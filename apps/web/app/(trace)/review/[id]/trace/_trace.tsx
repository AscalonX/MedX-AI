"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CaseTrace, GetSessionRes, IntakeSession, Lang, Localized, TraceNode } from "@medx/shared";
import { Badge, Button, Card, CardHeader, EvidenceHighlight, Icon, SegmentedControl, type IconName } from "@/components/ui";
import { fixtureSession } from "../../../../(orders)/_fixture";
import { call, clockOf } from "../../../../(orders)/_lib";
import { useIdentity } from "../../../../(orders)/_bits";
import { CaseHeader } from "../../../../_shared/CaseHeader";
import { NODE_H, NODE_W, edgeLabel, layoutTrace, summarize } from "../../../_graph";
import { fixtureTrace } from "../../../_fixture";

const L = (en: string, th: string, it: string): Localized => ({ en, th, it });
const S = {
  title: L("Case trace: how this case was handled", "เส้นทางของเคส: จัดการเคสนี้อย่างไร", "Traccia del caso: come è stato gestito"),
  back: L("Back to case", "กลับไปที่เคส", "Torna al caso"),
  patient: L("Patient", "ผู้ป่วย", "Paziente"),
  fixture: L("fixture", "ข้อมูลจำลอง", "dati di prova"),
  fixtureWhy: L("Trace route not answering. Showing a sample graph.", "เส้นทาง trace ยังไม่ตอบ แสดงกราฟตัวอย่าง", "Route trace non disponibile. Grafo di esempio."),
  loadFail: L("Could not load this case.", "โหลดเคสไม่ได้", "Impossibile caricare il caso."),
  graph: L("Graph", "กราฟ", "Grafo"), list: L("List view", "มุมมองรายการ", "Vista elenco"), view: L("View", "มุมมอง", "Vista"),
  steps: L("{n} steps", "{n} ขั้นตอน", "{n} passaggi"),
  rules: L("{n} rule checks", "{n} การตรวจตามกฎ", "{n} controlli a regole"),
  models: L("{n} model calls", "{n} การเรียกโมเดล", "{n} chiamate al modello"),
  step1: L("1 step", "1 ขั้นตอน", "1 passaggio"),
  rule1: L("1 rule check", "1 การตรวจตามกฎ", "1 controllo a regole"),
  model1: L("1 model call", "1 การเรียกโมเดล", "1 chiamata al modello"),
  human1: L("1 human decision", "1 การตัดสินใจโดยบุคลากร", "1 decisione umana"),
  skippedN: L("{n} skipped", "ข้าม {n}", "{n} saltati"),
  humans: L("{n} human decisions", "{n} การตัดสินใจโดยบุคลากร", "{n} decisioni umane"),
  escalated: L("escalated at step {n}", "ส่งต่อเร่งด่วนที่ขั้นตอน {n}", "escalation al passaggio {n}"),
  notEscalated: L("not escalated", "ไม่ส่งต่อเร่งด่วน", "nessuna escalation"),
  legend: L("Legend", "คำอธิบายสัญลักษณ์", "Legenda"),
  rule: L("Rule", "กฎ", "Regola"), model: L("Model", "โมเดล", "Modello"), human: L("Human", "บุคลากร", "Umano"), system: L("System", "ระบบ", "Sistema"),
  pharmacist: L("Pharmacist", "เภสัชกร", "Farmacista"),
  ok: L("Done", "เสร็จ", "Fatto"), skipped: L("Skipped", "ข้าม", "Saltato"), failed: L("Failed", "ล้มเหลว", "Fallito"), abstained: L("Abstained", "งดตัดสิน", "Astenuto"), escal: L("Escalated", "ส่งต่อเร่งด่วน", "Escalation"),
  panel: L("Step details", "รายละเอียดขั้นตอน", "Dettagli del passaggio"),
  pick: L("Select a step to see what happened, when, and which evidence it used.", "เลือกขั้นตอนเพื่อดูว่าเกิดอะไร เมื่อไร และใช้หลักฐานใด", "Seleziona un passaggio per vedere cosa è successo e quali prove ha usato."),
  actor: L("Actor", "ผู้ดำเนินการ", "Attore"), status: L("Status", "สถานะ", "Stato"), detail: L("What happened", "สิ่งที่เกิดขึ้น", "Cosa è successo"),
  latency: L("Latency", "เวลาประมวลผล", "Latenza"), time: L("Time", "เวลา", "Ora"), evidence: L("Evidence", "หลักฐาน", "Prove"), noEvidence: L("No patient quotes used in this step.", "ขั้นตอนนี้ไม่ได้ใช้คำพูดผู้ป่วย", "Nessuna citazione usata."),
  audit: L("Audit ids", "รหัสบันทึกตรวจสอบ", "Id di audit"), noAudit: L("None (step was not run)", "ไม่มี (ไม่ได้ทำขั้นตอนนี้)", "Nessuno (passaggio non eseguito)"),
  export: L("Export JSON", "ส่งออก JSON", "Esporta JSON"),
  replay: L("Deterministic replay check", "ตรวจสอบการเล่นซ้ำแบบกำหนดแน่นอน", "Verifica di replay deterministico"),
  digest: L("Audit digest", "ค่าสรุปบันทึกตรวจสอบ", "Digest di audit"),
  rederive: L("Re-derive", "สร้างใหม่", "Ricalcola"), deriving: L("Re-deriving", "กำลังสร้างใหม่", "Ricalcolo"),
  match: L("Match: re-derived digest is identical.", "ตรงกัน: ค่าสรุปที่สร้างใหม่เหมือนเดิม", "Corrisponde: il digest ricalcolato è identico."),
  mismatch: L("Mismatch: re-derived digest differs.", "ไม่ตรงกัน: ค่าสรุปที่สร้างใหม่ต่างไป", "Non corrisponde: il digest ricalcolato è diverso."),
  matchFx: L("Fixture only: not a server check.", "ข้อมูลจำลอง: ไม่ใช่การตรวจจากเซิร์ฟเวอร์", "Solo dati di prova: non è un controllo del server."),
  rederiveFail: L("Could not re-derive.", "สร้างใหม่ไม่ได้", "Impossibile ricalcolare."),
  stepN: L("Step {n}", "ขั้นตอน {n}", "Passaggio {n}"),
  scroll: L("Scroll sideways to see the whole graph.", "เลื่อนไปด้านข้างเพื่อดูกราฟทั้งหมด", "Scorri lateralmente per vedere tutto il grafo."),
  graphLabel: L("Executed graph, left to right", "กราฟที่ทำงานจริง จากซ้ายไปขวา", "Grafo eseguito, da sinistra a destra"),
  scope: L("Clinician view. Shows how the system handled this case; it supports review and is not a diagnosis.", "มุมมองบุคลากร แสดงวิธีที่ระบบจัดการเคส ใช้ช่วยตรวจทาน ไม่ใช่การวินิจฉัย", "Vista clinica. Mostra come il sistema ha gestito il caso; supporta la revisione e non è una diagnosi."),
};
type K = keyof typeof S;
const tr = (k: K, lang: Lang, v?: Record<string, string | number>) => S[k][lang].replace(/\{(\w+)\}/g, (_, x: string) => String(v?.[x] ?? ""));
const pick = (l: Localized, lang: Lang) => l[lang] || l.en;

const ACTOR: Record<TraceNode["actor"], { cls: string; icon: IconName; key: K }> = {
  rule: { cls: "border-ink bg-sheet", icon: "clipboard-list", key: "rule" },
  model: { cls: "border-ocean bg-ocean-tint", icon: "activity", key: "model" },
  human: { cls: "border-teal bg-teal-tint", icon: "user", key: "human" },
  system: { cls: "border-rule-strong bg-muted", icon: "clock", key: "system" },
};
const STATUS: Record<TraceNode["status"], { cls: string; icon: IconName; key: K }> = {
  ok: { cls: "", icon: "circle-check", key: "ok" },
  skipped: { cls: "border-dashed opacity-60", icon: "circle-minus", key: "skipped" },
  failed: { cls: "!border-warn bg-warn-tint", icon: "triangle-alert", key: "failed" },
  abstained: { cls: "!border-warn bg-warn-tint", icon: "triangle-alert", key: "abstained" },
  escalated: { cls: "!border-l-[6px] !border-l-signal", icon: "triangle-alert", key: "escal" },
};
/** Pharmacist steps (verify, return, dispense, call, collected) keep the human styling but carry a pill icon and role name. */
const isPharmacist = (n: TraceNode) => n.kind === "pharmacist_action";
const iconOf = (n: TraceNode): IconName => (isPharmacist(n) ? "pill" : ACTOR[n.actor].icon);
const actorText = (n: TraceNode, lang: Lang) => (isPharmacist(n) ? `${tr(ACTOR[n.actor].key, lang)} · ${tr("pharmacist", lang)}` : tr(ACTOR[n.actor].key, lang));
const statusColor = (s: TraceNode["status"]) => (s === "escalated" ? "text-signal" : s === "failed" || s === "abstained" ? "text-warn" : "text-ink-soft");

export function Trace({ id }: { id: string }) {
  const { lang } = useIdentity("Case trace");
  const [trace, setTrace] = useState<CaseTrace | null>(null);
  const [session, setSession] = useState<IntakeSession | null>(null);
  const [fixture, setFixture] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [view, setView] = useState<"graph" | "list">("graph");
  const [replay, setReplay] = useState<{ state: "idle" | "busy" | "match" | "mismatch" | "fail"; fx?: boolean }>({ state: "idle" });
  const picked = useRef(false);
  // Fit the graph to its card (never below 0.7 so text stays readable; below that the card scrolls sideways).
  const box = useRef<HTMLDivElement>(null);
  const [avail, setAvail] = useState(0);

  const loadTrace = useCallback(() => call<CaseTrace>(`/api/sessions/${id}/trace`, undefined, () => fixtureTrace(id)), [id]);
  useEffect(() => {
    (async () => {
      try {
        const [t, s] = await Promise.all([loadTrace(), call<GetSessionRes>(`/api/sessions/${id}`, undefined, () => ({ session: fixtureSession(id), audit: [] }))]);
        setTrace(t.data); setSession(s.data.session); setFixture(t.fixture); setErr(null);
        if (!picked.current) setSel(t.data.nodes.find((n) => n.status === "escalated")?.id ?? null);
      } catch (e) { setErr((e as Error).message); }
    })();
  }, [id, loadTrace]);

  const layout = useMemo(() => (trace ? layoutTrace(trace.nodes, trace.edges) : null), [trace]);
  const sum = useMemo(() => (trace ? summarize(trace.nodes) : null), [trace]);
  const scale = layout && avail ? Math.min(1, Math.max(0.7, (avail - 16) / layout.width)) : 1;
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setAvail(el.clientWidth));
    ro.observe(el); setAvail(el.clientWidth);
    return () => ro.disconnect();
  }, [view, trace]);
  const node = trace?.nodes.find((n) => n.id === sel) ?? null;
  const choose = (n: TraceNode) => { picked.current = true; setSel(n.id); };

  function exportJson() {
    if (!trace) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(trace, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url; a.download = `medx-trace-${session?.code ?? id}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    // Revoke after the click has been handled; revoking synchronously can cancel the download in some browsers.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function rederive() {
    if (!trace) return;
    setReplay({ state: "busy" });
    try {
      const r = await loadTrace();
      setReplay({ state: r.data.auditDigest === trace.auditDigest ? "match" : "mismatch", fx: r.fixture });
    } catch { setReplay({ state: "fail" }); }
  }

  return (
    <div className="mx-auto max-w-[1400px]">
      <CaseHeader
        id={id}
        active="trace"
        title={tr("title", lang)}
        lang={lang}
        session={session}
        badges={fixture ? <span title={tr("fixtureWhy", lang)}><Badge tone="pencil" icon={<Icon name="triangle-alert" size={12} />}>{tr("fixture", lang)}</Badge></span> : undefined}
        actions={<Button variant="secondary" onClick={exportJson} disabled={!trace} icon={<Icon name="file-text" size={16} />}>{tr("export", lang)}</Button>}
      >
        <p className="max-w-[80ch] text-small text-ink-soft">{tr("scope", lang)}</p>
      </CaseHeader>

      {err && <p role="alert" className="mb-3 rounded-2xl bg-signal-tint px-4 py-2 text-small font-semibold text-signal">{tr("loadFail", lang)} {err}</p>}
      {!trace && !err && <p className="text-body text-ink-soft" role="status">…</p>}

      {trace && layout && sum && (
        <>
          <p className="mb-3 flex flex-wrap gap-x-2 text-body font-semibold text-ink" data-testid="trace-summary">
            <span>{sum.steps === 1 ? tr("step1", lang) : tr("steps", lang, { n: sum.steps })}</span><span aria-hidden="true">·</span>
            <span>{sum.rules === 1 ? tr("rule1", lang) : tr("rules", lang, { n: sum.rules })}</span><span aria-hidden="true">·</span>
            <span>{sum.models === 1 ? tr("model1", lang) : tr("models", lang, { n: sum.models })}{sum.skipped > 0 && ` (${tr("skippedN", lang, { n: sum.skipped })})`}</span><span aria-hidden="true">·</span>
            <span>{sum.humans === 1 ? tr("human1", lang) : tr("humans", lang, { n: sum.humans })}</span><span aria-hidden="true">·</span>
            <span className={sum.escalatedAt ? "text-signal" : "text-ink-soft"}>{sum.escalatedAt ? tr("escalated", lang, { n: sum.escalatedAt }) : tr("notEscalated", lang)}</span>
          </p>

          <div className="grid gap-4">
            <Card padded={false} className="min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule/70 px-5 py-3">
                <Legend lang={lang} />
                <SegmentedControl size="sm" ariaLabel={tr("view", lang)} value={view} onChange={setView}
                  options={[{ value: "graph", label: tr("graph", lang) }, { value: "list", label: tr("list", lang) }]} />
              </div>
              {view === "graph" ? (
                <div ref={box} className="overflow-x-auto p-2" tabIndex={0} role="region" aria-label={`${tr("graphLabel", lang)}. ${tr("scroll", lang)}`}>
                  <div style={{ width: layout.width * scale, height: layout.height * scale }}>
                  <div className="relative origin-top-left" style={{ width: layout.width, height: layout.height, transform: `scale(${scale})` }}>
                    <svg width={layout.width} height={layout.height} className="absolute inset-0" aria-hidden="true">
                      <defs>
                        <marker id="tr-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
                          <path d="M0,0 L10,5 L0,10 z" fill="var(--color-rule-strong)" />
                        </marker>
                      </defs>
                      {layout.curves.map((c) => (
                        <g key={`${c.from}-${c.to}`}>
                          <path d={c.d} fill="none" stroke="var(--color-rule-strong)" strokeWidth={1.75} markerEnd="url(#tr-arrow)" />
                          {c.label && <text x={c.lx} y={c.ly} textAnchor="middle" fontSize={11} fill="var(--color-ink-soft)">{edgeLabel(c.label, lang)}</text>}
                        </g>
                      ))}
                    </svg>
                    {layout.placed.map((p) => (
                      <NodeCard key={p.node.id} n={p.node} step={sum.stepOf(p.node.id)} lang={lang} selected={sel === p.node.id} onPick={choose} style={{ left: p.x, top: p.y }} />
                    ))}
                  </div>
                  </div>
                </div>
              ) : (
                <ol className="divide-y divide-rule/70" aria-label={tr("list", lang)}>
                  {[...trace.nodes].sort((a, b) => a.at.localeCompare(b.at)).map((n) => (
                    <li key={n.id}>
                      <button type="button" onClick={() => choose(n)} aria-pressed={sel === n.id}
                        className={`flex w-full items-start gap-3 px-5 py-3 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ocean ${sel === n.id ? "bg-paper" : ""}`}>
                        <span className="w-16 shrink-0 text-small font-semibold text-ink-soft">{tr("stepN", lang, { n: sum.stepOf(n.id) })}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-body font-bold text-ink">{pick(n.label, lang)}</span>
                          <span className="block text-small text-ink-soft">{actorText(n, lang)} · <span className={statusColor(n.status)}>{tr(STATUS[n.status].key, lang)}</span> · {pick(n.detail, lang)}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </Card>

            <aside aria-live="polite" aria-label={tr("panel", lang)} className="order-last">
              <Card>
                <CardHeader title={tr("panel", lang)} />
                {node ? <Panel n={node} step={sum.stepOf(node.id)} lang={lang} session={session} /> : <p className="text-body text-ink-soft">{tr("pick", lang)}</p>}
              </Card>
            </aside>
          </div>

          <Card className="mt-4">
            <h2 className="text-lead font-bold text-ink">{tr("replay", lang)}</h2>
            <p className="mt-2 flex flex-wrap items-center gap-3 text-body text-ink">
              <span className="font-semibold">{tr("digest", lang)}:</span>
              <code className="break-all rounded-lg bg-paper px-2 py-1 text-small" data-testid="trace-digest">{trace.auditDigest}</code>
              <Button variant="secondary" onClick={rederive} disabled={replay.state === "busy"}>{replay.state === "busy" ? tr("deriving", lang) : tr("rederive", lang)}</Button>
            </p>
            <p role="status" aria-live="polite" className="mt-2 min-h-6 text-body font-semibold">
              {replay.state === "match" && <span className="inline-flex items-center gap-1.5 text-teal"><Icon name="check" size={16} />{tr("match", lang)} {replay.fx && tr("matchFx", lang)}</span>}
              {replay.state === "mismatch" && <span className="inline-flex items-center gap-1.5 text-signal"><Icon name="triangle-alert" size={16} />{tr("mismatch", lang)}</span>}
              {replay.state === "fail" && <span className="text-signal">{tr("rederiveFail", lang)}</span>}
            </p>
          </Card>
        </>
      )}
    </div>
  );
}

function Legend({ lang }: { lang: Lang }) {
  const chip = (cls: string, label: string) => (
    <span className="inline-flex items-center gap-1.5 text-small text-ink-soft"><span aria-hidden="true" className={`inline-block h-4 w-6 rounded-md border-2 ${cls}`} />{label}</span>
  );
  return (
    <div role="group" aria-label={tr("legend", lang)} className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {chip("border-ink bg-sheet", tr("rule", lang))}
      {chip("border-ocean bg-ocean-tint", tr("model", lang))}
      {chip("border-teal bg-teal-tint", tr("human", lang))}
      {chip("border-rule-strong bg-muted", tr("system", lang))}
      {chip("border-signal border-l-[6px]", tr("escal", lang))}
      {chip("border-dashed border-rule-strong opacity-60", tr("skipped", lang))}
      {chip("border-warn bg-warn-tint", `${tr("failed", lang)} / ${tr("abstained", lang)}`)}
    </div>
  );
}

function NodeCard({ n, step, lang, selected, onPick, style }: { n: TraceNode; step: number; lang: Lang; selected: boolean; onPick: (n: TraceNode) => void; style: React.CSSProperties }) {
  const a = ACTOR[n.actor], s = STATUS[n.status];
  return (
    <>
      <span id={`tr-d-${n.id}`} className="sr-only">{tr("actor", lang)}: {actorText(n, lang)}. {tr("status", lang)}: {tr(s.key, lang)}. {pick(n.detail, lang)}</span>
      <button type="button" onClick={() => onPick(n)} aria-pressed={selected} aria-describedby={`tr-d-${n.id}`} data-node={n.id} data-status={n.status}
        style={{ ...style, width: NODE_W, height: NODE_H }}
        className={`absolute flex flex-col justify-center gap-0.5 rounded-2xl border-2 px-3 text-left shadow-sheet transition-shadow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ocean ${a.cls} ${s.cls} ${selected ? "ring-2 ring-ocean ring-offset-2" : ""}`}>
        <span className="flex items-center gap-1.5 text-micro font-semibold text-ink-soft">
          <Icon name={iconOf(n)} size={13} />{step}. {isPharmacist(n) ? tr("pharmacist", lang) : tr(a.key, lang)}
        </span>
        <span className="line-clamp-2 text-small font-bold leading-tight text-ink">{pick(n.label, lang)}</span>
        <span className={`flex items-center gap-1 text-micro font-semibold ${statusColor(n.status)}`}><Icon name={s.icon} size={12} />{tr(s.key, lang)}</span>
      </button>
    </>
  );
}

function Panel({ n, step, lang, session }: { n: TraceNode; step: number; lang: Lang; session: IntakeSession | null }) {
  const byTurn = new Map<string, TraceNode["evidence"]>();
  for (const e of n.evidence) byTurn.set(e.turnId, [...(byTurn.get(e.turnId) ?? []), e]);
  const row = (k: K, v: React.ReactNode) => (<div className="flex gap-3"><dt className="w-28 shrink-0 text-small font-semibold text-ink-soft">{tr(k, lang)}</dt><dd className="min-w-0 text-body text-ink">{v}</dd></div>);
  return (
    <div className="md:grid md:grid-cols-2 md:gap-x-8">
      <h3 className="text-body font-bold text-ink md:col-span-2">{tr("stepN", lang, { n: step })}: {pick(n.label, lang)}</h3>
      <dl className="mt-3 flex flex-col gap-2">
        {row("actor", actorText(n, lang))}
        {row("status", <span className={`font-semibold ${statusColor(n.status)}`}>{tr(STATUS[n.status].key, lang)}</span>)}
        {row("detail", pick(n.detail, lang))}
        {n.latencyMs !== undefined && row("latency", `${n.latencyMs} ms`)}
        {row("time", clockOf(n.at, lang))}
        {row("audit", n.auditIds.length ? <span className="break-all text-small">{n.auditIds.join(", ")}</span> : <span className="text-ink-soft">{tr("noAudit", lang)}</span>)}
      </dl>
      <div>
      <h4 className="mt-4 text-small font-bold text-ink md:mt-3">{tr("evidence", lang)}</h4>
      {byTurn.size === 0 ? <p className="mt-1 text-small text-ink-soft">{tr("noEvidence", lang)}</p> : (
        <div className="mt-2 flex flex-col gap-2">
          {[...byTurn.entries()].map(([turnId, ev]) => {
            const turn = session?.turns.find((t) => t.id === turnId);
            return turn
              ? <EvidenceHighlight key={turnId} text={turn.text} lang={turn.lang} marks={ev.map((e) => ({ start: e.start, end: e.end, quote: e.quote, active: true }))} />
              : <blockquote key={turnId} className="border-l-4 border-ocean pl-3 text-body text-ink">{ev.map((e) => e.quote).join(" … ")}</blockquote>;
          })}
        </div>
      )}
      </div>
    </div>
  );
}
