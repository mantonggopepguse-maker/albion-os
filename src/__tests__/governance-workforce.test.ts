import { describe, it, expect } from 'vitest';
import {
  getAuditLogs,
  logAuditEvent,
  getBranchExpenses,
  addBranchExpense,
  getVetServices,
  createVetService,
  updateVetService,
  getClinicShifts,
  assignClinicShift,
  deleteClinicShift,
  getPatientReminders,
  createPatientReminder,
  updatePatientReminderStatus,
} from '@/lib/data-service';

describe('Enterprise Governance & Audit Trail', () => {
  it('retrieves system audit logs and supports category filtering', async () => {
    const allLogs = await getAuditLogs();
    expect(Array.isArray(allLogs)).toBe(true);
    expect(allLogs.length).toBeGreaterThan(0);

    const financialLogs = await getAuditLogs('financial');
    expect(financialLogs.every((l) => l.category === 'financial')).toBe(true);

    const securityLogs = await getAuditLogs('security');
    expect(securityLogs.every((l) => l.category === 'security')).toBe(true);
  });

  it('records an immutable audit event', async () => {
    const res = await logAuditEvent({
      user_id: 'usr-superadmin',
      user_name: 'Dr. Obinna SuperAdmin',
      action: 'APPROVE_HIGH_VALUE_PAYMENT',
      category: 'financial',
      severity: 'warning',
      entity_type: 'payment',
      entity_id: 'pay-test-999',
      details: { amount: 750000, channel: 'bank_transfer' },
      ip_address: '192.168.1.1',
    });

    expect(res.success).toBe(true);
    expect(res.data).toBeDefined();
    expect(res.data?.action).toBe('APPROVE_HIGH_VALUE_PAYMENT');
    expect(res.data?.category).toBe('financial');
    expect(res.data?.severity).toBe('warning');

    const logs = await getAuditLogs('financial');
    expect(logs.some((l) => l.entity_id === 'pay-test-999')).toBe(true);
  });
});

describe('Practice Operating Overheads & Expenses', () => {
  it('fetches operating expenses and filters by location', async () => {
    const allExpenses = await getBranchExpenses();
    expect(Array.isArray(allExpenses)).toBe(true);
    expect(allExpenses.length).toBeGreaterThan(0);

    const loc1 = allExpenses[0].location_id;
    const scoped = await getBranchExpenses(loc1);
    expect(scoped.every((e) => e.location_id === loc1)).toBe(true);
  });

  it('validates and records a new operating expense', async () => {
    // Validation failure: non-positive amount
    const invalidRes = await addBranchExpense({
      location_id: 'loc-1',
      category: 'fuel',
      amount: -500,
      expense_date: '2026-09-09',
      description: 'Diesel fuel',
    });
    expect(invalidRes.success).toBe(false);

    // Valid expense creation
    const validRes = await addBranchExpense({
      location_id: 'loc-1',
      category: 'fuel',
      amount: 45000,
      expense_date: '2026-09-09',
      description: 'Diesel fuel 50L for backup generator',
      vendor: 'TotalEnergies Onitsha',
      recorded_by: 'usr-ops',
    });

    expect(validRes.success).toBe(true);
    expect(validRes.data?.amount).toBe(45000);
    expect(validRes.data?.category).toBe('fuel');
    expect(validRes.data?.vendor).toBe('TotalEnergies Onitsha');
  });
});

describe('Clinical Procedures & Tariff Schedule', () => {
  it('retrieves veterinary procedures with duration metadata', async () => {
    const services = await getVetServices();
    expect(Array.isArray(services)).toBe(true);
    expect(services.length).toBeGreaterThan(0);

    const first = services[0];
    expect(first.name).toBeDefined();
    expect(first.price).toBeGreaterThan(0);
    expect(typeof first.duration_minutes === 'number' || first.duration_minutes === undefined).toBe(true);
  });

  it('creates a new veterinary service with clinical duration', async () => {
    const res = await createVetService({
      name: 'Canine Ultrasound Echocardiography',
      category: 'imaging',
      species: 'canine',
      price: 35000,
      duration_minutes: 45,
    });

    expect(res.success).toBe(true);
    expect(res.data?.name).toBe('Canine Ultrasound Echocardiography');
    expect(res.data?.price).toBe(35000);
    expect(res.data?.duration_minutes).toBe(45);
  });

  it('updates an existing veterinary service price and duration', async () => {
    const services = await getVetServices();
    const serviceToUpdate = services[0];

    const res = await updateVetService(serviceToUpdate.id, {
      price: serviceToUpdate.price + 5000,
      duration_minutes: 60,
    });

    expect(res.success).toBe(true);
    expect(res.data?.price).toBe(serviceToUpdate.price + 5000);
    expect(res.data?.duration_minutes).toBe(60);
  });
});

describe('Clinical Duty Roster & Shifts', () => {
  it('retrieves scheduled clinic shifts and allows location scoping', async () => {
    const shifts = await getClinicShifts();
    expect(Array.isArray(shifts)).toBe(true);
    expect(shifts.length).toBeGreaterThan(0);

    const locId = shifts[0].location_id;
    const scopedShifts = await getClinicShifts(locId);
    expect(scopedShifts.every((s) => s.location_id === locId)).toBe(true);
  });

  it('assigns and validates a clinical shift', async () => {
    // Missing required user_id
    const failRes = await assignClinicShift({
      user_id: '',
      location_id: 'loc-1',
      shift_date: '2026-09-15',
      shift_block: 'morning',
      start_time: '08:00',
      end_time: '16:00',
    });
    expect(failRes.success).toBe(false);

    // Valid assignment
    const assignRes = await assignClinicShift({
      user_id: 'usr-vet-1',
      staff_name: 'Dr. Jane Okoye',
      role: 'veterinarian',
      location_id: 'loc-1',
      location_name: 'Main Hospital',
      shift_date: '2026-09-15',
      shift_block: 'afternoon',
      start_time: '14:00',
      end_time: '22:00',
      notes: 'ICU & Emergency coverage',
    });

    expect(assignRes.success).toBe(true);
    expect(assignRes.data?.staff_name).toBe('Dr. Jane Okoye');
    expect(assignRes.data?.shift_block).toBe('afternoon');

    // Remove shift
    const shiftId = assignRes.data!.id;
    const delRes = await deleteClinicShift(shiftId);
    expect(delRes.success).toBe(true);
  });
});

describe('Preventive Care & Patient Recalls', () => {
  it('retrieves patient recall reminders and filters by status', async () => {
    const allReminders = await getPatientReminders();
    expect(Array.isArray(allReminders)).toBe(true);
    expect(allReminders.length).toBeGreaterThan(0);

    const pendingReminders = await getPatientReminders('pending');
    expect(pendingReminders.every((r) => r.status === 'pending')).toBe(true);
  });

  it('schedules a new patient recall and transitions status', async () => {
    const createRes = await createPatientReminder({
      patient_id: 'pat-101',
      patient_name: 'Rocky',
      species: 'Canine',
      owner_id: 'cli-01',
      owner_name: 'Chief Chukwuma',
      owner_phone: '+2348031234567',
      reminder_type: 'vaccination',
      title: 'Annual Rabies & DHPPi Booster',
      due_date: '2026-09-30',
      notes: 'Send SMS reminder 3 days prior',
    });

    expect(createRes.success).toBe(true);
    expect(createRes.data?.patient_name).toBe('Rocky');
    expect(createRes.data?.status).toBe('pending');
    expect(createRes.data?.reminder_type).toBe('vaccination');

    const reminderId = createRes.data!.id;

    // Transition to 'sent'
    const sentRes = await updatePatientReminderStatus(reminderId, 'sent');
    expect(sentRes.success).toBe(true);
    expect(sentRes.data?.status).toBe('sent');
    expect(sentRes.data?.last_notified_at).toBeDefined();

    // Transition to 'completed'
    const compRes = await updatePatientReminderStatus(reminderId, 'completed');
    expect(compRes.success).toBe(true);
    expect(compRes.data?.status).toBe('completed');
  });
});
