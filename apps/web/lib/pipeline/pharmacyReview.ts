import type { PharmacyReviewReq } from '@medx/shared';
import { PipelineError } from './pipeline';
import { lookupDrug, MEDRULES, refreshMedAlerts } from './medrules';
import { object, shortString } from './schema';
import { redact } from './redact';
import { appendAudit, getSession, saveSession, withSessionLock } from './store';

function invalid(reason: string): never { throw new PipelineError(reason, 'bad_request'); }
export function validatePharmacyReview(value: unknown): asserts value is PharmacyReviewReq {
  if (!object(value) || Object.keys(value).some(k => !['reviewerId', 'medActions', 'alertActions', 'allergyActions', 'complete'].includes(k)) || !shortString(value.reviewerId, 200) || (value.complete !== undefined && typeof value.complete !== 'boolean')) invalid('Invalid pharmacy review body');
  const lists = [
    { key: 'medActions', id: 'medId', actions: ['verify', 'edit', 'discontinue'], optional: ['generic', 'dose', 'frequency'] },
    { key: 'alertActions', id: 'alertId', actions: ['acknowledge', 'resolved', 'false_alarm'], optional: ['note'] },
    { key: 'allergyActions', id: 'allergyId', actions: ['verify', 'edit'], optional: ['allergenClass', 'reaction'] },
  ];
  let count = 0;
  for (const list of lists) {
    const xs = value[list.key];
    if (xs === undefined && list.key === 'allergyActions') continue;
    if (!Array.isArray(xs) || xs.length > 100) invalid(`Invalid ${list.key}`);
    const ids = new Set<string>();
    for (const a of xs) {
      if (!object(a) || !shortString(a[list.id], 200) || ids.has(a[list.id] as string) || !list.actions.includes(String(a.action)) || Object.keys(a).some(k => ![list.id, 'action', ...list.optional].includes(k)) || list.optional.some(k => a[k] !== undefined && !(a[k] === '' && ['dose', 'frequency', 'reaction'].includes(k)) && !shortString(a[k], k === 'note' ? 2000 : 300))) invalid(`Invalid ${list.key} action`);
      if (a.action === 'false_alarm' && (typeof a.note !== 'string' || !a.note.trim())) invalid('False alarm requires a note');
      if (a.action === 'edit' && !list.optional.some(k => a[k] !== undefined)) invalid('Edit requires a corrected value');
      if (a.action !== 'edit' && list.optional.filter(k => k !== 'note').some(k => a[k] !== undefined)) invalid('Corrections require edit');
      ids.add(a[list.id] as string); count++;
    }
  }
  if (!count && value.complete !== true) invalid('No pharmacy action supplied');
  // Accepted audit payloads are byte-for-value identical to the request actions.
  // Reject PII rather than silently rewriting a pharmacist's signed decision.
  const freeText = new Set(['reviewerId', 'note', 'generic', 'dose', 'frequency', 'allergenClass', 'reaction']);
  const check = (x: unknown): void => { if (Array.isArray(x)) x.forEach(check); else if (object(x)) for (const [key, v] of Object.entries(x)) { if (freeText.has(key) && typeof v === 'string' && redact(v).text !== v) invalid('Remove personal data from pharmacy review'); if (typeof v === 'object') check(v); } };
  check(value);
}

export async function pharmacyReview(sessionId: string, value: unknown) {
  validatePharmacyReview(value);
  return withSessionLock(sessionId, () => {
    const session = getSession(sessionId);
    if (!session) throw new PipelineError('Session not found', 'not_found');
    if (!session.summary) invalid('Session has no summary to review');
    const summary = session.summary!; const at = new Date().toISOString();
    const reviewerId = value.reviewerId;
    for (const a of value.medActions) {
      const m = summary.medications?.find(m => m.id === a.medId); if (!m) invalid('Unknown medication');
      if (a.action === 'edit') {
        const previous = m.review?.previous || { generic: m.generic, dose: m.dose, frequency: m.frequency };
        if (a.generic !== undefined) {
          const d = MEDRULES.drugs.find(d => d.generic === a.generic) || lookupDrug(a.generic);
          m.generic = d?.generic ?? a.generic; m.drugClass = d?.drugClass ?? null;
        }
        if (a.dose !== undefined) m.dose = a.dose === '' ? null : a.dose;
        if (a.frequency !== undefined) m.frequency = a.frequency === '' ? null : a.frequency;
        m.status = 'edited'; m.review = { reviewerId, at, previous };
      } else { m.status = a.action === 'verify' ? 'verified' : 'discontinued'; m.review = { ...m.review, reviewerId, at }; }
    }
    for (const a of value.allergyActions || []) {
      const allergy = summary.allergies?.find(x => x.id === a.allergyId); if (!allergy) invalid('Unknown allergy');
      if (a.action === 'edit') {
        const previous = allergy.review?.previous || { allergenClass: allergy.allergenClass, reaction: allergy.reaction };
        if (a.allergenClass !== undefined) allergy.allergenClass = a.allergenClass;
        if (a.reaction !== undefined) allergy.reaction = a.reaction === '' ? null : a.reaction;
        allergy.status = 'edited'; allergy.review = { reviewerId, at, previous };
      } else { allergy.status = 'verified'; allergy.review = { ...allergy.review, reviewerId, at }; }
    }
    refreshMedAlerts(summary);
    for (const a of value.alertActions) {
      const alert = summary.medAlerts?.find(x => x.id === a.alertId); if (!alert) invalid('Unknown medication alert');
      alert.review = { action: a.action, reviewerId, at, ...(a.note !== undefined ? { note: a.note } : {}) };
    }
    if (value.complete) {
      const blockers = [
        ...(summary.medAlerts || []).filter(a => a.severity === 'high' && !a.review).map(a => `high alert ${a.ruleId} requires review`),
        ...(summary.medications || []).filter(m => ['unmatched', 'unsupported'].includes(m.status) && !m.review).map(m => `medication ${m.id} requires review`),
      ];
      if (blockers.length) throw new PipelineError(`Cannot reconcile: ${blockers.join('; ')}`, 'bad_request', 409);
    }
    session.pharmacyStatus = value.complete ? 'reconciled' : 'in_review';
    session.pharmacyReviewerId = reviewerId; session.updatedAt = at;
    const payload = { ...value } as Record<string, unknown>; delete payload.reviewerId;
    saveSession(session); appendAudit(sessionId, 'pharmacy_review', 'clinician', payload, reviewerId, at);
    return session;
  });
}
