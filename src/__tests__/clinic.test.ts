import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getPatients,
  addPatient,
  getAppointments,
  addAppointment,
  updateAppointmentStatus,
  getQueue,
  getVetServices,
  getTreatments,
  getTreatmentMedications,
  createTreatment,
  createTreatmentMedication,
  getClinicClients,
  getClinicClientById,
  addClinicClient,
  updateClinicClient,
} from '@/lib/data-service';
import {
  MOCK_PATIENTS,
  MOCK_APPOINTMENTS,
  MOCK_TREATMENTS,
  MOCK_CLINIC_CLIENTS,
} from '@/lib/mock-data';

let patientsSnapshot: typeof MOCK_PATIENTS;
let appointmentsSnapshot: typeof MOCK_APPOINTMENTS;
let treatmentsSnapshot: typeof MOCK_TREATMENTS;
let clientsSnapshot: typeof MOCK_CLINIC_CLIENTS;

function saveSnapshots() {
  patientsSnapshot = JSON.parse(JSON.stringify(MOCK_PATIENTS));
  appointmentsSnapshot = JSON.parse(JSON.stringify(MOCK_APPOINTMENTS));
  treatmentsSnapshot = JSON.parse(JSON.stringify(MOCK_TREATMENTS));
  clientsSnapshot = JSON.parse(JSON.stringify(MOCK_CLINIC_CLIENTS));
}

function restoreSnapshots() {
  MOCK_PATIENTS.length = 0;
  MOCK_PATIENTS.push(...patientsSnapshot);
  MOCK_APPOINTMENTS.length = 0;
  MOCK_APPOINTMENTS.push(...appointmentsSnapshot);
  MOCK_TREATMENTS.length = 0;
  MOCK_TREATMENTS.push(...treatmentsSnapshot);
  MOCK_CLINIC_CLIENTS.length = 0;
  MOCK_CLINIC_CLIENTS.push(...clientsSnapshot);
}

beforeEach(() => {
  saveSnapshots();
});

afterEach(() => {
  restoreSnapshots();
});

describe('getPatients', () => {
  it('returns all patients', async () => {
    const patients = await getPatients();
    expect(Array.isArray(patients)).toBe(true);
    expect(patients.length).toBeGreaterThan(0);
  });
});

describe('addPatient', () => {
  it('rejects missing name', async () => {
    const result = await addPatient({
      owner_id: 'test-owner',
      name: '',
      species: 'Dog',
      gender: 'Male',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('name');
  });

  it('rejects missing owner', async () => {
    const result = await addPatient({
      owner_id: '',
      name: 'Test Pet',
      species: 'Cat',
      gender: 'Female',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Owner');
  });

  it('creates a patient with defaults', async () => {
    const result = await addPatient({
      owner_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      name: 'Buddy',
      species: 'Dog',
      gender: 'Male',
    });
    expect(result.success).toBe(true);
    expect(result.data?.name).toBe('Buddy');
    expect(result.data?.is_active).toBe(true);
    expect(result.data?.spayed_neutered).toBe(false);
  });

  it('creates a patient with full details', async () => {
    const result = await addPatient({
      owner_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      name: 'Whiskers',
      species: 'Cat',
      breed: 'Persian',
      gender: 'Female',
      date_of_birth: '2023-05-15',
      weight_kg: 4.5,
      color: 'White',
      microchip_id: 'MC-999-0001',
      spayed_neutered: true,
      allergies: 'None',
      medical_notes: 'Healthy',
    });
    expect(result.success).toBe(true);
    expect(result.data?.name).toBe('Whiskers');
    expect(result.data?.species).toBe('Cat');
    expect(result.data?.breed).toBe('Persian');
    expect(result.data?.weight_kg).toBe(4.5);
  });
});

describe('getAppointments', () => {
  it('returns all appointments', async () => {
    const appointments = await getAppointments();
    expect(Array.isArray(appointments)).toBe(true);
    expect(appointments.length).toBeGreaterThan(0);
  });
});

describe('addAppointment', () => {
  it('rejects missing patient', async () => {
    const result = await addAppointment({
      patient_id: '',
      owner_id: 'owner-1',
      date: '2026-07-15',
      time: '09:00',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Patient');
  });

  it('rejects missing date', async () => {
    const result = await addAppointment({
      patient_id: 'pat-001',
      owner_id: 'owner-1',
      date: '',
      time: '09:00',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Date');
  });

  it('creates an appointment with defaults', async () => {
    const result = await addAppointment({
      patient_id: 'pat-001',
      owner_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      date: '2026-07-20',
      time: '14:00',
    });
    expect(result.success).toBe(true);
    expect(result.data?.status).toBe('scheduled');
    expect(result.data?.duration_minutes).toBe(30);
  });

  it('creates an appointment with full details', async () => {
    const result = await addAppointment({
      patient_id: 'pat-002',
      owner_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      procedure_type: 'Vaccination',
      date: '2026-07-22',
      time: '10:30',
      duration_minutes: 45,
      reason: 'Annual booster',
    });
    expect(result.success).toBe(true);
    expect(result.data?.procedure_type).toBe('Vaccination');
    expect(result.data?.duration_minutes).toBe(45);
    expect(result.data?.reason).toBe('Annual booster');
  });
});

describe('updateAppointmentStatus', () => {
  it('updates appointment status', async () => {
    const result = await updateAppointmentStatus('apt-001', 'checked_in');
    expect(result.success).toBe(true);
    const appt = MOCK_APPOINTMENTS.find((a) => a.id === 'apt-001');
    expect(appt?.status).toBe('checked_in');
  });

  it('returns error for non-existent appointment', async () => {
    const result = await updateAppointmentStatus('non-existent', 'checked_in');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });
});

describe('getQueue', () => {
  it('returns the patient queue', async () => {
    const queue = await getQueue();
    expect(Array.isArray(queue)).toBe(true);
    if (queue.length > 0) {
      expect(queue[0]).toHaveProperty('patient_id');
      expect(queue[0]).toHaveProperty('status');
    }
  });
});

describe('getVetServices', () => {
  it('returns all veterinary services', async () => {
    const services = await getVetServices();
    expect(Array.isArray(services)).toBe(true);
    expect(services.length).toBeGreaterThan(0);
    expect(services[0]).toHaveProperty('name');
    expect(services[0]).toHaveProperty('price');
  });
});

describe('getTreatments', () => {
  it('returns all treatments', async () => {
    const treatments = await getTreatments();
    expect(Array.isArray(treatments)).toBe(true);
    expect(treatments.length).toBeGreaterThan(0);
  });
});

describe('getTreatmentMedications', () => {
  it('returns medications for a treatment', async () => {
    const meds = await getTreatmentMedications('trt-001');
    expect(Array.isArray(meds)).toBe(true);
    if (meds.length > 0) {
      expect(meds[0]).toHaveProperty('drug_name');
      expect(meds[0]).toHaveProperty('dosage');
    }
  });

  it('returns empty array for treatment with no medications', async () => {
    const meds = await getTreatmentMedications('non-existent');
    expect(meds).toEqual([]);
  });
});

describe('createTreatment and createTreatmentMedication', () => {
  it('creates a new treatment record successfully', async () => {
    const res = await createTreatment({
      patient_id: 'p-001',
      chief_complaint: 'Lethargy and vomiting',
      diagnosis: 'Acute Gastroenteritis',
      assessment: 'Dehydrated, mild pyrexia',
      plan: 'Fluid therapy, antiemetics, bland diet',
      status: 'completed',
      total_cost: 15000,
    });
    expect(res.success).toBe(true);
    expect(res.data).toBeDefined();
    expect(res.data?.id).toBeDefined();
    expect(res.data?.diagnosis).toBe('Acute Gastroenteritis');

    // Verify it is retrievable via getTreatments
    const all = await getTreatments();
    expect(all.some((t) => t.id === res.data!.id)).toBe(true);
  });

  it('persists prescribed treatment medications durably', async () => {
    const txRes = await createTreatment({
      patient_id: 'p-002',
      chief_complaint: 'Bacterial skin infection',
      diagnosis: 'Pyoderma',
      status: 'ongoing',
      total_cost: 8500,
    });
    expect(txRes.success).toBe(true);
    const txId = txRes.data!.id;

    const medRes = await createTreatmentMedication({
      treatment_id: txId,
      drug_name: 'Cephalexin',
      dosage: '500mg',
      route: 'PO',
      frequency: 'BID',
      duration: '14 days',
      quantity: 28,
      unit_price: 300,
    });
    expect(medRes.success).toBe(true);
    expect(medRes.data?.drug_name).toBe('Cephalexin');
    expect(medRes.data?.total).toBe(8400);

    const meds = await getTreatmentMedications(txId);
    expect(meds.length).toBe(1);
    expect(meds[0].drug_name).toBe('Cephalexin');
    expect(meds[0].quantity).toBe(28);
  });
});

describe('Clinic Clients', () => {
  it('returns all clinic clients with expected attributes', async () => {
    const clients = await getClinicClients();
    expect(Array.isArray(clients)).toBe(true);
    expect(clients.length).toBeGreaterThan(0);
    const first = clients[0];
    expect(first).toHaveProperty('id');
    expect(first).toHaveProperty('full_name');
    expect(first).toHaveProperty('phone');
    expect(first).toHaveProperty('address');
  });

  it('filters clinic clients by location_id', async () => {
    const allClients = await getClinicClients();
    const locId = allClients.find((c) => c.location_id)?.location_id;
    if (locId) {
      const filtered = await getClinicClients(locId);
      expect(filtered.every((c) => c.location_id === locId)).toBe(true);
    }
  });

  it('retrieves single client by id with hydrated patient list', async () => {
    const clients = await getClinicClients();
    const target = clients[0];
    const retrieved = await getClinicClientById(target.id);
    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe(target.id);
    expect(retrieved?.full_name).toBe(target.full_name);
    expect(Array.isArray(retrieved?.patients)).toBe(true);
  });

  it('adds a new clinic client and validates required fields', async () => {
    const invalidRes = await addClinicClient({
      first_name: '',
      last_name: 'Doe',
      phone: '+234 801 234 5678',
      address: '12 Marina, Lagos',
    });
    expect(invalidRes.success).toBe(false);
    expect(invalidRes.error).toContain('First name is required');

    const validRes = await addClinicClient({
      first_name: 'Fatima',
      last_name: 'Yusuf',
      phone: '+234 809 111 2233',
      email: 'fatima.yusuf@example.com',
      address: '42 Admiralty Way, Lekki',
      city: 'Lekki',
      state: 'Lagos',
      emergency_contact_name: 'Kabir Yusuf',
      emergency_contact_phone: '+234 809 999 8877',
      preferred_contact: 'WhatsApp',
    });
    expect(validRes.success).toBe(true);
    expect(validRes.data).toBeDefined();
    expect(validRes.data?.full_name).toBe('Fatima Yusuf');
    expect(validRes.data?.phone).toBe('+234 809 111 2233');

    // Verify it is retrievable via getClinicClients
    const updatedList = await getClinicClients();
    expect(updatedList.some((c) => c.full_name === 'Fatima Yusuf')).toBe(true);
  });

  it('updates an existing clinic client', async () => {
    const clients = await getClinicClients();
    const target = clients[0];
    const updateRes = await updateClinicClient(target.id, {
      phone: '+234 700 000 9999',
      notes: 'VIP Client - always schedule with Dr. Emeka',
    });
    expect(updateRes.success).toBe(true);
    expect(updateRes.data?.phone).toBe('+234 700 000 9999');
    expect(updateRes.data?.notes).toBe('VIP Client - always schedule with Dr. Emeka');
  });

  it('hydrates patient owner information with client records', async () => {
    const patients = await getPatients();
    expect(patients.length).toBeGreaterThan(0);
    const sample = patients[0];
    expect(sample.owner).toBeDefined();
    expect(sample.owner?.full_name).toBeDefined();
    expect(sample.owner?.phone).toBeDefined();
  });

  it('registers a patient linked to clinic_client_id and resolves owner data', async () => {
    const clientRes = await addClinicClient({
      first_name: 'Chidi',
      last_name: 'Anosike',
      phone: '+234 803 555 4433',
      address: '15 Ozumba Mbadiwe, VI',
    });
    expect(clientRes.success).toBe(true);
    const clientId = clientRes.data!.id;

    const patientRes = await addPatient({
      name: 'Bingo',
      species: 'Dog',
      owner_id: clientId,
      clinic_client_id: clientId,
      breed: 'Boerboel',
      gender: 'Male',
      weight_kg: 42,
    });
    expect(patientRes.success).toBe(true);
    expect(patientRes.data?.name).toBe('Bingo');

    const patients = await getPatients();
    const bingo = patients.find((p) => p.name === 'Bingo');
    expect(bingo).toBeDefined();
    expect(bingo?.owner?.full_name).toBe('Chidi Anosike');
    expect(bingo?.owner?.phone).toBe('+234 803 555 4433');
  });
});

