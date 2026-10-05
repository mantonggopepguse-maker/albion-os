import { describe, expect, it, beforeEach } from 'vitest';
import { dispensePrescription, getNarcoticLogs } from '@/lib/data-service';

describe('Pharmacy POS Dispensing & Narcotics Custody', () => {
  it('rejects an empty dispense request', async () => {
    const res = await dispensePrescription({
      patient_id: 'pat-1',
      items: [],
      payment_method: 'cash',
      user_id: 'usr-1',
      authorizer_name: 'Dr. Test',
    });
    expect(res.success).toBe(false);
    expect(res.error).toBe('Cart is empty');
  });

  it('rejects controlled substance dispensation without valid PIN', async () => {
    const res = await dispensePrescription({
      patient_id: 'pat-1',
      items: [
        {
          product_id: 'prod-ketamine',
          product_name: 'Ketamine 100mg/mL',
          quantity: 2,
          unit_price: 5000,
          is_controlled: true,
        },
      ],
      payment_method: 'cash',
      user_id: 'usr-1',
      authorizer_name: 'Dr. Test',
      pin: '', // missing PIN
    });
    expect(res.success).toBe(false);
    expect(res.error).toContain('PIN is required');
  });

  it('rejects invalid controlled drug authorization PIN', async () => {
    const res = await dispensePrescription({
      patient_id: 'pat-1',
      items: [
        {
          product_id: 'prod-ketamine',
          product_name: 'Ketamine 100mg/mL',
          quantity: 2,
          unit_price: 5000,
          is_controlled: true,
        },
      ],
      payment_method: 'cash',
      user_id: 'usr-1',
      authorizer_name: 'Dr. Test',
      pin: '9999', // wrong PIN
    });
    expect(res.success).toBe(false);
    expect(res.error).toContain('Invalid Narcotics Authorization PIN');
  });

  it('allows non-controlled medication dispensing without requiring PIN', async () => {
    const res = await dispensePrescription({
      patient_id: 'pat-1',
      items: [
        {
          product_id: 'prod-amox',
          product_name: 'Amoxicillin 250mg',
          quantity: 3,
          unit_price: 1500,
          is_controlled: false,
        },
      ],
      payment_method: 'cash',
      user_id: 'usr-1',
      authorizer_name: 'Pharm. Tech',
    });
    expect(res.success).toBe(true);
    expect(res.data?.total_amount).toBe(4500);
    expect(res.data?.has_controlled).toBe(false);
  });

  it('successfully dispenses controlled substance with valid PIN and writes to custody log', async () => {
    const initialLogs = await getNarcoticLogs();
    const initialCount = initialLogs.length;

    const res = await dispensePrescription({
      patient_id: 'pat-simba',
      patient_name: 'Simba (Canine)',
      items: [
        {
          product_id: 'prod-ketamine',
          product_name: 'Ketamine 100mg/mL Injection',
          quantity: 2,
          unit_price: 6000,
          is_controlled: true,
        },
      ],
      payment_method: 'pos_card',
      pin: '1234',
      user_id: 'usr-vet-1',
      authorizer_name: 'Dr. Bello',
      location_id: 'loc-lekki',
    });

    expect(res.success).toBe(true);
    expect(res.data?.total_amount).toBe(12000);
    expect(res.data?.has_controlled).toBe(true);

    const updatedLogs = await getNarcoticLogs();
    expect(updatedLogs.length).toBe(initialCount + 1);
    expect(updatedLogs[0].product_name).toBe('Ketamine 100mg/mL Injection');
    expect(updatedLogs[0].patient_name).toBe('Simba (Canine)');
    expect(updatedLogs[0].quantity).toBe(2);
  });
});
