import { createHash } from 'node:crypto';
import type { AuditEvent, CaseTrace, Evidence, IntakeSession, Localized, TraceEdge, TraceNode, TraceNodeKind } from '@medx/shared';

// Pure reconstruction of what ran for ONE case. Reads only audit ids/types/payload counts, rule ids and
// field names (never turn text), so the trace carries no patient data. It changes no clinical behaviour.
const LABEL: Record<TraceNodeKind, [string, string, string]> = {
  input: ['Patient turn', 'Turno del paziente', 'ข้อความผู้ป่วย'], redact: ['Redact personal data', 'Rimozione dati personali', 'ลบข้อมูลส่วนบุคคล'],
  red_flag_rules: ['Red-flag rules', 'Regole di allerta', 'กฎสัญญาณอันตราย'], model_screen: ['Model red-flag screen', 'Controllo modello', 'โมเดลคัดกรอง'],
  extract: ['Model extraction', 'Estrazione modello', 'โมเดลสกัดข้อมูล'], verify: ['Verify against patient words', 'Verifica con le parole del paziente', 'ตรวจกับคำพูดผู้ป่วย'],
  abstain: ['Abstain', 'Astensione', 'งดสรุป'], next_question: ['Next question', 'Prossima domanda', 'คำถามถัดไป'],
  consult_rules: ['Consult rules', 'Regole di consulto', 'กฎการให้คำปรึกษา'], vitals_news2: ['Vitals and NEWS2', 'Parametri e NEWS2', 'สัญญาณชีพและ NEWS2'],
  triage_confirm: ['Triage confirmed by human', 'Triage confermato', 'ยืนยันคัดแยก'], med_rules: ['Medication rules', 'Regole farmaci', 'กฎยา'],
  order_check: ['Order checks', 'Controlli ordini', 'ตรวจคำสั่ง'], clinician_action: ['Clinician action', 'Azione del clinico', 'การดำเนินการของแพทย์'],
  pharmacist_action: ['Pharmacist action', 'Azione del farmacista', 'การดำเนินการของเภสัชกร'], output: ['Output for a human', 'Output per una persona', 'ผลลัพธ์สำหรับบุคลากร'],
};
const loc = (t: string): Localized => ({ en: t, it: t, th: t });
const num = (x: unknown) => typeof x === 'number' ? x : 0;
const strs = (x: unknown) => Array.isArray(x) ? x.filter((v): v is string => typeof v === 'string') : [];

export function auditDigest(audit: AuditEvent[]) {
  return createHash('sha256').update(audit.map(e => `${e.id}:${e.type}`).join('\n')).digest('hex');
}

export function deriveTrace(session: IntakeSession, audit: AuditEvent[], consult?: { suggestions: { kind: string; status: string; ruleId?: string }[] }): CaseTrace {
  const events = audit.filter(e => e.sessionId === session.id);
  const nodes: TraceNode[] = []; const edges: TraceEdge[] = [];
  let seq = 0;
  const add = (kind: TraceNodeKind, p: { at: string; actor: TraceNode['actor']; status?: TraceNode['status']; detail: string; ids?: AuditEvent[]; evidence?: Evidence[]; latencyMs?: number; parents?: (string | undefined)[]; edge?: string }) => {
    const id = `n${++seq}`;
    nodes.push({ id, kind, label: { en: LABEL[kind][0], it: LABEL[kind][1], th: LABEL[kind][2] }, at: p.at, actor: p.actor, status: p.status || 'ok', detail: loc(p.detail), evidence: p.evidence || [], ...(p.latencyMs !== undefined ? { latencyMs: p.latencyMs } : {}), auditIds: (p.ids || []).map(e => e.id) });
    for (const from of p.parents || []) if (from) edges.push({ from, to: id, ...(p.edge ? { label: p.edge } : {}) });
    return id;
  };
  const of = (...types: string[]) => events.filter(e => types.includes(e.type));
  const redFlagEvidence = (ruleIds: string[]) => (session.summary?.redFlags || []).filter(f => ruleIds.includes(f.ruleId)).flatMap(f => f.evidence);

  // --- per-turn pipeline: events between consecutive turn_added belong to that turn ---
  const turnStarts = events.map((e, i) => e.type === 'turn_added' ? i : -1).filter(i => i >= 0);
  let tail: string | undefined; let escalatedBy: string | undefined; let lastOutput: string | undefined;
  turnStarts.forEach((start, n) => {
    const group = events.slice(start, turnStarts[n + 1] ?? events.length);
    const turn = group[0]; const pii = group.find(e => e.type === 'pii_redacted'); const flag = group.find(e => e.type === 'red_flag');
    const summaryEv = group.find(e => e.type === 'summary_generated'); const abst = group.find(e => e.type === 'abstained');
    const input = add('input', { at: turn.at, actor: 'human', detail: `Turn ${n + 1} (${String(turn.payload.inputMode || 'text')})`, ids: [turn], parents: [tail] });
    const spans = Array.isArray(pii?.payload.replaced) ? (pii!.payload.replaced as { type: string; count: number }[]) : [];
    const redact = add('redact', { at: (pii || turn).at, actor: 'rule', detail: spans.length ? spans.map(r => `${r.type} x${r.count}`).join(', ') + ' replaced' : 'No personal data found', ids: pii ? [pii] : [], parents: [input] });
    const ruleIds = strs(flag?.payload.ruleIds);
    const rules = add('red_flag_rules', { at: (flag || summaryEv || turn).at, actor: 'rule', status: flag ? 'escalated' : 'ok', detail: flag ? `Fired: ${ruleIds.join(', ')}` : 'No rule fired', ids: flag ? [flag] : [], evidence: flag ? redFlagEvidence(ruleIds) : [], parents: [redact] });
    const calls = Array.isArray(summaryEv?.payload.modelCalls) ? (summaryEv!.payload.modelCalls as { step: string; ok: boolean; latencyMs: number }[]) : [];
    const callInfo = (step: string) => { const c = calls.filter(x => x.step === step); return { n: c.length, failed: c.filter(x => !x.ok).length, ms: c.reduce((t, x) => t + num(x.latencyMs), 0) }; };
    if (flag) {
      // Escalation stops the pipeline: model nodes are recorded as not run.
      const skipped = (['model_screen', 'extract', 'verify'] as const).map(k => add(k, { at: flag.at, actor: k === 'verify' ? 'rule' : 'model', status: 'skipped', detail: 'Skipped: escalated by red-flag rule', parents: [rules], edge: 'escalated' }));
      lastOutput = add('output', { at: flag.at, actor: 'system', status: 'escalated', detail: `Escalation to clinician (${ruleIds.length} rule${ruleIds.length === 1 ? '' : 's'})`, ids: summaryEv ? [summaryEv] : [], parents: [skipped[2]] });
      tail = lastOutput; escalatedBy = flag.id; return;
    }
    const screen = callInfo('red_flags'), ext = callInfo('extract');
    const ms = add('model_screen', { at: (summaryEv || turn).at, actor: 'model', status: screen.failed ? 'failed' : 'ok', detail: screen.n ? `${screen.n} call(s), ${screen.failed} failed` : 'Rules only', latencyMs: screen.ms, parents: [rules] });
    const ex = add('extract', { at: (summaryEv || turn).at, actor: 'model', status: ext.failed ? 'failed' : 'ok', detail: ext.n ? `${ext.n} call(s), ${ext.failed} failed` : 'No extraction call', latencyMs: ext.ms, parents: [rules] });
    const supported = num(summaryEv?.payload.supported), required = num(summaryEv?.payload.required);
    const verify = add('verify', { at: (summaryEv || turn).at, actor: 'rule', detail: `${supported} of ${required} required fields supported by patient quotes`, ids: summaryEv ? [summaryEv] : [], parents: [ms, ex] });
    if (abst) { tail = add('abstain', { at: abst.at, actor: 'system', status: 'abstained', detail: `Abstained: ${String(abst.payload.reason || 'unspecified')}`, ids: [abst], parents: [verify] }); lastOutput = tail; }
    else {
      const next = n === turnStarts.length - 1 ? session.summary?.nextQuestion : null;
      tail = add('next_question', { at: (summaryEv || turn).at, actor: 'system', status: next === null && n === turnStarts.length - 1 ? 'skipped' : 'ok', detail: next ? `Ask about ${next.field}` : n === turnStarts.length - 1 ? 'No further question' : 'Asked in a later step', parents: [verify] });
      lastOutput = tail;
    }
  });
  void escalatedBy;

  // --- case-level branches, driven by what actually exists ---
  const root = tail;
  const consultEvents = of('consult_turn', 'consult_suggestion');
  const sug = consult?.suggestions || [];
  let consultNode: string | undefined;
  if (consultEvents.length || sug.length) {
    const rf = sug.filter(s => s.kind === 'rule_out').length, cons = sug.filter(s => s.kind === 'consider').length, kept = sug.filter(s => s.kind === 'consider' && s.status === 'asked').length;
    consultNode = add('consult_rules', { at: (consultEvents.at(-1) || events.at(-1)!).at, actor: 'rule', detail: `${rf} question(s), ${cons} consideration(s), ${kept} kept; ${of('consult_turn').length} consult turn(s)`, ids: consultEvents, parents: [root] });
  }
  const vit = of('vitals_recorded'); let vitNode: string | undefined;
  if (vit.length) vitNode = add('vitals_news2', { at: vit.at(-1)!.at, actor: 'rule', detail: `${vit.length} reading(s), suggested level ${session.triage?.suggestedLevel ?? '?'}${session.triage?.warningScore !== undefined ? `, NEWS2 ${session.triage.warningScore}` : ''}`, ids: vit, parents: [consultNode || root] });
  const tri = of('triage_confirmed'); let triNode: string | undefined;
  if (tri.length) triNode = add('triage_confirm', { at: tri.at(-1)!.at, actor: 'human', detail: `Level ${num(tri.at(-1)!.payload.level)} confirmed (suggested ${num(tri.at(-1)!.payload.suggestedLevel)})`, ids: tri, parents: [vitNode || root] });

  const s = session.summary; const alerts = s?.medAlerts || [];
  let medNode: string | undefined;
  if ((s?.medications?.length || 0) + (s?.allergies?.length || 0) > 0 || alerts.length) {
    medNode = add('med_rules', { at: s!.generatedAt, actor: 'rule', detail: `${s?.medications?.length || 0} medicine(s), ${s?.allergies?.length || 0} allergy entr${(s?.allergies?.length || 0) === 1 ? 'y' : 'ies'}; alerts: ${[...new Set(alerts.map(a => a.ruleId))].join(', ') || 'none'}`, evidence: [...(s?.medications || []), ...(s?.allergies || [])].flatMap(e => e.evidence), parents: [root], edge: 'medications' });
  }
  const orderEv = of('order_drafted', 'order_submitted', 'order_cancelled'); let orderNode: string | undefined;
  const meds = session.orders?.medications || []; const invs = session.orders?.investigations || [];
  if (orderEv.length || meds.length || invs.length) {
    const fired = [...new Set(meds.flatMap(m => m.checks.map(c => c.ruleId)))];
    orderNode = add('order_check', { at: (orderEv.at(-1) || events.at(-1)!).at, actor: 'rule', detail: `${meds.length} medication order(s), ${invs.length} investigation(s); rules fired: ${fired.join(', ') || 'none'}; overrides ${meds.reduce((t, m) => t + m.overrides.length, 0)}`, ids: orderEv, parents: [medNode || triNode || consultNode || root], edge: 'orders' });
  }
  // Humans, in audit order, each hanging off the branch it acts on.
  let humanTail: string | undefined;
  for (const e of events) {
    const parent = humanTail || undefined;
    if (e.type === 'review' || e.type === 'red_flag_review' || e.type === 'takeover') humanTail = add('clinician_action', { at: e.at, actor: 'human', detail: `${e.type}${Array.isArray(e.payload.actions) ? ` (${e.payload.actions.length} action(s))` : ''}`, ids: [e], parents: [parent || root] });
    else if (e.type === 'consult_note_signed') humanTail = add('clinician_action', { at: e.at, actor: 'human', detail: `Consult note signed (${num(e.payload.lineCount)} lines, ${strs(e.payload.keptConsiderationIds).length} consideration(s) kept)`, ids: [e], parents: [consultNode || parent || root] });
    else if (e.type === 'pharmacy_review') humanTail = add('pharmacist_action', { at: e.at, actor: 'human', detail: `Pharmacy review${e.payload.complete ? ' (reconciled)' : ''}`, ids: [e], parents: [medNode || parent || root] });
    else if (e.type === 'order_pharmacy_action') humanTail = add('pharmacist_action', { at: e.at, actor: 'human', detail: `Order ${String(e.payload.action)}`, ids: [e], parents: [orderNode || parent || root] });
  }
  void lastOutput;
  const last = events.at(-1);
  return { sessionId: session.id, version: '1', generatedAt: last?.at ?? session.updatedAt, nodes, edges, auditDigest: auditDigest(events) };
}
