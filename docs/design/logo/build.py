"""MedX logo system generator. Run from repo root:  python3 docs/design/logo/build.py
Writes SVGs to docs/design/logo/ (and apps/web/app/icon.svg). PNG exports: docs/design/logo/export.sh.
Mark: "Echo X" -- a medical plus turned into an X; its fourth arm becomes two sound/echo arcs radiating
from the centre (listening + medicine; echolocation = Fin the dolphin). Pure vector, no font dependency:
the "Med" letters are SCBXBeta2 Bold outlines converted to paths at build time.
"""
import math
import os
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
OUT = os.path.join(ROOT, "docs/design/logo")
FONT = os.path.join(ROOT, "apps/web/app/fonts/SCBXBeta2-Bold.otf")

TEAL, OCEAN, INK, WHITE = "#0A8077", "#1A5FC4", "#0F1E2E", "#FFFFFF"

# ---------- mark geometry (64x64 grid, centre 32,32) ----------
C = 32.0
ARM = 18.0  # centre to arm end (before round cap)
BAR = 11.0  # bar stroke width
ARC = 7.0  # echo arc stroke width
# visual bounding box of the mark (bars with round caps + outer arc), grid units
BX0, BY0, BX1, BY1 = 8.5, 4.8, 59.2, 55.5
BCX, BCY = (BX0 + BX1) / 2, (BY0 + BY1) / 2
BW, BH = BX1 - BX0, BY1 - BY0


def arc(r, a0, a1):
    """SVG arc around the centre, angles in degrees (0 = right, -90 = up)."""
    p = lambda a: (C + r * math.cos(math.radians(a)), C + r * math.sin(math.radians(a)))
    (x0, y0), (x1, y1) = p(a0), p(a1)
    return f"M{x0:.2f} {y0:.2f}A{r} {r} 0 0 1 {x1:.2f} {y1:.2f}"


def mark_paths_small(color):
    """Small-size cut (favicon, <= 24px): heavier bars and a single echo arc so it does not fill in."""
    ends = [(-1, -1), (-1, 1), (1, 1)]
    bars = "".join(f"M{C} {C}L{C + sx * ARM:.2f} {C + sy * ARM:.2f}" for sx, sy in ends)
    return (
        f'<path d="{bars}" fill="none" stroke="{color}" stroke-width="13" stroke-linecap="round"/>'
        f'<path d="{arc(20, -45 - 33, -45 + 33)}" fill="none" stroke="{color}" stroke-width="9" stroke-linecap="round"/>'
    )


def mark_paths(color, bar=BAR, arcw=ARC):
    """Three bars of the X plus two concentric echo arcs as the up-right arm."""
    ends = [(-1, -1), (-1, 1), (1, 1)]  # up-left, down-left, down-right
    bars = "".join(f"M{C} {C}L{C + sx * ARM:.2f} {C + sy * ARM:.2f}" for sx, sy in ends)
    arcs = arc(13.5, -45 - 34, -45 + 34) + arc(24.5, -45 - 30, -45 + 30)
    return (
        f'<path d="{bars}" fill="none" stroke="{color}" stroke-width="{bar}" stroke-linecap="round"/>'
        f'<path d="{arcs}" fill="none" stroke="{color}" stroke-width="{arcw}" stroke-linecap="round"/>'
    )


def grad(gid, x1, y1, x2, y2):
    return (
        f'<linearGradient id="{gid}" gradientUnits="userSpaceOnUse" x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}">'
        f'<stop offset="0" stop-color="{TEAL}"/><stop offset="1" stop-color="{OCEAN}"/></linearGradient>'
    )


def svg(w, h, body, defs=""):
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">'
        + (f"<defs>{defs}</defs>" if defs else "")
        + body
        + "</svg>\n"
    )


def mark(variant):
    if variant == "color":
        return svg(64, 64, mark_paths("url(#mx-g)"), grad("mx-g", 10, 10, 54, 54))
    return svg(64, 64, mark_paths(WHITE if variant == "white" else INK))


def tile(size=64, radius=15, small=False):
    """Gradient rounded tile with white mark (app icon, favicon, AppShell). `small` uses the favicon cut."""
    s = size / 64
    k = size * 0.64 / BW
    body = (
        f'<rect width="{size}" height="{size}" rx="{radius * s:.2f}" fill="url(#mx-t)"/>'
        f'<g transform="translate({size / 2 - BCX * k:.2f} {size / 2 - BCY * k:.2f}) scale({k:.4f})">{(mark_paths_small if small else mark_paths)(WHITE)}</g>'
    )
    return svg(size, size, body, grad("mx-t", 0, 0, size, size))


# ---------- wordmark: "Med" outlines + the mark as X ----------
def med_path():
    f = TTFont(FONT)
    gs = f.getGlyphSet()
    cmap = f.getBestCmap()
    cap = f["OS/2"].sCapHeight  # 700
    pen = SVGPathPen(gs)
    x = 0.0
    names = [cmap[ord(c)] for c in "Med"]
    # optical kerning (font units): tighten M-e and e-d slightly for a logo
    kern = {("M", "e"): -10, ("e", "d"): -6}
    prev = None
    for ch, n in zip("Med", names):
        if prev:
            x += kern.get((prev, ch), 0)
        tp = TransformPen(pen, (1, 0, 0, -1, x, cap))  # flip y, baseline at y = cap
        gs[n].draw(tp)
        x += gs[n].width
        prev = ch
    return pen.getCommands(), x, cap


def wordmark(variant, with_tile=False):
    d, width, cap = med_path()
    # X: the mark scaled so its arm span matches the cap height
    k = cap * 1.04 / BH  # optical: the open echo arm reads lighter, so the X is set 4% larger than the caps
    gap = 46
    xx = width + gap - BX0 * k
    xy = cap / 2 - BCY * k
    ink = WHITE if variant == "white" else INK
    xcolor = "url(#mx-w)" if variant == "color" else ink
    mark_g = f'<g transform="translate({xx:.1f} {xy:.1f}) scale({k:.3f})">{mark_paths(xcolor)}</g>'
    total_w = width + gap + BW * k
    over = (BH * k - cap) / 2  # the X overshoots the caps slightly; keep it inside the viewBox
    body = f'<path d="{d}" fill="{ink}"/>{mark_g}'
    defs = grad("mx-w", 10, 10, 54, 54) if variant == "color" else ""
    pad = 0
    if with_tile:
        tsize = cap * 1.45
        tgap = tsize * 0.34
        ty = -(tsize - cap) / 2
        tk = tsize * 0.64 / BW
        tile_body = (
            f'<rect x="0" y="{ty:.1f}" width="{tsize:.1f}" height="{tsize:.1f}" rx="{tsize * 15 / 64:.1f}" '
            f'fill="{"url(#mx-t)" if variant == "color" else (WHITE if variant == "white" else INK)}"/>'
            f'<g transform="translate({tsize / 2 - BCX * tk:.1f} {ty + tsize / 2 - BCY * tk:.1f}) scale({tk:.4f})">'
            f'{mark_paths(OCEAN if variant == "white" else WHITE)}</g>'
        )
        if variant == "color":
            defs += grad("mx-t", 0, -(tsize - cap) / 2, tsize, tsize)
        body = tile_body + f'<g transform="translate({tsize + tgap:.1f} 0)">{body}</g>'
        total_w += tsize + tgap
        top = -(tsize - cap) / 2
        h = tsize
        return svg_vb(f"0 {top:.1f} {total_w:.1f} {h:.1f}", total_w, h, body, defs)
    return svg_vb(f"0 {-over:.1f} {total_w:.1f} {cap + 2 * over:.1f}", total_w, cap + 2 * over, body, defs)


def svg_vb(vb, w, h, body, defs):
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" width="{w:.0f}" height="{h:.0f}">'
        + (f"<defs>{defs}</defs>" if defs else "")
        + body
        + "</svg>\n"
    )


def write(name, content):
    with open(os.path.join(OUT, name), "w") as fh:
        fh.write(content)


if __name__ == "__main__":
    for v in ("color", "white", "ink"):
        write(f"mark-{v}.svg", mark(v))
        write(f"wordmark-{v}.svg", wordmark(v))
        write(f"lockup-{v}.svg", wordmark(v, with_tile=True))
    write("app-icon.svg", tile(1024, 0))  # full-bleed square: iOS/Android apply their own corner mask
    write("app-icon-rounded.svg", tile(1024, 15))  # for slides and previews
    write("favicon.svg", tile(64, 15, small=True))
    write("mark-small-color.svg", svg(64, 64, mark_paths_small("url(#mx-g)"), grad("mx-g", 10, 10, 54, 54)))
    with open(os.path.join(ROOT, "apps/web/app/icon.svg"), "w") as fh:
        fh.write(tile(64, 15, small=True))
    # Web: static, trusted SVG strings for components/ui/Logo.tsx (generated; do not edit by hand)
    import json
    ts = (
        "// GENERATED by docs/design/logo/build.py. Do not edit by hand.\n"
        + "".join(
            f"export const {name} = {json.dumps(content.strip())};\n"
            for name, content in [
                ("LOCKUP_COLOR", wordmark("color", with_tile=True)),
                ("LOCKUP_WHITE", wordmark("white", with_tile=True)),
                ("MARK_TILE", tile(64, 15)),
            ]
        )
    )
    with open(os.path.join(ROOT, "apps/web/components/ui/logoSvg.ts"), "w") as fh:
        fh.write(ts)
    print("ok")
