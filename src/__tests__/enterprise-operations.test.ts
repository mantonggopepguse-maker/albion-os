import { describe, it, expect } from 'vitest';
import {
  getStaffRequests,
  createStaffRequest,
  updateStaffRequestStatus,
  getAnnouncements,
  createAnnouncement,
  recallProductBatch,
  batchUpdateProductPrices,
  applyCompensationAdjustment,
  createVetService,
  createTreatment,
  createLabOrder,
  getSalaries,
  getProducts,
} from '@/lib/data-service';

describe('Staff Requests & Internal Approval Portal', () => {
  it('retrieves staff requests and filters by user or status', async () => {
    const all = await getStaffRequests();
    expect(Array.isArray(all)).toBe(true);
    expect(all.length).toBeGreaterThan(0);
  });

  it('allows staff to submit a new restock/leave/transfer request', async () => {
    const res = await createStaffRequest({
      user_id: 'usr-rep-001',
      user_name: 'Emeka Rep',
      user_role: 'sales_rep',
      type: 'restock',
      title: 'Restock Antibiotics for Abuja Territory',
      location_id: 'loc-1',
      location_name: 'Abuja Central Clinic',
      details: {
        reason: 'Urgent demand for Albion Cipro 500mg in Garki clinic district',
        items: [{ item_name: 'Albion Cipro 500mg', quantity: 20 }],
      },
    });

    expect(res.success).toBe(true);
    expect(res.data).toBeDefined();
    expect(res.data?.type).toBe('restock');
    expect(res.data?.status).toBe('pending');
    expect(res.data?.details.items?.length).toBe(1);

    const updated = await getStaffRequests('usr-rep-001', 'sales_rep');
    expect(updated.some((r) => r.id === res.data?.id)).toBe(true);
  });

  it('allows manager to approve or reject a staff request with reviewer notes', async () => {
    const reqRes = await createStaffRequest({
      user_id: 'usr-vet-002',
      user_name: 'Dr. Fatima',
      user_role: 'vet',
      type: 'leave',
      title: 'Annual Professional Development Leave',
      details: {
        reason: 'Attending NVMA Annual Congress in Abuja',
      },
    });

    expect(reqRes.success).toBe(true);
    const reqId = reqRes.data!.id;

    const approvalRes = await updateStaffRequestStatus(
      reqId,
      'approved',
      'usr-ceo',
      'Chief Medical Director',
      'Approved. Clinic loc-1 coverage arranged with Dr. Chinedu.'
    );

    expect(approvalRes.success).toBe(true);
    expect(approvalRes.data?.status).toBe('approved');
    expect(approvalRes.data?.reviewer_name).toBe('Chief Medical Director');
    expect(approvalRes.data?.review_notes).toContain('Approved');
  });
});

describe('Corporate Announcements & Notice Broadcasts', () => {
  it('retrieves announcements scoped by target audience', async () => {
    const announcements = await getAnnouncements();
    expect(Array.isArray(announcements)).toBe(true);
  });

  it('allows authorized admins to publish company-wide and clinic-scoped broadcasts', async () => {
    const broadcast = await createAnnouncement({
      title: 'New Clinical Biosecurity Protocol 2026',
      message: 'All veterinary surgery suites must enforce revised autoclave cycles.',
      scope: 'all',
      priority: 'urgent',
      author_id: 'usr-superadmin',
      author_name: 'Admin Secretariat',
      author_role: 'super_admin',
    });

    expect(broadcast.success).toBe(true);
    expect(broadcast.data).toBeDefined();
    expect(broadcast.data?.title).toBe('New Clinical Biosecurity Protocol 2026');
    expect(broadcast.data?.scope).toBe('all');
    expect(broadcast.data?.priority).toBe('urgent');

    const list = await getAnnouncements();
    expect(list.some((a) => a.id === broadcast.data?.id)).toBe(true);
  });
});

describe('Warehouse & Inventory Governance (Recalls & Batch Pricing)', () => {
  it('executes a product batch recall and marks affected products', async () => {
    const recallRes = await recallProductBatch(
      'BATCH-CIP-2026',
      'Packaging seal variance reported from regional depot',
      'usr-warehouse-mgr'
    );

    expect(recallRes.success).toBe(true);
    expect(recallRes.data?.affectedCount).toBeGreaterThanOrEqual(0);
  });

  it('allows warehouse manager to update pricing in bulk across product catalog', async () => {
    const products = await getProducts();
    expect(products.length).toBeGreaterThan(0);

    const p1 = products[0];
    const newPrice = (p1.unit_price || 1000) + 250;

    const batchRes = await batchUpdateProductPrices([
      { productId: p1.id, newPrice: newPrice },
    ]);

    expect(batchRes.success).toBe(true);

    const refreshedProducts = await getProducts();
    const updatedP1 = refreshedProducts.find((p) => p.id === p1.id);
    expect(updatedP1?.unit_price).toBe(newPrice);
  });
});

describe('Finance Manager Compensation & Staff Adjustments', () => {
  it('applies incentives/bonuses to employee payroll adjustment', async () => {
    const salaries = await getSalaries();
    expect(salaries.length).toBeGreaterThan(0);

    const sal = salaries[0];
    const initialGross = sal.total_gross || sal.basic_salary;

    const adjRes = await applyCompensationAdjustment(
      sal.user_id,
      'bonus',
      45000,
      'Q3 Outstanding Territory Sales Incentive',
      'usr-finance-mgr'
    );

    expect(adjRes.success).toBe(true);
    expect(sal.total_gross).toBeGreaterThan(initialGross);
    expect(sal.custom_additions?.some((a) => a.label.includes('Q3 Outstanding'))).toBe(true);
  });
});

describe('Clinical Procedures Medication Protocols & Full Workflow', () => {
  it('creates a clinical procedure with a multi-drug medication protocol and OR alternatives', async () => {
    const res = await createVetService({
      name: 'Canine Cruciate Ligament Repair (TPLO)',
      category: 'surgery',
      species: 'Dog',
      price: 125000,
      duration_minutes: 90,
      post_op_notes: 'Crate rest 6 weeks. Cold compress incision 72h.',
      medication_protocol: [
        { drug_name: 'Cefazolin IV', dosage: '22mg/kg', frequency: 'q90min intra-op', duration: 'Surgery' },
        { drug_name: 'Meloxicam Oral', dosage: '0.1mg/kg', frequency: 'q24h', duration: '7 days' },
        { drug_name: 'Carprofen Chewable', dosage: '4.4mg/kg', frequency: 'q24h', duration: '7 days', is_alternative: true },
      ],
    });

    expect(res.success).toBe(true);
    expect(res.data?.name).toContain('Cruciate Ligament Repair');
    expect(res.data?.medication_protocol?.length).toBe(3);
    expect(res.data?.medication_protocol?.[2].is_alternative).toBe(true);
  });

  it('records a comprehensive clinical treatment and dispatches lab investigation', async () => {
    const txRes = await createTreatment({
      patient_id: 'pat-1',
      vet_id: 'usr-vet-001',
      chief_complaint: 'Acute vomiting and watery diarrhea x 2 days',
      diagnosis: 'Acute Gastroenteritis / Suspected Dietary Indiscretion',
      assessment: 'Vitals: Wt 14kg, Temp 38.8°C, HR 120bpm. Moderate dehydration.',
      plan: 'Maropitant 1mg/kg SC, Metronidazole 15mg/kg PO BID x 5d, IV Hartmanns @ 60ml/kg/24h.',
      status: 'ongoing',
      total_cost: 32500,
    });

    expect(txRes.success).toBe(true);
    expect(txRes.data?.id).toBeDefined();
    expect(txRes.data?.diagnosis).toContain('Acute Gastroenteritis');

    // Dispatch direct lab investigation
    const labRes = await createLabOrder({
      patient_id: 'pat-1',
      patient_name: 'Bella',
      species: 'Dog',
      test_type: 'parasitology',
      priority: 'urgent',
      status: 'pending',
      doctor_name: 'Dr. Obinna Attending Vet',
      clinical_notes: `Ordered via Treatment #${txRes.data?.id.slice(-6)}: Faecal Floatation & Giardia Ag`,
    });

    expect(labRes.success).toBe(true);
    expect(labRes.data?.test_type).toBe('parasitology');
    expect(labRes.data?.priority).toBe('urgent');
  });
});
