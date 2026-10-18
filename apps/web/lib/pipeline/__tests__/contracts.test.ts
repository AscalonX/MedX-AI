// w20 M-01: shared demo, journey, audit-type and staff contracts.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AUDIT_TYPES, AUDIT_TYPES_COMPLETE, DEMO_PERSONAS, DEMO_SAMPLES, JOURNEY_STAGE_LABELS, JOURNEY_STAGES, roleOf, STAFF, WRITE_ROLES } from '@medx/shared';
import type { AuditType, DemoCasesRes, PatientSessionView, SessionListItem } from '@medx/shared';
import { checkRedFlags } from '../redflags';

const fixture = (id: string) => JSON.parse(readFileSync(new URL(`../../../../../data/cases/${id}.json`, import.meta.url), 'utf8')) as { id: string; lang: string; synthetic: boolean; turns: { role: string; text: string }[] };

describe('DEMO_PERSONAS', () => {
  it('has exactly the six landing roles, staff names from STAFF and a valid stage', () => {
    expect(DEMO_PERSONAS.map(p => p.id)).toEqual(['patient', 'nurse-rossi', 'doctor-bianchi', 'pharm-conti', 'pharm-wong', 'ops-head']);
    for (const p of DEMO_PERSONAS) {
      expect(JOURNEY_STAGES).toContain(p.stage);
      expect(p.label).toMatch(/^[A-Z][A-Za-z0-9 ()]+$/); expect(p.task.length).toBeGreaterThan(10);
      if (p.id === 'patient') { expect(p.role).toBe('patient'); expect(p.staffName).toBeNull(); continue; }
      const member = STAFF.find(s => s.id === p.id)!;
      expect(p.staffName).toBe(member.name); expect(p.role).toBe(member.role); expect(roleOf(p.staffName)).toBe(p.role);
    }
    // Pharmacist 1 verifies and Pharmacist 2 dispenses: two different people for the two-person check.
    expect(DEMO_PERSONAS.find(p => p.id === 'pharm-conti')!.stage).toBe('pharmacy_verify');
    expect(DEMO_PERSONAS.find(p => p.id === 'pharm-wong')!.stage).toBe('pharmacy_dispense');
  });
});

describe('DEMO_SAMPLES', () => {
  it('copies each synthetic fixture verbatim and flags only the red-flag example', () => {
    expect(DEMO_SAMPLES.map(s => s.fixtureId)).toEqual(['EN-01', 'EN-02', 'IT-01', 'DEMO-GOLD', 'TH-01', 'TH-05']);
    for (const s of DEMO_SAMPLES) {
      const f = fixture(s.fixtureId);
      expect(s.synthetic).toBe(true); expect(f.synthetic).toBe(true);
      expect(s.lang).toBe(f.lang); expect(s.id).toBe(s.fixtureId);
      expect(s.text).toBe(f.turns.filter(t => t.role === 'patient')[0].text);
      // The flag matches the deterministic rules, so the landing never styles a routine example as urgent or vice versa.
      expect(s.redFlag).toBe(checkRedFlags(s.text).length > 0);
    }
    expect(DEMO_SAMPLES.filter(s => s.redFlag).map(s => s.fixtureId)).toEqual(['TH-05']);
  });
});

describe('journey stages and audit types', () => {
  it('lists every stage once, in journey order, with word labels in three languages', () => {
    expect(JOURNEY_STAGES).toEqual(['intake', 'intake_reviewed', 'triaged', 'nurse_done', 'doctor_signed', 'orders_submitted', 'pharmacy_verify', 'pharmacy_dispense', 'ready_for_pickup', 'collected']);
    for (const s of JOURNEY_STAGES) for (const l of ['en', 'it', 'th'] as const) expect(JOURNEY_STAGE_LABELS[s][l].trim().length).toBeGreaterThan(2);
  });
  it('AUDIT_TYPES is a duplicate-free runtime copy of the AuditType union (compile-time checked both ways)', () => {
    expect(new Set(AUDIT_TYPES).size).toBe(AUDIT_TYPES.length);
    expect(AUDIT_TYPES_COMPLETE).toBe(true);
    const sample: AuditType[] = ['session_created', 'order_recheck', 'pickup_collected', 'takeover'];
    for (const t of sample) expect(AUDIT_TYPES).toContain(t);
  });
  it('types the list item stage, the patient seenByStaff flag and the demo cases map', () => {
    const item: Pick<SessionListItem, 'stage'> = { stage: 'triaged' };
    const view: Pick<PatientSessionView, 'seenByStaff'> = { seenByStaff: true };
    const cases: Partial<DemoCasesRes> = { patient: null };
    expect([item.stage, view.seenByStaff, cases.patient]).toEqual(['triaged', true, null]);
  });
});

describe('roleOf', () => {
  it('matches STAFF by display name or id, ignoring case and extra spaces', () => {
    for (const s of STAFF) { expect(roleOf(s.name)).toBe(s.role); expect(roleOf(s.id)).toBe(s.role); }
    expect(roleOf('  pharmacist   LAURA conti ')).toBe('pharmacist');
    expect(roleOf('DOCTOR-BIANCHI')).toBe('doctor');
  });
  it.each(['synthetic-reviewer', 'Dr. Marco', 'Nurse', '', '   ', 'pharm-conti2'])('returns undefined for an unknown actor (%j)', actor => {
    expect(roleOf(actor)).toBeUndefined();
  });
  it('returns undefined for non-strings', () => {
    for (const v of [undefined, null, 42, {}, ['nurse-rossi']]) expect(roleOf(v)).toBeUndefined();
  });
  it('WRITE_ROLES names who may perform each clinical write', () => {
    expect(WRITE_ROLES).toEqual({ vitals: ['nurse'], triage: ['nurse'], orders: ['doctor'], sign: ['doctor'], pharmacy: ['pharmacist'] });
  });
});
