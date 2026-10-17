"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ConsultMode, ConsultNote, ConsultNoteLine, ConsultState, ConsultSuggestion, Evidence, ExtractedField, FieldKey, IntakeSession, Lang } from "@medx/shared";
import { Badge, Button, Card, EvidenceHighlight, FieldValue, Icon, LangMorph, PencilField, RedFlagInterrupt, SegmentedControl, type Mark } from "@/components/ui";
import { FIELD_LABEL, LANG_NAME, clock, fetchSession, getJson, post } from "../../_lib";
import { useClinician } from "../../_shell";
import { tr } from "../../_i18n";
import { ct, type CKey } from "./_c18n";
import { considerationsFor, questionsFor } from "./_guard";
import { buildFixture, type Line } from "./_fixture";
import { useSpeech } from "./_speech";

const REC_LANG: Record<Lang, string> = { en: "en-US", th: "th-TH", it: "it-IT" };
const PULSE_CSS = "@keyframes cl-pulse{0%{box-shadow:0 0 0 0 rgba(26,95,196,.45)}100%{box-shadow:0 0 0 18px rgba(26,95,196,0)}}.cl-pulse{animation:cl-pulse 1.6s ease-out infinite}";
const SECTIONS: ConsultNoteLine["section"][] = ["presenting_complaint", "history", "medications", "allergies", "red_flags", "considerations", "open_questions"];
const sectionKey = (s: string) => `section${s[0].toUpperCase()}${s.slice(1)}` as CKey;
const OVERLAY: { key: FieldKey; re: RegExp }[] = [
  { key: "onset", re: /(?:since|for)\s+\w+(?:\s+\w+)?|yesterday|this morning|\d+\s+(?:days?|hours?) ago/i },
  { key: "severity", re: /\d+\s*(?:\/|out of)\s*10/i },
  { key: "allergies", re: /(?:no |not )?allerg\w*(?: to \w+)?/i },
  { key: "medications", re: /(?:take|taking)\s+[\w ]{3,30}/i },
];

type Sel = { key: string; ev: Evidence[] } | null;

export function Consult({ id, mode }: { id: string; mode: ConsultMode }) {
  const { lang, reviewer, sorted } = useClinician();
  const [data, setData] = useState<{ session: IntakeSession } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cs, setCs] = useState<ConsultState | null>(null);
  const [fixture, setFixture] = useState(false);
  const [local, setLocal] = useState<Line[]>([]);
  const [statusMap, setStatusMap] = useState<Record<string, ConsultSuggestion["status"]>>({});
  const [speaker, setSpeaker] = useState<"patient" | "clinician">("patient");
  const [text, setText] = useState("");
  const [sel, setSel] = useState<Sel>(null);
  const [live, setLive] = useState("");
  const [busy, setBusy] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [consented, setConsented] = useState(false);
  useEffect(() => { try { setConsented(sessionStorage.getItem(`medx.consult.consent.${id}`) === "1"); } catch { /* keep default */ } }, [id]);
  const seen = useRef<Set<string>>(new Set());
  const reqId = useRef(0);

  // ---- data
  const loadSession = useCallback(async () => {
    const mine = ++reqId.current;
    try {
      const d = await fetchSession(id);
      if (mine === reqId.current) { setData({ session: d.session }); setLoadError(null); }
    } catch (e) { if (mine === reqId.current) setLoadError((e as Error).message); }
  }, [id]);
  const loadConsult = useCallback(async () => {
    try {
      const r = await getJson<ConsultState>(`/api/sessions/${id}/consult?mode=${mode}`);
      setCs(r); setFixture(false);
    } catch { setFixture(true); }
  }, [id, mode]);
  useEffect(() => {
    loadSession(); loadConsult();
    const t = setInterval(() => { loadSession(); loadConsult(); }, 4000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { clearInterval(t); reqId.current++; };
  }, [loadSession, loadConsult]);

  const session = data?.session;
  const patientLang: Lang = session?.patientLang ?? "en";

  // ---- transcript: intake/session turns plus lines not yet echoed by the server
  const lines: Line[] = useMemo(() => {
    const base: Line[] = (session?.turns ?? []).map((t) => ({ id: t.id, speaker: t.role === "patient" ? "patient" : "clinician", system: t.role === "assistant", text: t.text, at: t.at }));
    const unsynced = local.filter((l) => !base.some((b) => b.text === l.text && b.speaker === l.speaker));
    return [...base, ...unsynced];
  }, [session, local]);
  const turnLang = (l: Line): Lang => session?.turns.find((t) => t.id === l.id)?.lang ?? (l.speaker === "patient" ? patientLang : lang);

  // ---- consult state: server's, or the typed fixture
  const fx = useMemo(() => buildFixture(mode, lines, statusMap, id), [mode, lines, statusMap, id]);
  const state: ConsultState = fixture || !cs ? fx : cs;
  const suggestions = state.suggestions;
  // Questions fill the 3 popup slots; considerations live in their own doctor-only panel (see _guard.ts).
  const open = questionsFor(mode, suggestions).filter((s) => s.status === "open").sort((a, b) => rank(a) - rank(b));
  const shown = open.slice(0, 3);
  const considerations = considerationsFor(mode, suggestions).filter((s) => s.status !== "dismissed").sort((a, b) => (a.source === b.source ? 0 : a.source === "rule" ? -1 : 1)).slice(0, 4);
  const note: ConsultNote | null = state.note;

  useEffect(() => {
    const fresh = shown.filter((s) => !seen.current.has(s.id));
    if (!fresh.length) return;
    fresh.forEach((s) => seen.current.add(s.id));
    setLive(fresh.map((s) => `${ct("announceNew", lang)}: ${s.text[lang].replace(/[.?!]+$/, "")}`).join(". "));
  }, [shown, lang]);

  // ---- speech
  const submit = useCallback(async (raw: string, who: "patient" | "clinician", input: "text" | "voice" = "text") => {
    const t = raw.trim();
    if (!t) return;
    const clientTurnId = crypto.randomUUID();
    setLocal((l) => [...l, { id: `local-${clientTurnId}`, speaker: who, text: t, at: new Date().toISOString(), input }]);
    if (!fixture) {
      try {
        const r = await post<ConsultState>(`/api/sessions/${id}/consult/turns`, { speaker: who, text: t, mode, clientTurnId, inputMode: input });
        setCs(r); setWriteError(null);
      } catch (e) { setWriteError(`${ct("writeFailed", lang)}: ${(e as Error).message}`); }
    }
    loadSession();
  }, [id, mode, loadSession, fixture, lang]);
  const giveConsent = (on: boolean) => {
    setConsented(on);
    try { if (on) sessionStorage.setItem(`medx.consult.consent.${id}`, "1"); else sessionStorage.removeItem(`medx.consult.consent.${id}`); } catch { /* local state only */ }
    if (on) submit(ct("consentNote", "en"), "clinician"); // audited as a stored clinician line through the existing turn route
  };
  const speakerRef = useRef(speaker);
  speakerRef.current = speaker;
  const recLang = REC_LANG[speaker === "patient" ? patientLang : lang];
  const sp = useSpeech(recLang, (t) => submit(t, speakerRef.current, "voice"));
  // Changing the speaker changes the recognition language: restart if listening.
  const wasListening = useRef(false);
  wasListening.current = sp.listening;
  const { start, stop } = sp;
  useEffect(() => { if (wasListening.current) { stop(); setTimeout(start, 250); } }, [recLang, start, stop]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) return;
      if (e.key === "p" || e.key === "P") setSpeaker("patient");
      if (e.key === "c" || e.key === "C") setSpeaker("clinician");
      if (e.key === "Escape") setSel(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ---- actions
  const mark = async (s: ConsultSuggestion, status: "asked" | "dismissed") => {
    setStatusMap((m) => ({ ...m, [s.id]: status }));
    setCs((c) => (c ? { ...c, suggestions: c.suggestions.map((x) => (x.id === s.id ? { ...x, status } : x)) } : c));
    if (!fixture) { try { await post(`/api/sessions/${id}/consult/suggestions/${encodeURIComponent(s.id)}`, { reviewerId: reviewer, status }); } catch (e) { setWriteError(`${ct("writeFailed", lang)}: ${(e as Error).message}`); loadConsult(); } }
  };
  // Writes never fall back to fixtures: a refused or failed write is shown with the server's reason and nothing is marked signed.
  const noteAction = async (action: "draft" | "sign", edits?: { lineId: string; text: string }[]) => {
    if (fixture) { setNoteError(ct("fixtureNoSign", lang)); return; }
    setBusy(true);
    setNoteError(null);
    try {
      const r = await post<ConsultState>(`/api/sessions/${id}/consult/note`, { reviewerId: reviewer, mode, action, ...(edits ? { edits } : {}) });
      setCs(r);
    } catch (e) {
      setNoteError(`${ct("writeFailed", lang)}: ${(e as Error).message}`);
    } finally { setBusy(false); }
  };
  const ackFlags = async () => {
    const hits = (session?.summary?.redFlags ?? []).filter((h) => !h.review);
    setBusy(true);
    try { await post(`/api/sessions/${id}/review`, { reviewerId: reviewer, actions: [], redFlagActions: hits.map((h) => ({ ruleId: h.ruleId, action: "acknowledge" })) }); } catch { /* shown by next poll */ }
    setBusy(false); loadSession();
  };

  if (!session) {
    return (
      <Card aria-busy="true" className="flex flex-col gap-3">
        {loadError ? <p role="alert" className="text-body text-signal">{ct("loadFail", lang)}: {loadError}. <button className="font-semibold text-ocean underline" onClick={loadSession}>{ct("retry", lang)}</button></p> : [0, 1, 2].map((i) => <span key={i} className="mx-skeleton !h-12" />)}
      </Card>
    );
  }

  const hits = session.summary?.redFlags ?? [];
  const pending = hits.some((h) => !h.review);
  const next = sorted?.find((x) => x.id !== id && (x.status === "escalated" || x.status === "awaiting_review"));

  // evidence marks
  const used: Evidence[] = [...suggestions.flatMap((s) => s.evidence), ...(note?.lines.flatMap((l) => l.evidence) ?? []), ...hits.flatMap((h) => h.evidence)];
  const marksFor = (turnId: string): Mark[] => {
    const active = sel?.ev ?? [];
    return [...used, ...active].filter((e) => e.turnId === turnId).map((e) => ({ start: e.start, end: e.end, quote: e.quote, active: active.some((a) => a.turnId === e.turnId && a.start === e.start && a.end === e.end) }));
  };

  // live summary fields (server's; in fixture mode a small keyword overlay from the spoken lines)
  const fields: ExtractedField[] = (session.summary?.fields ?? []).filter((f) => f.required).map((f) => {
    if (!fixture || f.status !== "missing") return f;
    const o = OVERLAY.find((x) => x.key === f.key);
    if (!o) return f;
    for (const l of local.filter((x) => x.speaker === "patient")) {
      const m = o.re.exec(l.text);
      if (m) return { ...f, status: "supported" as const, confidence: 0.8, value: { en: m[0], th: m[0], it: m[0] }, valueOriginal: m[0], evidence: [{ turnId: l.id, quote: m[0], start: m.index, end: m.index + m[0].length }] };
    }
    return f;
  });

  const body = (
    <div className="flex flex-col gap-4">
      <style>{PULSE_CSS}</style>
      <p aria-live="polite" className="sr-only">{live}</p>

      <Card className="cl-enter flex flex-wrap items-center gap-3">
        <span className="grid size-11 place-items-center rounded-full bg-primary-gradient text-on-primary"><Icon name="mic" size={20} /></span>
        <div className="min-w-0">
          <h1 className="text-title font-extrabold">{ct("title", lang)} <span className="tabular-nums text-ink-soft">{session.code}</span></h1>
          <p className="text-small text-ink-soft"><Badge tone="ocean">{ct(mode === "nurse" ? "modeNurse" : "modeDoctor", lang)}</Badge> <span lang={patientLang}>{LANG_NAME[patientLang]}</span></p>
        </div>
        {fixture && <Badge tone="pencil" className="ml-1">{ct("fixture", lang)}</Badge>}
        {mode === "nurse" && <Link href={`/review/${id}/vitals`} className="ml-auto inline-flex h-10 items-center gap-2 rounded-full bg-primary-gradient px-4 text-small font-semibold text-on-primary">{ct("nextVitals", lang)}<Icon name="chevron-right" size={14} /></Link>}
        <Link href={`/review/${id}/trace`} title={tr("caseTraceHint", lang)} className="inline-flex h-10 items-center gap-2 rounded-full border border-rule-strong/60 bg-sheet px-4 text-small font-semibold text-ink hover:border-ocean hover:text-ocean"><Icon name="clock" size={14} />{tr("caseTrace", lang)}</Link>
        <Link href={`/review/${id}`} className={`${mode === "nurse" ? "" : "ml-auto "}inline-flex h-10 items-center gap-2 rounded-full border border-rule-strong/60 bg-sheet px-4 text-small font-semibold text-ink hover:border-ocean hover:text-ocean`}>
          <Icon name="chevron-right" size={14} className="rotate-180" />{ct("backToCase", lang)}
        </Link>
        {fixture && <p className="basis-full text-micro text-ink-soft">{ct("fixtureHint", lang)}</p>}
      </Card>

      <Card className="cl-enter">
        <h2 className="mb-3 text-lead font-bold">{ct("summary", lang)}</h2>
        <ul className="grid grid-cols-1 gap-x-6 gap-y-3 min-[900px]:grid-cols-2 min-[1280px]:grid-cols-3">
          {fields.map((f) => (
            <li key={f.key} className="flex flex-col gap-1">
              <span className="text-small font-semibold text-ink-soft"><LangMorph text={FIELD_LABEL[f.key]} lang={lang} /></span>
              <FieldValue field={f} lang={lang} />
            </li>
          ))}
        </ul>
      </Card>

      <div className="grid grid-cols-1 gap-4 min-[1100px]:grid-cols-[minmax(0,1fr)_420px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card className="cl-enter flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <button
                type="button"
                aria-pressed={sp.listening}
                disabled={!sp.supported || !consented}
                onClick={() => { if (sp.listening) { sp.stop(); setLive(ct("stoppedAnnounce", lang)); } else { sp.start(); setLive(ct("listeningAnnounce", lang)); } }}
                className={`grid size-16 shrink-0 place-items-center rounded-full text-on-primary transition-transform duration-quick ease-pen active:scale-95 disabled:bg-muted disabled:text-graphite ${sp.listening ? "bg-primary-gradient cl-pulse" : "bg-ink"}`}
                aria-label={ct(sp.listening ? "micStop" : "mic", lang)}
              >
                <Icon name="mic" size={28} />
              </button>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-lead font-bold" role="status">
                  {sp.listening ? <><Badge tone="ocean" icon={<Icon name="mic" size={12} />}>{ct("listening", lang)}</Badge></> : <span className="text-ink-soft">{ct("idle", lang)}</span>}
                </p>
                <p className="min-h-[1.5em] truncate text-body text-ink-soft" lang={recLang}>{sp.interim ? `${sp.interim}…` : ""}</p>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-micro font-semibold text-ink-soft">{ct("speaker", lang)}</span>
                <SegmentedControl
                  ariaLabel={ct("speaker", lang)}
                  size="sm"
                  value={speaker}
                  onChange={setSpeaker}
                  options={[{ value: "patient" as const, label: `${ct("patient", lang)} (P)` }, { value: "clinician" as const, label: `${ct("clinician", lang)} (C)` }]}
                />
              </div>
            </div>
            <label className="flex items-start gap-3 rounded-2xl bg-paper p-3 text-small text-ink">
              <input type="checkbox" checked={consented} onChange={(e) => giveConsent(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[var(--color-teal)]" />
              <span>{ct("consentLabel", lang)}</span>
            </label>
            {!consented && <p className="text-small font-semibold text-warn">{ct("consentNeeded", lang)}</p>}
            {!sp.supported && <p className="text-small text-ink-soft">{ct("noSpeech", lang)}</p>}
            {writeError && <p role="alert" className="text-small font-semibold text-signal">{writeError}</p>}
            {sp.error && <p role="alert" className="text-small font-semibold text-signal">{sp.error}</p>}
            <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); submit(text, speaker); setText(""); }}>
              <label className="flex min-w-60 flex-1 flex-col gap-1 text-small font-semibold text-ink-soft">
                {ct("typeLabel", lang)} ({ct(speaker, lang)})
                <input value={text} onChange={(e) => setText(e.target.value)} maxLength={500} className="h-10 rounded-control border border-rule-strong/60 bg-sheet px-3 text-body font-normal text-ink hover:border-ocean" />
              </label>
              <Button type="submit" variant="primary" disabled={!text.trim()}>{ct("send", lang)}</Button>
            </form>
          </Card>

          <Card padded={false} className="cl-enter flex h-[420px] flex-col">
            <h2 className="px-5 pb-2 pt-4 text-lead font-bold">{ct("transcript", lang)}</h2>
            <Transcript lines={lines} turnLang={turnLang} marksFor={marksFor} sel={sel} lang={lang} />
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          <h2 className="text-lead font-bold">{ct("suggestions", lang)}</h2>
          {shown.length === 0 && <Card className="text-small text-ink-soft">{ct("noSuggestions", lang)}</Card>}
          {shown.map((s) => (
            <SuggestionCard key={s.id} s={s} lang={lang} patientLang={patientLang} active={sel?.key === s.id} onShow={() => setSel(sel?.key === s.id ? null : { key: s.id, ev: s.evidence })} onMark={(st) => mark(s, st)} />
          ))}
          {open.length > 3 && <p className="text-small text-ink-soft">{ct("more", lang).replace("{n}", String(open.length - 3))}</p>}
          {mode === "doctor" && (
            <section aria-labelledby="consider-h" className="mt-2 flex flex-col gap-2 rounded-card border border-teal/30 bg-teal-tint/50 p-3">
              <h2 id="consider-h" className="text-lead font-bold text-teal">{ct("considerations", lang)}</h2>
              <p className="text-micro font-semibold text-teal">{ct("considerPanelNote", lang)}</p>
              {considerations.length === 0 && <p className="text-small text-ink-soft">{ct("noConsiderations", lang)}</p>}
              {considerations.map((s) => (
                <SuggestionCard key={s.id} s={s} lang={lang} patientLang={patientLang} panel active={sel?.key === s.id} onShow={() => setSel(sel?.key === s.id ? null : { key: s.id, ev: s.evidence })} onMark={(st) => mark(s, st)} />
              ))}
            </section>
          )}
        </div>
      </div>

      {mode === "doctor" && (
        <NotePanel
          note={note}
          lang={lang}
          busy={busy}
          blockedReason={fixture ? ct("fixtureNoSign", lang) : pending ? ct("signBlocked", lang) : null}
          error={noteError}
          reviewer={reviewer}
          onHover={(ev, key) => setSel(ev ? { key, ev } : null)}
          onDraft={() => noteAction("draft")}
          onSign={(edits) => noteAction("sign", edits)}
          next={next ? { id: next.id, code: next.code } : null}
          caseId={id}
          keptTexts={new Set(suggestions.filter((x) => x.kind === "consider" && x.status === "asked").map((x) => x.text.en))}
        />
      )}
    </div>
  );

  return hits.length > 0 ? (
    <RedFlagInterrupt key={id} hits={hits} lang={lang} patientLang={session.patientLang} acknowledged={!pending} onAcknowledge={ackFlags}>
      <div className="px-3 pt-4">{body}</div>
    </RedFlagInterrupt>
  ) : body;
}

/** "Consider for clinician review: Consider sepsis" -> "Sepsis": the chip already says Consider. */
const condition = (t: string) => { const c = t.replace(/^(?:consider(?:\s+for clinician review)?\s*:?\s*)+/i, "").trim(); return c ? c[0].toUpperCase() + c.slice(1) : t; };

const rank = (s: ConsultSuggestion) => (s.kind === "rule_out" ? 0 : 1);

function Transcript({ lines, turnLang, marksFor, sel, lang }: { lines: Line[]; turnLang: (l: Line) => Lang; marksFor: (id: string) => Mark[]; sel: Sel; lang: Lang }) {
  const end = useRef<HTMLLIElement>(null);
  const n = lines.length;
  useEffect(() => {
    if (sel) return; // do not pull the view away from a highlighted quote
    end.current?.scrollIntoView({ block: "nearest", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [n, sel]);
  if (!n) return <p className="px-5 pb-4 text-small text-ink-soft">{ct("emptyTranscript", lang)}</p>;
  return (
    <ol className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
      {lines.map((l) => {
        const marks = marksFor(l.id);
        const hasActive = marks.some((m) => m.active);
        return (
          <li key={l.id} className="border-t border-rule/70 py-2.5 first:border-t-0">
            <p className="flex items-center gap-2 text-micro text-graphite">
              <Badge tone={l.speaker === "patient" ? "ocean" : "outline"}>{l.system ? tr("question", lang) : ct(l.speaker, lang)}</Badge>
              <span className="tabular-nums">{clock(l.at, lang)}</span>
              {l.input && <Badge tone="outline">{tr(l.input === "voice" ? "tagSpoken" : "tagTyped", lang)}</Badge>}
            </p>
            {l.speaker === "patient" ? (
              <EvidenceHighlight key={hasActive ? `${l.id}:${sel?.key}` : l.id} text={l.text} lang={turnLang(l)} marks={marks} className="mt-1" />
            ) : (
              <p lang={turnLang(l)} className="mt-1 text-body text-ink-soft">{l.text}</p>
            )}
          </li>
        );
      })}
      <li ref={end} aria-hidden="true" />
    </ol>
  );
}

function SuggestionCard({ s, lang, patientLang, panel = false, active, onShow, onMark }: { s: ConsultSuggestion; lang: Lang; patientLang: Lang; panel?: boolean; active: boolean; onShow: () => void; onMark: (st: "asked" | "dismissed") => void }) {
  const tone = s.kind === "rule_out" ? "signalOutline" : s.kind === "consider" ? "teal" : "ocean";
  const label = ct(s.kind === "rule_out" ? "ruleOut" : s.kind === "consider" ? "consider" : "askNext", lang);
  const sm = "h-8! px-3! text-small!";
  return (
    <Card className={`cl-enter flex flex-col gap-2 !p-4 ${s.kind === "rule_out" ? "ring-1 ring-inset ring-signal/30" : ""} ${active ? "!ring-2 !ring-ocean" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={tone} icon={s.kind === "rule_out" ? <Icon name="triangle-alert" size={12} /> : undefined}>{label}</Badge>
        <Badge tone={s.source === "rule" ? "outline" : "pencil"}>{ct(s.source === "rule" ? "sourceRule" : "sourceModel", lang)}</Badge>
      </div>
      <p className="text-body font-semibold text-ink">{s.kind === "consider" ? condition(s.text[lang]) : <LangMorph text={s.text} lang={lang} />}</p>
      {s.kind === "consider" && <p className="text-micro font-semibold text-teal">{ct(s.source === "rule" ? "considerRuleNote" : "considerNote", lang)}</p>}
      <p className="text-small text-ink-soft"><span className="font-semibold">{ct("why", lang)}:</span> <LangMorph text={s.why} lang={lang} /></p>
      {s.evidence[0] && (
        <button type="button" onClick={onShow} aria-pressed={active} className="self-start rounded-2xl bg-paper px-3 py-1.5 text-left text-small text-ink-soft hover:bg-ocean-tint">
          {ct("evidence", lang)}: <q lang={patientLang} className="font-semibold text-ink">{s.evidence[0].quote}</q>
          <span className="sr-only">. {ct("showInTranscript", lang)}</span>
        </button>
      )}
      <div className="flex gap-2 pt-1">
        {panel ? (
          <>
            <Button className={sm} variant="primary" aria-pressed={s.status === "asked"} icon={<Icon name="check" size={14} />} disabled={s.status === "asked"} onClick={() => onMark("asked")}>{ct(s.status === "asked" ? "keptBtn" : "keepBtn", lang)}</Button>
            <Button className={sm} onClick={() => onMark("dismissed")}>{ct("notRelevant", lang)}</Button>
          </>
        ) : (
          <>
            <Button className={sm} variant="primary" icon={<Icon name="check" size={14} />} onClick={() => onMark("asked")}>{ct("asked", lang)}</Button>
            <Button className={sm} onClick={() => onMark("dismissed")}>{ct("dismiss", lang)}</Button>
          </>
        )}
      </div>
    </Card>
  );
}

function NotePanel({ note, lang, busy, blockedReason, error, reviewer, caseId, keptTexts, onHover, onDraft, onSign, next }: {
  note: ConsultNote | null; lang: Lang; busy: boolean; blockedReason: string | null; error: string | null; reviewer: string; caseId: string; keptTexts: Set<string>;
  onHover: (ev: Evidence[] | null, key: string) => void; onDraft: () => void; onSign: (edits: { lineId: string; text: string }[]) => void; next: { id: string; code: string } | null;
}) {
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [hov, setHov] = useState<string | null>(null);
  const [kept, setKept] = useState<Set<string>>(new Set());
  const signed = note?.signed;
  const isKept = (l: ConsultNoteLine) => kept.has(l.id) || keptTexts.has(l.text.en);
  const lineText = (l: ConsultNoteLine) => edits[l.id] ?? l.text[lang];
  const sm = "h-8! px-3! text-small!";

  return (
    <Card className="cl-enter flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lead font-bold">{ct(signed ? "signedNote" : "draftNote", lang)}</h2>
        {!signed && <Button className="ml-auto" disabled={busy} icon={<Icon name="clipboard-list" size={16} />} onClick={onDraft}>{ct(note ? "redraft" : "draftBtn", lang)}</Button>}
      </div>
      {signed ? (
        <p className="rounded-2xl bg-teal-tint px-4 py-2.5 text-small font-semibold text-teal">{ct("signedBanner", lang)}</p>
      ) : (
        <p className="rounded-2xl bg-warn-tint px-4 py-2.5 text-small font-semibold text-warn">{note?.disclaimer[lang] ?? ct("noteDisclaimer", lang)}</p>
      )}

      {signed ? (
        <div role="status" className="flex flex-wrap items-center gap-4 rounded-card border border-teal/30 bg-teal-tint p-4">
          <span className="grid size-11 place-items-center rounded-full bg-primary-gradient text-on-primary"><Icon name="circle-check" size={22} /></span>
          <div className="min-w-0 flex-1">
            <p className="text-lead font-extrabold text-teal">{ct("signedTitle", lang)}</p>
            <p className="text-small text-ink-soft">{signed.reviewerId}, {clock(signed.at, lang)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/review/${caseId}/orders`} className="inline-flex h-10 items-center gap-2 rounded-full bg-primary-gradient px-5 text-small font-semibold text-on-primary shadow-[0_10px_18px_-10px_rgba(26,95,196,0.8)]">{ct("writeOrders", lang)}<Icon name="chevron-right" size={14} /></Link>
            {next && <Link href={`/review/${next.id}`} className="inline-flex h-10 items-center gap-2 rounded-full border border-rule-strong/60 bg-sheet px-4 text-small font-semibold text-ink hover:border-ocean hover:text-ocean">{ct("nextCase", lang)} {next.code}</Link>}
          </div>
        </div>
      ) : null}

      {!note ? <p className="text-small text-ink-soft">{ct("noteEmpty", lang)}</p> : (
        SECTIONS.map((sec) => {
          const ls = note.lines.filter((l) => l.section === sec);
          if (!ls.length) return null;
          return (
            <section key={sec} aria-labelledby={`ns-${sec}`} className={sec === "considerations" ? "rounded-2xl bg-teal-tint/60 p-3" : ""}>
              <h3 id={`ns-${sec}`} className="mb-1 text-small font-bold text-ink-soft">{ct(sectionKey(sec), lang)}</h3>
              {sec === "considerations" && <p className="mb-1 text-micro font-semibold text-teal">{ct("considerNote", lang)} {ct("droppedUnlessKept", lang)}</p>}
              <ul className="flex flex-col gap-1">
                {ls.map((l) => {
                  const shownEv = hov === l.id;
                  return (
                    <li
                      key={l.id}
                      tabIndex={0}
                      onMouseEnter={() => { setHov(l.id); onHover(l.evidence, l.id); }}
                      onMouseLeave={() => { setHov(null); onHover(null, l.id); }}
                      onFocus={() => { setHov(l.id); onHover(l.evidence, l.id); }}
                      onBlur={() => { setHov(null); onHover(null, l.id); }}
                      className="rounded-2xl px-3 py-2 hover:bg-paper focus-visible:bg-paper"
                    >
                      {editing === l.id ? (
                        <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (draft.trim()) setEdits((m) => ({ ...m, [l.id]: draft.trim() })); setEditing(null); }}>
                          <input autoFocus aria-label={`${ct("edit", lang)}: ${lineText(l)}`} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape") setEditing(null); }} maxLength={400} className="h-9 min-w-60 flex-1 rounded-control border border-rule-strong/60 bg-sheet px-3 text-body" />
                          <Button type="submit" variant="primary" className={sm}>{ct("save", lang)}</Button>
                          <Button className={sm} onClick={() => setEditing(null)}>{ct("cancel", lang)}</Button>
                        </form>
                      ) : (
                        <div className="flex flex-wrap items-start gap-2">
                          <div className="min-w-0 flex-1">
                            {edits[l.id] ? (
                              <span className="text-body font-semibold">{edits[l.id]} <Badge tone="teal" icon={<Icon name="pencil" size={12} />}>{ct("edited", lang)}</Badge></span>
                            ) : l.status === "unsupported" ? (
                              <PencilField value={l.text[lang]} lang={lang} />
                            ) : (
                              <span className="text-body">{l.text[lang]}</span>
                            )}
                            {(shownEv || false) && (
                              <p className="mt-1 text-small text-ink-soft">
                                {l.evidence[0] ? <>{ct("evidence", lang)}: <q className="font-semibold text-ink">{l.evidence[0].quote.length > 140 ? `${l.evidence[0].quote.slice(0, 140)}…` : l.evidence[0].quote}</q></> : ct("noEvidence", lang)}
                              </p>
                            )}
                          </div>
                          {!signed && sec === "considerations" && (
                            <label className="flex items-center gap-2 text-small font-semibold text-ink-soft">
                              <input type="checkbox" checked={isKept(l)} onChange={(e) => setKept((k) => { const n = new Set(k); if (e.target.checked) n.add(l.id); else n.delete(l.id); return n; })} className="size-4 accent-[var(--color-teal)]" />
                              {ct("keepInNote", lang)}
                              {!isKept(l) && <Badge tone="outline">{ct("willDrop", lang)}</Badge>}
                            </label>
                          )}
                          {!signed && sec !== "red_flags" && <Button className={sm} variant="quiet" icon={<Icon name="pencil" size={14} />} onClick={() => { setEditing(l.id); setDraft(lineText(l)); }}>{ct("edit", lang)}</Button>}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })
      )}

      {error && <p role="alert" className="text-small font-semibold text-signal">{error}</p>}
      {note && !signed && (
        <div className="flex flex-wrap items-center gap-3 border-t border-rule/70 pt-3">
          <Button variant="primary" icon={<Icon name="circle-check" size={16} />} disabled={busy || !!blockedReason} aria-describedby={blockedReason ? "sign-why" : undefined} onClick={() => onSign([...Object.entries(edits).map(([lineId, t]) => ({ lineId, text: t })), ...note.lines.filter((l) => l.section === "considerations" && isKept(l) && !(l.id in edits)).map((l) => ({ lineId: l.id, text: l.text[lang] }))])}>{ct("sign", lang)}</Button>
          {blockedReason && <span id="sign-why" className="text-small font-semibold text-warn">{blockedReason}</span>}
          <span className="ml-auto text-micro text-ink-soft">{reviewer}</span>
        </div>
      )}
    </Card>
  );
}
