import { describe, it, expect } from 'vitest';
import {
  calculateDrugDose,
  calculateFluidRate,
  getLabOrders,
  createLabOrder,
  updateLabOrderStatus,
  getHospitalizations,
  admitToHospital,
  addICUVital,
  dischargeHospitalization,
  getSurgeries,
  createSurgery,
  updateSurgeryStatus,
  getCashReconciliations,
  submitCashReconciliation,
} from '@/lib/data-service';

describe('Clinical Veterinary Calculators', () => {
  describe('calculateDrugDose', () => {
    it('accurately calculates dosage volume in mL for standard canine dosing', () => {
      // 10 kg dog, 12.5 mg/kg Amoxicillin-Clavulanate, stock concentration 50 mg/mL
      // Total mg = 10 * 12.5 = 125 mg
      // Volume = 125 / 50 = 2.5 mL
      const result = calculateDrugDose(10, 12.5, 50);
      expect(result.totalDoseMg).toBe(125);
      expect(result.volumeMl).toBe(2.5);
      expect(result.weightKg).toBe(10);
      expect(result.doseMgKg).toBe(12.5);
      expect(result.concentrationMgMl).toBe(50);
    });

    it('handles low-dose feline NSAID dosing with fractional weights', () => {
      // 4 kg cat, 0.2 mg/kg Meloxicam, 5 mg/mL
      // Total mg = 4 * 0.2 = 0.8 mg
      // Volume = 0.8 / 5 = 0.16 mL
      const result = calculateDrugDose(4, 0.2, 5);
      expect(result.totalDoseMg).toBe(0.8);
      expect(result.volumeMl).toBe(0.16);
    });

    it('safely handles zero concentration without throwing DivisionByZero', () => {
      const result = calculateDrugDose(15, 10, 0);
      expect(result.volumeMl).toBe(0);
      expect(result.totalDoseMg).toBe(150);
    });
  });

  describe('calculateFluidRate', () => {
    it('calculates standard 24-hour euvolemic maintenance fluid rate', () => {
      // 10 kg patient, 0% dehydration, 0 ongoing losses
      // Maintenance = 10 * 55 = 550 mL/day
      // Hourly rate = 550 / 24 = 22.9 mL/hr
      // Drops/min = (22.9 * 20) / 60 = ~8 drops/min
      const result = calculateFluidRate(10, 0, 0);
      expect(result.maintenanceMlDay).toBe(550);
      expect(result.dehydrationDeficitMl).toBe(0);
      expect(result.total24hMl).toBe(550);
      expect(result.hourlyRateMlHr).toBe(22.9);
      expect(result.dropsPerMinute).toBe(8);
    });

    it('accurately incorporates dehydration replacement and ongoing losses', () => {
      // 20 kg patient, 7% dehydration, 200 mL ongoing diarrhea losses
      // Maintenance = 20 * 55 = 1100 mL
      // Dehydration deficit = 20 * 0.07 * 1000 = 1400 mL
      // Ongoing losses = 200 mL
      // Total 24h = 1100 + 1400 + 200 = 2700 mL
      // Hourly rate = 2700 / 24 = 112.5 mL/hr
      // Drops/min = (112.5 * 20) / 60 = 38 drops/min
      const result = calculateFluidRate(20, 7, 200);
      expect(result.maintenanceMlDay).toBe(1100);
      expect(result.dehydrationDeficitMl).toBe(1400);
      expect(result.ongoingLossesMlDay).toBe(200);
      expect(result.total24hMl).toBe(2700);
      expect(result.hourlyRateMlHr).toBe(112.5);
      expect(result.dropsPerMinute).toBe(38);
    });
  });
});

describe('Diagnostic Lab Hub Operations', () => {
  it('retrieves laboratory orders and creates a new accessioned specimen', async () => {
    const initialOrders = await getLabOrders();
    expect(initialOrders.length).toBeGreaterThan(0);

    const res = await createLabOrder({
      patient_id: 'pat-1',
      test_type: 'biochemistry',
      status: 'pending',
      priority: 'urgent',
      clinical_notes: 'STAT pre-surgical hepatic profile',
    });

    expect(res.success).toBe(true);
    expect(res.data).toBeDefined();
    expect(res.data?.order_number).toContain('LAB-');
    expect(res.data?.priority).toBe('urgent');
  });

  it('updates lab order status and stores parametric results', async () => {
    const orders = await getLabOrders();
    const orderId = orders[0].id;

    const res = await updateLabOrderStatus(
      orderId,
      'ready',
      [{ parameter: 'ALT', value: '45', unit: 'U/L', reference_range: '10-100', status: 'normal' }],
      'Hepatic enzymes within expected clinical limits',
      'Dr. Lab Scientist'
    );

    expect(res.success).toBe(true);
  });
});

describe('ICU & Inpatient Hospitalization Operations', () => {
  it('admits a patient, logs serial vitals, and discharges with summary', async () => {
    const initial = await getHospitalizations();
    expect(initial.length).toBeGreaterThan(0);

    // 1. Admit
    const admitRes = await admitToHospital({
      patient_id: 'pat-1',
      ward_type: 'icu',
      cage_number: 'ICU-99',
      admitting_diagnosis: 'Acute pancreatitis',
      status: 'admitted',
      fluid_rate_ml_hr: 50,
    });
    expect(admitRes.success).toBe(true);
    expect(admitRes.data?.cage_number).toBe('ICU-99');
    const hospId = admitRes.data!.id;

    // 2. Add vitals
    const vitRes = await addICUVital(hospId, {
      temperature_c: 38.6,
      heart_rate_bpm: 120,
      respiratory_rate_bpm: 24,
      capillary_refill_sec: 1.5,
      mucous_membranes: 'Pink / Moist',
      pain_score: 1,
      mental_status: 'BAR',
      logged_by: 'Nurse Test',
    });
    expect(vitRes.success).toBe(true);
    expect(vitRes.data?.temperature_c).toBe(38.6);

    // 3. Discharge
    const disRes = await dischargeHospitalization(hospId, 'Resolved pancreatitis, eating normally');
    expect(disRes.success).toBe(true);
  });
});

describe('Surgical Suite Operations', () => {
  it('schedules a surgical procedure and updates status', async () => {
    const surgeries = await getSurgeries();
    expect(surgeries.length).toBeGreaterThan(0);

    const res = await createSurgery({
      patient_id: 'pat-2',
      procedure_name: 'Gastrotomy foreign body removal',
      surgeon_name: 'Dr. Bello',
      anesthesia_protocol: 'Propofol + Isoflurane',
      theater_room: 'OR-1',
      status: 'scheduled',
      scheduled_date: new Date().toISOString(),
    });

    expect(res.success).toBe(true);
    expect(res.data?.surgery_number).toContain('SURG-');

    const updateRes = await updateSurgeryStatus(res.data!.id, 'in_surgery', 'Incision made, foreign body retrieved');
    expect(updateRes.success).toBe(true);
  });
});

describe('Cash Reconciliation Variance Math', () => {
  it('correctly marks shift as balanced when actual equals expected', async () => {
    const res = await submitCashReconciliation({
      date: '2026-09-09',
      cashier_id: 'usr-1',
      cash_expected: 50000,
      cash_actual: 50000,
      pos_card_expected: 150000,
      pos_card_actual: 150000,
      bank_transfer_expected: 100000,
      bank_transfer_actual: 100000,
    });

    expect(res.success).toBe(true);
    expect(res.data?.total_expected).toBe(300000);
    expect(res.data?.total_actual).toBe(300000);
    expect(res.data?.variance).toBe(0);
    expect(res.data?.status).toBe('balanced');
  });

  it('correctly flags discrepancy when drawer has a cash shortage', async () => {
    const res = await submitCashReconciliation({
      date: '2026-09-09',
      cashier_id: 'usr-1',
      cash_expected: 50000,
      cash_actual: 48000, // Shortage of ₦2,000
      pos_card_expected: 100000,
      pos_card_actual: 100000,
      bank_transfer_expected: 50000,
      bank_transfer_actual: 50000,
      discrepancy_reason: 'Missing ₦2,000 cash in drawer',
    });

    expect(res.success).toBe(true);
    expect(res.data?.total_expected).toBe(200000);
    expect(res.data?.total_actual).toBe(198000);
    expect(res.data?.variance).toBe(-2000);
    expect(res.data?.status).toBe('discrepancy');
  });
});
