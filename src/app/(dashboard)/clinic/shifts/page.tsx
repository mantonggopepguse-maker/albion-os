'use client';

import React, { useState, useMemo } from 'react';
import styles from './shifts.module.css';
import { useClinicShifts, useUsers, useLocations } from '@/hooks/use-supabase-data';
import { assignClinicShift, deleteClinicShift } from '@/lib/data-service';
import { ShiftBlock, ClinicShift } from '@/lib/types';

export default function ClinicShiftsPage() {
  const { shifts, loading, refetch } = useClinicShifts();
  const { users } = useUsers();
  const { locations } = useLocations();

  const [selectedBlock, setSelectedBlock] = useState<string>('all');
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State for Assigning Shift
  const [formUserId, setFormUserId] = useState('');
  const [formLocationId, setFormLocationId] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formBlock, setFormBlock] = useState<ShiftBlock>('morning');
  const [formStartTime, setFormStartTime] = useState('08:00');
  const [formEndTime, setFormEndTime] = useState('16:00');
  const [formNotes, setFormNotes] = useState('');

  // Update default start/end times when shift block changes
  const handleBlockChange = (block: ShiftBlock) => {
    setFormBlock(block);
    if (block === 'morning') {
      setFormStartTime('08:00');
      setFormEndTime('16:00');
    } else if (block === 'afternoon') {
      setFormStartTime('14:00');
      setFormEndTime('22:00');
    } else if (block === 'night') {
      setFormStartTime('22:00');
      setFormEndTime('06:00');
    } else if (block === 'on_call') {
      setFormStartTime('00:00');
      setFormEndTime('23:59');
    }
  };

  // Filtered Shifts
  const filteredShifts = useMemo(() => {
    return shifts.filter((s) => {
      const matchBlock = selectedBlock === 'all' || s.shift_block === selectedBlock;
      const matchLoc = selectedLocation === 'all' || s.location_id === selectedLocation;
      const matchSearch =
        !searchTerm ||
        (s.staff_name && s.staff_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (s.role && s.role.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (s.location_name && s.location_name.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchBlock && matchLoc && matchSearch;
    });
  }, [shifts, selectedBlock, selectedLocation, searchTerm]);

  // Statistics
  const morningCount = useMemo(() => shifts.filter((s) => s.shift_block === 'morning').length, [shifts]);
  const afternoonCount = useMemo(() => shifts.filter((s) => s.shift_block === 'afternoon').length, [shifts]);
  const nightCount = useMemo(() => shifts.filter((s) => s.shift_block === 'night' || s.shift_block === 'on_call').length, [shifts]);

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formUserId || !formDate) return;

    setSubmitting(true);
    const selectedUser = users.find((u) => u.id === formUserId);
    const locId = formLocationId || (locations[0]?.id ?? '');
    const selectedLoc = locations.find((l) => l.id === locId);

    const res = await assignClinicShift({
      user_id: formUserId,
      staff_name: selectedUser ? selectedUser.full_name : 'Staff Member',
      role: selectedUser?.role || 'clinical_staff',
      location_id: locId,
      location_name: selectedLoc?.name || 'Clinic',
      shift_date: formDate,
      shift_block: formBlock,
      start_time: formStartTime,
      end_time: formEndTime,
      notes: formNotes,
    });

    setSubmitting(false);
    if (res.success) {
      setShowModal(false);
      setFormNotes('');
      await refetch();
    } else {
      alert(res.error || 'Failed to assign shift');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this shift assignment?')) return;
    await deleteClinicShift(id);
    await refetch();
  };

  const exportCSV = () => {
    const headers = ['Date', 'Staff', 'Role', 'Location', 'Block', 'Start Time', 'End Time', 'Notes'];
    const rows = filteredShifts.map((s) => [
      s.shift_date,
      s.staff_name || '',
      s.role || '',
      s.location_name || '',
      s.shift_block,
      s.start_time,
      s.end_time,
      `"${(s.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `clinic_shifts_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getBlockBadgeClass = (block: ShiftBlock) => {
    switch (block) {
      case 'morning':
        return styles.blockMorning;
      case 'afternoon':
        return styles.blockAfternoon;
      case 'night':
        return styles.blockNight;
      case 'on_call':
        return styles.blockOnCall;
      default:
        return '';
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.greeting}>
        <h1 className={styles.greetingText}>Clinic Duty Roster & Shifts</h1>
        <p className={styles.greetingSub}>
          Coordinate clinical rotas, on-call veterinary doctors, shift coverage, and practice staffing schedules.
        </p>
      </div>

      {/* KPI Stats */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statTop}>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>Total Shifts Scheduled</span>
              <span className={styles.statValue}>{shifts.length}</span>
            </div>
            <div className={styles.statIcon} style={{ background: 'linear-gradient(135deg, #0a2540, #146eb4)' }}>
              🗓️
            </div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statTop}>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>Morning Rotas</span>
              <span className={styles.statValue}>{morningCount}</span>
            </div>
            <div className={styles.statIcon} style={{ background: 'linear-gradient(135deg, #d97706, #f59e0b)' }}>
              🌅
            </div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statTop}>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>Afternoon Rotas</span>
              <span className={styles.statValue}>{afternoonCount}</span>
            </div>
            <div className={styles.statIcon} style={{ background: 'linear-gradient(135deg, #0284c7, #38bdf8)' }}>
              ☀️
            </div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statTop}>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>Night & On-Call</span>
              <span className={styles.statValue}>{nightCount}</span>
            </div>
            <div className={styles.statIcon} style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}>
              🌙
            </div>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className={styles.actionsBar}>
        <div className={styles.filters}>
          {(['all', 'morning', 'afternoon', 'night', 'on_call'] as const).map((block) => (
            <button
              key={block}
              className={`${styles.filterBtn} ${selectedBlock === block ? styles.filterBtnActive : ''}`}
              onClick={() => setSelectedBlock(block)}
            >
              {block === 'all' ? 'All Blocks' : block.replace('_', ' ').toUpperCase()}
            </button>
          ))}
        </div>

        <div className={styles.searchWrap}>
          {locations.length > 0 && (
            <select
              className={styles.selectInput}
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
            >
              <option value="all">All Locations</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          )}

          <input
            type="text"
            placeholder="Search staff name or role..."
            className={styles.searchInput}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <button className={styles.exportBtn} onClick={exportCSV}>
            📥 Export CSV
          </button>

          <button className={styles.addBtn} onClick={() => setShowModal(true)}>
            + Assign Shift
          </button>
        </div>
      </div>

      {/* Shift Table */}
      <div className={styles.tableCard}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Staff Member</th>
                <th>Shift Block</th>
                <th>Duty Hours</th>
                <th>Location</th>
                <th>Notes</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '3rem' }}>
                    Loading clinical shift timetable...
                  </td>
                </tr>
              ) : filteredShifts.length === 0 ? (
                <tr>
                  <td colSpan={7} className={styles.emptyState}>
                    No shifts assigned matching your filter criteria. Click &quot;+ Assign Shift&quot; to schedule staff.
                  </td>
                </tr>
              ) : (
                filteredShifts.map((shift: ClinicShift) => (
                  <tr key={shift.id}>
                    <td>
                      <strong>{new Date(shift.shift_date).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' })}</strong>
                    </td>
                    <td>
                      <div className={styles.staffCell}>
                        <div className={styles.staffAvatar}>
                          {(shift.staff_name || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className={styles.staffName}>{shift.staff_name}</div>
                          <div className={styles.staffRole}>{shift.role?.replace('_', ' ')}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`${styles.blockBadge} ${getBlockBadgeClass(shift.shift_block)}`}>
                        {shift.shift_block.replace('_', ' ')}
                      </span>
                    </td>
                    <td className={styles.timeCell}>
                      {shift.start_time} - {shift.end_time}
                    </td>
                    <td>{shift.location_name || 'Main Clinic'}</td>
                    <td style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>
                      {shift.notes || '—'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className={styles.deleteBtn}
                        onClick={() => handleDelete(shift.id)}
                        title="Remove Shift"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Assign Shift Modal */}
      {showModal && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Assign Clinic Shift</h2>
              <button className={styles.closeBtn} onClick={() => setShowModal(false)}>
                &times;
              </button>
            </div>
            <form onSubmit={handleAssignSubmit}>
              <div className={styles.modalBody}>
                <div className={styles.formGroup}>
                  <label>Staff Member</label>
                  <select
                    value={formUserId}
                    onChange={(e) => setFormUserId(e.target.value)}
                    required
                  >
                    <option value="">Select Staff / Clinician...</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.full_name} ({u.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>Shift Date</label>
                    <input
                      type="date"
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                      required
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Shift Block</label>
                    <select
                      value={formBlock}
                      onChange={(e) => handleBlockChange(e.target.value as ShiftBlock)}
                      required
                    >
                      <option value="morning">Morning (08:00 - 16:00)</option>
                      <option value="afternoon">Afternoon (14:00 - 22:00)</option>
                      <option value="night">Night (22:00 - 06:00)</option>
                      <option value="on_call">On-Call (24 Hours)</option>
                    </select>
                  </div>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>Start Time</label>
                    <input
                      type="time"
                      value={formStartTime}
                      onChange={(e) => setFormStartTime(e.target.value)}
                      required
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>End Time</label>
                    <input
                      type="time"
                      value={formEndTime}
                      onChange={(e) => setFormEndTime(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label>Branch / Clinic Location</label>
                  <select
                    value={formLocationId}
                    onChange={(e) => setFormLocationId(e.target.value)}
                  >
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label>Special Instructions / Notes</label>
                  <textarea
                    rows={3}
                    placeholder="e.g. Lead triage doctor, surgical prep handover, emergency pager duty"
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.submitBtn}
                  disabled={submitting}
                >
                  {submitting ? 'Assigning...' : 'Confirm Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
