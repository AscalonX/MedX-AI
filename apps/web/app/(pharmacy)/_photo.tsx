"use client";
import { useRef, useState } from "react";
import type { IntakeSession, Lang, MedPhotoSuggestion } from "@medx/shared";
import { Badge, Button, Card, CardHeader, Icon, LangMorph } from "@/components/ui";
import { L, post } from "./_lib";
import { usePharmacy } from "./_shell";

const T = {
  title: L("เพิ่มยาจากรูปถ่าย", "Aggiungi da foto", "Add from photo"),
  button: L("ถ่ายหรือเลือกรูปกล่องยา", "Scatta o scegli una foto della confezione", "Take or choose a pack photo"),
  note: L("โมเดลเสนอรายการให้ตรวจ ยังไม่เข้ารายการยาจนกว่าเภสัชกรจะยืนยัน", "Il modello suggerisce voci da verificare. Nulla entra nell'elenco finché il farmacista non conferma.", "The model suggests entries for review. Nothing joins the medicine list until you confirm."),
  loading: L("กำลังอ่านรูป อาจใช้เวลาถึงหนึ่งนาที", "Lettura della foto in corso, può richiedere fino a un minuto", "Reading the photo. This can take up to a minute."),
  fromPhoto: L("จากรูปถ่าย · ตรวจสอบ", "Da foto · verificare", "From photo · check"),
  unverified: L("ไม่พบในพจนานุกรมยา ยังไม่ยืนยัน", "Non nel dizionario, non verificato", "Not in the drug dictionary, unverified"),
  matched: L("อาจตรงกับ", "Possibile corrispondenza", "Possible match"),
  confirm: L("ยืนยัน", "Conferma", "Confirm"),
  discard: L("ทิ้ง", "Scarta", "Discard"),
  review: L("อ่านรูปนี้ไม่ได้ ต้องให้บุคลากรตรวจ กรอกชื่อยาเอง", "Foto non leggibile dal modello: serve revisione umana. Inserisci il farmaco a mano.", "The model could not read this photo: needs human review. Enter the medicine by hand."),
  failed: L("ส่งรูปไม่สำเร็จ", "Invio della foto non riuscito", "Could not send the photo"),
  identity: L("เลือกผู้ใช้งานก่อน", "Scegli prima chi è collegato", "Choose who is signed in first"),
};
const MAX_SIDE = 1600;

/** Phone photos are several MB: shrink to a JPEG well under the 4 MB server cap (also makes the model call faster). */
async function shrink(file: File): Promise<{ mime: string; imageBase64: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return { mime: "image/jpeg", imageBase64: canvas.toDataURL("image/jpeg", 0.85).split(",")[1] };
}

export function PhotoCard({ session, lang, locked }: { session: IntakeSession; lang: Lang; locked: boolean }) {
  const { reviewer, refresh } = usePharmacy();
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<"idle" | "reading" | "deciding">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const pending = (session.medPhoto ?? []).filter((s) => s.status === "matched" || s.status === "unverified");
  const call = async (body: unknown, next: "reading" | "deciding") => {
    if (!reviewer) { setMessage(T.identity[lang]); return; }
    setState(next); setMessage(null);
    try {
      const res = await post<{ outcome?: string }>(`/api/sessions/${session.id}/med-photo`, { reviewerId: reviewer, ...(body as object) });
      if (res.outcome === "needs_human_review") setMessage(T.review[lang]);
    } catch (e) { setMessage(`${(e as Error).message || T.failed[lang]}`); }
    finally { setState("idle"); refresh(); }
  };
  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try { await call(await shrink(file), "reading"); } catch { setMessage(T.failed[lang]); setState("idle"); }
    if (input.current) input.current.value = "";
  };

  return (
    <Card aria-labelledby="h-photo">
      <CardHeader title={<span id="h-photo"><LangMorph text={T.title} lang={lang} /></span>} />
      <p className="max-w-[65ch] text-small text-ink-soft"><LangMorph text={T.note} lang={lang} /></p>
      <input ref={input} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden="true" data-testid="med-photo-input" onChange={(e) => onFile(e.target.files?.[0])} />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button variant="primary" disabled={locked || state !== "idle"} onClick={() => input.current?.click()}>{T.button[lang]}</Button>
        {state === "reading" && <p role="status" className="text-small font-semibold text-ocean">{T.loading[lang]}</p>}
      </div>
      {message && <p role="alert" className="mt-3 rounded-2xl bg-warn-tint px-4 py-2 text-small text-warn">{message}</p>}
      {pending.length > 0 && (
        <ul className="mt-4 flex flex-col gap-3">
          {pending.map((s: MedPhotoSuggestion) => (
            <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-dashed border-warn/60 bg-paper p-3">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className="text-lead font-bold">{s.name}{s.strength ? `, ${s.strength}` : ""}{s.form ? `, ${s.form}` : ""}</p>
                <p className="flex flex-wrap items-center gap-2">
                  <Badge tone="pencil" icon={<Icon name="pill" size={14} />}>{T.fromPhoto[lang]}</Badge>
                  {s.generic ? <span className="text-small text-ink-soft">{T.matched[lang]}: {s.generic}</span> : <Badge tone="outline" icon={<Icon name="circle-minus" size={14} />}>{T.unverified[lang]}</Badge>}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="primary" className="h-7! px-2! text-small!" disabled={locked || state !== "idle"} onClick={() => call({ action: "confirm", suggestionId: s.id }, "deciding")}>{T.confirm[lang]}<span className="sr-only">, {s.name}</span></Button>
                <Button className="h-7! px-2! text-small!" disabled={locked || state !== "idle"} onClick={() => call({ action: "discard", suggestionId: s.id }, "deciding")}>{T.discard[lang]}<span className="sr-only">, {s.name}</span></Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
