import type { IntakeSummary, Localized } from '@medx/shared';

type AbstainReason = NonNullable<IntakeSummary['abstainReason']>;
const messages: Record<AbstainReason, Localized> = {
  provider_error: {
    en: 'We could not process your answers. A member of staff needs to review them.',
    it: 'Non è stato possibile elaborare le sue risposte. È necessaria la verifica del personale.',
    th: 'ไม่สามารถประมวลผลคำตอบได้ เจ้าหน้าที่ต้องตรวจสอบข้อมูล',
  },
  schema_error: {
    en: 'We could not prepare a reliable summary. A member of staff needs to review your answers.',
    it: 'Non è stato possibile preparare un riepilogo affidabile. Il personale deve verificare le sue risposte.',
    th: 'ไม่สามารถจัดทำสรุปที่เชื่อถือได้ เจ้าหน้าที่ต้องตรวจสอบคำตอบ',
  },
  low_confidence: {
    en: 'Some answers are unclear. A member of staff needs to review them.',
    it: 'Alcune risposte non sono chiare. È necessaria la verifica del personale.',
    th: 'คำตอบบางส่วนไม่ชัดเจน เจ้าหน้าที่ต้องตรวจสอบข้อมูล',
  },
  unsupported_language: {
    en: 'We could not reliably understand the language used. Please ask a member of staff for help.',
    it: 'Non è stato possibile comprendere la lingua con sufficiente affidabilità. Chieda aiuto al personale.',
    th: 'ไม่สามารถเข้าใจภาษาที่ใช้ได้อย่างน่าเชื่อถือ โปรดขอความช่วยเหลือจากเจ้าหน้าที่',
  },
  out_of_scope: {
    en: 'These answers need a member of staff to review them.',
    it: 'Queste risposte richiedono la verifica del personale.',
    th: 'คำตอบเหล่านี้ต้องให้เจ้าหน้าที่ตรวจสอบ',
  },
  conflicting_information: {
    en: 'Some answers do not match. A member of staff needs to check them with you.',
    it: 'Alcune risposte non concordano. Il personale deve verificarle con lei.',
    th: 'คำตอบบางส่วนไม่ตรงกัน เจ้าหน้าที่ต้องตรวจสอบข้อมูลกับคุณ',
  },
};
const fallback: Localized = {
  en: 'A member of staff needs to review your answers.',
  it: 'Il personale deve verificare le sue risposte.',
  th: 'เจ้าหน้าที่ต้องตรวจสอบคำตอบของคุณ',
};

/** UI copy only. The summary retains its reason code and shared contract. */
export function abstainMessage(reason: string | undefined | null): Localized {
  return { ...(reason && Object.hasOwn(messages, reason) ? messages[reason as AbstainReason] : fallback) };
}
