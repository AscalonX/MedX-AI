#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
MedX launch film: original 60.0 s score and sound design.

Everything here is synthesized by this file. It uses numpy and the Python standard
library only, with no samples, loops or third-party audio. Output is deterministic:
every random source is a numpy Generator seeded from a fixed text tag (crc32), and
nothing reads the clock.

Reads ../storyboard.json for the bpm grid, the chord chart and the sfx cue list.
It renders five stems (drums, bass, keys, pads, fx) from per-instrument channels,
adds our own convolution reverb (synthesized stereo IRs) and an exact
frequency-domain ping-pong delay, and masters with a soft-knee, look-ahead,
true-peak limiter driven to a BS.1770 loudness target. The result is
audio/score.wav: 48 kHz, 16-bit, stereo, exactly 60.0 s (2,880,000 frames).

Usage
  python -I make_score.py [--lufs -14] [--ceiling -2.4] [--stems] [--out PATH]

Timeline (bar = 2.0 s at 120 bpm, D major opening in B minor)
  0-8    intro: room tone, Bm(add9) pad, felt-piano motif hanging on E4, glyph scatter,
         snap, count ticks, riser, total silence 7.75-8.0 (the launch breath)
  8-12   reveal: impact and D(add9) bloom, Fin pop, arc pings, logo bell, shimmer, whoosh
  12-28  journey groove: kick 1+3, clap 2+4, hats, 16th Karplus-Strong arp, sub bass
  28-32  safety dip: drums and arp out, pad low-passed 2 kHz to 400 Hz, one calm alert
  32-39  groove return, six check plucks, chorus lift at 36
  39-42  trace: kick and shaker, node blips, gate scan, short riser
  42-46  breakdown / trust: warm pad, sparse piano, 60 bpm heartbeat
  46-50  callback: motif returns, E4 resolves to D4 at 48.5, riser, gap 49.875-50.0
  50-54  final chorus (brightest)
  54-60  final impact, last bell at 56, ring-out to -60 dB by 59.8, digital silence to 60.0
"""
import argparse
import json
import math
import os
import re
import sys
import time
import wave
import zlib

import numpy as np
from numpy.lib.stride_tricks import sliding_window_view

SR = 48000
DUR = 60.0
N = int(round(DUR * SR))          # 2,880,000 output frames
NT = N + SR                       # one second of spill room, trimmed at the end
TWO_PI = 2.0 * np.pi
LN1000 = 6.907755278982137        # ln(1000): -60 dB

HERE = os.path.dirname(os.path.abspath(__file__))
PROMO = os.path.dirname(HERE)

# Silence windows: the launch breath before the reveal and the gap before the final chorus.
MUTES = [(7.75, 8.0), (49.875, 50.0)]
END_SILENCE = 59.8                # digital silence from here to 60.0
FADE_START = 57.9                 # master ring-out fade starts here (-60 dB at END_SILENCE)
# Wet effects (reverb, delay) are computed per segment so no tail crosses a silence window.
SEGMENTS = [(0.0, 7.75), (8.0, 49.875), (50.0, NT / SR)]

EVENTS = []                       # (t, kind, detail) log written to score-meta.json


def log_event(t, kind, detail=''):
    EVENTS.append({'t': round(float(t), 4), 'kind': kind, 'detail': detail})


# ----------------------------------------------------------------------------- helpers
def S(t):
    """seconds -> sample index"""
    return int(round(t * SR))


def rng(tag):
    return np.random.default_rng(zlib.crc32(tag.encode('utf-8')))


def next_pow2(n):
    return 1 << int(math.ceil(math.log2(max(2, n))))


def undb(d):
    return 10.0 ** (np.asarray(d, float) / 20.0)


def todb(x):
    return 20.0 * np.log10(np.maximum(np.abs(x), 1e-12))


def smoothstep(x):
    x = np.clip(x, 0.0, 1.0)
    return x * x * (3.0 - 2.0 * x)


def keys_interp(keys, t, log=False):
    ks = np.array([k[0] for k in keys], float)
    vs = np.array([k[1] for k in keys], float)
    if log:
        return np.exp(np.interp(t, ks, np.log(vs)))
    return np.interp(t, ks, vs)


_PC = {'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6,
       'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11}


def midi(name):
    m = re.fullmatch(r'([A-G][#b]?)(-?\d)', name.strip())
    if not m:
        raise ValueError('bad note ' + name)
    return 12 * (int(m.group(2)) + 1) + _PC[m.group(1)]


def hz(x):
    if isinstance(x, str):
        x = midi(x)
    return 440.0 * 2.0 ** ((x - 69) / 12.0)


def pan_gains(p):
    """-3 dB pan law, normalised so centre = (1, 1)."""
    th = (np.clip(p, -1.0, 1.0) + 1.0) * (np.pi / 4.0)
    return np.cos(th) * math.sqrt(2.0), np.sin(th) * math.sqrt(2.0)


# ----------------------------------------------------------------------------- filters
def lp_mag(f, fc, q=0.707, stages=1):
    x = np.asarray(f, float) / fc
    return (1.0 / np.sqrt((1.0 - x * x) ** 2 + (x / q) ** 2)) ** stages


def hp_mag(f, fc, q=0.707, stages=1):
    x = np.maximum(np.asarray(f, float), 1e-3) / fc
    return (x * x / np.sqrt((1.0 - x * x) ** 2 + (x / q) ** 2)) ** stages


def bp_mag(f, fc, q=1.0):
    x = np.maximum(np.asarray(f, float), 1e-3) / fc
    return 1.0 / np.sqrt(1.0 + (q * (x - 1.0 / x)) ** 2)


def fft_filter(x, mag, pad=None):
    """Zero-phase static filter: multiply the spectrum by mag(freqs)."""
    x = np.asarray(x, float)
    n = x.shape[-1]
    if pad is None:
        pad = min(16384, max(2048, n // 4))
    nfft = next_pow2(n + pad)
    X = np.fft.rfft(x, nfft, axis=-1)
    X *= mag(np.fft.rfftfreq(nfft, 1.0 / SR))
    return np.fft.irfft(X, nfft, axis=-1)[..., :n]


_WIN_CACHE = {}


def tv_filter(x, gain_fn, nfft=2048, hop=None):
    """Time-varying zero-phase filter by STFT (sqrt-Hann WOLA, 75 % overlap, perfect
    reconstruction when the gain is 1). gain_fn(freqs[1,bins], times[frames,1]) -> gains."""
    hop = hop or nfft // 4
    x = np.asarray(x, float)
    shp = x.shape
    x2 = x.reshape(-1, shp[-1])
    n = shp[-1]
    if nfft not in _WIN_CACHE:
        _WIN_CACHE[nfft] = np.sqrt(0.5 - 0.5 * np.cos(TWO_PI * np.arange(nfft) / nfft))
    win = _WIN_CACHE[nfft]
    pad = nfft
    nfr = int(math.ceil((n + 2 * pad - nfft) / hop)) + 1
    L = (nfr - 1) * hop + nfft
    freqs = np.fft.rfftfreq(nfft, 1.0 / SR)[None, :]
    times = (np.arange(nfr) * hop + nfft / 2.0 - pad) / SR
    out = np.zeros((x2.shape[0], L))
    chunk = 256
    for c in range(x2.shape[0]):
        xp = np.zeros(L)
        xp[pad:pad + n] = x2[c]
        frames = sliding_window_view(xp, nfft)[::hop]
        for a in range(0, nfr, chunk):
            b = min(nfr, a + chunk)
            G = gain_fn(freqs, times[a:b, None])
            spec = np.fft.rfft(frames[a:b] * win, axis=1) * G
            y = np.fft.irfft(spec, nfft, axis=1) * win
            for k in range(b - a):
                i = (a + k) * hop
                out[c, i:i + nfft] += y[k]
    out *= 2.0 * hop / nfft
    return out[:, pad:pad + n].reshape(shp)


def hp_causal(x, f0=20.0, q=0.707):
    """Causal 2nd-order high-pass (RBJ biquad) applied by its exact frequency response;
    used on the master as a DC / infrasonic blocker without pre-ringing."""
    n = x.shape[-1]
    nfft = next_pow2(n + SR)
    w0 = TWO_PI * f0 / SR
    al = math.sin(w0) / (2.0 * q)
    cw = math.cos(w0)
    b0, b1, b2 = (1.0 + cw) / 2.0, -(1.0 + cw), (1.0 + cw) / 2.0
    a0, a1, a2 = 1.0 + al, -2.0 * cw, 1.0 - al
    z1 = np.exp(-1j * TWO_PI * np.fft.rfftfreq(nfft, 1.0 / SR) / SR)
    H = (b0 + b1 * z1 + b2 * z1 * z1) / (a0 + a1 * z1 + a2 * z1 * z1)
    return np.fft.irfft(np.fft.rfft(x, nfft, axis=-1) * H, nfft, axis=-1)[..., :n]


def tv_segment(x, t0, t1, gain_fn, nfft=2048):
    """Apply tv_filter to x[:, t0:t1] only (gain must be 1 near both edges)."""
    i0, i1 = S(t0), min(x.shape[1], S(t1))
    y = x.copy()
    y[:, i0:i1] = tv_filter(x[:, i0:i1], lambda f, tm: gain_fn(f, tm + t0), nfft)
    return y


# ----------------------------------------------------------------------------- oscillators
def osc_phase(f, n, ph0=0.0):
    """radians; starts exactly at ph0"""
    f = np.broadcast_to(np.asarray(f, float), (n,))
    return ph0 + TWO_PI * (np.cumsum(f) - f) / SR


def saw(f, n, ph0=0.0):
    """polyBLEP band-limited sawtooth"""
    f = np.broadcast_to(np.asarray(f, float), (n,))
    dt = f / SR
    ph = (ph0 + np.cumsum(dt) - dt) % 1.0
    y = 2.0 * ph - 1.0
    m = ph < dt
    if m.any():
        u = ph[m] / dt[m]
        y[m] -= 2.0 * u - u * u - 1.0
    m = ph > 1.0 - dt
    if m.any():
        u = (ph[m] - 1.0) / dt[m]
        y[m] -= u * u + 2.0 * u + 1.0
    return y


def triangle(f, n, nharm=15):
    t = np.arange(n) / SR
    y = np.zeros(n)
    for k in range(1, 2 * nharm, 2):
        if k * f > SR * 0.45:
            break
        y += ((-1) ** ((k - 1) // 2)) * np.sin(TWO_PI * k * f * t) / (k * k)
    return y * (8.0 / np.pi ** 2)


# ----------------------------------------------------------------------------- instruments
def pad_note(f, dur, attack, release, tag, width=0.85, detune=7.0):
    """3 detuned polyBLEP saws (+/-7 cents) with slow drift, spread L/C/R."""
    n = S(dur + release)
    t = np.arange(n) / SR
    r = rng(tag)
    out = np.zeros((2, n))
    for i, (cents, p) in enumerate(((-detune, -width), (0.0, 0.0), (detune, width))):
        drift = 1.0 + 0.0008 * np.sin(TWO_PI * (0.11 + 0.04 * i) * t + r.uniform(0, TWO_PI))
        s = saw(f * 2.0 ** (cents / 1200.0) * drift, n, ph0=r.random())
        gl, gr = pan_gains(p)
        out[0] += gl * s
        out[1] += gr * s
    env = np.sin(0.5 * np.pi * np.clip(t / attack, 0.0, 1.0)) ** 2
    env *= np.cos(0.5 * np.pi * np.clip((t - dur) / release, 0.0, 1.0)) ** 2
    return out * env / 3.0


def piano_note(f, vel=0.6, t60=1.8, tag='pn'):
    """Felt piano: sine with light FM (ratio 2, index 0.6), 4 ms hammer noise, LP ~3 kHz."""
    n = S(t60 + 0.3)
    t = np.arange(n) / SR
    r = rng(tag)
    att = 1.0 - np.exp(-t / 0.0016)
    body = (0.5 * np.exp(-t / 0.14) + 0.5) * np.exp(-LN1000 * t / t60)
    index = 0.6 * (0.55 + 0.45 * vel) * np.exp(-t / 0.4) + 0.05
    out = np.empty((2, n))
    for c, cents in enumerate((-1.2, 1.2)):
        ph = TWO_PI * f * 2.0 ** (cents / 1200.0) * t + r.uniform(0, TWO_PI)
        s = np.sin(ph + index * np.sin(2.0 * ph))
        s += 0.14 * np.exp(-t / 0.5) * np.sin(2.0018 * ph)
        s += 0.045 * np.exp(-t / 0.28) * np.sin(3.006 * ph)
        out[c] = s
    out *= att * body
    hn = S(0.004)
    hammer = r.standard_normal(hn) * np.exp(-np.arange(hn) / (0.0012 * SR))
    out[:, :hn] += 0.35 * vel * hammer
    fc = 2000.0 + 1600.0 * vel
    out = fft_filter(out, lambda fr: lp_mag(fr, fc, 0.65))
    fade = S(0.01)
    out[:, -fade:] *= np.linspace(1.0, 0.0, fade)
    return out * vel


def fm_bell(f, t60=1.5, ratio=3.5, index=4.0, tag='bell'):
    """FM bell: carrier f, modulator ratio 3.5, index decaying from 4 towards 0."""
    n = S(t60 + 0.2)
    t = np.arange(n) / SR
    r = rng(tag)
    I = index * np.exp(-t / (0.18 * t60 + 0.05))
    amp = (1.0 - np.exp(-t / 0.0015)) * np.exp(-LN1000 * t / t60)
    out = np.empty((2, n))
    for c, cents in enumerate((-2.0, 2.0)):
        ph = TWO_PI * f * 2.0 ** (cents / 1200.0) * t
        out[c] = np.sin(ph + I * np.sin(ratio * ph + r.uniform(0, TWO_PI)))
        out[c] += 0.2 * np.exp(-t / (0.35 * t60)) * np.sin(2.0 * ph)
    fade = S(0.01)
    out[:, -fade:] *= np.linspace(1.0, 0.0, fade)
    return out * amp


def ks_pluck(f, dur=0.45, t60=0.75, bright=0.5, body=0.25, tag='ks'):
    """Karplus-Strong pluck, exact pitch: rendered at srp = (Np + 0.5) * f (2x oversampled,
    the +0.5 compensates the averaging filter's half-sample delay), then resampled to 48 kHz."""
    Np = int(round(2.0 * SR / f))
    srp = (Np + 0.5) * f
    n_out = S(dur)
    n_in = int(math.ceil(dur * srp)) + 4
    nblocks = n_in // Np + 2
    z = np.zeros(1 + nblocks * Np)
    r = rng(tag)
    ex = r.standard_normal(Np)
    E = np.fft.rfft(ex)
    E *= lp_mag(np.fft.rfftfreq(Np, 1.0 / srp), 1200.0 + 9000.0 * bright, 0.7)
    ex = np.fft.irfft(E, Np)
    ex -= ex.mean()
    ex /= np.max(np.abs(ex)) + 1e-12
    z[1:1 + Np] = ex
    g = 10.0 ** (-3.0 / (t60 * f))
    for b in range(1, nblocks):
        s = 1 + b * Np
        z[s:s + Np] = g * 0.5 * (z[s - Np:s] + z[s - Np - 1:s - 1])
    y = z[1:]
    out = np.interp(np.arange(n_out) * (srp / SR), np.arange(len(y)), y)
    t = np.arange(n_out) / SR
    out += body * np.sin(TWO_PI * f * t) * np.exp(-t / 0.18) * (1.0 - np.exp(-t / 0.002))
    fade = min(S(0.03), n_out)
    out[-fade:] *= np.linspace(1.0, 0.0, fade)
    return out


def glass_pluck(f, tag='glass'):
    n = S(1.4)
    t = np.arange(n) / SR
    y = np.zeros(n)
    for ratio, amp, tau in ((1.0, 1.0, 0.55), (2.32, 0.45, 0.22), (4.25, 0.25, 0.1), (6.63, 0.12, 0.05)):
        if ratio * f < SR * 0.45:
            y += amp * np.sin(TWO_PI * ratio * f * t) * np.exp(-t / tau)
    y *= 1.0 - np.exp(-t / 0.0008)
    return y


def mallet(f, tag='mallet'):
    n = S(1.0)
    t = np.arange(n) / SR
    y = np.sin(TWO_PI * f * t) * np.exp(-t / 0.32)
    y += 0.35 * np.sin(TWO_PI * 3.93 * f * t) * np.exp(-t / 0.07)
    if 9.2 * f < SR * 0.45:
        y += 0.1 * np.sin(TWO_PI * 9.2 * f * t) * np.exp(-t / 0.02)
    return y * (1.0 - np.exp(-t / 0.001))


def blip(f, dur=0.16, tau=0.05, h2=0.2, att=0.001):
    n = S(dur)
    t = np.arange(n) / SR
    y = np.sin(TWO_PI * f * t) + h2 * np.sin(2.0 * TWO_PI * f * t)
    y *= (1.0 - np.exp(-t / att)) * np.exp(-t / tau)
    fade = S(0.01)
    y[-fade:] *= np.linspace(1.0, 0.0, fade)
    return y


def tick(f, dur=0.03, tau=0.006):
    n = S(dur)
    t = np.arange(n) / SR
    y = np.sin(TWO_PI * f * t) * (1.0 - np.exp(-t / 0.0004)) * np.exp(-t / tau)
    y[-S(0.003):] *= np.linspace(1.0, 0.0, S(0.003))
    return y


def pop(f0, f1, dur=0.08, tag='pop'):
    n = S(dur + 0.04)
    t = np.arange(n) / SR
    f = f0 * (f1 / f0) ** np.clip(t / dur, 0.0, 1.0)
    y = np.sin(osc_phase(f, n)) + 0.15 * np.sin(2.0 * osc_phase(f, n))
    y *= (1.0 - np.exp(-t / 0.0012)) * np.exp(-t / (dur * 0.35))
    y[-S(0.005):] *= np.linspace(1.0, 0.0, S(0.005))
    return y


def noise_click(fc, dur=0.004, q=2.0, tag='click'):
    n = S(dur + 0.01)
    t = np.arange(n) / SR
    x = rng(tag).standard_normal(n) * np.exp(-t / (dur / 3.0))
    return fft_filter(x, lambda f: bp_mag(f, fc, q))


def whoosh(dur, f0, f1, peak=0.6, q=1.4, pan0=0.0, pan1=0.0, tag='wh', arch=False, curve=2.0):
    """Band-passed noise whose centre sweeps f0 -> f1 (or up and back down when arch)."""
    n = S(dur)
    t = np.arange(n) / SR
    nz = rng(tag).standard_normal((2, n))
    nz[1] = 0.6 * nz[0] + 0.8 * nz[1]

    def g(freqs, times):
        u = np.clip(times / dur, 0.0, 1.0)
        w = np.sin(np.pi * u) if arch else u
        return bp_mag(freqs, f0 * (f1 / f0) ** w, q)

    y = tv_filter(nz, g, nfft=1024)
    u = t / dur
    env = np.where(u < peak, (u / peak) ** curve, np.clip((1.0 - u) / (1.0 - peak), 0.0, 1.0) ** 1.5)
    y *= env
    gl, gr = pan_gains(pan0 + (pan1 - pan0) * u)
    y[0] *= gl
    y[1] *= gr
    return y / (np.max(np.abs(y)) + 1e-12)


def riser(dur, tag, fn=(400.0, 9000.0), glide=None, trem=(4.0, 16.0), lvl_db=30.0):
    n = S(dur)
    t = np.arange(n) / SR
    u = t / dur
    nz = rng(tag).standard_normal((2, n))
    nz[1] = 0.5 * nz[0] + 0.87 * nz[1]
    y = tv_filter(nz, lambda fr, tm: bp_mag(fr, fn[0] * (fn[1] / fn[0]) ** np.clip(tm / dur, 0.0, 1.0), 1.2), 1024)
    y /= np.max(np.abs(y)) + 1e-12
    lvl = undb(-lvl_db + lvl_db * u ** 1.6)
    rate = trem[0] + (trem[1] - trem[0]) * u
    tr = 1.0 - 0.4 * u * (0.5 + 0.5 * np.cos(TWO_PI * np.cumsum(rate) / SR))
    y *= lvl * tr
    if glide:
        fg = glide[0] * (glide[1] / glide[0]) ** (u ** 1.3)
        s = saw(fg, n) + 0.5 * saw(fg * 1.004, n, 0.37)
        s = fft_filter(s, lambda fr: lp_mag(fr, 2600.0, 0.8))
        s *= undb(-30.0 + 24.0 * u ** 1.5)
        y[0] += s
        y[1] += np.concatenate([np.zeros(S(0.006)), s[:-S(0.006)]])
    fade = S(0.005)
    y[:, -fade:] *= np.linspace(1.0, 0.0, fade)
    return y / (np.max(np.abs(y)) + 1e-12)


def impact(big=False, tag='impact'):
    """Sub drop 60 -> 40 Hz, body thump, noise burst and crack."""
    dur = 4.2 if big else 2.8
    n = S(dur)
    t = np.arange(n) / SR
    r = rng(tag)
    f = 40.0 + 20.0 * np.exp(-t / (0.55 if big else 0.4))
    sub = np.sin(osc_phase(f, n)) * (1.0 - np.exp(-t / 0.002)) * np.exp(-t / (1.15 if big else 0.75))
    sub = np.tanh(1.6 * sub) / np.tanh(1.6)
    fb = 70.0 + 50.0 * np.exp(-t / 0.03)
    boom = np.sin(osc_phase(fb, n)) * (1.0 - np.exp(-t / 0.001)) * np.exp(-t / 0.14)
    nz = r.standard_normal((2, n))
    nz[1] = 0.5 * nz[0] + 0.87 * nz[1]
    burst = fft_filter(nz * np.exp(-t / (0.38 if big else 0.26)), lambda fr: lp_mag(fr, 2400.0, 0.7) * hp_mag(fr, 90.0))
    crack = fft_filter(nz[::-1] * np.exp(-t / 0.012), lambda fr: hp_mag(fr, 2500.0, 0.7))
    out = np.zeros((2, n))
    out += (0.75 if big else 0.7) * sub + 0.6 * boom
    out += 0.62 * burst / (np.max(np.abs(burst)) + 1e-12)
    out += 0.3 * crack / (np.max(np.abs(crack)) + 1e-12)
    fade = S(0.05)
    out[:, -fade:] *= np.linspace(1.0, 0.0, fade)
    return out


def shimmer(dur, notes, tag, rise=0.5, reverse=False, air=0.06):
    n = S(dur)
    t = np.arange(n) / SR
    u = t / dur
    r = rng(tag)
    out = np.zeros((2, n))
    for i, nt in enumerate(notes):
        f = hz(nt)
        for c in range(2):
            fr = f * 2.0 ** (r.uniform(-6.0, 6.0) / 1200.0)
            trem = 1.0 + 0.35 * np.sin(TWO_PI * r.uniform(5.0, 9.0) * t + r.uniform(0, TWO_PI))
            out[c] += (0.82 ** i) * trem * np.sin(TWO_PI * fr * t + r.uniform(0, TWO_PI))
    nz = fft_filter(r.standard_normal((2, n)), lambda fr: hp_mag(fr, 7000.0, 0.7, 2))
    out += air * len(notes) * nz / (np.max(np.abs(nz)) + 1e-12)
    if reverse:
        env = (np.exp(4.0 * u) - 1.0) / (math.e ** 4 - 1.0)
        env *= 1.0 - smoothstep((u - 0.96) / 0.04)
    else:
        env = np.where(u < rise, np.sin(0.5 * np.pi * u / rise) ** 2, np.cos(0.5 * np.pi * (u - rise) / (1.0 - rise)) ** 2)
    out *= env
    return out / (np.max(np.abs(out)) + 1e-12)


def glyph_scatter(dur=0.8, tag='glyph'):
    """Granular dissolve drifting right, HP noise sweep, reverse shimmer."""
    n = S(dur + 0.35)
    out = np.zeros((2, n))
    r = rng(tag)
    pent = ['B5', 'D6', 'E6', 'F#6', 'A6', 'B6', 'D7']
    for k in range(150):
        u = r.random() ** 1.6
        t0 = u * dur
        gl_s = r.uniform(0.006, 0.022)
        m = S(gl_s)
        tt = np.arange(m) / SR
        w = np.sin(np.pi * tt / gl_s) ** 2
        if r.random() < 0.65:
            fc = r.uniform(2500.0, 9000.0)
            g = fft_filter(r.standard_normal(m), lambda f: bp_mag(f, fc, 2.0), pad=1024)
            g /= np.max(np.abs(g)) + 1e-12
        else:
            g = np.sin(TWO_PI * hz(pent[int(r.integers(len(pent)))]) * tt)
        amp = (1.0 - u) ** 1.2 * r.uniform(0.4, 1.0)
        gl, gr = pan_gains(float(np.clip(0.1 + 0.8 * u + r.normal(0.0, 0.2), -1.0, 1.0)))
        i0 = S(t0)
        out[0, i0:i0 + m] += amp * gl * g * w
        out[1, i0:i0 + m] += amp * gr * g * w
    hs = rng(tag + 'hp').standard_normal((2, S(dur)))
    hs = tv_filter(hs, lambda f, tm: hp_mag(f, 800.0 * (9000.0 / 800.0) ** np.clip(tm / dur, 0.0, 1.0), 0.8, 2), 1024)
    tt = np.arange(S(dur)) / SR
    hs *= np.exp(-tt / 0.28) * (1.0 - np.exp(-tt / 0.01))
    gl, gr = pan_gains(0.1 + 0.6 * tt / dur)
    out[0, :S(dur)] += 0.5 * gl * hs[0] / (np.max(np.abs(hs)) + 1e-12)
    out[1, :S(dur)] += 0.5 * gr * hs[1] / (np.max(np.abs(hs)) + 1e-12)
    rv = shimmer(0.55, ['B5', 'F#6', 'C#7'], tag + 'rev', reverse=True)
    out[:, :rv.shape[1]] += 0.35 * rv
    return out / (np.max(np.abs(out)) + 1e-12)


# ----------------------------------------------------------------------------- drum kit
def kick_sample():
    """Sine pitch drop 120 -> 45 Hz, about 180 ms, plus beater click, soft saturation."""
    n = S(0.30)
    t = np.arange(n) / SR
    f = 45.0 + 75.0 * np.exp(-t / 0.028)
    body = np.sin(osc_phase(f, n))
    amp = (1.0 - np.exp(-t / 0.0007)) * np.exp(-t / 0.075) * (1.0 - smoothstep((t - 0.17) / 0.12))
    click = fft_filter(rng('kick-click').standard_normal(n) * np.exp(-t / 0.0025), lambda fr: bp_mag(fr, 3500.0, 0.9))
    click *= 0.35 / (np.max(np.abs(click)) + 1e-12)
    beater = 0.22 * np.sin(TWO_PI * 1700.0 * t) * np.exp(-t / 0.0035)
    y = body * amp + click + beater
    return np.tanh(2.0 * y) / np.tanh(2.0)


def clap_sample(tag='clap'):
    """Three band-passed noise bursts at 1.2 kHz, 8 ms apart, plus a short tail."""
    n = S(0.4)
    t = np.arange(n) / SR
    nz = rng(tag).standard_normal((2, n))
    nz[1] = 0.7 * nz[0] + 0.71 * nz[1]
    nz = fft_filter(nz, lambda f: bp_mag(f, 1200.0, 1.1) + 0.3 * hp_mag(f, 4500.0, 0.7))
    env = np.zeros(n)
    for k in range(3):
        tk = 0.008 * k
        env += (t >= tk) * np.exp(-np.maximum(t - tk, 0.0) / 0.0032) * (0.8 + 0.1 * k)
    env += 0.55 * (t >= 0.016) * np.exp(-np.maximum(t - 0.016, 0.0) / 0.075)
    y = nz * env
    return y / (np.max(np.abs(y)) + 1e-12)


def hat_sample(open_=False, tag='hat'):
    dur = 0.5 if open_ else 0.09
    n = S(dur)
    t = np.arange(n) / SR
    r = rng(tag)
    metal = sum(np.sign(np.sin(TWO_PI * f * t + r.uniform(0, TWO_PI))) for f in (205.3, 304.4, 369.6, 522.7, 540.0, 800.0)) / 6.0
    x = 0.55 * metal + 0.6 * r.standard_normal(n)
    x = fft_filter(x, lambda f: hp_mag(f, 7000.0, 0.8, 2) * lp_mag(f, 15000.0, 0.7))
    tau = 0.11 if open_ else 0.016
    env = (1.0 - np.exp(-t / 0.0004)) * np.exp(-t / tau)
    if open_:
        env *= 1.0 - smoothstep((t - 0.12) / 0.2)
    y = x * env
    y[-S(0.004):] *= np.linspace(1.0, 0.0, S(0.004))
    return y / (np.max(np.abs(y)) + 1e-12)


def shaker_sample(tag='shaker'):
    n = S(0.12)
    t = np.arange(n) / SR
    x = fft_filter(rng(tag).standard_normal(n), lambda f: hp_mag(f, 6000.0, 0.7, 2))
    env = smoothstep(t / 0.006) * np.exp(-t / 0.028)
    y = x * env
    y[-S(0.004):] *= np.linspace(1.0, 0.0, S(0.004))
    return y / (np.max(np.abs(y)) + 1e-12)


def crash_sample(tag='crash'):
    n = S(3.0)
    t = np.arange(n) / SR
    r = rng(tag)
    out = np.zeros((2, n))
    for c in range(2):
        metal = sum(np.sign(np.sin(TWO_PI * f * t + r.uniform(0, TWO_PI))) for f in (293.0, 377.0, 431.0, 587.0, 742.0, 1013.0)) / 6.0
        x = 0.4 * metal + r.standard_normal(n)
        out[c] = fft_filter(x, lambda f: hp_mag(f, 4500.0, 0.7, 2) * lp_mag(f, 14000.0, 0.7))
    out *= (1.0 - np.exp(-t / 0.002)) * np.exp(-t / 0.8)
    out[:, -S(0.05):] *= np.linspace(1.0, 0.0, S(0.05))
    return out / (np.max(np.abs(out)) + 1e-12)


def heartbeat_thump():
    n = S(0.35)
    t = np.arange(n) / SR
    f = 45.0 + 18.0 * np.exp(-t / 0.03)
    y = np.sin(osc_phase(f, n)) * (1.0 - np.exp(-t / 0.003)) * np.exp(-t / 0.085)
    y = np.tanh(2.0 * y) / np.tanh(2.0)
    y[-S(0.01):] *= np.linspace(1.0, 0.0, S(0.01))
    return y


def midbass_note(f, tag):
    n = S(0.3)
    t = np.arange(n) / SR
    s = saw(f, n, rng(tag).random()) + 0.6 * np.sin(TWO_PI * f * t)
    s = fft_filter(s, lambda fr: lp_mag(fr, 750.0, 1.0))
    s *= (1.0 - np.exp(-t / 0.002)) * np.exp(-t / 0.085)
    s[-S(0.01):] *= np.linspace(1.0, 0.0, S(0.01))
    return s


# ----------------------------------------------------------------------------- channels
STEMS = ('drums', 'bass', 'keys', 'pads', 'fx')


class Channel:
    def __init__(self, stem, hall=0.0, plate=0.0, delay=0.0, chain=()):
        self.stem = stem
        self.sends = {'hall': hall, 'plate': plate, 'delay': delay}
        self.chain = list(chain)
        self.buf = np.zeros((2, NT))
        self.events = 0


CHANNELS = {}
WARNINGS = []


def place(name, t, sig, gain=1.0, pan=0.0):
    """Add a mono or stereo signal into a channel at time t. Events that run into a silence
    window are cut at its start (6 ms fade), so nothing rings across the launch breath."""
    c = CHANNELS[name]
    sig = np.asarray(sig, float)
    if sig.ndim == 1:
        gl, gr = pan_gains(pan)
        st = np.stack([sig * gl, sig * gr])
    else:
        st = sig.copy()
    i0 = S(t)
    for a, b in MUTES:
        ia, ib = S(a), S(b)
        if ia <= i0 < ib:
            WARNINGS.append(f'{name} event at {t:.3f}s starts inside silence {a}-{b}; skipped')
            return
        if i0 < ia < i0 + st.shape[1]:
            cut = ia - i0
            fade = min(S(0.006), cut)
            st = st[:, :cut].copy()
            st[:, cut - fade:] *= np.linspace(1.0, 0.0, fade)
    i1 = min(NT, i0 + st.shape[1])
    if i1 <= i0:
        return
    c.buf[:, i0:i1] += gain * st[:, :i1 - i0]
    c.events += 1


# ----------------------------------------------------------------------------- harmony
VOICING = {
    'Bm(add9)': dict(root='B1', pad=['F#3', 'B3', 'C#4', 'D4', 'F#4'], arp=['B4', 'D5', 'F#5', 'C#6']),
    'Bm':       dict(root='B1', pad=['F#3', 'B3', 'D4', 'F#4'], arp=['B4', 'D5', 'F#5', 'A5']),
    'Gmaj7':    dict(root='G1', pad=['G3', 'B3', 'D4', 'F#4'], arp=['G4', 'B4', 'D5', 'F#5']),
    'G':        dict(root='G1', pad=['G3', 'B3', 'D4', 'G4'], arp=['G4', 'B4', 'D5', 'E5']),
    'A(sus4)':  dict(root='A1', pad=['A3', 'D4', 'E4', 'A4'], arp=['A4', 'D5', 'E5', 'F#5']),
    'A':        dict(root='A1', pad=['A3', 'C#4', 'E4', 'A4'], arp=['A4', 'C#5', 'E5', 'F#5']),
    'A/C#':     dict(root='C#2', pad=['A3', 'C#4', 'E4', 'A4'], arp=['A4', 'C#5', 'E5', 'F#5']),
    'D':        dict(root='D2', pad=['A3', 'D4', 'F#4', 'A4'], arp=['D5', 'F#5', 'A5', 'B5']),
    'D(add9)':  dict(root='D2', pad=['D3', 'A3', 'D4', 'E4', 'F#4'], arp=['D5', 'F#5', 'A5', 'E6']),
}
CHORD_RE = re.compile(r'Bm\(add9\)|D\(add9\)|A\(sus4\)|Gmaj7|A/C#|Bm|G|A|D')
SECTION_TABLE = [('intro', 0, 8), ('reveal', 8, 12), ('groove', 12, 28), ('dip', 28, 32),
                 ('return', 32, 36), ('chorus', 36, 39), ('trace', 39, 42), ('break', 42, 46),
                 ('callback', 46, 50), ('final', 50, 54), ('outro', 54, 61)]


def section(t):
    for name, a, b in SECTION_TABLE:
        if a <= t < b:
            return name
    return 'outro'


def chord_timeline(sb):
    ch = sb['music']['chords']
    out = []
    for i, c in enumerate(ch):
        t0 = float(c['t'])
        t1 = float(ch[i + 1]['t']) if i + 1 < len(ch) else DUR
        syms = CHORD_RE.findall(c['chord'])
        if not syms:
            raise ValueError('cannot parse chord ' + c['chord'])
        step = (t1 - t0) / len(syms)
        for k, s in enumerate(syms):
            if s not in VOICING:
                raise ValueError('no voicing for ' + s)
            out.append((t0 + k * step, t0 + (k + 1) * step, s))
    return out


def chord_at(timeline, t):
    for a, b, s in timeline:
        if a <= t < b:
            return s
    return timeline[-1][2]


# ----------------------------------------------------------------------------- mix levels
LV = {
    'pad': 0.33, 'piano': 0.62, 'arp': 0.38, 'bell': 0.30, 'pluck': 0.34,
    'kick': 0.85, 'clap': 0.5, 'hat': 0.105, 'shaker': 0.07, 'crash': 0.075, 'heart': 0.55,
    'sub': 0.22, 'midbass': 0.17,
}
BEAT = 0.5
BAR = 2.0
KICKS = []


def bars(t0, t1):
    return [round(b, 6) for b in np.arange(t0, t1 - 1e-9, BAR)]


def arrange_drums():
    kick = kick_sample()
    claps = [clap_sample('clap%d' % i) for i in range(3)]
    hats = [hat_sample(False, 'hat%d' % i) for i in range(4)]
    ohat = hat_sample(True, 'ohat')
    shk = [shaker_sample('shk%d' % i) for i in range(3)]
    crash = crash_sample()
    r = rng('groove-human')

    kt = []
    for b in bars(12, 28):
        kt += [b, b + 1.0]
    for b in bars(32, 36):
        kt += [b, b + 1.0]
    kt += [36.0, 36.75, 37.0, 38.0, 38.75]
    kt += [39.0, 40.0, 41.0]
    for b in bars(50, 54):
        kt += [b, b + 0.75, b + 1.0]
    for t in kt:
        v = 0.86 if (t % 1.0) > 0.01 else 1.0
        place('kick', t, kick, LV['kick'] * v)
    KICKS.extend(kt)
    log_event(12.0, 'music', 'groove starts: kick 1+3, clap 2+4, hats, arp, sub')

    ct = []
    for b in bars(12, 28):
        ct += [(b + 0.5, 1.0), (b + 1.5, 1.0)]
    ct += [(22.0, 0.75)]                      # confirm accent "on the clap"
    for b in bars(32, 39):
        for o in (0.5, 1.5):
            if b + o < 39.0:
                ct.append((b + o, 1.0))
    ct += [(35.75, 0.45), (35.875, 0.6)]      # little roll into the chorus
    for b in bars(50, 54):
        ct += [(b + 0.5, 1.0), (b + 1.5, 1.0)]
    for i, (t, v) in enumerate(ct):
        place('clap', t, claps[i % 3], LV['clap'] * v, pan=0.0)

    def hat_row(t0, t1, mode, vel_fn=None):
        k = 0
        for t in np.arange(t0, t1 - 1e-9, 0.125):
            t = round(float(t), 4)
            pos = int(round((t % 0.5) / 0.125))      # 0..3 within the beat
            if mode == '8off':
                if pos != 2:
                    continue
                v = 0.8
            else:
                v = {0: 0.55, 1: 0.42, 2: 0.85, 3: 0.45}[pos]
            if vel_fn:
                v *= vel_fn(t)
            v *= 1.0 + r.uniform(-0.06, 0.06)
            if mode == 'open' and pos == 2:
                place('hat', t, ohat, LV['hat'] * 0.85 * v, pan=0.18)
            else:
                place('hat', t, hats[k % 4], LV['hat'] * v, pan=0.18)
            k += 1

    hat_row(12.0, 20.0, '8off')
    hat_row(20.0, 27.9, '16')
    hat_row(30.0, 32.0, '16', lambda t: 0.12 + 0.88 * ((t - 30.0) / 2.0) ** 1.5)   # hats creep back
    hat_row(32.0, 36.0, '16')
    hat_row(36.0, 39.0, 'open')
    hat_row(50.0, 54.0, 'open')

    def shaker_row(t0, t1, gain):
        for i, t in enumerate(np.arange(t0, t1 - 1e-9, 0.125)):
            pos = i % 4
            v = {0: 0.6, 1: 0.45, 2: 1.0, 3: 0.5}[pos] * (1.0 + r.uniform(-0.1, 0.1))
            jit = r.uniform(-0.006, 0.006)
            place('perc', max(t0, float(t) + jit), shk[i % 3], LV['shaker'] * gain * v, pan=-0.3)

    shaker_row(39.0, 42.0, 1.0)
    shaker_row(50.0, 54.0, 0.6)

    for t, v in ((12.0, 0.55), (32.0, 0.5), (36.0, 0.85), (50.0, 0.9)):
        place('crash', t, crash, LV['crash'] * v)
        log_event(t, 'music', 'crash')

    hb = heartbeat_thump()
    for t in (42.0, 43.0, 44.0, 45.0):
        place('kick', t, hb, LV['heart'])
        place('kick', t + 0.22, hb, LV['heart'] * 0.7)
    log_event(42.0, 'music', 'breakdown: 60 bpm heartbeat (45 Hz double thump)')


PAD_STYLE = {
    'intro': (1.8, 1.6, 1.0, False), 'reveal': (0.7, 1.6, 1.1, False), 'groove': (0.8, 1.0, 0.8, False),
    'dip': (0.6, 1.6, 0.95, False), 'return': (0.8, 1.0, 0.8, False), 'chorus': (0.45, 1.0, 0.9, True),
    'trace': (0.8, 1.0, 0.8, False), 'break': (1.0, 1.6, 1.0, False), 'callback': (1.0, 1.4, 0.95, False),
    'final': (0.35, 1.0, 0.95, True), 'outro': (0.03, 4.5, 1.05, True),
}


def arrange_pads(tl):
    for (t0, t1, sym) in tl:
        attack, release, gain, octave = PAD_STYLE[section(t0)]
        dur = t1 - t0
        if t0 == 0.0:
            attack = 2.6
        if abs(t0 - 8.0) < 1e-6:
            attack = 0.25                      # the D(add9) bloom
        if section(t0) == 'outro':
            dur = 1.5
        notes = VOICING[sym]['pad']
        g = LV['pad'] * gain / math.sqrt(len(notes))
        for nt in notes:
            place('pad', t0, pad_note(hz(nt), dur, attack, release, 'pad-%.3f-%s' % (t0, nt)), g)
            if octave:
                place('pad', t0, pad_note(2.0 * hz(nt), dur, attack, release, 'pado-%.3f-%s' % (t0, nt), width=1.0), g * 0.3)


PAD_CUTOFF = [
    (0.0, 700), (2.0, 1000), (4.0, 1200), (6.0, 1400), (7.75, 3400), (7.76, 700),
    (8.0, 650), (9.6, 2400), (11.0, 2200), (11.95, 2700), (12.0, 2000),
    (27.5, 2000), (28.0, 1500), (28.6, 400), (30.0, 400), (32.0, 2100),
    (35.99, 2100), (36.0, 3200), (38.99, 3000), (39.0, 2000), (41.99, 2100),
    (42.0, 1200), (45.0, 1250), (46.0, 1700), (48.0, 1500), (49.875, 2600),
    (50.0, 3600), (53.99, 3600), (54.0, 3000), (61.0, 900),
]


def pad_filter(x):
    def g(freqs, times):
        fc = keys_interp(PAD_CUTOFF, times, log=True)
        fc = fc * 2.0 ** (0.22 * np.sin(TWO_PI * 0.09 * times))     # slow evolution
        return lp_mag(freqs, fc, 0.8, 2)
    return tv_filter(x, g, 2048)


def chorus(x, base=0.011, depth=0.0025, rate=0.33, mix=0.35):
    n = x.shape[1]
    t = np.arange(n) / SR
    idx = np.arange(n, dtype=float)
    out = np.empty_like(x)
    for c, ph in ((0, 0.0), (1, np.pi)):
        d = (base + depth * np.sin(TWO_PI * rate * t + ph)) * SR
        out[c] = (1.0 - mix) * x[c] + mix * np.interp(idx - d, idx, x[c], left=0.0)
    return out


def duck_curve(times, depth_db, release=0.14):
    e = np.zeros(NT)
    att = S(0.004)
    L = S(release * 6)
    k = np.concatenate([smoothstep(np.arange(att) / att), np.exp(-np.arange(L) / (release * SR))])
    for tk in times:
        i = max(0, S(tk) - att)
        j = min(NT, i + len(k))
        e[i:j] = np.maximum(e[i:j], k[:j - i])
    return 1.0 - (1.0 - undb(-depth_db)) * e


def duck(depth_db, release=0.14):
    return lambda x: x * duck_curve(KICKS, depth_db, release)[None, :]


def groove_close(x):
    """27.5 s: the low-pass starts closing on the groove, fully shut at the 28.0 bar line."""
    def g(freqs, times):
        fc = np.exp(np.interp(times, [27.5, 28.0], [math.log(18000.0), math.log(600.0)]))
        gg = lp_mag(freqs, fc, 0.75, 2)
        return np.where(times < 27.5, 1.0, gg)
    return tv_segment(x, 27.0, 29.0, g)


def arrange_arp(tl):
    r = rng('arp-human')

    def level(t):
        sec = section(t)
        if sec == 'groove':
            return 0.8 + 0.2 * min(1.0, (t - 12.0) / 4.0)
        return {'return': 0.95, 'chorus': 1.1, 'final': 1.15}[sec]

    def bright(t):
        return {'groove': 0.45, 'return': 0.5, 'chorus': 0.72, 'final': 0.85}[section(t)]

    steps = []
    for (a, b) in ((12.0, 27.95), (32.0, 39.0), (50.0, 54.0)):
        steps += [round(float(t), 4) for t in np.arange(a, b - 1e-9, 0.125)]
    for i, t in enumerate(steps):
        s16 = int(round((t % BAR) / 0.125))
        sym = chord_at(tl, t)
        tones = VOICING[sym]['arp']
        note = midi(tones[[0, 2, 3, 1][s16 % 4]])
        sec = section(t)
        if sec in ('chorus', 'final') and s16 in (6, 14):
            note += 12
        v = 1.0 if s16 % 4 == 0 else (0.78 if s16 % 2 == 0 else 0.62)
        v *= 1.0 + r.uniform(-0.05, 0.05)
        pan = -0.35 if i % 2 == 0 else 0.35
        sig = ks_pluck(hz(note), dur=0.42, t60=0.75, bright=bright(t), body=0.22, tag='arp-%d' % i)
        place('arp', t, sig, LV['arp'] * v * level(t), pan)
        if sec == 'final' or (sec == 'chorus' and s16 % 4 == 0):
            sig2 = ks_pluck(hz(note + 12), dur=0.3, t60=0.5, bright=0.9, body=0.0, tag='arpo-%d' % i)
            place('arp', t, sig2, LV['arp'] * v * 0.3 * level(t), -pan)


SUB_KEYS = [
    (0.0, 0.0), (3.0, 0.0), (3.7, 0.22), (4.0, 0.18), (4.45, 0.0),
    (6.0, 0.0), (6.3, 0.2), (7.72, 0.42), (7.75, 0.0),
    (8.0, 0.0), (8.7, 0.0), (9.6, 0.55), (11.6, 0.5), (11.98, 0.45), (12.0, 1.0),
    (27.5, 1.0), (28.0, 0.5), (29.9, 0.45), (31.98, 0.8), (32.0, 1.0),
    (39.0, 1.0), (41.9, 0.85), (42.0, 0.0),
    (46.0, 0.0), (46.6, 0.35), (49.0, 0.45), (49.86, 0.6), (49.875, 0.0),
    (50.0, 0.0), (50.01, 1.0), (53.99, 1.0), (54.0, 0.0),
    (54.5, 0.0), (55.2, 0.3), (58.5, 0.0), (61.0, 0.0),
]


def arrange_bass(tl):
    f = np.zeros(NT)
    for (t0, t1, sym) in tl:
        f[S(t0):S(t1)] = hz(VOICING[sym]['root'])
    f[S(tl[-1][1]):] = hz(VOICING[tl[-1][2]]['root'])
    k = S(0.015)
    cs = np.concatenate([[0.0], np.cumsum(np.concatenate([np.full(k - 1, f[0]), f]))])
    fs = (cs[k:] - cs[:-k]) / k
    t = np.arange(NT) / SR
    amp = keys_interp(SUB_KEYS, t)
    ph = osc_phase(fs, NT)
    y = amp * (np.sin(ph) + 0.4 * np.sin(2.0 * ph + 0.3))
    y = np.tanh(1.8 * y) / 1.8 * LV['sub']
    CHANNELS['sub'].buf += np.stack([y, y])
    CHANNELS['sub'].events += 1
    log_event(3.0, 'music', 'faint sub swell')

    # mid-bass offbeat plucks for lift (octave above the root)
    for (a, b, g) in ((20.0, 27.5, 0.6), (32.0, 36.0, 0.75), (36.0, 39.0, 1.0), (50.0, 54.0, 1.1)):
        for i, tt in enumerate(np.arange(a + 0.25, b - 1e-9, 0.5)):
            tt = round(float(tt), 4)
            root = 2.0 * hz(VOICING[chord_at(tl, tt)]['root'])
            if root < 90.0:
                root *= 2.0
            place('midbass', tt, midbass_note(root, 'mb-%.3f' % tt), LV['midbass'] * g)


PIANO = [
    # hook motif: hangs on E4 (the question)
    (0.5, ['B3'], 0.55, 2.6), (1.0, ['D4'], 0.55, 2.6), (1.5, ['F#4'], 0.6, 2.6), (2.0, ['E4'], 0.62, 6.0),
    # reveal bloom D-F#-A-E
    (8.0, ['D2', 'D3'], 0.45, 4.0), (8.0, ['D4'], 0.5, 4.0), (8.03, ['F#4'], 0.5, 4.0),
    (8.06, ['A4'], 0.5, 4.0), (8.09, ['E5'], 0.48, 4.0),
    (9.5, ['A3', 'C#4', 'E4'], 0.28, 2.5),        # with the logo landing (fix round 2: was 10.0)
    # counter-melody D-E-F#-A from 24.0
    (24.0, ['D5'], 0.5, 1.8), (24.5, ['E5'], 0.45, 1.8), (25.0, ['F#5'], 0.5, 1.8),
    (26.0, ['A5'], 0.5, 1.8), (26.75, ['G5'], 0.38, 1.6), (27.0, ['F#5'], 0.42, 1.6),
    # chorus stabs and line
    (36.0, ['D4', 'F#4', 'A4'], 0.4, 1.8), (37.0, ['F#5'], 0.38, 1.6), (37.5, ['E5'], 0.34, 1.6),
    (38.0, ['C#4', 'E4', 'A4'], 0.38, 1.8), (38.5, ['E5'], 0.32, 1.6),
    # breakdown: sparse and warm
    (42.0, ['G2', 'D3'], 0.36, 3.5), (42.0, ['B4'], 0.4, 2.6), (43.0, ['D5'], 0.38, 2.4), (43.5, ['B4'], 0.3, 2.2),
    (44.0, ['B2', 'F#3'], 0.35, 3.0), (44.0, ['D5'], 0.38, 2.4), (45.0, ['A2', 'E3'], 0.35, 3.0),
    (45.0, ['E5'], 0.38, 2.4), (45.5, ['D5'], 0.32, 2.2),
    # callback: same motif, then the answer
    (46.0, ['G2', 'D3'], 0.3, 3.0), (46.5, ['B3'], 0.55, 2.6), (47.0, ['D4'], 0.55, 2.6), (47.5, ['F#4'], 0.6, 2.6),
    (48.0, ['E4'], 0.6, 2.4), (48.0, ['D3', 'A3'], 0.38, 3.0),
    (48.5, ['D4'], 0.72, 4.5), (48.5, ['D2', 'A2'], 0.36, 4.0), (48.52, ['D5'], 0.3, 3.5),
    # final chorus
    (50.0, ['D4', 'F#4', 'A4', 'D5'], 0.45, 1.8), (52.0, ['C#4', 'E4', 'A4'], 0.42, 1.8),
]


def arrange_keys():
    for (t, notes, vel, t60) in PIANO:
        for k, nt in enumerate(notes):
            m = midi(nt)
            pan = float(np.clip((m - 62) / 30.0, -0.4, 0.4))
            place('piano', t, piano_note(hz(nt), vel, t60, 'pn-%.3f-%s' % (t, nt)), LV['piano'], pan)
    log_event(0.5, 'music', 'motif B3-D4-F#4, E4 hangs at 2.0')
    log_event(24.0, 'music', 'piano counter-melody D-E-F#-A')
    log_event(48.5, 'music', 'motif resolves E4 -> D4 (understood)')
    # final D(add9) chord with the last impact (rolled)
    for k, nt in enumerate(['D2', 'A2', 'D3', 'F#3', 'A3', 'E4', 'F#4', 'D5']):
        place('piano', 54.0 + 0.012 * k, piano_note(hz(nt), 0.55, 5.0, 'pnend-%s' % nt), LV['piano'] * 0.9,
              float(np.clip((midi(nt) - 62) / 30.0, -0.4, 0.4)))
    log_event(54.0, 'music', 'final impact, D(add9) ring-out, groove stops')


# ----------------------------------------------------------------------------- sfx
def _num(pat, s, default=None, cast=float):
    m = re.search(pat, s or '')
    return cast(m.group(1)) if m else default


PENT = ['D5', 'E5', 'F#5', 'A5', 'B5', 'D6', 'E6', 'F#6']


def sfx_dispatch(e, counters):
    t = float(e['t'])
    ty = e['type']
    note = e.get('note', '') or ''
    ci = counters.get(ty, 0)
    counters[ty] = ci + 1

    if ty == 'roomtone':
        n = S(3.2)
        tt = np.arange(n) / SR
        x = rng('room').standard_normal((2, n + 4096))
        x = fft_filter(x, lambda f: (1.0 / np.sqrt(np.maximum(f, 20.0) / 20.0)) * lp_mag(f, 800.0, 0.7))[:, :n]
        x /= np.sqrt(np.mean(x ** 2)) + 1e-12
        env = smoothstep(tt / 0.4) * (1.0 - smoothstep((tt - 1.6) / 1.4))
        place('room', t, x * env, undb(-38.0))
        detail = 'pink noise LP 800 Hz, -38 dBFS RMS, gone by 3.0'
    elif ty == 'glyphScatter':
        place('fxwet', t, glyph_scatter(0.8), 0.32)
        detail = 'granular dissolve drifting right, HP sweep, reverse shimmer'
    elif ty == 'snap':
        tt = np.arange(S(0.2)) / SR
        thump = np.sin(TWO_PI * 70.0 * tt) * np.exp(-tt / 0.06) * (1.0 - np.exp(-tt / 0.001))
        clk = noise_click(3200.0, 0.003, 1.5, 'snap')
        clk /= np.max(np.abs(clk)) + 1e-12
        place('fxdry', t, clk, 0.32)
        place('fxdry', t, thump, 0.4)
        detail = 'filtered click + 70 Hz thump'
    elif ty == 'subPulse':
        tt = np.arange(S(0.8)) / SR
        y = np.sin(TWO_PI * hz('B1') * tt) * smoothstep(tt / 0.02) * np.exp(-tt / 0.22)
        y = np.tanh(2.0 * y) / np.tanh(2.0)
        place('impact', t, y, 0.22)
        detail = 'B1 sub pulse'
    elif ty == 'tickRoll':
        t_end = _num(r'to ([\d.]+)', note, 5.6)
        cnt = _num(r'(\d+) ticks', note, 16, int)
        f0 = _num(r'([\d.]+) to [\d.]+ kHz', note, 1.8) * 1000.0
        f1 = _num(r'[\d.]+ to ([\d.]+) kHz', note, 2.6) * 1000.0
        for k in range(cnt):
            u = k / max(1, cnt - 1)
            place('fxdry', t + u * (t_end - t), tick(f0 * (f1 / f0) ** u, 0.03, 0.007), 0.09 * (0.75 + 0.25 * u))
        detail = '%d ticks %.0f-%.0f Hz to %.2f' % (cnt, f0, f1, t_end)
    elif ty == 'riser':
        t_end = _num(r'to ([\d.]+)', note, t + 1.0)
        dur = t_end - t
        if dur > 1.5:
            sig = riser(dur, 'riser-%d' % ci, (400.0, 9000.0), glide=(hz('A2'), hz('A4')))
            g = 0.36
        elif t > 45.0:
            sig = riser(dur, 'riser-%d' % ci, (500.0, 8000.0), glide=(hz('D3'), hz('D5')), trem=(8.0, 24.0))
            g = 0.32
        else:
            sig = riser(dur, 'riser-%d' % ci, (600.0, 6000.0), glide=None, trem=(6.0, 12.0), lvl_db=24.0)
            sig[:, -S(0.03):] *= np.linspace(1.0, 0.0, S(0.03))
            g = 0.2
        place('fx', t, sig, g)
        detail = 'riser to %.3f' % t_end
    elif ty == 'impact':
        big = 'final' in note or t > 50.0
        place('impact', t, impact(big, 'impact-%d' % ci), 0.64 if big else 0.66)
        if big:
            place('fx', t, whoosh(0.6, 6500.0, 900.0, peak=0.12, q=1.0, tag='lockup-in'), 0.14)
            place('crash', t, crash_sample('crash-final'), LV['crash'] * 1.1)
        detail = 'final impact + lockup whoosh-in' if big else 'sub drop 60->40 Hz + noise burst'
    elif ty == 'bubblePop':
        if t < 20:
            place('fxdry', t, pop(300.0, 600.0, 0.08), 0.22, pan=-0.15)
            detail = 'sine 300->600 Hz, 80 ms'
        else:                                   # over the final chorus: an octave-ish higher so it reads at a lower level
            place('fxdry', t, pop(450.0, 900.0, 0.08), 0.42, pan=-0.3)
            detail = 'sine 450->900 Hz, 80 ms (Fin entrance)'
    elif ty == 'arcPing':
        f = hz(['F#5', 'A5'][ci % 2])
        place('bell', t, blip(f, 0.9, 0.22, 0.12, 0.002), 0.16, pan=0.2)
        detail = 'soft arc ping'
    elif ty == 'logoBell':
        f = _num(r'(\d+) Hz', note, 880.0)
        place('bell', t, fm_bell(f, 3.0, 3.5, 4.0, 'logo-bell'), 0.34)
        place('fx', t - 0.15, whoosh(0.55, 4000.0, 9000.0, peak=0.35, q=0.8, tag='air'), 0.08)
        detail = 'FM bell %.0f Hz + air whoosh' % f
    elif ty == 'shimmer':
        place('fxwet', t, shimmer(0.8, ['D6', 'A6', 'E7', 'F#6'], 'shim-%d' % ci), 0.2 if t < 50 else 0.28)
        detail = 'high cluster swell'
    elif ty == 'whoosh':
        f0 = _num(r'(\d+) to \d+ Hz', note, 300.0)
        f1 = _num(r'\d+ to (\d+) Hz', note, 6000.0)
        dur = _num(r'([\d.]+) s', note, 0.5)
        place('fx', t, whoosh(dur, f0, f1, peak=0.85, q=1.2, pan0=-0.2, pan1=0.2, tag='whoosh-%d' % ci), 0.4 if t < 50 else 0.55)
        detail = 'band-passed noise %.0f->%.0f Hz, %.2f s' % (f0, f1, dur)
    elif ty == 'nodeBlip':
        m = re.search(r'per node:\s*([\d.,\s]+)', note)
        if m:
            times = [float(v) for v in re.findall(r'[\d.]+', m.group(1))]
        else:
            cnt = _num(r'x(\d+)', note, 6, int)
            step = _num(r'every ([\d.]+) s', note, 0.25)
            times = [t + k * step for k in range(cnt)]
        for k, tk in enumerate(times):
            place('pluck', tk, blip(hz(PENT[k % len(PENT)]), 0.18, 0.05, 0.25), 0.3, pan=-0.4 + 0.8 * k / max(1, len(times) - 1))
        detail = 'node blips at ' + ', '.join('%.2f' % v for v in times)
    elif ty == 'langChime':
        if 'glass' in note:
            place('pluck', t, glass_pluck(hz('E6')), 0.2, pan=-0.45)
            detail = 'glass pluck E6 (left phone)'
        elif 'mallet' in note:
            place('pluck', t, mallet(hz('C#6')), 0.24, pan=0.0)
            detail = 'mallet C#6 (centre phone)'
        else:
            place('bell', t, fm_bell(hz('A5'), 1.5, 3.5, 3.0, 'lang-bell'), 0.17, pan=0.45)
            place('pluck', t + 0.06, blip(hz('E6'), 0.25, 0.06, 0.1), 0.08)
            place('pluck', t + 0.31, blip(hz('E6'), 0.25, 0.06, 0.1), 0.06)
            detail = 'FM bell A5 (right phone) + read-aloud ping'
    elif ty == 'highlightSwish':
        place('fx', t, whoosh(0.45, 2500.0, 5000.0, peak=0.5, q=2.5, pan0=-0.5, pan1=0.5, tag='hl'), 0.4)
        detail = 'highlighter swish L->R'
    elif ty == 'sendPop':
        place('fxdry', t, pop(400.0, 800.0, 0.07), 0.45)
        place('fx', t, whoosh(0.6, 1500.0, 9000.0, peak=0.3, q=0.9, tag='send-air'), 0.2)
        detail = 'pop + airy upward whoosh'
    elif ty == 'whipWhoosh':
        place('fx', t, whoosh(0.34, 500.0, 5000.0, peak=0.45, q=1.3, pan0=0.7, pan1=-0.7, tag='whip', arch=True), 0.62)
        detail = 'whip R->L'
    elif ty == 'linkChirp':
        n_cl = 22
        for k in range(n_cl):
            u = (k / n_cl) ** 0.7
            c = noise_click(3500.0, 0.0015, 2.0, 'zip-%d-%d' % (ci, k))
            c /= np.max(np.abs(c)) + 1e-12
            place('fxdry', t + 0.2 * u, c, 0.08 + 0.08 * u, pan=-0.3 + 0.6 * u)
        place('pluck', t + 0.2, blip(hz('G6'), 0.12, 0.035, 0.1), 0.28, pan=0.3)
        place('pluck', t + 0.27, blip(hz('C7'), 0.14, 0.04, 0.1), 0.28, pan=0.3)
        detail = 'thread zip + G6->C7 chirp'
    elif ty == 'confirmPop':
        tt = np.arange(S(0.1)) / SR
        y = (np.sin(TWO_PI * 880.0 * tt) + 0.7 * np.sin(TWO_PI * 1320.0 * tt)) * (1.0 - np.exp(-tt / 0.001)) * np.exp(-tt / 0.025)
        place('fxdry', t, y, 0.45)
        place('bell', t, fm_bell(hz('D6'), 1.0, 2.0, 1.5, 'third-a'), 0.12, pan=-0.2)
        place('bell', t, fm_bell(hz('F#6'), 1.0, 2.0, 1.5, 'third-b'), 0.1, pan=0.2)
        detail = '880+1320 Hz pop, major-third chime D6+F#6'
    elif ty == 'pressClick':
        c = noise_click(4000.0, 0.005, 1.5, 'press')
        c /= np.max(np.abs(c)) + 1e-12
        place('fxdry', t, c, 0.4)
        place('fxdry', t, tick(1200.0, 0.03, 0.008), 0.3)
        detail = 'press click'
    elif ty == 'pillWhoosh':
        place('fx', t, whoosh(0.3, 3000.0, 900.0, peak=0.4, q=1.4, pan0=0.2, pan1=-0.1, tag='pill'), 0.35)
        detail = 'short downward whoosh'
    elif ty == 'signatureStamp':
        place('fx', t, whoosh(0.3, 2500.0, 4500.0, peak=0.4, q=2.2, pan0=-0.25, pan1=0.25, tag='pen', arch=True), 0.14)
        tt = np.arange(S(0.3)) / SR
        thud = np.sin(osc_phase(200.0 + 40.0 * np.exp(-tt / 0.02), len(tt))) * (1.0 - np.exp(-tt / 0.001)) * np.exp(-tt / 0.09)
        place('fxdry', t + 0.12, thud, 0.35)
        place('fxdry', t + 0.28, pop(700.0, 1050.0, 0.06), 0.18)
        detail = 'pen swish + 220 Hz thud + check pop'
    elif ty == 'calmAlert':
        dur = _num(r'([\d.]+) s', note, 0.6)
        n = S(dur + 0.4)
        tt = np.arange(n) / SR
        env_a = smoothstep(tt / 0.03) * np.cos(0.5 * np.pi * np.clip((tt - (dur - 0.12)) / 0.36, 0.0, 1.0)) ** 2
        tb = np.maximum(tt - 0.14, 0.0)
        env_b = (tt >= 0.14) * smoothstep(tb / 0.03) * np.cos(0.5 * np.pi * np.clip((tt - (dur - 0.12)) / 0.36, 0.0, 1.0)) ** 2
        y = triangle(hz('B2'), n) * env_a + 0.85 * np.concatenate([np.zeros(S(0.14)), triangle(hz('F#3'), n - S(0.14))]) * env_b
        y = fft_filter(y, lambda f: lp_mag(f, 2200.0, 0.7))
        place('fxdry', t, y, 0.15)   # -2 dB: keeps the alert about 3 dB under the -14 LUFS groove
        detail = 'B2 + F#3 triangle, %.1f s, calm (no siren)' % dur
    elif ty == 'uiTick':
        place('fxdry', t, tick(2400.0, 0.03, 0.006), 0.3)
        if 'whoosh' in note:
            place('fx', t, whoosh(0.4, 1200.0, 6000.0, peak=0.35, q=1.0, pan0=0.0, pan1=0.4, tag='tick-send'), 0.18)
        detail = '2.4 kHz, 30 ms' + (' + soft send whoosh' if 'whoosh' in note else '')
    elif ty == 'sealClick':
        c = noise_click(1800.0, 0.006, 6.0, 'wood')
        c /= np.max(np.abs(c)) + 1e-12
        tt = np.arange(S(0.2)) / SR
        place('fxdry', t, c * 0.6 + np.concatenate([np.sin(TWO_PI * 950.0 * tt[:len(c)]) * np.exp(-tt[:len(c)] / 0.008), np.zeros(0)]), 0.5)
        place('pluck', t, blip(1320.0, 0.2, 0.07, 0.05), 0.2)
        detail = 'wood tick + 1320 Hz'
    elif ty == 'checkPluck':
        m = re.search(r'([A-G][#b]?\d)', note)
        nt = m.group(1) if m else PENT[ci % len(PENT)]
        sig = ks_pluck(hz(nt), dur=0.7, t60=1.0, bright=0.8, body=0.3, tag='check-%d' % ci)
        place('pluck', t, sig, 0.45 * (0.8 + 0.04 * ci), pan=-0.4 + 0.16 * ci)
        detail = 'KS pluck ' + nt
    elif ty == 'confirmChord':
        for k, nt in enumerate(('D5', 'F#5', 'A5')):
            place('pluck', t + 0.018 * k, ks_pluck(hz(nt), 0.9, 1.2, 0.6, 0.3, 'cc-%s' % nt), 0.18, pan=-0.3 + 0.3 * k)
        place('bell', t, fm_bell(hz('D6'), 1.2, 2.0, 1.2, 'cc-bell'), 0.09)
        detail = 'D major confirm chord'
    elif ty == 'counterChime':
        decay = _num(r'([\d.]+) s decay', note, 1.2)
        place('bell', t, fm_bell(hz('D6'), decay, 3.5, 3.5, 'counter-a'), 0.2, pan=-0.15)
        place('bell', t + 0.25, fm_bell(hz('A5'), decay, 3.5, 3.5, 'counter-b'), 0.2, pan=0.15)
        detail = 'FM bell D6 -> A5, %.1f s decay' % decay
    elif ty == 'railShimmer':
        place('fxwet', t, shimmer(0.9, ['D6', 'F#6', 'A6', 'D7'], 'rail', rise=0.35), 0.3)
        for k, nt in enumerate(('D6', 'F#6', 'A6', 'D7')):
            place('pluck', t + 0.04 * k, blip(hz(nt), 0.4, 0.09, 0.05), 0.15, pan=-0.45 + 0.3 * k)
        detail = 'rail-complete shimmer'
    elif ty == 'gateScan':
        t_end = _num(r'to ([\d.]+)', note, t + 0.75)
        dur = t_end - t
        sig = whoosh(dur, 500.0, 6000.0, peak=0.97, q=1.2, pan0=-0.5, pan1=0.5, tag='gate', curve=1.2)
        tt = np.arange(sig.shape[1]) / SR
        sig *= 0.75 + 0.25 * np.cos(TWO_PI * 12.0 * tt)
        place('fx', t, sig, 0.6)
        detail = 'filtered noise sweep up to %.2f' % t_end
    elif ty == 'gatePass':
        place('bell', t, fm_bell(hz('A5'), 1.2, 2.0, 2.0, 'gate-a'), 0.12, pan=-0.1)
        place('bell', t, fm_bell(hz('E6'), 1.2, 2.0, 2.0, 'gate-b'), 0.09, pan=0.1)
        detail = 'gate pass chime A5+E6'
    elif ty == 'softTick':
        place('fxdry', t, tick(1500.0, 0.04, 0.008), 0.6)
        lv = _num(r'(-?\d+) dB', note, None)
        stp = _num(r'every ([\d.]+) s', note, None)
        t_end = _num(r'to ([\d.]+)', note, None)
        detail = 'soft tick'
        if stp and t_end:
            g = undb(lv) if lv is not None else 0.06
            for k, tk in enumerate(np.arange(t + stp, t_end + 1e-6, stp)):
                place('fxdry', float(tk), tick(1800.0, 0.025, 0.005), g, pan=0.15 if k % 2 else -0.15)
            detail += ' + ledger ticks every %.2f s to %.2f at %.0f dB' % (stp, t_end, lv if lv is not None else -24)
    elif ty == 'reverseLock':
        place('fxwet', t, shimmer(0.5, ['B5', 'D6', 'F#6'], 'revlock', reverse=True), 0.35)
        c = noise_click(2200.0, 0.004, 3.0, 'lock')
        c /= np.max(np.abs(c)) + 1e-12
        place('fxdry', t + 0.5, c, 0.15)
        detail = 'reverse shimmer, lock tick at %.2f' % (t + 0.5)
    elif ty == 'typingTicks':
        t_end = _num(r'to ([\d.]+)', note, t + 0.8)
        cnt = 19                                   # medx.areazeroai.com
        r = rng('typing')
        for k in range(cnt):
            tk = t + (t_end - t) * k / cnt + r.uniform(-0.006, 0.006)
            c = noise_click(3200.0, 0.003, 3.0, 'type-%d' % k)
            c /= np.max(np.abs(c)) + 1e-12
            place('fxdry', tk, c, 0.12 * r.uniform(0.7, 1.0), pan=r.uniform(-0.2, 0.2))
        detail = '%d typing ticks to %.2f' % (cnt, t_end)
    elif ty == 'glint':
        place('bell', t, fm_bell(hz('E7'), 0.5, 1.41, 1.5, 'glint'), 0.18, pan=0.35)
        place('fxwet', t, shimmer(0.4, ['A6', 'D7', 'E7'], 'glint-sh', rise=0.2), 0.12)
        detail = 'QR glint'
    elif ty == 'bell':
        place('bell', t, fm_bell(hz('D6'), 3.2, 3.5, 4.0, 'last-bell'), 0.3)
        place('bell', t, fm_bell(hz('A5'), 2.8, 3.5, 2.5, 'last-bell-b'), 0.12, pan=0.2)
        detail = 'last bell D6 + A5'
    else:
        WARNINGS.append('unknown sfx type %s at %.2f; skipped' % (ty, t))
        return
    log_event(t, 'sfx:' + ty, detail)


# ----------------------------------------------------------------------------- effects
def make_ir(name, length, t60_keys, predelay, hp=150.0, lp=9000.0):
    n = S(length)
    r = rng('ir-' + name)
    noise = r.standard_normal((2, n))
    lf = np.log([k[0] for k in t60_keys])
    lt = np.log([k[1] for k in t60_keys])

    def g(freqs, times):
        T = np.exp(np.interp(np.log(np.maximum(freqs, 20.0)), lf, lt))
        return np.exp(-LN1000 * np.maximum(times, 0.0) / T) * hp_mag(freqs, hp, 0.7) * lp_mag(freqs, lp, 0.7)

    ir = tv_filter(noise, g, nfft=1024)
    t = np.arange(n) / SR
    ir *= smoothstep(t / 0.012)
    er = np.zeros((2, n))
    for k in range(10):
        tt = 0.004 + 0.07 * (k + r.random()) / 10.0
        i = S(tt)
        amp = math.exp(-tt / 0.05) * (0.6 + 0.4 * r.random()) * (1 if r.random() > 0.5 else -1)
        er[k % 2, i] += amp
        er[1 - k % 2, i + S(0.0007)] += 0.5 * amp
    er = fft_filter(er, lambda f: lp_mag(f, 6000.0, 0.7) * hp_mag(f, 200.0, 0.7))
    er *= math.sqrt(0.3 * np.sum(ir ** 2) / (np.sum(er ** 2) + 1e-12))
    ir = ir + er
    pre = S(predelay)
    ir = np.concatenate([np.zeros((2, pre)), ir], axis=1)[:, :n]
    ir /= np.sqrt(np.sum(ir ** 2, axis=1, keepdims=True))
    return ir


class ConvReverb:
    def __init__(self, ir):
        self.ir = ir
        self.cache = {}

    def __call__(self, x):
        n = len(x)
        nfft = next_pow2(n + self.ir.shape[1])
        if nfft not in self.cache:
            self.cache[nfft] = np.fft.rfft(self.ir, nfft, axis=1)
        X = np.fft.rfft(x, nfft)
        return np.fft.irfft(self.cache[nfft] * X[None, :], nfft, axis=1)[:, :n]


def pingpong(delay_s, fb, lp=5000.0, hp=250.0):
    """Exact ping-pong feedback delay solved in the frequency domain:
    L = E X / (1 - fb^2 E^2), R = fb E L, with E = filter * e^{-jwD}."""
    D = delay_s * SR

    def fn(x):
        n = len(x)
        tail = int(D * (3.0 / -math.log10(fb) + 2.0))
        nfft = next_pow2(n + tail)
        X = np.fft.rfft(x, nfft)
        f = np.fft.rfftfreq(nfft, 1.0 / SR)
        E = lp_mag(f, lp, 0.6) * hp_mag(f, hp, 0.6) * np.exp(-1j * TWO_PI * f * D / SR)
        YL = E * X / (1.0 - (fb * E) ** 2)
        YR = fb * E * YL
        return np.fft.irfft(np.stack([YL, YR]), nfft, axis=1)[:, :n]
    return fn


def seg_apply(send, fn):
    out = np.zeros((2, NT))
    fade = S(0.008)
    for a, b in SEGMENTS:
        ia, ib = S(a), min(NT, S(b))
        seg = send[ia:ib]
        if not np.any(seg):
            continue
        w = fn(seg)
        if ib < NT:
            w[:, -fade:] *= np.linspace(1.0, 0.0, fade)
        out[:, ia:ib] += w
    return out


def mute_mask(n):
    m = np.ones(n)
    f = S(0.006)
    for a, b in MUTES:
        ia, ib = S(a), S(b)
        m[ia - f:ia] *= np.linspace(1.0, 0.0, f)
        m[ia:ib] = 0.0
    return m


# ----------------------------------------------------------------------------- metering
def k_weight(x):
    n = x.shape[-1]
    nfft = next_pow2(n + SR)
    X = np.fft.rfft(x, nfft, axis=-1)
    w = TWO_PI * np.fft.rfftfreq(nfft, 1.0 / SR) / SR
    z1 = np.exp(-1j * w)
    z2 = z1 * z1
    H1 = (1.53512485958697 - 2.69169618940638 * z1 + 1.19839281085285 * z2) / (1.0 - 1.69065929318241 * z1 + 0.73248077421585 * z2)
    H2 = (1.0 - 2.0 * z1 + z2) / (1.0 - 1.99004745483398 * z1 + 0.99007225036621 * z2)
    return np.fft.irfft(X * H1 * H2, nfft, axis=-1)[..., :n]


def block_loudness(y, B, H):
    p = np.sum(y * y, axis=0)
    cs = np.concatenate([[0.0], np.cumsum(p)])
    st = np.arange(0, len(p) - B + 1, H)
    z = (cs[st + B] - cs[st]) / B
    return st, z


def integrated_lufs(x):
    """BS.1770-4 integrated loudness (400 ms blocks, 75 % overlap, -70 / -10 LU gates)."""
    y = k_weight(x)
    _, z = block_loudness(y, S(0.4), S(0.1))
    lk = -0.691 + 10.0 * np.log10(np.maximum(z, 1e-20))
    z1 = z[lk > -70.0]
    if not len(z1):
        return -np.inf
    rel = -0.691 + 10.0 * np.log10(z1.mean()) - 10.0
    z2 = z[(lk > -70.0) & (lk > rel)]
    return float(-0.691 + 10.0 * np.log10(z2.mean()))


def window_lufs(x, t0, t1):
    y = k_weight(x[:, S(t0):S(t1)])
    z = np.mean(np.sum(y * y, axis=0))
    return float(-0.691 + 10.0 * np.log10(max(z, 1e-20)))


def short_term_max(x):
    y = k_weight(x)
    _, z = block_loudness(y, S(3.0), S(0.1))
    return float(-0.691 + 10.0 * np.log10(np.max(z)))


def true_peak_env(x, os_=4):
    """Per-sample max |x| over 4x-oversampled (FFT band-limited) reconstruction."""
    n = x.shape[-1]
    env = np.zeros(n)
    for c in range(x.shape[0]):
        X = np.fft.rfft(x[c])
        Xu = np.zeros(n * os_ // 2 + 1, complex)
        Xu[:len(X)] = X
        xu = np.fft.irfft(Xu, n * os_) * os_
        env = np.maximum(env, np.abs(xu).reshape(n, os_).max(axis=1))
        del xu, Xu
    return env


# ----------------------------------------------------------------------------- limiter
def limiter_gain(env, ceiling_db, knee_db=2.0, look=0.002, release=0.08, block=16):
    """Soft-knee look-ahead limiter gain. Guarantees gain[n] <= required gain at every peak:
    backward min over the look-ahead window, release smoothing that only slows recovery,
    then a forward box average of the same length (attack ramp)."""
    n = len(env)
    over = todb(env) - ceiling_db
    k = knee_db
    g_db = np.where(over <= -k / 2, 0.0, np.where(over >= k / 2, -over, -((over + k / 2) ** 2) / (2 * k)))
    gd = undb(g_db)
    L = S(look)
    m = sliding_window_view(np.concatenate([np.ones(L - 1), gd]), L).min(axis=1)
    nb = int(math.ceil(n / block))
    mp = np.concatenate([m, np.ones(nb * block - n)])
    mb = mp.reshape(nb, block).min(axis=1)
    a = math.exp(-block / (release * SR))
    rb = np.empty(nb)
    r = 1.0
    for j in range(nb):
        v = mb[j]
        r = v if v < r else v + (r - v) * a
        rb[j] = r
    rf = np.repeat(rb, block)[:n]
    cs = np.concatenate([[0.0], np.cumsum(np.concatenate([rf, np.full(L - 1, rf[-1])]))])
    return (cs[L:L + n] - cs[:n]) / L


# ----------------------------------------------------------------------------- output
def write_wav16(path, x, silent):
    r = rng('tpdf-dither')
    d = r.random(x.shape) - r.random(x.shape)
    q = np.clip(np.round(x * 32767.0 + d), -32768, 32767).astype('<i2')
    q[:, silent] = 0
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with wave.open(path, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(q.T.reshape(-1).tobytes())
    return q.astype(float) / 32767.0


def build_channels():
    CHANNELS.clear()
    groove = groove_close
    CHANNELS['pad'] = Channel('pads', hall=0.32, chain=[pad_filter, chorus, duck(2.0)])
    CHANNELS['piano'] = Channel('keys', hall=0.34, delay=0.05)
    CHANNELS['arp'] = Channel('keys', hall=0.12, delay=0.30, chain=[duck(1.0), groove])
    CHANNELS['bell'] = Channel('fx', hall=0.45, delay=0.14)
    CHANNELS['pluck'] = Channel('fx', hall=0.3, delay=0.2)
    CHANNELS['kick'] = Channel('drums', plate=0.03, chain=[groove])
    CHANNELS['clap'] = Channel('drums', hall=0.08, plate=0.26, chain=[groove])
    CHANNELS['hat'] = Channel('drums', plate=0.06, chain=[groove])
    CHANNELS['perc'] = Channel('drums', hall=0.08, plate=0.1)
    CHANNELS['crash'] = Channel('drums', hall=0.15)
    CHANNELS['sub'] = Channel('bass', chain=[duck(5.0)])
    CHANNELS['midbass'] = Channel('bass', hall=0.03, chain=[duck(3.0), groove])
    CHANNELS['fx'] = Channel('fx', hall=0.22)
    CHANNELS['fxdry'] = Channel('fx', hall=0.1, plate=0.12)
    CHANNELS['fxwet'] = Channel('fx', hall=0.5, delay=0.2)
    CHANNELS['impact'] = Channel('fx', hall=0.32)
    CHANNELS['room'] = Channel('fx')


def check_storyboard(sb):
    g = sb.get('grid', {})
    if abs(float(g.get('bpm', 120)) - 120.0) > 1e-6:
        WARNINGS.append('storyboard bpm is %s; this arrangement is written for 120' % g.get('bpm'))
    if abs(float(sb.get('duration', 60)) - DUR) > 1e-6:
        WARNINGS.append('storyboard duration differs from 60.0')
    froms = sorted(float(s['from']) for s in sb['music']['structure'])
    mine = {a for _, a, _ in SECTION_TABLE}
    for f in froms:
        if f not in mine:
            WARNINGS.append('storyboard section boundary %.2f not in the arrangement' % f)
    cues = {round(float(c['t']), 3) for c in sb['music']['cues']}
    for a, _ in MUTES:
        if round(a, 3) not in cues:
            WARNINGS.append('silence at %.3f not found in storyboard cues' % a)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[1])
    ap.add_argument('--storyboard', default=os.path.join(PROMO, 'storyboard.json'))
    ap.add_argument('--out', default=os.path.join(HERE, 'score.wav'))
    ap.add_argument('--lufs', type=float, default=-14.0, help='integrated loudness target (LUFS), storyboard spec -14')
    ap.add_argument('--ceiling', type=float, default=-2.4,
                    help='true-peak ceiling (dBTP) of the WAV. The AAC 256k encode overshoots by 0.7-1.5 dB on this dense master '
                         '(measured: -1.5 -> -0.1, -2.0 -> -0.5, -2.4 -> -1.7 dBTP), so -2.4 keeps the MP4 at or below the -1.0 dBTP spec')
    ap.add_argument('--stems', action='store_true', help='also write audio/stems/<stem>.wav (pre-limiter, same gain)')
    args = ap.parse_args()
    t_start = time.time()

    with open(args.storyboard, encoding='utf-8') as f:
        sb = json.load(f)
    check_storyboard(sb)
    tl = chord_timeline(sb)
    build_channels()

    arrange_drums()                      # fills KICKS first (sidechain source)
    arrange_pads(tl)
    arrange_arp(tl)
    arrange_bass(tl)
    arrange_keys()
    counters = {}
    for e in sorted(sb['sfx'], key=lambda e: float(e['t'])):
        sfx_dispatch(e, counters)
    print('[score] arranged %d events in %.1f s' % (sum(c.events for c in CHANNELS.values()), time.time() - t_start))

    hall = ConvReverb(make_ir('hall', 3.4, [(80, 2.6), (300, 2.4), (1500, 2.1), (5000, 1.5), (10000, 0.9), (20000, 0.5)], 0.022))
    plate = ConvReverb(make_ir('plate', 1.4, [(80, 0.9), (1000, 1.0), (6000, 0.8), (16000, 0.5)], 0.008, hp=250.0, lp=11000.0))
    delay = pingpong(0.375, 0.38)        # dotted eighth at 120 bpm
    fxs = {'hall': hall, 'plate': plate, 'delay': delay}

    gate = mute_mask(NT)
    stems = {s: np.zeros((2, NT)) for s in STEMS}
    sends = {s: {k: np.zeros(NT) for k in fxs} for s in STEMS}
    for name, c in CHANNELS.items():
        x = c.buf
        for fn in c.chain:
            x = fn(x)
        x = x * gate
        stems[c.stem] += x
        mono = 0.5 * (x[0] + x[1])
        for k, v in c.sends.items():
            if v:
                sends[c.stem][k] += v * mono
        c.buf = None
    for s in STEMS:
        for k, fn in fxs.items():
            if np.any(sends[s][k]):
                stems[s] += seg_apply(sends[s][k], fn)
        sends[s] = None
    side_w = {'pads': 1.2, 'keys': 1.1}
    for s, w in side_w.items():
        M = 0.5 * (stems[s][0] + stems[s][1])
        D = 0.5 * (stems[s][0] - stems[s][1]) * w
        stems[s] = np.stack([M + D, M - D])
    print('[score] stems + effects in %.1f s' % (time.time() - t_start))

    mix = sum(stems[s] for s in STEMS)[:, :N]
    M = 0.5 * (mix[0] + mix[1])
    D = fft_filter(0.5 * (mix[0] - mix[1]), lambda f: hp_mag(f, 110.0, 0.7, 2))   # mono below ~110 Hz
    mix = hp_causal(np.stack([M + D, M - D]), 20.0)                              # DC / infrasonic blocker
    t = np.arange(N) / SR
    u = np.clip((t - FADE_START) / (END_SILENCE - FADE_START), 0.0, 1.0)
    mask = mute_mask(N) * undb(-60.0 * u * u)
    mask[S(END_SILENCE):] = 0.0
    mix *= mask

    # loudness normalisation + true-peak limiting (iterate gain until on target)
    env = true_peak_env(mix)
    pre_lufs = integrated_lufs(mix)
    G = args.lufs - pre_lufs
    ceiling = args.ceiling
    for it in range(8):
        g = limiter_gain(env * undb(G), ceiling)
        y = mix * (undb(G) * g)[None, :]
        L = integrated_lufs(y)
        if abs(L - args.lufs) < 0.02:
            break
        G += args.lufs - L
    tp = float(todb(true_peak_env(y).max()))
    if tp > args.ceiling + 0.01:
        ceiling = args.ceiling - (tp - args.ceiling) - 0.02
        for it in range(6):
            g = limiter_gain(env * undb(G), ceiling)
            y = mix * (undb(G) * g)[None, :]
            L = integrated_lufs(y)
            if abs(L - args.lufs) < 0.02:
                break
            G += args.lufs - L
    max_gr = float(-todb(g.min()))
    gr_at = float(np.argmin(g) / SR)
    gr_over1 = float(100.0 * np.mean(g < undb(-1.0)))
    y *= mask
    silent = mask == 0.0
    yq = write_wav16(args.out, y, silent)
    print('[score] mastered + written in %.1f s' % (time.time() - t_start))

    # ---- verification on the written 16-bit data
    with wave.open(args.out, 'rb') as w:
        frames, rate, chans, width = w.getnframes(), w.getframerate(), w.getnchannels(), w.getsampwidth()
    I = integrated_lufs(yq)
    TP = float(todb(true_peak_env(yq).max()))
    SP = float(todb(np.abs(yq).max()))
    tail_rms = float(todb(np.sqrt(np.mean(yq[:, S(59.7):S(59.8)] ** 2)) + 1e-12))
    dc = [round(float(todb(abs(yq[c].mean()) + 1e-12)), 1) for c in range(2)]
    tail_curve = {('%.1f-%.1f' % (a, b)): round(float(todb(np.sqrt(np.mean(yq[:, S(a):S(b)] ** 2)) + 1e-12)), 1)
                  for a, b in ((54.0, 55.0), (55.0, 56.0), (56.0, 57.0), (57.0, 58.0), (58.0, 59.0), (59.0, 59.5), (59.5, 59.8))}
    zeros = {('%.3f-%.3f' % (a, b)): bool(np.all(yq[:, S(a):S(b)] == 0.0)) for a, b in MUTES + [(END_SILENCE, DUR)]}
    sec = []
    for name, a, b in SECTION_TABLE:
        b = min(b, 60.0)
        sec.append({'section': name, 'from': a, 'to': b, 'lufs': round(window_lufs(yq, a, b), 2)})
    groove_l = window_lufs(yq, 12.0, 27.5)
    alert_l = window_lufs(yq, 28.6, 29.2)
    meta = {
        'file': os.path.relpath(args.out, PROMO).replace('\\', '/'),
        'generator': 'audio/make_score.py (numpy %s, deterministic)' % np.__version__,
        'sampleRate': rate, 'channels': chans, 'bitDepth': 8 * width, 'frames': frames,
        'durationSec': frames / rate, 'bpm': 120, 'key': sb['music'].get('key'),
        'targetLufs': args.lufs, 'ceilingDbtp': args.ceiling,
        'measured': {
            'integratedLufs': round(I, 2), 'truePeakDbtp': round(TP, 2), 'samplePeakDbfs': round(SP, 2),
            'shortTermMaxLufs': round(short_term_max(yq), 2), 'preMasterLufs': round(pre_lufs, 2),
            'masterGainDb': round(float(G), 2), 'limiterMaxGrDb': round(max_gr, 2), 'limiterMaxGrAtSec': round(gr_at, 3),
            'limiterTimeOver1dbGrPct': round(gr_over1, 2),
            'tail59_7to59_8Dbfs': round(tail_rms, 1), 'tailRmsDbfs': tail_curve, 'dcOffsetDbfs': dc,
            'digitalSilence': zeros,
            'groove12to27_5Lufs': round(groove_l, 2), 'alert28_6to29_2Lufs': round(alert_l, 2),
        },
        'sections': sec, 'events': sorted(EVENTS, key=lambda e: e['t']), 'warnings': WARNINGS,
    }
    with open(os.path.join(os.path.dirname(args.out), 'score-meta.json'), 'w', encoding='utf-8') as f:
        json.dump(meta, f, indent=1, ensure_ascii=False)

    if args.stems:
        sd = os.path.join(os.path.dirname(args.out), 'stems')
        for s in STEMS:
            st = stems[s][:, :N] * mask * undb(G)
            write_wav16(os.path.join(sd, s + '.wav'), np.clip(st, -1.0, 1.0), silent)

    print('[score] %s  %d frames @ %d Hz x%d ch, %d-bit = %.4f s' % (args.out, frames, rate, chans, 8 * width, frames / rate))
    print('[score] integrated %.2f LUFS (target %.1f), true peak %.2f dBTP, sample peak %.2f dBFS, limiter max GR %.2f dB'
          % (I, args.lufs, TP, SP, max_gr))
    print('[score] groove %.2f LUFS, calm alert window %.2f LUFS (%.1f dB under), tail 59.7-59.8 %.1f dBFS, silence %s'
          % (groove_l, alert_l, groove_l - alert_l, tail_rms, zeros))
    for s_ in sec:
        print('   %-9s %5.1f-%5.1f  %6.2f LUFS' % (s_['section'], s_['from'], s_['to'], s_['lufs']))
    for w_ in WARNINGS:
        print('[warn] ' + w_)
    print('[score] done in %.1f s' % (time.time() - t_start))


if __name__ == '__main__':
    main()
