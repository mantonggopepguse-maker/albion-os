// ============================================================================
// AlbionOS — Mock Data for Development
// Albion Pharmaceuticals (Nigeria) Enterprise Platform
// ============================================================================
import type {
  User,
  Location,
  Product,
  Customer,
  Invoice,
  InvoiceItem,
  Payment,
  InventoryItem,
  ChatMessage,
  DashboardStats,
  SalaryGrade,
  Salary,
  PayrollRun,
  Payslip,
  LeaveRequest,
  LeaveBalance,
  AttendanceLog,
  EmployeeDocument,
  PerformanceTarget,
  PerformanceReview,
  Patient,
  Appointment,
  Treatment,
  TreatmentMedication,
  PatientQueue,
  VetService,
  Supplier,
  LabOrder,
  HospitalizationRecord,
  SurgeryRecord,
  CashReconciliation,
  BranchExpense,
  AuditLog,
  ClinicShift,
  PatientReminder,
} from '@/lib/types';
// ---------------------------------------------------------------------------
// Helper — all mock passwords (plain text, never shipped to production)
// ---------------------------------------------------------------------------
export const MOCK_PASSWORD = 'AlbionTest123!';
// ---------------------------------------------------------------------------
// 1. MOCK USERS
// ---------------------------------------------------------------------------
export const MOCK_USERS: User[] = [
  {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    email: 'admin@albionpharma.com',
    full_name: 'Dr. Emeka Moneke',
    role: 'super_admin',
    roles: ['super_admin', 'ceo'],
    location_id: null,
    avatar_url: null,
    phone: '+234 803 456 7890',
    created_at: '2025-01-15T09:00:00.000Z',
    is_active: true,
  },
  {
    id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    email: 'chidi@albionpharma.com',
    full_name: 'Chidi Okafor',
    role: 'sales_rep',
    roles: ['sales_rep'],
    location_id: 'loc-0002-lagos-territory',
    avatar_url: null,
    phone: '+234 812 345 6789',
    created_at: '2025-03-10T10:00:00.000Z',
    is_active: true,
  },
  {
    id: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
    email: 'ngozi@albionpharma.com',
    full_name: 'Ngozi Eze',
    role: 'finance_manager',
    roles: ['finance_manager'],
    location_id: 'loc-0001-onitsha-hq',
    avatar_url: null,
    phone: '+234 705 678 9012',
    created_at: '2025-02-20T11:00:00.000Z',
    is_active: true,
  },
  {
    id: 'd4e5f6a7-b8c9-0123-defa-234567890123',
    email: 'tunde@albionpharma.com',
    full_name: 'Tunde Adeyemi',
    role: 'inventory_manager',
    roles: ['inventory_manager'],
    location_id: 'loc-0001-onitsha-hq',
    avatar_url: null,
    phone: '+234 908 123 4567',
    created_at: '2025-04-05T08:00:00.000Z',
    is_active: true,
  },
  {
    id: 'e5f6a7b8-c9d0-1234-efab-345678901234',
    email: 'ceo@albionpharma.com',
    full_name: 'Chief Executive Officer',
    role: 'ceo',
    roles: ['ceo'],
    location_id: 'loc-0001-onitsha-hq',
    avatar_url: null,
    phone: '+234 803 000 0005',
    created_at: '2025-01-15T09:00:00.000Z',
    is_active: true,
  },
  {
    id: 'c1b2c3d4-e5f6-7890-abcd-ef1234567891',
    email: 'clinicadmin@albionpharma.com',
    full_name: 'Dr. Kalu Okonkwo',
    role: 'clinic_admin',
    roles: ['clinic_admin', 'vet'],
    location_id: 'loc-0005-lekki-clinic',
    avatar_url: null,
    phone: '+234 802 345 6789',
    created_at: '2025-02-01T08:00:00.000Z',
    is_active: true,
  },
  {
    id: 'c2b2c3d4-e5f6-7890-abcd-ef1234567892',
    email: 'vet@albionpharma.com',
    full_name: 'Dr. Amaka Bello, DVM',
    role: 'vet',
    roles: ['vet'],
    location_id: 'loc-0004-onitsha-clinic',
    avatar_url: null,
    phone: '+234 803 111 2233',
    created_at: '2025-02-15T08:30:00.000Z',
    is_active: true,
  },
  {
    id: 'c3b2c3d4-e5f6-7890-abcd-ef1234567893',
    email: 'reception@albionpharma.com',
    full_name: 'Chioma Eze',
    role: 'receptionist',
    roles: ['receptionist'],
    location_id: 'loc-0005-lekki-clinic',
    avatar_url: null,
    phone: '+234 809 444 5566',
    created_at: '2025-03-01T09:00:00.000Z',
    is_active: true,
  },
  {
    id: 'c4b2c3d4-e5f6-7890-abcd-ef1234567894',
    email: 'lab@albionpharma.com',
    full_name: 'Babatunde Adeleke',
    role: 'lab_scientist',
    roles: ['lab_scientist'],
    location_id: 'loc-0001-onitsha-hq',
    avatar_url: null,
    phone: '+234 805 777 8899',
    created_at: '2025-03-12T10:00:00.000Z',
    is_active: true,
  },
  {
    id: 'c5b2c3d4-e5f6-7890-abcd-ef1234567895',
    email: 'vettech@albionpharma.com',
    full_name: 'Ibrahim Musa',
    role: 'vet_tech',
    roles: ['vet_tech', 'vet_assistant'],
    location_id: 'loc-0005-lekki-clinic',
    avatar_url: null,
    phone: '+234 807 999 0011',
    created_at: '2025-03-20T07:30:00.000Z',
    is_active: true,
  },
];
// ---------------------------------------------------------------------------
// 2. MOCK LOCATIONS
// ---------------------------------------------------------------------------
export const MOCK_LOCATIONS: Location[] = [
  {
    id: 'loc-0001-onitsha-hq',
    name: 'Onitsha HQ',
    type: 'warehouse',
    region: 'South East',
    state: 'Anambra',
    address: '15 New Market Road, Main Market, Onitsha',
  },
  {
    id: 'loc-0002-lagos-territory',
    name: 'Lagos Sales Territory',
    type: 'territory',
    region: 'South West',
    state: 'Lagos',
    address: '22 Ikorodu Road, Fadeyi, Lagos',
  },
  {
    id: 'loc-0003-abuja-territory',
    name: 'Abuja Sales Territory',
    type: 'territory',
    region: 'North Central',
    state: 'FCT',
    address: '7 Wuse II, Off Aminu Kano Crescent, Abuja',
  },
  {
    id: 'loc-0004-delta-clinic',
    name: 'Delta Clinic',
    type: 'clinic',
    region: 'South South',
    state: 'Delta',
    address: '3 Warri-Sapele Road, Warri',
  },
  {
    id: 'loc-0004-onitsha-clinic',
    name: 'Albion Pet Clinic - Onitsha Central',
    type: 'clinic',
    region: 'South East',
    state: 'Anambra',
    address: '18 Oguta Road, Onitsha',
  },
  {
    id: 'loc-0005-lekki-clinic',
    name: 'Albion Pet Clinic - Lekki Branch',
    type: 'clinic',
    region: 'South West',
    state: 'Lagos',
    address: 'Plot 12 Admiralty Way, Lekki Phase 1, Lagos',
  },
];
// ---------------------------------------------------------------------------
// 3. MOCK PRODUCTS
// ---------------------------------------------------------------------------
export const MOCK_PRODUCTS: Product[] = [
  {
    id: 'prod-0001-ivermectin',
    name: 'Albion Ivermectin 1% Injectable',
    sku: 'ALB-IVM-100',
    nafdac_number: 'NAFDAC/VET/2024/0001',
    unit_price: 8500,
    category: 'injectable',
    description:
      'Broad-spectrum antiparasitic injectable solution for cattle, sheep, and goats. 1% w/v Ivermectin. 50 mL multi-dose vial.',
    image_url: null,
    created_at: '2025-01-10T00:00:00.000Z',
    is_active: true,
  },
  {
    id: 'prod-0002-oxytet',
    name: 'Albion Oxytetracycline LA',
    sku: 'ALB-OXY-200',
    nafdac_number: 'NAFDAC/VET/2024/0002',
    unit_price: 12000,
    category: 'injectable',
    description:
      'Long-acting oxytetracycline injection 20% w/v for treatment of bacterial infections in livestock. 100 mL vial.',
    image_url: null,
    created_at: '2025-01-10T00:00:00.000Z',
    is_active: true,
  },
  {
    id: 'prod-0003-multivitamin',
    name: 'Albion Multivitamin Premix',
    sku: 'ALB-MVP-500',
    nafdac_number: 'NAFDAC/VET/2024/0003',
    unit_price: 4500,
    category: 'premix',
    description:
      'Complete vitamin-mineral premix for poultry and livestock feed supplementation. 500 g sachet.',
    image_url: null,
    created_at: '2025-01-10T00:00:00.000Z',
    is_active: true,
  },
  {
    id: 'prod-0004-calcium',
    name: 'Albion Calcium Borogluconate',
    sku: 'ALB-CAB-400',
    nafdac_number: 'NAFDAC/VET/2024/0004',
    unit_price: 6500,
    category: 'injectable',
    description:
      'Calcium borogluconate 40% w/v solution for treatment of milk fever and calcium deficiency in cattle. 400 mL bottle.',
    image_url: null,
    created_at: '2025-01-10T00:00:00.000Z',
    is_active: true,
  },
  {
    id: 'prod-0005-diminazene',
    name: 'Albion Diminazene Aceturate',
    sku: 'ALB-DIM-238',
    nafdac_number: 'NAFDAC/VET/2024/0005',
    unit_price: 3200,
    category: 'injectable',
    description:
      'Diminazene aceturate 2.36 g granules for reconstitution. Treatment of trypanosomosis and babesiosis in cattle.',
    image_url: null,
    created_at: '2025-01-10T00:00:00.000Z',
    is_active: true,
  },
  {
    id: 'prod-0006-poultry-vit',
    name: 'Albion Poultry Vitamin Pack',
    sku: 'ALB-PVP-100',
    nafdac_number: 'NAFDAC/VET/2024/0006',
    unit_price: 2500,
    category: 'feed_additive',
    description:
      'Water-soluble vitamin pack for layers and broilers. Contains vitamins A, D3, E, K3, B-complex. 100 g pack.',
    image_url: null,
    created_at: '2025-01-10T00:00:00.000Z',
    is_active: true,
  },
  {
    id: 'prod-0007-dewormer',
    name: 'Albion Dewormer Bolus',
    sku: 'ALB-DWB-250',
    nafdac_number: 'NAFDAC/VET/2024/0007',
    unit_price: 5800,
    category: 'bolus',
    description:
      'Broad-spectrum anthelmintic bolus containing Albendazole 2500 mg for cattle and large ruminants. Pack of 10 boluses.',
    image_url: null,
    created_at: '2025-01-10T00:00:00.000Z',
    is_active: true,
  },
  {
    id: 'prod-0008-wound-spray',
    name: 'Albion Wound Spray',
    sku: 'ALB-WDS-200',
    nafdac_number: 'NAFDAC/VET/2024/0008',
    unit_price: 3800,
    category: 'spray',
    description:
      'Antiseptic aerosol wound spray with insect repellent for topical treatment of wounds, cuts, and surgical sites in animals. 200 mL can.',
    image_url: null,
    created_at: '2025-01-10T00:00:00.000Z',
    is_active: true,
  },
];
// ---------------------------------------------------------------------------
// 3.5. MOCK SUPPLIERS
// ---------------------------------------------------------------------------
export const MOCK_SUPPLIERS: Supplier[] = [
  {
    id: 'sup-0001-vetpharma',
    name: 'VetPharma Global Imports Ltd',
    contact_person: 'Mr. Kenji Sato',
    phone: '+234 802 345 6789',
    email: 'orders@vetpharmaglobal.com',
    address: '12 Commercial Avenue, Apapa, Lagos',
    is_active: true,
    created_at: '2025-01-05T00:00:00.000Z',
    updated_at: '2025-01-05T00:00:00.000Z',
  },
  {
    id: 'sup-0002-afrivet',
    name: 'AfriVet Biologicals Nigeria',
    contact_person: 'Dr. Grace Danjuma',
    phone: '+234 813 987 6543',
    email: 'supply@afrivet.ng',
    address: '8 Industrial Layout, Trans-Amadi, Port Harcourt',
    is_active: true,
    created_at: '2025-01-08T00:00:00.000Z',
    updated_at: '2025-01-08T00:00:00.000Z',
  },
  {
    id: 'sup-0003-agrochem',
    name: 'AgroChem International FZE',
    contact_person: 'Chief Obinna Nnamdi',
    phone: '+234 701 555 1212',
    email: 'obinna@agrochem-fze.com',
    address: 'Plot 4 Free Trade Zone, Calabar, Cross River',
    is_active: true,
    created_at: '2025-01-12T00:00:00.000Z',
    updated_at: '2025-01-12T00:00:00.000Z',
  },
];
// ---------------------------------------------------------------------------
// 4. MOCK CUSTOMERS
// ---------------------------------------------------------------------------
export const MOCK_CUSTOMERS: Customer[] = [
  {
    id: 'cust-0001-vetzone',
    name: 'Dr. Adaeze Nwosu',
    business_name: 'VetZone Animal Clinic',
    phone: '+234 803 111 2233',
    email: 'info@vetzoneclinic.com',
    address: '45 Allen Avenue, Ikeja',
    state: 'Lagos',
    credit_limit: 500000,
    outstanding_balance: 185000,
    location_id: 'loc-0001-onitsha-hq',
    is_active: true,
  },
  {
    id: 'cust-0002-farmkings',
    name: 'Musa Abdullahi',
    business_name: 'FarmKings Agro Dealers',
    phone: '+234 906 444 5566',
    email: 'musa@farmkings.ng',
    address: '12 Ahmadu Bello Way, Kaduna South',
    state: 'Kaduna',
    credit_limit: 1000000,
    outstanding_balance: 420000,
    location_id: 'loc-0001-onitsha-hq',
    is_active: true,
  },
  {
    id: 'cust-0003-ekenepharm',
    name: 'Obiora Ekene',
    business_name: 'Ekene Veterinary Pharmacy',
    phone: '+234 813 777 8899',
    email: 'sales@ekenepharm.com',
    address: '8 Iweka Road, Main Market',
    state: 'Anambra',
    credit_limit: 750000,
    outstanding_balance: 0,
    location_id: 'loc-0001-onitsha-hq',
    is_active: true,
  },
  {
    id: 'cust-0004-pethealth',
    name: 'Dr. Funke Adesanya',
    business_name: 'PetHealth Veterinary Hospital',
    phone: '+234 708 222 3344',
    email: 'funke@pethealth.com.ng',
    address: '33 Adeola Odeku Street, Victoria Island',
    state: 'Lagos',
    credit_limit: 300000,
    outstanding_balance: 72500,
    location_id: 'loc-0001-onitsha-hq',
    is_active: true,
  },
  {
    id: 'cust-0005-greatfarmer',
    name: 'Ibrahim Bello',
    business_name: 'Great Farmer Agro Services',
    phone: '+234 802 999 0011',
    email: 'ibrahim@greatfarmer.com',
    address: '5 Garki Area 11, Off Nile Crescent',
    state: 'FCT',
    credit_limit: 800000,
    outstanding_balance: 315000,
    location_id: 'loc-0001-onitsha-hq',
    is_active: true,
  },
  {
    id: 'cust-0006-deltavet',
    name: 'Oghenekaro Efemena',
    business_name: 'Delta Vet Supplies',
    phone: '+234 905 666 7788',
    email: 'info@deltavet.ng',
    address: '19 Effurun-Sapele Road, Warri',
    state: 'Delta',
    credit_limit: 1500000,
    outstanding_balance: 540000,
    location_id: 'loc-0001-onitsha-hq',
    is_active: true,
  },
];
// ---------------------------------------------------------------------------
// 5. MOCK INVOICES
// ---------------------------------------------------------------------------
const invoiceItems1: InvoiceItem[] = [
  {
    id: 'li-0001',
    product_id: 'prod-0001-ivermectin',
    product_name: 'Albion Ivermectin 1% Injectable',
    quantity: 20,
    unit_price: 8500,
    total: 170000,
  },
  {
    id: 'li-0002',
    product_id: 'prod-0002-oxytet',
    product_name: 'Albion Oxytetracycline LA',
    quantity: 10,
    unit_price: 12000,
    total: 120000,
  },
];
const invoiceItems2: InvoiceItem[] = [
  {
    id: 'li-0003',
    product_id: 'prod-0006-poultry-vit',
    product_name: 'Albion Poultry Vitamin Pack',
    quantity: 50,
    unit_price: 2500,
    total: 125000,
  },
  {
    id: 'li-0004',
    product_id: 'prod-0003-multivitamin',
    product_name: 'Albion Multivitamin Premix',
    quantity: 30,
    unit_price: 4500,
    total: 135000,
  },
];
const invoiceItems3: InvoiceItem[] = [
  {
    id: 'li-0005',
    product_id: 'prod-0005-diminazene',
    product_name: 'Albion Diminazene Aceturate',
    quantity: 100,
    unit_price: 3200,
    total: 320000,
  },
];
const invoiceItems4: InvoiceItem[] = [
  {
    id: 'li-0006',
    product_id: 'prod-0007-dewormer',
    product_name: 'Albion Dewormer Bolus',
    quantity: 15,
    unit_price: 5800,
    total: 87000,
  },
  {
    id: 'li-0007',
    product_id: 'prod-0008-wound-spray',
    product_name: 'Albion Wound Spray',
    quantity: 25,
    unit_price: 3800,
    total: 95000,
  },
];
const invoiceItems5: InvoiceItem[] = [
  {
    id: 'li-0008',
    product_id: 'prod-0004-calcium',
    product_name: 'Albion Calcium Borogluconate',
    quantity: 40,
    unit_price: 6500,
    total: 260000,
  },
];
export const MOCK_INVOICES: Invoice[] = [
  {
    id: 'inv-0001-paid',
    invoice_number: 'ALB-INV-2026-0001',
    customer_id: 'cust-0003-ekenepharm',
    sales_rep_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    location_id: 'loc-0001-onitsha-hq',
    items: invoiceItems1,
    subtotal: 290000,
    vat: 21750,
    total: 311750,
    status: 'paid',
    due_date: '2026-05-30T00:00:00.000Z',
    created_at: '2026-05-15T09:00:00.000Z',
  },
  {
    id: 'inv-0002-partial',
    invoice_number: 'ALB-INV-2026-0002',
    customer_id: 'cust-0002-farmkings',
    sales_rep_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    location_id: 'loc-0001-onitsha-hq',
    items: invoiceItems2,
    subtotal: 260000,
    vat: 19500,
    total: 279500,
    status: 'partial',
    due_date: '2026-06-15T00:00:00.000Z',
    created_at: '2026-05-15T09:00:00.000Z',
  },
  {
    id: 'inv-0003-overdue',
    invoice_number: 'ALB-INV-2026-0003',
    customer_id: 'cust-0005-greatfarmer',
    sales_rep_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    location_id: 'loc-0001-onitsha-hq',
    items: invoiceItems3,
    subtotal: 320000,
    vat: 24000,
    total: 344000,
    status: 'overdue',
    due_date: '2026-06-01T00:00:00.000Z',
    created_at: '2026-05-15T09:00:00.000Z',
  },
  {
    id: 'inv-0004-sent',
    invoice_number: 'ALB-INV-2026-0004',
    customer_id: 'cust-0001-vetzone',
    sales_rep_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    location_id: 'loc-0001-onitsha-hq',
    items: invoiceItems4,
    subtotal: 182000,
    vat: 13650,
    total: 195650,
    status: 'sent',
    due_date: '2026-07-05T00:00:00.000Z',
    created_at: '2026-05-15T09:00:00.000Z',
  },
  {
    id: 'inv-0005-draft',
    invoice_number: 'ALB-INV-2026-0005',
    customer_id: 'cust-0006-deltavet',
    sales_rep_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    location_id: 'loc-0001-onitsha-hq',
    items: invoiceItems5,
    subtotal: 260000,
    vat: 19500,
    total: 279500,
    status: 'draft',
    due_date: '2026-07-15T00:00:00.000Z',
    created_at: '2026-05-15T09:00:00.000Z',
  },
];
// ---------------------------------------------------------------------------
// 6. MOCK PAYMENTS
// ---------------------------------------------------------------------------
export const MOCK_PAYMENTS: Payment[] = [
  {
    id: 'pay-0001-approved',
    invoice_id: 'inv-0001-paid',
    customer_id: 'cust-0003-ekenepharm',
    amount: 311750,
    method: 'bank_transfer',
    proof_url: '/uploads/receipts/ekene-uba-transfer.jpg',
    status: 'approved',
    recorded_by: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    approved_by: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
    notes: 'Full settlement. Confirmed on UBA statement.',
    created_at: '2026-05-15T09:00:00.000Z',
  },
  {
    id: 'pay-0002-approved',
    invoice_id: 'inv-0002-partial',
    customer_id: 'cust-0002-farmkings',
    amount: 150000,
    method: 'cash',
    proof_url: null,
    status: 'approved',
    recorded_by: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    approved_by: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
    notes: 'Partial payment — customer to settle balance by end of June.',
    created_at: '2026-05-15T09:00:00.000Z',
  },
  {
    id: 'pay-0003-pending',
    invoice_id: 'inv-0004-sent',
    customer_id: 'cust-0001-vetzone',
    amount: 100000,
    method: 'bank_transfer',
    proof_url: '/uploads/receipts/vetzone-transfer-receipt.jpg',
    status: 'pending',
    recorded_by: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    approved_by: null,
    notes: 'Customer sent ₦100k part payment. Transfer receipt attached. Awaiting finance verification.',
    created_at: '2026-05-15T09:00:00.000Z',
  },
  {
    id: 'pay-0004-rejected',
    invoice_id: 'inv-0003-overdue',
    customer_id: 'cust-0005-greatfarmer',
    amount: 200000,
    method: 'bank_transfer',
    proof_url: '/uploads/receipts/greatfarmer-cheque-scan.jpg',
    status: 'rejected',
    recorded_by: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    approved_by: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
    notes: 'Cheque returned — insufficient funds. Customer must re-issue via bank transfer.',
    created_at: '2026-05-15T09:00:00.000Z',
  },
];
// ---------------------------------------------------------------------------
// 7. MOCK INVENTORY
// ---------------------------------------------------------------------------
export const MOCK_INVENTORY: InventoryItem[] = [
  // ── Warehouse stock (Onitsha HQ) ──
  {
    id: 'stk-0001',
    product_id: 'prod-0001-ivermectin',
    location_id: 'loc-0001-onitsha-hq',
    quantity: 450,
    batch_number: 'BATCH-IVM-2026-A',
    expiry_date: '2028-01-15T00:00:00.000Z',
    status: 'in_stock',
  },
  {
    id: 'stk-0002',
    product_id: 'prod-0002-oxytet',
    location_id: 'loc-0001-onitsha-hq',
    quantity: 280,
    batch_number: 'BATCH-OXY-2026-A',
    expiry_date: '2027-11-30T00:00:00.000Z',
    status: 'in_stock',
  },
  {
    id: 'stk-0003',
    product_id: 'prod-0003-multivitamin',
    location_id: 'loc-0001-onitsha-hq',
    quantity: 600,
    batch_number: 'BATCH-MVP-2026-B',
    expiry_date: '2027-09-01T00:00:00.000Z',
    status: 'in_stock',
  },
  {
    id: 'stk-0004',
    product_id: 'prod-0005-diminazene',
    location_id: 'loc-0001-onitsha-hq',
    quantity: 35,
    batch_number: 'BATCH-DIM-2026-A',
    expiry_date: '2028-03-01T00:00:00.000Z',
    status: 'low_stock',
  },
  {
    id: 'stk-0005',
    product_id: 'prod-0008-wound-spray',
    location_id: 'loc-0001-onitsha-hq',
    quantity: 12,
    batch_number: 'BATCH-WDS-2025-C',
    expiry_date: '2027-06-01T00:00:00.000Z',
    status: 'low_stock',
  },
  // ── Rep allocation (Lagos Territory — Chidi) ──
  {
    id: 'stk-0006',
    product_id: 'prod-0001-ivermectin',
    location_id: 'loc-0001-onitsha-hq',
    quantity: 60,
    batch_number: 'BATCH-IVM-2026-A',
    expiry_date: '2028-01-15T00:00:00.000Z',
    status: 'in_stock',
  },
  {
    id: 'stk-0007',
    product_id: 'prod-0006-poultry-vit',
    location_id: 'loc-0001-onitsha-hq',
    quantity: 120,
    batch_number: 'BATCH-PVP-2026-A',
    expiry_date: '2027-12-01T00:00:00.000Z',
    status: 'in_stock',
  },
  {
    id: 'stk-0008',
    product_id: 'prod-0007-dewormer',
    location_id: 'loc-0001-onitsha-hq',
    quantity: 45,
    batch_number: 'BATCH-DWB-2026-A',
    expiry_date: '2028-06-01T00:00:00.000Z',
    status: 'in_stock',
  },
  // ── Delta clinic stock ──
  {
    id: 'stk-0009',
    product_id: 'prod-0004-calcium',
    location_id: 'loc-0001-onitsha-hq',
    quantity: 25,
    batch_number: 'BATCH-CAB-2026-A',
    expiry_date: '2027-08-01T00:00:00.000Z',
    status: 'in_stock',
  },
  {
    id: 'stk-0010',
    product_id: 'prod-0002-oxytet',
    location_id: 'loc-0001-onitsha-hq',
    quantity: 18,
    batch_number: 'BATCH-OXY-2026-A',
    expiry_date: '2027-11-30T00:00:00.000Z',
    status: 'in_stock',
  },
];
// ---------------------------------------------------------------------------
// 8. MOCK CHAT MESSAGES
// ---------------------------------------------------------------------------
export const MOCK_CHAT_MESSAGES: ChatMessage[] = [
  {
    id: 'msg-0001',
    sender_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    receiver_id: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
    content:
      'Good morning Ngozi. I collected a ₦100,000 transfer from VetZone Animal Clinic for invoice ALB-INV-2026-0004. Uploading the receipt now.',
    attachment_url: null,
    attachment_type: null,
    is_read: true,
    created_at: '2026-05-15T09:00:00.000Z',
  },
  {
    id: 'msg-0002',
    sender_id: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
    receiver_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    content:
      'Good morning Chidi. Noted — please make sure the transfer receipt is clear and shows the amount. I will verify against our Access Bank statement.',
    attachment_url: null,
    attachment_type: null,
    is_read: true,
    created_at: '2026-05-15T09:00:00.000Z',
  },
  {
    id: 'msg-0003',
    sender_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    receiver_id: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
    content:
      'Receipt uploaded. Reference: TRF/ACCESS/2026061700789. Dr. Adaeze said they will pay the remaining ₦95,650 next week.',
    attachment_url: '/uploads/receipts/vetzone-transfer-receipt.jpg',
    attachment_type: 'image',
    is_read: true,
    created_at: '2026-05-15T09:00:00.000Z',
  },
  {
    id: 'msg-0004',
    sender_id: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
    receiver_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    content:
      'I can see the receipt. Let me check the bank statement to confirm. Give me a moment.',
    attachment_url: null,
    attachment_type: null,
    is_read: true,
    created_at: '2026-05-15T09:00:00.000Z',
  },
  {
    id: 'msg-0005',
    sender_id: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
    receiver_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    content:
      "I haven't seen the credit on the statement yet. It may take some time to reflect. I'll keep it as pending for now.",
    attachment_url: null,
    attachment_type: null,
    is_read: true,
    created_at: '2026-05-15T09:00:00.000Z',
  },
  {
    id: 'msg-0006',
    sender_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    receiver_id: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
    content:
      'Okay, no problem. Also — any update on the Great Farmer cheque that bounced? Ibrahim says he wants to resend via transfer this time.',
    attachment_url: null,
    attachment_type: null,
    is_read: true,
    created_at: '2026-05-15T09:00:00.000Z',
  },
  {
    id: 'msg-0007',
    sender_id: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
    receiver_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    content:
      'Yes, the cheque was returned — insufficient funds. I already rejected the payment and left a note. Tell Ibrahim to do a direct bank transfer to our Zenith account. No more cheques from that customer.',
    attachment_url: null,
    attachment_type: null,
    is_read: true,
    created_at: '2026-05-15T09:00:00.000Z',
  },
  {
    id: 'msg-0008',
    sender_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    receiver_id: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
    content:
      "Understood. I'll inform him today. Also, we're running low on Diminazene at the warehouse — only 35 sachets left. Should I tell Tunde to reorder?",
    attachment_url: null,
    attachment_type: null,
    is_read: true,
    created_at: '2026-05-15T09:00:00.000Z',
  },
  {
    id: 'msg-0009',
    sender_id: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
    receiver_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    content:
      'Yes, flag it to Tunde. The Wound Spray stock is also critically low — only 12 cans. We need to place an order before month-end.',
    attachment_url: null,
    attachment_type: null,
    is_read: false,
    created_at: '2026-05-15T09:00:00.000Z',
  },
  {
    id: 'msg-0010',
    sender_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    receiver_id: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
    content: "Noted. I'll message Tunde now. Thanks Ngozi 👍",
    attachment_url: null,
    attachment_type: null,
    is_read: false,
    created_at: '2026-05-15T09:00:00.000Z',
  },
];
// ---------------------------------------------------------------------------
// 9. MOCK DASHBOARD STATS
// ---------------------------------------------------------------------------
export const MOCK_DASHBOARD_STATS: DashboardStats = {
  total_revenue: 4_875_320,
  total_receivables: 1_532_500,
  active_reps: 1,
  inventory_value: 8_240_600,
  pending_payments: 1,
  expiring_soon: 2,
};
// ---------------------------------------------------------------------------
// 10. MOCK SALARY GRADES
// ---------------------------------------------------------------------------
export const MOCK_SALARY_GRADES: SalaryGrade[] = [
  { id: 'sg-001', grade: 'Executive', min_salary: 800000, max_salary: 1500000, housing_allowance_pct: 40, transport_allowance_pct: 15, medical_allowance_pct: 10, created_at: '2025-01-01T00:00:00.000Z' },
  { id: 'sg-002', grade: 'Grade 1', min_salary: 400000, max_salary: 800000, housing_allowance_pct: 35, transport_allowance_pct: 12, medical_allowance_pct: 8, created_at: '2025-01-01T00:00:00.000Z' },
  { id: 'sg-003', grade: 'Grade 2', min_salary: 200000, max_salary: 400000, housing_allowance_pct: 30, transport_allowance_pct: 10, medical_allowance_pct: 7, created_at: '2025-01-01T00:00:00.000Z' },
  { id: 'sg-004', grade: 'Grade 3', min_salary: 100000, max_salary: 200000, housing_allowance_pct: 25, transport_allowance_pct: 8, medical_allowance_pct: 5, created_at: '2025-01-01T00:00:00.000Z' },
  { id: 'sg-005', grade: 'Intern', min_salary: 50000, max_salary: 100000, housing_allowance_pct: 20, transport_allowance_pct: 5, medical_allowance_pct: 3, created_at: '2025-01-01T00:00:00.000Z' },
];
// ---------------------------------------------------------------------------
// 11. MOCK SALARIES
// ---------------------------------------------------------------------------
export const MOCK_SALARIES: Salary[] = [
  { id: 'sal-001', user_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', salary_grade_id: 'sg-001', basic_salary: 1200000, housing_allowance: 480000, transport_allowance: 180000, medical_allowance: 120000, total_gross: 1980000, tax_rate: 7.5, pension_rate: 8.0, nhis_rate: 2.5, total_deductions: 356400, net_pay: 1623600, effective_date: '2025-01-15', is_active: true, created_at: '2025-01-15T09:00:00.000Z', updated_at: '2025-01-15T09:00:00.000Z' },
  { id: 'sal-002', user_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901', salary_grade_id: 'sg-003', basic_salary: 300000, housing_allowance: 90000, transport_allowance: 30000, medical_allowance: 21000, total_gross: 441000, tax_rate: 7.5, pension_rate: 8.0, nhis_rate: 2.5, total_deductions: 79380, net_pay: 361620, effective_date: '2025-03-10', is_active: true, created_at: '2025-03-10T10:00:00.000Z', updated_at: '2025-03-10T10:00:00.000Z' },
  { id: 'sal-003', user_id: 'c3d4e5f6-a7b8-9012-cdef-123456789012', salary_grade_id: 'sg-002', basic_salary: 600000, housing_allowance: 210000, transport_allowance: 72000, medical_allowance: 48000, total_gross: 930000, tax_rate: 7.5, pension_rate: 8.0, nhis_rate: 2.5, total_deductions: 167400, net_pay: 762600, effective_date: '2025-02-20', is_active: true, created_at: '2025-02-20T11:00:00.000Z', updated_at: '2025-02-20T11:00:00.000Z' },
  { id: 'sal-004', user_id: 'd4e5f6a7-b8c9-0123-defa-234567890123', salary_grade_id: 'sg-003', basic_salary: 350000, housing_allowance: 105000, transport_allowance: 35000, medical_allowance: 24500, total_gross: 514500, tax_rate: 7.5, pension_rate: 8.0, nhis_rate: 2.5, total_deductions: 92610, net_pay: 421890, effective_date: '2025-04-05', is_active: true, created_at: '2025-04-05T08:00:00.000Z', updated_at: '2025-04-05T08:00:00.000Z' },
  { id: 'sal-005', user_id: 'e5f6a7b8-c9d0-1234-efab-345678901234', salary_grade_id: 'sg-001', basic_salary: 1500000, housing_allowance: 600000, transport_allowance: 225000, medical_allowance: 150000, total_gross: 2475000, tax_rate: 7.5, pension_rate: 8.0, nhis_rate: 2.5, total_deductions: 445500, net_pay: 2029500, effective_date: '2025-01-15', is_active: true, created_at: '2025-01-15T09:00:00.000Z', updated_at: '2025-01-15T09:00:00.000Z' },
];
// ---------------------------------------------------------------------------
// 12. MOCK PAYROLL RUNS
// ---------------------------------------------------------------------------
export const MOCK_PAYROLL_RUNS: PayrollRun[] = [
  { id: 'pr-001', period_start: '2026-05-01', period_end: '2026-05-31', payment_date: '2026-05-28', status: 'completed', total_gross: 6337500, total_deductions: 1141290, total_net: 5196210, employee_count: 5, processed_by: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', created_at: '2026-05-28T10:00:00.000Z', updated_at: '2026-05-28T10:00:00.000Z' },
  { id: 'pr-002', period_start: '2026-06-01', period_end: '2026-06-30', payment_date: '2026-06-27', status: 'processing', total_gross: 6337500, total_deductions: 1141290, total_net: 5196210, employee_count: 5, processed_by: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', created_at: '2026-06-27T09:00:00.000Z', updated_at: '2026-06-27T09:00:00.000Z' },
  { id: 'pr-003', period_start: '2026-04-01', period_end: '2026-04-30', payment_date: '2026-04-28', status: 'completed', total_gross: 6337500, total_deductions: 1141290, total_net: 5196210, employee_count: 5, processed_by: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', created_at: '2026-04-28T10:00:00.000Z', updated_at: '2026-04-28T10:00:00.000Z' },
];
// ---------------------------------------------------------------------------
// 13. MOCK PAYSLIPS
// ---------------------------------------------------------------------------
export const MOCK_PAYSLIPS: Payslip[] = [
  { id: 'ps-001', payroll_run_id: 'pr-001', user_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', basic_salary: 1200000, housing_allowance: 480000, transport_allowance: 180000, medical_allowance: 120000, gross_pay: 1980000, paye_tax: 148500, pension_deduction: 158400, nhis_deduction: 49500, total_deductions: 356400, net_pay: 1623600, created_at: '2026-05-28T10:00:00.000Z' },
  { id: 'ps-002', payroll_run_id: 'pr-001', user_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901', basic_salary: 300000, housing_allowance: 90000, transport_allowance: 30000, medical_allowance: 21000, gross_pay: 441000, paye_tax: 33075, pension_deduction: 35280, nhis_deduction: 11025, total_deductions: 79380, net_pay: 361620, created_at: '2026-05-28T10:00:00.000Z' },
  { id: 'ps-003', payroll_run_id: 'pr-001', user_id: 'c3d4e5f6-a7b8-9012-cdef-123456789012', basic_salary: 600000, housing_allowance: 210000, transport_allowance: 72000, medical_allowance: 48000, gross_pay: 930000, paye_tax: 69750, pension_deduction: 74400, nhis_deduction: 23250, total_deductions: 167400, net_pay: 762600, created_at: '2026-05-28T10:00:00.000Z' },
  { id: 'ps-004', payroll_run_id: 'pr-001', user_id: 'd4e5f6a7-b8c9-0123-defa-234567890123', basic_salary: 350000, housing_allowance: 105000, transport_allowance: 35000, medical_allowance: 24500, gross_pay: 514500, paye_tax: 38587.5, pension_deduction: 41160, nhis_deduction: 12862.5, total_deductions: 92610, net_pay: 421890, created_at: '2026-05-28T10:00:00.000Z' },
  { id: 'ps-005', payroll_run_id: 'pr-001', user_id: 'e5f6a7b8-c9d0-1234-efab-345678901234', basic_salary: 1500000, housing_allowance: 600000, transport_allowance: 225000, medical_allowance: 150000, gross_pay: 2475000, paye_tax: 185625, pension_deduction: 198000, nhis_deduction: 61875, total_deductions: 445500, net_pay: 2029500, created_at: '2026-05-28T10:00:00.000Z' },
  { id: 'ps-006', payroll_run_id: 'pr-002', user_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', basic_salary: 1200000, housing_allowance: 480000, transport_allowance: 180000, medical_allowance: 120000, gross_pay: 1980000, paye_tax: 148500, pension_deduction: 158400, nhis_deduction: 49500, total_deductions: 356400, net_pay: 1623600, created_at: '2026-06-27T09:00:00.000Z' },
  { id: 'ps-007', payroll_run_id: 'pr-002', user_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901', basic_salary: 300000, housing_allowance: 90000, transport_allowance: 30000, medical_allowance: 21000, gross_pay: 441000, paye_tax: 33075, pension_deduction: 35280, nhis_deduction: 11025, total_deductions: 79380, net_pay: 361620, created_at: '2026-06-27T09:00:00.000Z' },
  { id: 'ps-008', payroll_run_id: 'pr-002', user_id: 'c3d4e5f6-a7b8-9012-cdef-123456789012', basic_salary: 600000, housing_allowance: 210000, transport_allowance: 72000, medical_allowance: 48000, gross_pay: 930000, paye_tax: 69750, pension_deduction: 74400, nhis_deduction: 23250, total_deductions: 167400, net_pay: 762600, created_at: '2026-06-27T09:00:00.000Z' },
  { id: 'ps-009', payroll_run_id: 'pr-002', user_id: 'd4e5f6a7-b8c9-0123-defa-234567890123', basic_salary: 350000, housing_allowance: 105000, transport_allowance: 35000, medical_allowance: 24500, gross_pay: 514500, paye_tax: 38587.5, pension_deduction: 41160, nhis_deduction: 12862.5, total_deductions: 92610, net_pay: 421890, created_at: '2026-06-27T09:00:00.000Z' },
  { id: 'ps-010', payroll_run_id: 'pr-002', user_id: 'e5f6a7b8-c9d0-1234-efab-345678901234', basic_salary: 1500000, housing_allowance: 600000, transport_allowance: 225000, medical_allowance: 150000, gross_pay: 2475000, paye_tax: 185625, pension_deduction: 198000, nhis_deduction: 61875, total_deductions: 445500, net_pay: 2029500, created_at: '2026-06-27T09:00:00.000Z' },
];
// ---------------------------------------------------------------------------
// 14. MOCK LEAVE REQUESTS
// ---------------------------------------------------------------------------
export const MOCK_LEAVE_REQUESTS: LeaveRequest[] = [
  { id: 'lr-001', user_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901', leave_type: 'annual', start_date: '2026-07-10', end_date: '2026-07-17', duration_days: 7, reason: 'Family vacation to Enugu', status: 'pending', approved_by: null, reviewed_at: null, reviewer_notes: null, created_at: '2026-06-20T08:30:00.000Z', updated_at: '2026-06-20T08:30:00.000Z' },
  { id: 'lr-002', user_id: 'c3d4e5f6-a7b8-9012-cdef-123456789012', leave_type: 'annual', start_date: '2026-05-05', end_date: '2026-05-09', duration_days: 5, reason: 'Personal time off', status: 'approved', approved_by: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', reviewed_at: '2026-04-28T14:00:00.000Z', reviewer_notes: 'Approved. Ensure handover of payment queue to deputy.', created_at: '2026-04-25T09:00:00.000Z', updated_at: '2026-04-28T14:00:00.000Z' },
  { id: 'lr-003', user_id: 'd4e5f6a7-b8c9-0123-defa-234567890123', leave_type: 'sick', start_date: '2026-04-20', end_date: '2026-04-21', duration_days: 2, reason: 'Malaria', status: 'approved', approved_by: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', reviewed_at: '2026-04-20T10:00:00.000Z', reviewer_notes: 'Get well soon.', created_at: '2026-04-20T08:00:00.000Z', updated_at: '2026-04-20T10:00:00.000Z' },
  { id: 'lr-004', user_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901', leave_type: 'personal', start_date: '2026-04-10', end_date: '2026-04-10', duration_days: 1, reason: 'Personal errand', status: 'approved', approved_by: 'c3d4e5f6-a7b8-9012-cdef-123456789012', reviewed_at: '2026-04-09T16:00:00.000Z', reviewer_notes: 'Noted.', created_at: '2026-04-08T11:00:00.000Z', updated_at: '2026-04-09T16:00:00.000Z' },
  { id: 'lr-005', user_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', leave_type: 'annual', start_date: '2026-08-01', end_date: '2026-08-14', duration_days: 14, reason: 'Annual leave — traveling abroad', status: 'pending', approved_by: null, reviewed_at: null, reviewer_notes: null, created_at: '2026-06-25T09:00:00.000Z', updated_at: '2026-06-25T09:00:00.000Z' },
];
// ---------------------------------------------------------------------------
// 15. MOCK LEAVE BALANCES
// ---------------------------------------------------------------------------
export const MOCK_LEAVE_BALANCES: LeaveBalance[] = [
  { id: 'lb-001', user_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', leave_type: 'annual', total_days: 24, used_days: 5, remaining_days: 19, year: 2026, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-06-25T09:00:00.000Z' },
  { id: 'lb-002', user_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', leave_type: 'sick', total_days: 10, used_days: 2, remaining_days: 8, year: 2026, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-06-01T00:00:00.000Z' },
  { id: 'lb-003', user_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', leave_type: 'personal', total_days: 5, used_days: 0, remaining_days: 5, year: 2026, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' },
  { id: 'lb-004', user_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901', leave_type: 'annual', total_days: 20, used_days: 8, remaining_days: 12, year: 2026, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-06-20T08:30:00.000Z' },
  { id: 'lb-005', user_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901', leave_type: 'sick', total_days: 10, used_days: 0, remaining_days: 10, year: 2026, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' },
  { id: 'lb-006', user_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901', leave_type: 'personal', total_days: 5, used_days: 1, remaining_days: 4, year: 2026, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-04-09T16:00:00.000Z' },
  { id: 'lb-007', user_id: 'c3d4e5f6-a7b8-9012-cdef-123456789012', leave_type: 'annual', total_days: 22, used_days: 5, remaining_days: 17, year: 2026, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-04-28T14:00:00.000Z' },
  { id: 'lb-008', user_id: 'c3d4e5f6-a7b8-9012-cdef-123456789012', leave_type: 'sick', total_days: 10, used_days: 0, remaining_days: 10, year: 2026, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' },
  { id: 'lb-009', user_id: 'd4e5f6a7-b8c9-0123-defa-234567890123', leave_type: 'annual', total_days: 20, used_days: 0, remaining_days: 20, year: 2026, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' },
  { id: 'lb-010', user_id: 'd4e5f6a7-b8c9-0123-defa-234567890123', leave_type: 'sick', total_days: 10, used_days: 2, remaining_days: 8, year: 2026, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-04-20T10:00:00.000Z' },
  { id: 'lb-011', user_id: 'e5f6a7b8-c9d0-1234-efab-345678901234', leave_type: 'annual', total_days: 24, used_days: 10, remaining_days: 14, year: 2026, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-06-01T00:00:00.000Z' },
  { id: 'lb-012', user_id: 'e5f6a7b8-c9d0-1234-efab-345678901234', leave_type: 'sick', total_days: 10, used_days: 1, remaining_days: 9, year: 2026, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-03-15T00:00:00.000Z' },
];
// ---------------------------------------------------------------------------
// 16. MOCK ATTENDANCE LOGS
// ---------------------------------------------------------------------------
export const MOCK_ATTENDANCE_LOGS: AttendanceLog[] = [
  { id: 'att-001', user_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', date: '2026-06-26', clock_in: '2026-06-26T08:15:00.000Z', clock_out: '2026-06-26T17:30:00.000Z', status: 'present', hours_worked: 9.25, notes: null, created_at: '2026-06-26T08:15:00.000Z', updated_at: '2026-06-26T17:30:00.000Z' },
  { id: 'att-002', user_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901', date: '2026-06-26', clock_in: '2026-06-26T09:05:00.000Z', clock_out: '2026-06-26T17:15:00.000Z', status: 'late', hours_worked: 8.17, notes: 'Traffic on Lagos-Ibadan expressway', created_at: '2026-06-26T09:05:00.000Z', updated_at: '2026-06-26T17:15:00.000Z' },
  { id: 'att-003', user_id: 'c3d4e5f6-a7b8-9012-cdef-123456789012', date: '2026-06-26', clock_in: '2026-06-26T08:00:00.000Z', clock_out: '2026-06-26T16:45:00.000Z', status: 'present', hours_worked: 8.75, notes: null, created_at: '2026-06-26T08:00:00.000Z', updated_at: '2026-06-26T16:45:00.000Z' },
  { id: 'att-004', user_id: 'd4e5f6a7-b8c9-0123-defa-234567890123', date: '2026-06-26', clock_in: '2026-06-26T07:50:00.000Z', clock_out: '2026-06-26T17:00:00.000Z', status: 'present', hours_worked: 9.17, notes: null, created_at: '2026-06-26T07:50:00.000Z', updated_at: '2026-06-26T17:00:00.000Z' },
  { id: 'att-005', user_id: 'e5f6a7b8-c9d0-1234-efab-345678901234', date: '2026-06-26', clock_in: null, clock_out: null, status: 'on_leave', hours_worked: null, notes: 'Annual leave', created_at: '2026-06-26T00:00:00.000Z', updated_at: '2026-06-26T00:00:00.000Z' },
  { id: 'att-006', user_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', date: '2026-06-25', clock_in: '2026-06-25T08:00:00.000Z', clock_out: '2026-06-25T17:30:00.000Z', status: 'present', hours_worked: 9.5, notes: null, created_at: '2026-06-25T08:00:00.000Z', updated_at: '2026-06-25T17:30:00.000Z' },
  { id: 'att-007', user_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901', date: '2026-06-25', clock_in: '2026-06-25T08:30:00.000Z', clock_out: '2026-06-25T17:00:00.000Z', status: 'present', hours_worked: 8.5, notes: null, created_at: '2026-06-25T08:30:00.000Z', updated_at: '2026-06-25T17:00:00.000Z' },
  { id: 'att-008', user_id: 'c3d4e5f6-a7b8-9012-cdef-123456789012', date: '2026-06-25', clock_in: '2026-06-25T08:15:00.000Z', clock_out: '2026-06-25T17:15:00.000Z', status: 'present', hours_worked: 9.0, notes: null, created_at: '2026-06-25T08:15:00.000Z', updated_at: '2026-06-25T17:15:00.000Z' },
  { id: 'att-009', user_id: 'd4e5f6a7-b8c9-0123-defa-234567890123', date: '2026-06-25', clock_in: '2026-06-25T08:00:00.000Z', clock_out: '2026-06-25T17:00:00.000Z', status: 'present', hours_worked: 9.0, notes: null, created_at: '2026-06-25T08:00:00.000Z', updated_at: '2026-06-25T17:00:00.000Z' },
  { id: 'att-010', user_id: 'e5f6a7b8-c9d0-1234-efab-345678901234', date: '2026-06-25', clock_in: null, clock_out: null, status: 'on_leave', hours_worked: null, notes: 'Annual leave', created_at: '2026-06-25T00:00:00.000Z', updated_at: '2026-06-25T00:00:00.000Z' },
];
// ---------------------------------------------------------------------------
// 17. MOCK EMPLOYEE DOCUMENTS
// ---------------------------------------------------------------------------
export const MOCK_EMPLOYEE_DOCUMENTS: EmployeeDocument[] = [
  { id: 'doc-001', user_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', document_type: 'contract', document_name: 'Employment Contract - Dr. Emeka Moneke.pdf', file_url: '/uploads/documents/contract_emeka.pdf', file_size: 245000, expiry_date: null, is_verified: true, verified_by: 'e5f6a7b8-c9d0-1234-efab-345678901234', notes: 'Signed 15 Jan 2025', created_at: '2025-01-15T09:00:00.000Z', updated_at: '2025-01-15T09:00:00.000Z' },
  { id: 'doc-002', user_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', document_type: 'degree', document_name: 'PharmD Certificate - University of Nigeria.pdf', file_url: '/uploads/documents/degree_emeka.pdf', file_size: 1200000, expiry_date: null, is_verified: true, verified_by: 'e5f6a7b8-c9d0-1234-efab-345678901234', notes: null, created_at: '2025-01-15T09:00:00.000Z', updated_at: '2025-01-15T09:00:00.000Z' },
  { id: 'doc-003', user_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901', document_type: 'contract', document_name: 'Employment Contract - Chidi Okafor.pdf', file_url: '/uploads/documents/contract_chidi.pdf', file_size: 234000, expiry_date: null, is_verified: true, verified_by: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', notes: 'Signed 10 Mar 2025', created_at: '2025-03-10T10:00:00.000Z', updated_at: '2025-03-10T10:00:00.000Z' },
  { id: 'doc-004', user_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901', document_type: 'id_card', document_name: 'National ID - Chidi Okafor.png', file_url: '/uploads/documents/nin_chidi.png', file_size: 89000, expiry_date: '2030-06-01', is_verified: true, verified_by: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', notes: 'NIN verified', created_at: '2025-03-10T10:00:00.000Z', updated_at: '2025-03-10T10:00:00.000Z' },
  { id: 'doc-005', user_id: 'c3d4e5f6-a7b8-9012-cdef-123456789012', document_type: 'contract', document_name: 'Employment Contract - Ngozi Eze.pdf', file_url: '/uploads/documents/contract_ngozi.pdf', file_size: 238000, expiry_date: null, is_verified: true, verified_by: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', notes: 'Signed 20 Feb 2025', created_at: '2025-02-20T11:00:00.000Z', updated_at: '2025-02-20T11:00:00.000Z' },
  { id: 'doc-006', user_id: 'd4e5f6a7-b8c9-0123-defa-234567890123', document_type: 'contract', document_name: 'Employment Contract - Tunde Adeyemi.pdf', file_url: '/uploads/documents/contract_tunde.pdf', file_size: 232000, expiry_date: null, is_verified: true, verified_by: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', notes: 'Signed 5 Apr 2025', created_at: '2025-04-05T08:00:00.000Z', updated_at: '2025-04-05T08:00:00.000Z' },
  { id: 'doc-007', user_id: 'e5f6a7b8-c9d0-1234-efab-345678901234', document_type: 'contract', document_name: 'CEO Appointment Letter.pdf', file_url: '/uploads/documents/contract_ceo.pdf', file_size: 180000, expiry_date: null, is_verified: true, verified_by: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', notes: 'Signed 15 Jan 2025', created_at: '2025-01-15T09:00:00.000Z', updated_at: '2025-01-15T09:00:00.000Z' },
];
// ---------------------------------------------------------------------------
// 18. MOCK PERFORMANCE TARGETS
// ---------------------------------------------------------------------------
export const MOCK_PERFORMANCE_TARGETS: PerformanceTarget[] = [
  { id: 'pt-001', user_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901', target_type: 'monthly', period_start: '2026-06-01', period_end: '2026-06-30', sales_target: 2000000, actual_sales: 1545000, collection_target: 1800000, actual_collection: 1200000, new_customers_target: 5, new_customers_actual: 2, status: 'active', notes: 'Below target on collections — follow up on VetZone balance', created_at: '2026-06-01T00:00:00.000Z', updated_at: '2026-06-26T00:00:00.000Z' },
  { id: 'pt-002', user_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901', target_type: 'quarterly', period_start: '2026-04-01', period_end: '2026-06-30', sales_target: 6000000, actual_sales: 4250000, collection_target: 5400000, actual_collection: 3200000, new_customers_target: 15, new_customers_actual: 8, status: 'active', notes: 'Q2 in progress — behind on collections', created_at: '2026-04-01T00:00:00.000Z', updated_at: '2026-06-26T00:00:00.000Z' },
  { id: 'pt-003', user_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901', target_type: 'monthly', period_start: '2026-05-01', period_end: '2026-05-31', sales_target: 2000000, actual_sales: 1820000, collection_target: 1800000, actual_collection: 1350000, new_customers_target: 4, new_customers_actual: 3, status: 'missed', notes: 'Missed sales target by 9%', created_at: '2026-05-01T00:00:00.000Z', updated_at: '2026-06-01T00:00:00.000Z' },
  { id: 'pt-004', user_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901', target_type: 'monthly', period_start: '2026-04-01', period_end: '2026-04-30', sales_target: 1500000, actual_sales: 1680000, collection_target: 1350000, actual_collection: 1450000, new_customers_target: 3, new_customers_actual: 4, status: 'achieved', notes: 'Exceeded all targets for April', created_at: '2026-04-01T00:00:00.000Z', updated_at: '2026-05-01T00:00:00.000Z' },
  { id: 'pt-005', user_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901', target_type: 'annual', period_start: '2026-01-01', period_end: '2026-12-31', sales_target: 24000000, actual_sales: 7750000, collection_target: 21600000, actual_collection: 6000000, new_customers_target: 40, new_customers_actual: 12, status: 'active', notes: 'Annual target — 32% achieved at mid-year', created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-06-26T00:00:00.000Z' },
];
// ---------------------------------------------------------------------------
// 19. MOCK PERFORMANCE REVIEWS
// ---------------------------------------------------------------------------
export const MOCK_PERFORMANCE_REVIEWS: PerformanceReview[] = [
  { id: 'prv-001', user_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901', reviewer_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', review_period: 'Q1 2026', sales_achievement: 85.5, collection_rate: 72.0, customer_satisfaction: 88.0, overall_rating: 3.5, comments: 'Chidi is performing well in sales but needs to improve collection follow-up. Good customer relationships.', created_at: '2026-04-10T10:00:00.000Z', updated_at: '2026-04-10T10:00:00.000Z' },
  { id: 'prv-002', user_id: 'c3d4e5f6-a7b8-9012-cdef-123456789012', reviewer_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', review_period: 'Q1 2026', sales_achievement: null, collection_rate: 95.0, customer_satisfaction: 92.0, overall_rating: 4.5, comments: 'Ngozi has been excellent in payment processing and financial reporting. No discrepancies found.', created_at: '2026-04-10T10:00:00.000Z', updated_at: '2026-04-10T10:00:00.000Z' },
  { id: 'prv-003', user_id: 'd4e5f6a7-b8c9-0123-defa-234567890123', reviewer_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', review_period: 'Q1 2026', sales_achievement: null, collection_rate: null, customer_satisfaction: 90.0, overall_rating: 4.0, comments: 'Tunde maintains good inventory discipline. Expiry tracking has improved.', created_at: '2026-04-10T10:00:00.000Z', updated_at: '2026-04-10T10:00:00.000Z' },
];

// ---------------------------------------------------------------------------
// Convenience look-ups (for components that need to resolve IDs → names)
// ---------------------------------------------------------------------------
/** Find a user by their ID */
export function findUserById(id: string): User | undefined {
  return MOCK_USERS.find((u) => u.id === id);
}
/** Find a user by email (for auth) */
export function findUserByEmail(email: string): User | undefined {
  return MOCK_USERS.find((u) => u.email === email);
}
/** Find a product by its ID */
export function findProductById(id: string): Product | undefined {
  return MOCK_PRODUCTS.find((p) => p.id === id);
}
/** Find a customer by their ID */
export function findCustomerById(id: string): Customer | undefined {
  return MOCK_CUSTOMERS.find((c) => c.id === id);
}
/** Find a location by its ID */
export function findLocationById(id: string): Location | undefined {
  return MOCK_LOCATIONS.find((l) => l.id === id);
}
/** Get inventory items for a specific location */
export function getInventoryByLocation(locationId: string): InventoryItem[] {
  return MOCK_INVENTORY.filter((i) => i.location_id === locationId);
}
/** Get invoices for a specific customer */
export function getInvoicesByCustomer(customerId: string): Invoice[] {
  return MOCK_INVOICES.filter((i) => i.customer_id === customerId);
}
/** Get payments for a specific invoice */
export function getPaymentsByInvoice(invoiceId: string): Payment[] {
  return MOCK_PAYMENTS.filter((p) => p.invoice_id === invoiceId);
}

/** Find a salary grade by its ID */
export function findSalaryGradeById(id: string): SalaryGrade | undefined {
  return MOCK_SALARY_GRADES.find((sg) => sg.id === id);
}

/** Get salary for a specific user */
export function getSalaryByUserId(userId: string): Salary | undefined {
  return MOCK_SALARIES.find((s) => s.user_id === userId && s.is_active);
}

/** Get payslips for a specific user */
export function getPayslipsByUserId(userId: string): Payslip[] {
  return MOCK_PAYSLIPS.filter((p) => p.user_id === userId);
}

/** Get payslips for a specific payroll run */
export function getPayslipsByPayrollRun(payrollRunId: string): Payslip[] {
  return MOCK_PAYSLIPS.filter((p) => p.payroll_run_id === payrollRunId);
}

/** Get leave requests for a specific user */
export function getLeaveRequestsByUserId(userId: string): LeaveRequest[] {
  return MOCK_LEAVE_REQUESTS.filter((lr) => lr.user_id === userId);
}

/** Get leave balance for a specific user */
export function getLeaveBalancesByUserId(userId: string): LeaveBalance[] {
  return MOCK_LEAVE_BALANCES.filter((lb) => lb.user_id === userId);
}

/** Get attendance logs for a specific user */
export function getAttendanceLogsByUserId(userId: string): AttendanceLog[] {
  return MOCK_ATTENDANCE_LOGS.filter((a) => a.user_id === userId);
}

/** Get documents for a specific user */
export function getDocumentsByUserId(userId: string): EmployeeDocument[] {
  return MOCK_EMPLOYEE_DOCUMENTS.filter((d) => d.user_id === userId);
}

/** Get performance targets for a specific user */
export function getPerformanceTargetsByUserId(userId: string): PerformanceTarget[] {
  return MOCK_PERFORMANCE_TARGETS.filter((t) => t.user_id === userId);
}

/** Get performance reviews for a specific user */
export function getPerformanceReviewsByUserId(userId: string): PerformanceReview[] {
  return MOCK_PERFORMANCE_REVIEWS.filter((r) => r.user_id === userId);
}

// ============================================================================
// 11. CLINIC — Mock Data
// ============================================================================

export const MOCK_VET_SERVICES: VetService[] = [
  { id: 'vs-001', name: 'General Consultation', description: 'Standard veterinary checkup', category: 'consultation', species: 'All', price: 5000, is_active: true, created_at: '2025-01-01T00:00:00.000Z', updated_at: '2025-01-01T00:00:00.000Z' },
  { id: 'vs-002', name: 'Vaccination', description: 'Core vaccines for dogs and cats', category: 'preventive', species: 'Dog,Cat', price: 8000, is_active: true, created_at: '2025-01-01T00:00:00.000Z', updated_at: '2025-01-01T00:00:00.000Z' },
  { id: 'vs-003', name: 'Spay/Neuter', description: 'Sterilization surgery', category: 'surgery', species: 'Dog,Cat', price: 35000, is_active: true, created_at: '2025-01-01T00:00:00.000Z', updated_at: '2025-01-01T00:00:00.000Z' },
  { id: 'vs-004', name: 'Dental Cleaning', description: 'Scaling, polishing, and oral exam', category: 'dental', species: 'Dog,Cat', price: 15000, is_active: true, created_at: '2025-01-01T00:00:00.000Z', updated_at: '2025-01-01T00:00:00.000Z' },
  { id: 'vs-005', name: 'X-Ray', description: 'Digital radiography', category: 'diagnostic', species: 'All', price: 12000, is_active: true, created_at: '2025-01-01T00:00:00.000Z', updated_at: '2025-01-01T00:00:00.000Z' },
  { id: 'vs-006', name: 'Laboratory Test', description: 'Blood work, fecal, urinalysis', category: 'diagnostic', species: 'All', price: 10000, is_active: true, created_at: '2025-01-01T00:00:00.000Z', updated_at: '2025-01-01T00:00:00.000Z' },
  { id: 'vs-007', name: 'Hospitalization', description: 'Per night stay with monitoring', category: 'inpatient', species: 'All', price: 15000, is_active: true, created_at: '2025-01-01T00:00:00.000Z', updated_at: '2025-01-01T00:00:00.000Z' },
  { id: 'vs-008', name: 'Emergency Care', description: 'After-hours emergency treatment', category: 'emergency', species: 'All', price: 25000, is_active: true, created_at: '2025-01-01T00:00:00.000Z', updated_at: '2025-01-01T00:00:00.000Z' },
];

export const MOCK_PATIENTS: Patient[] = [
  { id: 'pat-001', owner_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', location_id: null, name: 'Max', species: 'Dog', breed: 'Golden Retriever', gender: 'Male', date_of_birth: '2022-03-15', age_years: 3, age_months: 2, weight_kg: 32.5, color: 'Golden', microchip_id: 'MC-982-0001', spayed_neutered: false, allergies: null, medical_notes: null, is_active: true, created_at: '2025-06-01T10:00:00.000Z', updated_at: '2025-06-01T10:00:00.000Z' },
  { id: 'pat-002', owner_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', location_id: null, name: 'Luna', species: 'Cat', breed: 'Siamese', gender: 'Female', date_of_birth: '2021-11-20', age_years: 4, age_months: 7, weight_kg: 4.2, color: 'Cream', microchip_id: 'MC-982-0002', spayed_neutered: true, allergies: 'Fish', medical_notes: null, is_active: true, created_at: '2025-06-01T10:00:00.000Z', updated_at: '2025-06-01T10:00:00.000Z' },
  { id: 'pat-003', owner_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901', location_id: null, name: 'Charlie', species: 'Dog', breed: 'German Shepherd', gender: 'Male', date_of_birth: '2023-01-10', age_years: 2, age_months: 5, weight_kg: 28.0, color: 'Black & Tan', microchip_id: 'MC-982-0003', spayed_neutered: false, allergies: 'Chicken', medical_notes: null, is_active: true, created_at: '2025-06-02T14:00:00.000Z', updated_at: '2025-06-02T14:00:00.000Z' },
];

export const MOCK_APPOINTMENTS: Appointment[] = [
  { id: 'apt-001', patient_id: 'pat-001', owner_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', vet_id: null, location_id: null, procedure_type: 'General Consultation', date: '2026-07-01', time: '09:00', duration_minutes: 30, reason: 'Annual checkup', status: 'scheduled', notes: null, created_at: '2026-06-25T08:00:00.000Z', updated_at: '2026-06-25T08:00:00.000Z' },
  { id: 'apt-002', patient_id: 'pat-002', owner_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', vet_id: null, location_id: null, procedure_type: 'Vaccination', date: '2026-07-01', time: '10:00', duration_minutes: 20, reason: 'Booster shot', status: 'scheduled', notes: null, created_at: '2026-06-25T08:00:00.000Z', updated_at: '2026-06-25T08:00:00.000Z' },
  { id: 'apt-003', patient_id: 'pat-003', owner_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901', vet_id: null, location_id: null, procedure_type: 'General Consultation', date: '2026-07-02', time: '11:00', duration_minutes: 30, reason: 'Limping on right hind leg', status: 'scheduled', notes: null, created_at: '2026-06-26T09:00:00.000Z', updated_at: '2026-06-26T09:00:00.000Z' },
];

export const MOCK_TREATMENTS: Treatment[] = [
  { id: 'trt-001', patient_id: 'pat-001', vet_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', location_id: null, date: '2026-06-15', chief_complaint: 'Skin irritation on belly', diagnosis: 'Allergic dermatitis', assessment: 'Mild inflammation with erythema', plan: 'Prescribe antihistamines and hypoallergenic diet for 2 weeks', status: 'completed', follow_up_date: '2026-06-29', total_cost: 8500, created_at: '2026-06-15T10:00:00.000Z', updated_at: '2026-06-15T10:00:00.000Z' },
  { id: 'trt-002', patient_id: 'pat-002', vet_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', location_id: null, date: '2026-06-20', chief_complaint: 'Vomiting after meals', diagnosis: 'Gastritis', assessment: 'Moderate dehydration noted', plan: 'IV fluids, antiemetics, bland diet for 3 days', status: 'ongoing', follow_up_date: '2026-06-27', total_cost: 12000, created_at: '2026-06-20T14:00:00.000Z', updated_at: '2026-06-20T14:00:00.000Z' },
];

export const MOCK_TREATMENT_MEDICATIONS: TreatmentMedication[] = [
  { id: 'tm-001', treatment_id: 'trt-001', inventory_item_id: null, drug_name: 'Cetirizine', dosage: '10mg', route: 'Oral', frequency: 'Once daily', duration: '14 days', quantity: 14, unit_price: 150, total: 2100, created_at: '2026-06-15T10:00:00.000Z' },
  { id: 'tm-002', treatment_id: 'trt-002', inventory_item_id: null, drug_name: 'Maropitant', dosage: '1mg/kg', route: 'IV', frequency: 'Once daily', duration: '3 days', quantity: 3, unit_price: 1200, total: 3600, created_at: '2026-06-20T14:00:00.000Z' },
];

export const MOCK_PATIENT_QUEUE: PatientQueue[] = [
  { id: 'q-001', patient_id: 'pat-001', owner_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', location_id: null, department: 'consultation', priority: 'normal', status: 'waiting', reason: 'Follow-up skin check', assigned_vet_id: null, called_at: null, completed_at: null, created_at: '2026-06-30T08:30:00.000Z', updated_at: '2026-06-30T08:30:00.000Z' },
  { id: 'q-002', patient_id: 'pat-003', owner_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901', location_id: null, department: 'emergency', priority: 'urgent', status: 'waiting', reason: 'Hit by car — possible fracture', assigned_vet_id: null, called_at: null, completed_at: null, created_at: '2026-06-30T09:00:00.000Z', updated_at: '2026-06-30T09:00:00.000Z' },
];

/* ── Diagnostic Lab Hub Mock Orders ── */
export const MOCK_LAB_ORDERS: LabOrder[] = [
  {
    id: 'lab-001',
    order_number: 'LAB-2026-001',
    patient_id: 'pat-001',
    patient_name: 'Max (Golden Retriever)',
    species: 'Canine',
    breed: 'Golden Retriever',
    owner_name: 'Chief Anthony Eze',
    doctor_id: 'c2b2c3d4-e5f6-7890-abcd-ef1234567892',
    doctor_name: 'Dr. Amaka Bello, DVM',
    test_type: 'cbc',
    status: 'ready',
    notes: 'Pre-op comprehensive hematology screen',
    collected_at: '2026-06-30T09:15:00.000Z',
    completed_at: '2026-06-30T10:30:00.000Z',
    reviewed_by: 'Babatunde Adeleke',
    pathology_summary: 'Mild regenerative anemia with elevated leukocyte count indicating systemic inflammation.',
    results: [
      { name: 'RBC (Red Blood Cells)', value: 4.8, unit: 'M/uL', reference_range: '5.5 - 8.5', flag: 'low' },
      { name: 'Hemoglobin', value: 10.2, unit: 'g/dL', reference_range: '12.0 - 18.0', flag: 'low' },
      { name: 'Hematocrit (PCV)', value: 31.0, unit: '%', reference_range: '37.0 - 55.0', flag: 'low' },
      { name: 'WBC (White Blood Cells)', value: 19.4, unit: 'K/uL', reference_range: '6.0 - 17.0', flag: 'high' },
      { name: 'Platelets', value: 245, unit: 'K/uL', reference_range: '175 - 500', flag: 'normal' },
    ],
  },
  {
    id: 'lab-002',
    order_number: 'LAB-2026-002',
    patient_id: 'pat-002',
    patient_name: 'Bella (Persian Cat)',
    species: 'Feline',
    breed: 'Persian',
    owner_name: 'Mrs. Folake Davies',
    doctor_id: 'c1b2c3d4-e5f6-7890-abcd-ef1234567891',
    doctor_name: 'Dr. Kalu Okonkwo',
    test_type: 'biochemistry',
    status: 'processing',
    notes: 'Renal & liver biochemistry panel',
    collected_at: '2026-06-30T10:00:00.000Z',
  },
  {
    id: 'lab-003',
    order_number: 'LAB-2026-003',
    patient_id: 'pat-003',
    patient_name: 'Thor (Rottweiler)',
    species: 'Canine',
    breed: 'Rottweiler',
    owner_name: 'Engr. Obinna Nwosu',
    doctor_id: 'c2b2c3d4-e5f6-7890-abcd-ef1234567892',
    doctor_name: 'Dr. Amaka Bello, DVM',
    test_type: 'parasitology',
    status: 'collected',
    notes: 'Blood smear for Babesia and Ehrlichia check',
    collected_at: '2026-06-30T10:45:00.000Z',
  },
];

/* ── Inpatient ICU & Hospitalization Mock Records ── */
export const MOCK_HOSPITALIZATIONS: HospitalizationRecord[] = [
  {
    id: 'hosp-001',
    patient_id: 'pat-001',
    patient_name: 'Max (Golden Retriever)',
    species: 'Canine',
    cage_number: 'ICU-Bay-01',
    ward: 'icu',
    admission_date: '2026-06-29T14:00:00.000Z',
    reason_for_admission: 'Acute pancreatitis with severe dehydration and abdominal pain',
    attending_vet_id: 'c2b2c3d4-e5f6-7890-abcd-ef1234567892',
    attending_vet_name: 'Dr. Amaka Bello, DVM',
    status: 'active',
    weight_kg: 28.5,
    vitals: [
      {
        id: 'vit-01',
        timestamp: '2026-06-30T08:00:00.000Z',
        temperature_c: 38.8,
        heart_rate_bpm: 110,
        respiratory_rate_bpm: 24,
        crt_seconds: 1.5,
        mucous_membranes: 'pink',
        fluid_rate_ml_hr: 65,
        notes: 'Alert, resting comfortably, IV fluid therapy running smoothly',
        logged_by: 'Ibrahim Musa (Vet Tech)',
      },
      {
        id: 'vit-02',
        timestamp: '2026-06-30T10:00:00.000Z',
        temperature_c: 38.6,
        heart_rate_bpm: 104,
        respiratory_rate_bpm: 22,
        crt_seconds: 1.5,
        mucous_membranes: 'pink',
        fluid_rate_ml_hr: 65,
        notes: 'Urine output normal, pain score 2/10',
        logged_by: 'Ibrahim Musa (Vet Tech)',
      },
    ],
  },
  {
    id: 'hosp-002',
    patient_id: 'pat-003',
    patient_name: 'Thor (Rottweiler)',
    species: 'Canine',
    cage_number: 'Ward-A-04',
    ward: 'general_ward',
    admission_date: '2026-06-30T09:30:00.000Z',
    reason_for_admission: 'Femoral fracture stabilization pre-surgery',
    attending_vet_id: 'c1b2c3d4-e5f6-7890-abcd-ef1234567891',
    attending_vet_name: 'Dr. Kalu Okonkwo',
    status: 'critical',
    weight_kg: 42.0,
    vitals: [
      {
        id: 'vit-03',
        timestamp: '2026-06-30T09:45:00.000Z',
        temperature_c: 39.2,
        heart_rate_bpm: 135,
        respiratory_rate_bpm: 32,
        crt_seconds: 2.0,
        mucous_membranes: 'pale',
        fluid_rate_ml_hr: 90,
        notes: 'Pre-op splint placed, opioid analgesia administered',
        logged_by: 'Ibrahim Musa (Vet Tech)',
      },
    ],
  },
];

/* ── Surgical Suite Mock Records ── */
export const MOCK_SURGERIES: SurgeryRecord[] = [
  {
    id: 'surg-001',
    surgery_number: 'SURG-2026-001',
    patient_id: 'pat-003',
    patient_name: 'Thor (Rottweiler)',
    procedure_name: 'Femoral Fracture Repair & Intramedullary Pinning',
    primary_surgeon: 'Dr. Amaka Bello, DVM',
    anesthetist: 'Dr. Kalu Okonkwo',
    status: 'scheduled',
    scheduled_date: '2026-06-30T14:30:00.000Z',
    pre_op_checklist: {
      fasting_confirmed: true,
      consent_signed: true,
      iv_catheter_placed: true,
      pre_medication_given: true,
    },
    anesthesia_agent: 'Propofol induction, Isoflurane maintenance',
    duration_minutes: 90,
    surgical_notes: 'Right distal femur transverse fracture. Target closed reduction with 3.5mm dynamic plate.',
    post_op_instructions: 'Strict cage rest for 6 weeks, NSAID analgesia, antibiotic course.',
  },
  {
    id: 'surg-002',
    surgery_number: 'SURG-2026-002',
    patient_id: 'pat-002',
    patient_name: 'Bella (Persian Cat)',
    procedure_name: 'Feline Ovariohysterectomy (Spay)',
    primary_surgeon: 'Dr. Kalu Okonkwo',
    anesthetist: 'Ibrahim Musa (Vet Tech)',
    status: 'completed',
    scheduled_date: '2026-06-28T10:00:00.000Z',
    pre_op_checklist: {
      fasting_confirmed: true,
      consent_signed: true,
      iv_catheter_placed: true,
      pre_medication_given: true,
    },
    anesthesia_agent: 'Ketamine/Midazolam with Isoflurane',
    duration_minutes: 45,
    blood_loss_ml: 15,
    surgical_notes: 'Routine midline celiotomy. Ligatures secure, abdominal wall closed in 3 layers.',
    post_op_instructions: 'Elizabethan collar for 10 days. Suture removal on day 10.',
  },
];

/* ── Cash Reconciliation Mock Records ── */
export const MOCK_CASH_RECONCILIATIONS: CashReconciliation[] = [
  {
    id: 'rec-001',
    shift_date: '2026-06-29',
    shift_type: 'full_day',
    reconciled_by: 'Chioma Eze (Receptionist)',
    cash_expected: 145000,
    cash_actual: 145000,
    pos_card_expected: 320000,
    pos_card_actual: 320000,
    bank_transfer_expected: 85000,
    bank_transfer_actual: 85000,
    total_expected: 550000,
    total_actual: 550000,
    variance: 0,
    status: 'balanced',
    approved_by: 'Dr. Kalu Okonkwo (Clinic Admin)',
    created_at: '2026-06-29T19:00:00.000Z',
  },
  {
    id: 'rec-002',
    shift_date: '2026-06-30',
    shift_type: 'morning',
    reconciled_by: 'Chioma Eze (Receptionist)',
    cash_expected: 85000,
    cash_actual: 85000,
    pos_card_expected: 190000,
    pos_card_actual: 190000,
    bank_transfer_expected: 45000,
    bank_transfer_actual: 45000,
    total_expected: 320000,
    total_actual: 320000,
    variance: 0,
    status: 'balanced',
    created_at: '2026-06-30T14:00:00.000Z',
  },
];

/* ── Enterprise Audit Log Vault Mock Records ── */
export const MOCK_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'audit-001',
    table_name: 'payments',
    record_id: 'pay-0001-chidi-cash',
    action: 'approved',
    actor_id: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
    actor_name: 'Ngozi Eze',
    actor_role: 'finance_manager',
    category: 'financial',
    severity: 'info',
    details: {
      invoice_number: 'INV-2026-001',
      customer: 'VetZone Animal Clinic',
      amount_approved: 1200000,
      payment_method: 'bank_transfer',
      previous_balance: 1450000,
      new_balance: 250000,
    },
    ip_address: '102.89.33.14',
    created_at: '2026-06-30T16:45:00.000Z',
  },
  {
    id: 'audit-002',
    table_name: 'narcotics_dispensing',
    record_id: 'disp-004-ketamine',
    action: 'dispensed',
    actor_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    actor_name: 'Dr. Amaka Bello, DVM',
    actor_role: 'vet',
    category: 'narcotics',
    severity: 'warning',
    details: {
      substance: 'Ketamine Hydrochloride 50mg/mL',
      schedule: 'Schedule II',
      volume_dispensed: '5.0 mL',
      patient: 'Thor (Rottweiler)',
      procedure: 'Femoral Fracture Pinning',
      pin_verified: true,
      custody_witness: 'Ibrahim Musa (Vet Tech)',
    },
    ip_address: '197.210.55.8',
    created_at: '2026-06-30T14:15:00.000Z',
  },
  {
    id: 'audit-003',
    table_name: 'stock_movements',
    record_id: 'mov-008-allocation',
    action: 'created',
    actor_id: 'd4e5f6a7-b8c9-0123-defa-234567890123',
    actor_name: 'Tunde Adeyemi',
    actor_role: 'inventory_manager',
    category: 'inventory',
    severity: 'info',
    details: {
      product: 'Oxytetracycline 20% LA 100mL',
      quantity: 50,
      from: 'Onitsha Central Warehouse',
      to: 'Lagos Territory Depot',
      batch_number: 'OXY-2026-B12',
      expiry_date: '2027-04-30',
    },
    ip_address: '102.89.44.12',
    created_at: '2026-06-30T11:20:00.000Z',
  },
  {
    id: 'audit-004',
    table_name: 'payments',
    record_id: 'pay-0004-invalid-slip',
    action: 'rejected',
    actor_id: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
    actor_name: 'Ngozi Eze',
    actor_role: 'finance_manager',
    category: 'financial',
    severity: 'warning',
    details: {
      invoice_number: 'INV-2026-004',
      customer: 'Sunrise Farm Supplies',
      attempted_amount: 450000,
      rejection_reason: 'Bank transfer slip blurred; teller number could not be validated with Access Bank.',
    },
    ip_address: '102.89.33.14',
    created_at: '2026-06-29T15:10:00.000Z',
  },
  {
    id: 'audit-005',
    table_name: 'auth_sessions',
    record_id: 'sess-superadmin-login',
    action: 'login',
    actor_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    actor_name: 'Dr. Emeka Moneke',
    actor_role: 'super_admin',
    category: 'security',
    severity: 'info',
    details: {
      session_type: 'Executive Single Sign-On',
      multi_role_active: ['super_admin', 'ceo'],
      device: 'macOS Chrome 126.0 (HQ Terminal)',
    },
    ip_address: '102.89.44.12',
    created_at: '2026-06-29T08:30:00.000Z',
  },
  {
    id: 'audit-006',
    table_name: 'narcotics_lockbox',
    record_id: 'lockbox-audit-cycle',
    action: 'reconciled',
    actor_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    actor_name: 'Dr. Kalu Okonkwo',
    actor_role: 'clinic_admin',
    category: 'narcotics',
    severity: 'critical',
    details: {
      cycle: 'Bi-Weekly Schedule II Controlled Audit',
      ketamine_vials_counted: 24,
      morphine_ampoules_counted: 10,
      diazepam_vials_counted: 15,
      discrepancy: 0,
      lockbox_seal_number: 'SEAL-2026-9941',
    },
    ip_address: '197.210.55.8',
    created_at: '2026-06-28T18:00:00.000Z',
  },
  {
    id: 'audit-007',
    table_name: 'surgeries',
    record_id: 'surg-001',
    action: 'created',
    actor_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    actor_name: 'Dr. Amaka Bello, DVM',
    actor_role: 'vet',
    category: 'clinical',
    severity: 'info',
    details: {
      procedure: 'Femoral Fracture Repair & Intramedullary Pinning',
      theater: 'OR-1 Main Sterile Suite',
      patient: 'Thor (Rottweiler)',
      pre_op_safety_passed: true,
    },
    ip_address: '197.210.55.8',
    created_at: '2026-06-28T09:15:00.000Z',
  },
];

/* ── Operating Expenses Mock Records ── */
export const MOCK_EXPENSES: BranchExpense[] = [
  {
    id: 'exp-001',
    location_id: 'loc-0001-onitsha-hq',
    location_name: 'Onitsha Central HQ & Depot',
    category: 'fuel',
    amount: 350000,
    description: 'Diesel Fuel Purchase (250 Litres for 100kVA Standby Generator)',
    expense_date: '2026-06-29',
    recorded_by: 'Ngozi Eze',
    recorder_name: 'Ngozi Eze (Finance Manager)',
    vendor_name: 'TotalEnergies Onitsha Expressway',
    payment_method: 'bank_transfer',
    receipt_url: 'https://example.com/receipts/diesel-2026-06.pdf',
    created_at: '2026-06-29T11:00:00.000Z',
  },
  {
    id: 'exp-002',
    location_id: 'loc-0003-ikeja-clinic',
    location_name: 'Ikeja Specialist Veterinary Center',
    category: 'consumables',
    amount: 185000,
    description: 'Diagnostic SNAP Test Kits (Parvo/Corona/Giardia) & Reagent Stains',
    expense_date: '2026-06-28',
    recorded_by: 'Babatunde Adeleke',
    recorder_name: 'Babatunde Adeleke (Lab Scientist)',
    vendor_name: 'BioDiagnostics West Africa Ltd',
    payment_method: 'bank_transfer',
    receipt_url: 'https://example.com/receipts/lab-kits-0628.pdf',
    created_at: '2026-06-28T14:30:00.000Z',
  },
  {
    id: 'exp-003',
    location_id: 'loc-0001-onitsha-hq',
    location_name: 'Onitsha Central HQ & Depot',
    category: 'utilities',
    amount: 75000,
    description: 'Dedicated Fiber Internet Bandwidth Subscription (Monthly)',
    expense_date: '2026-06-25',
    recorded_by: 'Ngozi Eze',
    recorder_name: 'Ngozi Eze (Finance Manager)',
    vendor_name: 'MainOne Broadband Services',
    payment_method: 'bank_transfer',
    receipt_url: null,
    created_at: '2026-06-25T09:15:00.000Z',
  },
  {
    id: 'exp-004',
    location_id: 'loc-0004-lekki-hospital',
    location_name: 'Lekki Pet Hospital',
    category: 'maintenance',
    amount: 120000,
    description: 'Autoclave Sterilizer Calibration & Bi-Annual Pressure Chamber Servicing',
    expense_date: '2026-06-22',
    recorded_by: 'Dr. Kalu Okonkwo',
    recorder_name: 'Dr. Kalu Okonkwo (Clinic Admin)',
    vendor_name: 'SterilMed Nigeria Technical Ltd',
    payment_method: 'bank_transfer',
    receipt_url: 'https://example.com/receipts/autoclave-servicing.pdf',
    created_at: '2026-06-22T15:00:00.000Z',
  },
  {
    id: 'exp-005',
    location_id: 'loc-0002-lagos-territory',
    location_name: 'Lagos Mainland Depot & Office',
    category: 'rent',
    amount: 450000,
    description: 'Territory Office & Cold-Room Facility Lease Monthly Amortization',
    expense_date: '2026-06-01',
    recorded_by: 'Ngozi Eze',
    recorder_name: 'Ngozi Eze (Finance Manager)',
    vendor_name: 'Prime Commercial Properties Lagos',
    payment_method: 'bank_transfer',
    receipt_url: null,
    created_at: '2026-06-01T08:00:00.000Z',
  },
  {
    id: 'exp-006',
    location_id: 'loc-0003-ikeja-clinic',
    location_name: 'Ikeja Specialist Veterinary Center',
    category: 'consumables',
    amount: 95000,
    description: 'Surgical Needles, Sutures (Polyglactin 2-0/3-0), Gauze Swabs & IV Lines',
    expense_date: '2026-06-18',
    recorded_by: 'Ibrahim Musa',
    recorder_name: 'Ibrahim Musa (Vet Tech)',
    vendor_name: 'MedEquip Nigeria Supplies',
    payment_method: 'cash',
    receipt_url: null,
    created_at: '2026-06-18T16:20:00.000Z',
  },
];

/* ── Shift Timetable & Duty Roster Mock Records ── */
export const MOCK_SHIFTS: ClinicShift[] = [
  {
    id: 'shift-001',
    user_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    staff_name: 'Dr. Amaka Bello, DVM',
    role: 'vet',
    location_id: 'loc-0003-ikeja-clinic',
    location_name: 'Ikeja Specialist Veterinary Center',
    shift_date: '2026-07-01',
    shift_block: 'morning',
    start_time: '08:00',
    end_time: '16:00',
    notes: 'Lead surgeon on morning soft-tissue procedures',
    created_at: '2026-06-28T09:00:00.000Z',
  },
  {
    id: 'shift-002',
    user_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    staff_name: 'Ibrahim Musa',
    role: 'vet_tech',
    location_id: 'loc-0003-ikeja-clinic',
    location_name: 'Ikeja Specialist Veterinary Center',
    shift_date: '2026-07-01',
    shift_block: 'morning',
    start_time: '08:00',
    end_time: '16:00',
    notes: 'Inpatient ICU kennel rounds and fluid pump monitoring',
    created_at: '2026-06-28T09:00:00.000Z',
  },
  {
    id: 'shift-003',
    user_id: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
    staff_name: 'Chioma Eze',
    role: 'receptionist',
    location_id: 'loc-0003-ikeja-clinic',
    location_name: 'Ikeja Specialist Veterinary Center',
    shift_date: '2026-07-01',
    shift_block: 'morning',
    start_time: '08:00',
    end_time: '16:00',
    notes: 'Front desk patient queue intake and POS billing',
    created_at: '2026-06-28T09:00:00.000Z',
  },
  {
    id: 'shift-004',
    user_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    staff_name: 'Dr. Kalu Okonkwo',
    role: 'clinic_admin',
    location_id: 'loc-0004-lekki-hospital',
    location_name: 'Lekki Pet Hospital',
    shift_date: '2026-07-01',
    shift_block: 'afternoon',
    start_time: '14:00',
    end_time: '22:00',
    notes: 'Clinical admin shift and emergency triage coverage',
    created_at: '2026-06-28T09:00:00.000Z',
  },
  {
    id: 'shift-005',
    user_id: 'd4e5f6a7-b8c9-0123-defa-234567890123',
    staff_name: 'Babatunde Adeleke',
    role: 'lab_scientist',
    location_id: 'loc-0003-ikeja-clinic',
    location_name: 'Ikeja Specialist Veterinary Center',
    shift_date: '2026-07-02',
    shift_block: 'morning',
    start_time: '08:00',
    end_time: '16:00',
    notes: 'Diagnostic hub CBC and biochemical panel accessioning',
    created_at: '2026-06-28T09:00:00.000Z',
  },
  {
    id: 'shift-006',
    user_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    staff_name: 'Dr. Amaka Bello, DVM',
    role: 'vet',
    location_id: 'loc-0003-ikeja-clinic',
    location_name: 'Ikeja Specialist Veterinary Center',
    shift_date: '2026-07-02',
    shift_block: 'on_call',
    start_time: '22:00',
    end_time: '08:00',
    notes: '24-hour ER emergency veterinary on-call coverage',
    created_at: '2026-06-28T09:00:00.000Z',
  },
];

/* ── Preventive Care & Patient Recalls Mock Records ── */
export const MOCK_REMINDERS: PatientReminder[] = [
  {
    id: 'rem-001',
    patient_id: 'pat-001',
    patient_name: 'Max (Golden Retriever)',
    owner_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    owner_name: 'Dr. Emeka Moneke',
    owner_phone: '+234 803 456 7890',
    species: 'Dog',
    reminder_type: 'vaccination',
    title: 'Annual Rabies Booster Vaccine Due',
    due_date: '2026-07-02',
    status: 'pending',
    notes: 'Previous vaccine given 12 months ago; rabies certificate renewal needed.',
    last_notified_at: null,
    created_at: '2026-06-20T10:00:00.000Z',
  },
  {
    id: 'rem-002',
    patient_id: 'pat-003',
    patient_name: 'Thor (Rottweiler)',
    owner_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    owner_name: 'Chidi Okafor',
    owner_phone: '+234 812 345 6789',
    species: 'Dog',
    reminder_type: 'suture_removal',
    title: 'Post-Op Femoral Suture Removal & Orthopedic Recheck',
    due_date: '2026-07-08',
    status: 'pending',
    notes: 'Inspect surgical incision site, remove skin staples, evaluate weight-bearing.',
    last_notified_at: null,
    created_at: '2026-06-28T16:00:00.000Z',
  },
  {
    id: 'rem-003',
    patient_id: 'pat-002',
    patient_name: 'Bella (Persian Cat)',
    owner_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    owner_name: 'Dr. Emeka Moneke',
    owner_phone: '+234 803 456 7890',
    species: 'Cat',
    reminder_type: 'deworming',
    title: 'Quarterly Broad-Spectrum Feline Deworming',
    due_date: '2026-06-25',
    status: 'pending',
    notes: 'Overdue by 5 days; administer Praziquantel/Pyrantel.',
    last_notified_at: '2026-06-26T09:00:00.000Z',
    created_at: '2026-06-15T12:00:00.000Z',
  },
  {
    id: 'rem-004',
    patient_id: 'pat-001',
    patient_name: 'Max (Golden Retriever)',
    owner_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    owner_name: 'Dr. Emeka Moneke',
    owner_phone: '+234 803 456 7890',
    species: 'Dog',
    reminder_type: 'medication_refill',
    title: 'Chronic Atopic Allergy Refill (Cetirizine 10mg)',
    due_date: '2026-07-15',
    status: 'pending',
    notes: 'Check for skin itch control and re-evaluate dosage.',
    last_notified_at: null,
    created_at: '2026-06-25T14:00:00.000Z',
  },
];