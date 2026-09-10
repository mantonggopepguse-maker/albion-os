import { describe, it, expect } from 'vitest';
import { getNavItemsForRole, getRoleLabel, NAV_ITEMS } from '@/lib/navigation';
import { hasRole, type AuthUser } from '@/lib/auth-context';
import type { UserRole } from '@/lib/types';

import { addToQueue, updateQueueStatus, createTreatment, getQueue, getTreatments, addStaffUser, updateStaffUser } from '@/lib/data-service';

describe('Multi-Role Navigation & Permission Matrix', () => {
  it('returns all navigation items for super_admin', () => {
    const items = getNavItemsForRole('super_admin');
    expect(items.length).toBe(NAV_ITEMS.length);
  });

  it('returns all navigation items for ceo', () => {
    const items = getNavItemsForRole('ceo');
    expect(items.length).toBe(NAV_ITEMS.length);
  });

  it('restricts sales_rep from administrative HR and clinic fleet links', () => {
    const items = getNavItemsForRole('sales_rep');
    const hrefs = items.map((i) => i.href);
    expect(hrefs).toContain('/dashboard');
    expect(hrefs).toContain('/invoices');
    expect(hrefs).toContain('/customers');
    expect(hrefs).not.toContain('/staff');
    expect(hrefs).not.toContain('/clinic');
    expect(hrefs).not.toContain('/payroll');
  });

  it('unifies navigation for multi-role personnel (clinic_admin + vet) without switching', () => {
    const items = getNavItemsForRole('clinic_admin', ['clinic_admin', 'vet']);
    const hrefs = items.map((i) => i.href);
    // Clinic admin features
    expect(hrefs).toContain('/staff');
    expect(hrefs).toContain('/clinic');
    // Vet features
    expect(hrefs).toContain('/clinic/queue');
    expect(hrefs).toContain('/clinic/appointments');
    expect(hrefs).toContain('/clinic/patients');
    expect(hrefs).toContain('/clinic/treatments');
  });

  it('unifies navigation for multi-role commercial personnel (sales_rep + inventory_manager)', () => {
    const items = getNavItemsForRole('sales_rep', ['sales_rep', 'inventory_manager']);
    const hrefs = items.map((i) => i.href);
    expect(hrefs).toContain('/invoices');
    expect(hrefs).toContain('/customers');
    expect(hrefs).toContain('/products');
    expect(hrefs).toContain('/suppliers');
    expect(hrefs).toContain('/inventory');
  });

  it('formats human-readable labels for all 13 enterprise roles', () => {
    const roles: UserRole[] = [
      'super_admin',
      'ceo',
      'sales_rep',
      'finance_manager',
      'inventory_manager',
      'clinic_admin',
      'vet',
      'vet_tech',
      'vet_assistant',
      'receptionist',
      'lab_scientist',
      'pharmacist',
      'support_staff',
    ];
    for (const r of roles) {
      const label = getRoleLabel(r);
      expect(label).toBeTruthy();
      expect(typeof label).toBe('string');
      expect(label.length).toBeGreaterThan(3);
    }
    expect(getRoleLabel('super_admin')).toBe('Super Admin');
    expect(getRoleLabel('vet')).toBe('Veterinarian Surgeon');
    expect(getRoleLabel('clinic_admin')).toBe('Clinic Administrator');
  });
});

describe('hasRole Multi-Role Evaluator', () => {
  it('evaluates primary role correctly', () => {
    const user: AuthUser = {
      id: 'u-1',
      email: 'vet@albion.com',
      full_name: 'Dr. Vet',
      role: 'vet',
      location_id: 'loc-1',
      location_name: 'Main Clinic',
      phone: '08012345678',
      avatar_url: null,
    };
    expect(hasRole(user, 'vet')).toBe(true);
    expect(hasRole(user, 'clinic_admin')).toBe(false);
  });

  it('evaluates multi-role array correctly', () => {
    const user: AuthUser = {
      id: 'u-2',
      email: 'hybrid@albion.com',
      full_name: 'Dr. Hybrid Admin',
      role: 'clinic_admin',
      roles: ['clinic_admin', 'vet'],
      location_id: 'loc-1',
      location_name: 'Main Clinic',
      phone: '08012345678',
      avatar_url: null,
    };
    expect(hasRole(user, 'clinic_admin')).toBe(true);
    expect(hasRole(user, 'vet')).toBe(true);
    expect(hasRole(user, 'sales_rep')).toBe(false);
  });


  it('returns false when user is null', () => {
    expect(hasRole(null, 'super_admin')).toBe(false);
  });
});

describe('Clinic Queue & Treatment Operations in Data Service', () => {
  it('adds a patient to the live queue and retrieves it', async () => {
    const initialQueue = await getQueue();
    const res = await addToQueue({
      patient_id: 'pat-1',
      owner_id: 'cust-1',
      department: 'Veterinary Triage',
      priority: 'urgent',
      reason: 'Sudden lethargy and coughing',
    });
    expect(res.success).toBe(true);
    expect(res.data?.id).toBeTruthy();
    expect(res.data?.status).toBe('waiting');
    expect(res.data?.priority).toBe('urgent');

    const updatedQueue = await getQueue();
    expect(updatedQueue.length).toBe(initialQueue.length + 1);
  });

  it('updates patient queue status', async () => {
    const res = await addToQueue({
      patient_id: 'pat-2',
      owner_id: 'cust-2',
      department: 'Consultation',
      priority: 'normal',
      reason: 'Routine vaccination',
    });
    expect(res.success).toBe(true);
    const queueId = res.data!.id;

    const updated = await updateQueueStatus(queueId, 'in_consultation');
    expect(updated.success).toBe(true);
    expect(updated.data?.status).toBe('in_consultation');

    const completed = await updateQueueStatus(queueId, 'completed');
    expect(completed.success).toBe(true);
    expect(completed.data?.status).toBe('completed');
  });

  it('creates clinical treatment record with SOAP notes', async () => {
    const initialTreatments = await getTreatments();
    const res = await createTreatment({
      patient_id: 'pat-1',
      vet_id: 'u-vet',
      chief_complaint: 'Anorexia and vomiting for 24 hours',
      diagnosis: 'Acute Gastroenteritis',
      assessment: 'Mild dehydration, normothermic',
      plan: 'Fluid therapy, antiemetics, and bland diet',
      total_cost: 15000,
    });
    expect(res.success).toBe(true);
    expect(res.data?.id).toBeTruthy();
    expect(res.data?.diagnosis).toBe('Acute Gastroenteritis');
    expect(res.data?.total_cost).toBe(15000);

    const updatedTreatments = await getTreatments();
    expect(updatedTreatments.length).toBe(initialTreatments.length + 1);
  });
});

describe('Multi-Role Staff Management Persistence', () => {
  it('creates a new staff member with multiple concurrent roles', async () => {
    const res = await addStaffUser({
      email: `clinician-${Date.now()}@albionpharma.com`,
      full_name: 'Dr. Chinedu Eze',
      role: 'clinic_admin',
      roles: ['clinic_admin', 'vet'],
      location_id: 'loc-0005-lekki-clinic',
      phone: '+234 803 999 1122',
    });

    expect(res.success).toBe(true);
    expect(res.data?.id).toBeTruthy();
    expect(res.data?.role).toBe('clinic_admin');
    expect(res.data?.roles).toEqual(['clinic_admin', 'vet']);
    expect(res.data?.roles).toContain('clinic_admin');
    expect(res.data?.roles).toContain('vet');
  });

  it('updates an existing staff member concurrent roles', async () => {
    const created = await addStaffUser({
      email: `tech-${Date.now()}@albionpharma.com`,
      full_name: 'Grace Obi',
      role: 'vet_tech',
      roles: ['vet_tech'],
      location_id: 'loc-0005-lekki-clinic',
      phone: '+234 809 111 2233',
    });
    expect(created.success).toBe(true);
    const userId = created.data!.id;

    const updated = await updateStaffUser(userId, {
      roles: ['vet_tech', 'vet_assistant', 'lab_scientist'],
    });

    expect(updated.success).toBe(true);
    expect(updated.data?.roles).toEqual(['vet_tech', 'vet_assistant', 'lab_scientist']);
    expect(updated.data?.roles).toContain('lab_scientist');
  });
});


