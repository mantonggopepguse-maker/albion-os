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
} from '@/lib/data-service';
import {
  MOCK_PATIENTS,
  MOCK_APPOINTMENTS,
  MOCK_PATIENT_QUEUE,
  MOCK_VET_SERVICES,
  MOCK_TREATMENTS,
  MOCK_TREATMENT_MEDICATIONS,
} from '@/lib/mock-data';

let patientsSnapshot: typeof MOCK_PATIENTS;
let appointmentsSnapshot: typeof MOCK_APPOINTMENTS;
let treatmentsSnapshot: typeof MOCK_TREATMENTS;

function saveSnapshots() {
  patientsSnapshot = JSON.parse(JSON.stringify(MOCK_PATIENTS));
  appointmentsSnapshot = JSON.parse(JSON.stringify(MOCK_APPOINTMENTS));
  treatmentsSnapshot = JSON.parse(JSON.stringify(MOCK_TREATMENTS));
}

function restoreSnapshots() {
  MOCK_PATIENTS.length = 0;
  MOCK_PATIENTS.push(...patientsSnapshot);
  MOCK_APPOINTMENTS.length = 0;
  MOCK_APPOINTMENTS.push(...appointmentsSnapshot);
  MOCK_TREATMENTS.length = 0;
  MOCK_TREATMENTS.push(...treatmentsSnapshot);
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
  it('returns medications for a treatment', () => {
    const meds = getTreatmentMedications('trt-001');
    expect(Array.isArray(meds)).toBe(true);
    if (meds.length > 0) {
      expect(meds[0]).toHaveProperty('drug_name');
      expect(meds[0]).toHaveProperty('dosage');
    }
  });

  it('returns empty array for treatment with no medications', () => {
    const meds = getTreatmentMedications('non-existent');
    expect(meds).toEqual([]);
  });
});
