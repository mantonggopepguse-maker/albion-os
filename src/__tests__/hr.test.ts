import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  clockIn,
  clockOut,
  submitLeaveRequest,
  reviewLeaveRequest,
  getPayrollRuns,
  getPayrollRunById,
  getPayslipsForRun,
  processPayroll,
} from '@/lib/data-service';
import {
  MOCK_SALARIES,
  MOCK_PAYROLL_RUNS,
  MOCK_PAYSLIPS,
  MOCK_LEAVE_REQUESTS,
  MOCK_LEAVE_BALANCES,
  MOCK_ATTENDANCE_LOGS,
} from '@/lib/mock-data';

let payrollRunsSnapshot: typeof MOCK_PAYROLL_RUNS;
let payslipsSnapshot: typeof MOCK_PAYSLIPS;
let leaveRequestsSnapshot: typeof MOCK_LEAVE_REQUESTS;
let leaveBalancesSnapshot: typeof MOCK_LEAVE_BALANCES;
let attendanceLogsSnapshot: typeof MOCK_ATTENDANCE_LOGS;
let salariesSnapshot: typeof MOCK_SALARIES;

function saveSnapshots() {
  payrollRunsSnapshot = JSON.parse(JSON.stringify(MOCK_PAYROLL_RUNS));
  payslipsSnapshot = JSON.parse(JSON.stringify(MOCK_PAYSLIPS));
  leaveRequestsSnapshot = JSON.parse(JSON.stringify(MOCK_LEAVE_REQUESTS));
  leaveBalancesSnapshot = JSON.parse(JSON.stringify(MOCK_LEAVE_BALANCES));
  attendanceLogsSnapshot = JSON.parse(JSON.stringify(MOCK_ATTENDANCE_LOGS));
  salariesSnapshot = JSON.parse(JSON.stringify(MOCK_SALARIES));
}

function restoreSnapshots() {
  MOCK_PAYROLL_RUNS.length = 0;
  MOCK_PAYROLL_RUNS.push(...payrollRunsSnapshot);
  MOCK_PAYSLIPS.length = 0;
  MOCK_PAYSLIPS.push(...payslipsSnapshot);
  MOCK_LEAVE_REQUESTS.length = 0;
  MOCK_LEAVE_REQUESTS.push(...leaveRequestsSnapshot);
  MOCK_LEAVE_BALANCES.length = 0;
  MOCK_LEAVE_BALANCES.push(...leaveBalancesSnapshot);
  MOCK_ATTENDANCE_LOGS.length = 0;
  MOCK_ATTENDANCE_LOGS.push(...attendanceLogsSnapshot);
  MOCK_SALARIES.length = 0;
  MOCK_SALARIES.push(...salariesSnapshot);
}

beforeEach(() => {
  saveSnapshots();
});

afterEach(() => {
  restoreSnapshots();
});

/* ──────────── ATTENDANCE ──────────── */

describe('clockIn', () => {
  it('records a clock-in for a valid user', async () => {
    const result = await clockIn('b2c3d4e5-f6a7-8901-bcde-f12345678901');
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data!.user_id).toBe('b2c3d4e5-f6a7-8901-bcde-f12345678901');
  });

  it('returns error when already clocked in today', async () => {
    await clockIn('b2c3d4e5-f6a7-8901-bcde-f12345678901');
    const result = await clockIn('b2c3d4e5-f6a7-8901-bcde-f12345678901');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Already clocked in');
  });
});

describe('clockOut', () => {
  it('returns error when not clocked in', async () => {
    const result = await clockOut('non-existent-user');
    expect(result.success).toBe(false);
    expect(result.error).toContain('No clock-in record');
  });

  it('records a clock-out after clock-in', async () => {
    await clockIn('b2c3d4e5-f6a7-8901-bcde-f12345678901');
    const result = await clockOut('b2c3d4e5-f6a7-8901-bcde-f12345678901');
    expect(result.success).toBe(true);
    expect(result.data?.clock_out).toBeDefined();
  });
});

/* ──────────── LEAVE ──────────── */

describe('submitLeaveRequest', () => {
  it('rejects missing leave type', async () => {
    const result = await submitLeaveRequest({
      user_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
      leave_type: '' as unknown as 'annual' | 'sick' | 'personal' | 'maternity' | 'paternity' | 'study',
      start_date: '2026-08-01',
      end_date: '2026-08-05',
      reason: 'Vacation',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Leave type');
  });

  it('rejects end date before start date', async () => {
    const result = await submitLeaveRequest({
      user_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
      leave_type: 'annual',
      start_date: '2026-08-10',
      end_date: '2026-08-05',
      reason: 'Invalid dates',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('End date must be after');
  });

  it('submits a pending leave request', async () => {
    const result = await submitLeaveRequest({
      user_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
      leave_type: 'annual',
      start_date: '2026-09-01',
      end_date: '2026-09-05',
      reason: 'Family event',
    });
    expect(result.success).toBe(true);
    expect(result.data?.status).toBe('pending');
    expect(result.data?.duration_days).toBe(5);
  });
});

describe('reviewLeaveRequest', () => {
  it('approves a pending leave request', async () => {
    const submit = await submitLeaveRequest({
      user_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
      leave_type: 'annual',
      start_date: '2026-10-01',
      end_date: '2026-10-03',
      reason: 'Personal',
    });
    expect(submit.success).toBe(true);

    const result = await reviewLeaveRequest(
      submit.data!.id,
      'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      'approved',
      'Approved'
    );
    expect(result.success).toBe(true);
    expect(result.data?.status).toBe('approved');
  });

  it('rejects already-reviewed requests', async () => {
    const submit = await submitLeaveRequest({
      user_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
      leave_type: 'sick',
      start_date: '2026-11-01',
      end_date: '2026-11-02',
      reason: 'Sick',
    });
    await reviewLeaveRequest(submit.data!.id, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'approved');

    const result = await reviewLeaveRequest(
      submit.data!.id,
      'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      'rejected'
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('already');
  });
});

/* ──────────── PAYROLL ──────────── */

describe('getPayrollRuns', () => {
  it('returns all payroll runs', async () => {
    const runs = await getPayrollRuns();
    expect(Array.isArray(runs)).toBe(true);
    expect(runs.length).toBeGreaterThan(0);
    expect(runs[0]).toHaveProperty('period_start');
    expect(runs[0]).toHaveProperty('status');
  });
});

describe('getPayrollRunById', () => {
  it('returns a specific payroll run', async () => {
    const run = await getPayrollRunById('pr-001');
    expect(run).toBeDefined();
    expect(run?.status).toBe('completed');
  });

  it('returns undefined for non-existent run', async () => {
    const run = await getPayrollRunById('non-existent');
    expect(run).toBeUndefined();
  });
});

describe('getPayslipsForRun', () => {
  it('returns payslips for a valid payroll run', async () => {
    const payslips = await getPayslipsForRun('pr-001');
    expect(Array.isArray(payslips)).toBe(true);
    if (payslips.length > 0) {
      expect(payslips[0]).toHaveProperty('user_id');
      expect(payslips[0]).toHaveProperty('net_pay');
    }
  });

  it('returns empty array for non-existent run', async () => {
    const payslips = await getPayslipsForRun('non-existent');
    expect(payslips).toEqual([]);
  });
});

describe('processPayroll', () => {
  it('processes payroll for active salaries', async () => {
    const activeSalaries = MOCK_SALARIES.filter((s) => s.is_active);
    if (activeSalaries.length === 0) return;

    const result = await processPayroll(
      '2026-07-01',
      '2026-07-31',
      '2026-08-05',
      'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
    );
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data!.employee_count).toBeGreaterThan(0);
    expect(result.data!.total_net).toBeGreaterThan(0);
  });

  it('rejects duplicate payroll period', async () => {
    const activeSalaries = MOCK_SALARIES.filter((s) => s.is_active);
    if (activeSalaries.length === 0) return;

    await processPayroll(
      '2026-07-01',
      '2026-07-31',
      '2026-08-05',
      'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
    );

    const result = await processPayroll(
      '2026-07-01',
      '2026-07-31',
      '2026-08-05',
      'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('already exists');
  });

  it('calculates payslip totals correctly', async () => {
    const activeSalaries = MOCK_SALARIES.filter((s) => s.is_active);
    if (activeSalaries.length === 0) return;

    const result = await processPayroll(
      '2026-08-01',
      '2026-08-31',
      '2026-09-05',
      'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
    );
    expect(result.success).toBe(true);
    expect(result.data!.total_net).toBeLessThan(result.data!.total_gross);
    expect(result.data!.total_deductions).toBeGreaterThan(0);
  });

  it('correctly incorporates tax_deduction, loan_repayment, unmet_target_penalty, custom_additions, and custom_deductions', async () => {
    // Add custom debits and additions to an active salary
    const activeSalary = MOCK_SALARIES.find((s) => s.is_active);
    if (activeSalary) {
      activeSalary.tax_deduction = 45000;
      activeSalary.loan_repayment = 15000;
      activeSalary.unmet_target_penalty = 5000;
      activeSalary.custom_additions = [
        { id: 'ca1', label: 'Overtime Allowance', type: 'flat', value: 20000, amount: 20000 },
        { id: 'ca2', label: 'Target Achievement Bonus', type: 'percentage', value: 10, amount: 0 },
      ];
      activeSalary.custom_deductions = [
        { id: 'cd1', label: 'Equipment Damage Fine', type: 'flat', value: 3000, amount: 3000 },
      ];
    }

    const result = await processPayroll(
      '2026-09-01',
      '2026-09-30',
      '2026-10-05',
      'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
    );

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    const payslips = await getPayslipsForRun(result.data!.id);
    const targetPs = payslips.find((p) => p.user_id === activeSalary?.user_id);
    if (targetPs) {
      expect(targetPs.loan_repayment).toBe(15000);
      expect(targetPs.unmet_target_penalty).toBe(5000);
      expect(targetPs.custom_additions).toHaveLength(2);
      expect(targetPs.custom_deductions).toHaveLength(1);
    }
  });
});
