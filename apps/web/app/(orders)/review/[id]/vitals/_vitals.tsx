"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { WRITE_ROLES, type Consciousness, type GetSessionRes, type IntakeSession, type Lang, type VitalSigns, type VitalsReq } from "@medx/shared";
import { Badge, Button, Card, CardHeader, Field, Icon, Receipt, SegmentedControl, buttonClasses } from "@/components/ui";
import { notifyCaseChanged } from "../../../../_shared/caseEvents";
import { Head, Notice, ReadOnlyNote, noDash, useIdentity } from "../../../_bits";
import { fixtureConfirm, fixtureSession, fixtureVitals } from "../../../_fixture";
import { asSession, call, clockOf, tr, type TKey } from "../../../_lib";

type K = "heartRate" | "systolicBP" | "diastolicBP" | "respRate" | "tempC" | "spo2" | "painScore";
const FIELDS: { k: K; label: TKey; min: number; max: number; step?: string }[] = [
  { k: "heartRate", label: "hr", min: 20, max: 250 },
  { k: "systolicBP", label: "sys", min: 40, max: 300 },
  { k: "diastolicBP", label: "dia", min: 20, max: 200 },
  { k: "respRate", label: "rr", min: 4, max: 70 },
  { k: "tempC", label: "temp", min: 30, max: 43, step: "0.1" },
  { k: "spo2", label: "spo2", min: 50, max: 100 },
  { k: "painScore", label: "pain", min: 0, max: 10 },
];
const ACVPU: { value: Consciousness | ""; label: TKey }[] = [
  { value: "", label: "notAssessed" }, { value: "alert", label: "cAlert" }, { value: "new_confusion", label: "cConfusion" }, { value: "voice", label: "cVoice" },
  { value: "pain", label: "cPain" }, { value: "unresponsive", label: "cUnresp" },
];
const LEVELS = [1, 2, 3, 4, 5] as const;
type Level = (typeof LEVELS)[number];

export function Vitals({ id }: { id: string }) {
  const { lang, reviewer, role, setClinicianRole } = useIdentity("Vitals");
  const router = useRouter();
  // Server enforces the same rule (403): vitals and triage confirmation are nurse writes.
  const canEnter = (WRITE_ROLES.vitals as readonly string[]).includes(role);
  const [session, setSession] = useState<IntakeSession | null>(null);
  const [fixture, setFixture] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [vals, setVals] = useState<Record<K, string>>({ heartRate: "", systolicBP: "", diastolicBP: "", respRate: "", tempC: "", spo2: "", painScore: "" });
  const [onO2, setOnO2] = useState<"" | "yes" | "no">("");
  const [cons, setCons] = useState<Consciousness | "">("");
  const [errs, setErrs] = useState<Partial<Record<K | "form" | "o2", string>>>({});
  const [busy, setBusy] = useState(false);
  const [level, setLevel] = useState<Level>(3);
  const [note, setNote] = useState("");
  const [cErr, setCErr] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const fixtureRef = useRef(false);
  fixtureRef.current = fixture;

  const load = useCallback(async () => {
    try {
      const r = await call<GetSessionRes>(`/api/sessions/${id}`, undefined, () => ({ session: fixtureSession(id), audit: [] }));
      setSession((cur) => (fixtureRef.current && cur ? cur : r.data.session)); // never overwrite fixture edits with the sample session
      setFixture((f) => f || r.fixture);
      setLoadErr(null);
    } catch (e) { setLoadErr((e as Error).message); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  const triage = session?.triage;
  const nVitals = session?.vitals?.length ?? 0;
  useEffect(() => { if (triage) { setLevel(triage.suggestedLevel); setNote(""); setCErr(null); } }, [triage?.suggestedLevel, nVitals]); // eslint-disable-line react-hooks/exhaustive-deps

  function validate(): Partial<Record<K | "form" | "o2", string>> {
    const e: Partial<Record<K | "form" | "o2", string>> = {};
    let any = !!cons;
    for (const f of FIELDS) {
      const s = vals[f.k].trim();
      if (!s) continue;
      any = true;
      const n = Number(s);
      if (!Number.isFinite(n) || n < f.min || n > f.max || (f.k === "painScore" && !Number.isInteger(n))) e[f.k] = tr("range", lang, { min: f.min, max: f.max });
    }
    const sys = vals.systolicBP.trim(), dia = vals.diastolicBP.trim();
    if (!!sys !== !!dia) e[sys ? "diastolicBP" : "systolicBP"] = tr("diaNeedsSys", lang);
    else if (sys && dia && !e.systolicBP && !e.diastolicBP && Number(dia) >= Number(sys)) e.diastolicBP = tr("diaLess", lang);
    if (!onO2) e.o2 = tr("o2Required", lang);
    if (!any) e.form = tr("needOne", lang);
    return e;
  }

  async function save(ev: React.FormEvent) {
    ev.preventDefault();
    const e = validate();
    setErrs(e);
    if (Object.keys(e).length) {
      const first = FIELDS.find((f) => e[f.k]);
      if (first) formRef.current?.querySelector<HTMLInputElement>(`[name=${first.k}]`)?.focus();
      return;
    }
    const num = (k: K) => (vals[k].trim() ? Number(vals[k]) : undefined);
    const req: VitalsReq = {
      recordedBy: reviewer,
      vitals: { heartRate: num("heartRate"), systolicBP: num("systolicBP"), diastolicBP: num("diastolicBP"), respRate: num("respRate"), tempC: num("tempC"), spo2: num("spo2"), onOxygen: onO2 === "yes", painScore: num("painScore"), consciousness: cons || undefined },
    };
    setBusy(true);
    try {
      const r = await call<unknown>(`/api/sessions/${id}/vitals`, req, () => fixtureVitals(session ?? fixtureSession(id), req));
      setSession(asSession(r.data));
      if (r.fixture) setFixture(true); else notifyCaseChanged(id);
      setVals({ heartRate: "", systolicBP: "", diastolicBP: "", respRate: "", tempC: "", spo2: "", painScore: "" });
      setOnO2(""); setCons("");
      formRef.current?.querySelector<HTMLInputElement>("[name=heartRate]")?.focus();
    } catch (x) { setErrs({ form: (x as Error).message }); }
    finally { setBusy(false); }
  }

  async function confirm() {
    if (!triage) return;
    if (level > triage.suggestedLevel && !note.trim()) { setCErr(tr("noteLower", lang)); return; }
    setCErr(null);
    setBusy(true);
    const req = { reviewerId: reviewer, level, note: note.trim() || undefined };
    try {
      const r = await call<unknown>(`/api/sessions/${id}/triage/confirm`, req, () => fixtureConfirm(session!, reviewer, level, req.note));
      setSession(asSession(r.data));
      if (r.fixture) setFixture(true); else notifyCaseChanged(id);
    } catch (x) { setCErr((x as Error).message); }
    finally { setBusy(false); }
  }

  /** "Ready for doctor": switch this browser to the doctor role and open the doctor consult (S-01). */
  function handOver() {
    setClinicianRole("doctor"); // writes medx.clinicianRole and medx.role
    router.push(`/review/${id}/consult?mode=doctor`);
  }

  const hist = [...(session?.vitals ?? [])].reverse();
  return (
    <div className="mx-auto max-w-6xl">
      <Head id={id} active="vitals" title={tr("vitalsTitle", lang)} session={session} lang={lang} fixture={fixture} />
      {loadErr && <Notice>{tr("loadFail", lang)} {loadErr}</Notice>}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {canEnter ? <Card>
          <CardHeader title={tr("vitalsTitle", lang)} />
          <p className="-mt-2 mb-4 text-small text-ink-soft">{tr("vitalsHint", lang)}</p>
          <form ref={formRef} onSubmit={save} noValidate className="space-y-4">
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              {FIELDS.map((f, i) => (
                <Field
                  key={f.k} name={f.k} label={tr(f.label, lang)} type="number" inputMode="decimal" step={f.step ?? "1"} min={f.min} max={f.max}
                  autoFocus={i === 0} autoComplete="off" value={vals[f.k]} error={errs[f.k]} className="h-14! text-lead! font-semibold"
                  onChange={(e) => setVals((v) => ({ ...v, [f.k]: e.target.value }))}
                />
              ))}
              <fieldset className="col-span-2">
                <legend className="mb-1.5 text-small font-semibold text-ink">{tr("onO2", lang)}</legend>
                <div className="flex flex-wrap gap-3">
                  {(["no", "yes"] as const).map((v) => (
                    <label key={v} className="flex h-14 flex-1 items-center gap-3 rounded-control border border-rule-strong/70 px-4 text-body font-semibold text-ink">
                      <input type="radio" name="onOxygen" value={v} checked={onO2 === v} onChange={() => setOnO2(v)} className="size-5 accent-teal" />
                      {tr(v === "yes" ? "yesO2" : "roomAir", lang)}
                    </label>
                  ))}
                </div>
                {errs.o2 && <p className="mt-1 text-small text-signal">{errs.o2}</p>}
              </fieldset>
            </div>
            <div>
              <p id="acvpu" className="mb-1.5 text-small font-semibold text-ink">{tr("acvpu", lang)}</p>
              <div role="radiogroup" aria-label={tr("acvpu", lang)} className="flex flex-wrap gap-2">
                {ACVPU.map((o) => (
                  <label key={o.label} className={`flex h-10 cursor-pointer items-center rounded-full border px-4 text-small font-semibold ${cons === o.value ? "border-ink bg-ink text-sheet" : "border-rule-strong/60 bg-sheet text-ink-soft"} focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ocean`}>
                    <input type="radio" name="acvpu" checked={cons === o.value} onChange={() => setCons(o.value as Consciousness | "")} className="sr-only" />
                    {tr(o.label, lang)}
                  </label>
                ))}
              </div>
            </div>
            {errs.form && <Notice>{errs.form}</Notice>}
            <Button type="submit" variant="primary" size="lg" disabled={busy} icon={<Icon name="activity" />}>{busy ? tr("saving", lang) : tr("save", lang)}</Button>
          </form>
        </Card> : <Card><ReadOnlyNote>{tr("nursesOnly", lang)}</ReadOnlyNote></Card>}

        <div className="space-y-5">
          {!triage ? (
            <Card className="text-body text-ink-soft">{tr("noHistory", lang)}</Card>
          ) : (
            <>
              <Card aria-live="polite">
                <CardHeader title={tr("alerts", lang)} />
                {triage.vitalAlerts.length === 0 ? (
                  <p className="text-body text-ink-soft">{tr("noAlerts", lang)}</p>
                ) : (
                  <ul className="flex flex-wrap gap-2">
                    {triage.vitalAlerts.map((a) => (
                      <li key={a.id}>
                        <Badge tone={a.severity === "high" ? "signalOutline" : "pencil"} icon={<Icon name="triangle-alert" size={12} />} className="h-auto min-h-6 whitespace-normal py-1">
                          {a.severity === "high" ? `${tr("high", lang)}: ` : `${tr("moderate", lang)}: `}{noDash(a.message[lang])}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card>
                <Badge tone="ocean" icon={<Icon name="clipboard-list" size={12} />}>{tr("suggestionLabel", lang)}</Badge>
                <h2 className="mt-3 text-title font-bold text-ink">{tr("suggestedLevel", lang, { n: triage.suggestedLevel })}</h2>
                <p className="text-small text-ink-soft">{tr("levelScale", lang)}{triage.warningScore !== undefined && <> {tr("warningScore", lang)}: <b>{triage.warningScore}</b></>}</p>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-body text-ink">
                  {triage.reasons.map((r, i) => <li key={i}>{noDash(r[lang])}</li>)}
                </ul>

                {triage.confirmed && triage.suggestedLevel >= triage.confirmed.level ? (
                  <Receipt
                    className="mt-4"
                    focusOnMount={false}
                    title={tr("confirmed", lang, { who: triage.confirmed.by })}
                    rows={[
                      { label: tr("level", lang), value: triage.confirmed.level },
                      { label: tr("confirmedBy", lang), value: triage.confirmed.by },
                      { label: tr("at", lang), value: clockOf(triage.confirmed.at, lang) },
                      ...(triage.confirmed.note ? [{ label: tr("note", lang), value: triage.confirmed.note }] : []),
                    ]}
                    footer={
                      // S-01 handover: navigation only (the role switch is local); the doctor then runs the consult.
                      <section aria-label={tr("handoverTitle", lang)} className="flex w-full flex-col gap-2 border-t border-rule/70 pt-3" data-handover>
                        <p className="text-small text-ink-soft">{tr("readyForDoctorHint", lang)}</p>
                        <div className="flex flex-wrap gap-2">
                          <Button variant="primary" icon={<Icon name="user-check" size={16} />} onClick={handOver}>{tr("readyForDoctor", lang)}</Button>
                          {canEnter && <Link href={`/review/${id}/consult?mode=nurse`} className={buttonClasses({ variant: "secondary" })}><Icon name="mic" size={16} />{tr("startHistory", lang)}</Link>}
                        </div>
                      </section>
                    }
                  />
                ) : !canEnter ? null : (
                  <div className="mt-4 space-y-3 border-t border-rule/70 pt-4">
                    {triage.confirmed && (
                      <p role="alert" className="rounded-2xl border-l-4 border-signal bg-signal-tint px-4 py-2 text-body font-bold text-signal">
                        {tr("moreUrgent", lang)} <span className="font-normal">({tr("prevConfirmed", lang)}: {triage.confirmed.level})</span>
                      </p>
                    )}
                    <SegmentedControl
                      ariaLabel={tr("yourLevel", lang)} value={String(level) as "1"} onChange={(v) => setLevel(Number(v) as Level)}
                      options={LEVELS.map((n) => ({ value: String(n) as "1", label: String(n) }))}
                    />
                    <Field label={tr("note", lang)} hint={level > triage.suggestedLevel && !cErr ? tr("noteLower", lang) : undefined} error={cErr ?? undefined} value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
                    <Button variant="primary" disabled={busy} icon={<Icon name="circle-check" size={16} />} onClick={confirm}>{tr("confirmLevel", lang, { n: level })}</Button>
                  </div>
                )}
              </Card>
            </>
          )}
        </div>
      </div>

      <Card className="mt-5">
        <CardHeader title={tr("history", lang)} />
        {hist.length === 0 ? (
          <p className="text-body text-ink-soft">{tr("noHistory", lang)}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-body">
              <thead className="text-small text-ink-soft">
                <tr>{(["time", "hr", "bp", "rr", "temp", "spo2", "o2col", "acvpuCol", "pain", "by"] as TKey[]).map((h) => <th key={h} scope="col" className="py-2 pr-4 font-semibold">{["time", "bp", "by", "o2col", "acvpuCol"].includes(h) ? tr(h, lang) : tr(h, lang).replace(/ \(.*\)/, "")}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {hist.map((v, i) => <Row key={v.id} v={v} prev={hist[i + 1]} lang={lang} />)}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <p className="mt-4 text-small text-ink-soft">{tr("prototype", lang)}</p>
    </div>
  );
}

function Trend({ cur, prev }: { cur?: number; prev?: number }) {
  if (cur === undefined) return <span className="text-graphite">-</span>;
  const d = prev === undefined ? 0 : cur - prev;
  return <span>{cur}{d !== 0 && <span className="ml-1 text-small text-ink-soft" title={`${d > 0 ? "+" : ""}${Math.round(d * 10) / 10}`}>{d > 0 ? "↑" : "↓"}<span className="sr-only"> {d > 0 ? "up" : "down"} {Math.abs(Math.round(d * 10) / 10)}</span></span>}</span>;
}
function Row({ v, prev, lang }: { v: VitalSigns; prev?: VitalSigns; lang: Lang }) {
  return (
    <tr>
      <td className="py-2 pr-4 text-ink-soft">{clockOf(v.at, lang)}</td>
      <td className="pr-4"><Trend cur={v.heartRate} prev={prev?.heartRate} /></td>
      <td className="pr-4">{v.systolicBP !== undefined ? <Trend cur={v.systolicBP} prev={prev?.systolicBP} /> : "-"}{v.diastolicBP !== undefined && <span>/{v.diastolicBP}</span>}</td>
      <td className="pr-4"><Trend cur={v.respRate} prev={prev?.respRate} /></td>
      <td className="pr-4"><Trend cur={v.tempC} prev={prev?.tempC} /></td>
      <td className="pr-4"><Trend cur={v.spo2} prev={prev?.spo2} /></td>
      <td className="pr-4">{v.onOxygen === undefined ? "-" : tr(v.onOxygen ? "yes" : "no", lang)}</td>
      <td className="pr-4">{v.consciousness ? tr(ACVPU.find((o) => o.value === v.consciousness)?.label ?? "notAssessed", lang) : "-"}</td>
      <td className="pr-4"><Trend cur={v.painScore} prev={prev?.painScore} /></td>
      <td className="text-ink-soft">{v.recordedBy}</td>
    </tr>
  );
}
