'use client';

import React, { useState, useMemo } from 'react';
import { useAuditLogs } from '@/hooks/use-supabase-data';
import type { AuditLog, AuditCategory, AuditSeverity } from '@/lib/types';
import styles from './audit.module.css';

export default function AuditLogPage() {
  const { auditLogs, loading, refetch } = useAuditLogs();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [inspectedLog, setInspectedLog] = useState<AuditLog | null>(null);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      const matchCategory =
        selectedCategory === 'all' || log.category === selectedCategory;
      const matchSeverity =
        selectedSeverity === 'all' || log.severity === selectedSeverity;
      const q = searchTerm.toLowerCase().trim();
      const matchSearch =
        !q ||
        log.action.toLowerCase().includes(q) ||
        (log.actor_name && log.actor_name.toLowerCase().includes(q)) ||
        log.actor_role.toLowerCase().includes(q) ||
        log.table_name.toLowerCase().includes(q) ||
        log.record_id.toLowerCase().includes(q) ||
        JSON.stringify(log.details || {}).toLowerCase().includes(q);

      return matchCategory && matchSeverity && matchSearch;
    });
  }, [auditLogs, selectedCategory, selectedSeverity, searchTerm]);

  // Aggregate metrics
  const stats = useMemo(() => {
    const total = auditLogs.length;
    const financial = auditLogs.filter((l) => l.category === 'financial').length;
    const narcotics = auditLogs.filter((l) => l.category === 'narcotics').length;
    const security = auditLogs.filter((l) => l.category === 'security').length;
    return { total, financial, narcotics, security };
  }, [auditLogs]);

  // Export CSV
  const handleExportCSV = () => {
    if (filteredLogs.length === 0) return;
    const headers = ['ID', 'Timestamp', 'Actor Name', 'Actor Role', 'Action', 'Category', 'Severity', 'Table', 'Record ID', 'IP Address', 'Details'];
    const rows = filteredLogs.map((l) => [
      l.id,
      new Date(l.created_at).toISOString(),
      `"${l.actor_name || 'System'}"`,
      l.actor_role,
      l.action,
      l.category,
      l.severity,
      l.table_name,
      l.record_id,
      l.ip_address || '',
      `"${JSON.stringify(l.details || {}).replace(/"/g, '""')}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `AlbionOS_Audit_Trail_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getCategoryBadgeClass = (category: AuditCategory) => {
    switch (category) {
      case 'financial':
        return styles.badgeFinancial;
      case 'narcotics':
        return styles.badgeNarcotics;
      case 'inventory':
        return styles.badgeInventory;
      case 'security':
        return styles.badgeSecurity;
      case 'clinical':
        return styles.badgeClinical;
      default:
        return styles.badgeSystem;
    }
  };

  const getSeverityDotClass = (severity: AuditSeverity) => {
    switch (severity) {
      case 'critical':
        return styles.severityCritical;
      case 'warning':
        return styles.severityWarning;
      default:
        return styles.severityInfo;
    }
  };

  const getActionClass = (action: string) => {
    switch (action.toLowerCase()) {
      case 'approved':
        return styles.actionApproved;
      case 'rejected':
        return styles.actionRejected;
      case 'dispensed':
        return styles.actionDispensed;
      case 'reconciled':
        return styles.actionReconciled;
      default:
        return styles.actionCreated;
    }
  };

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.greeting}>
        <h1 className={styles.greetingText}>🛡️ Enterprise Audit Log Vault</h1>
        <p className={styles.greetingSub}>
          Cryptographically immutable event log recording financial transactions, Schedule II narcotics custody, inventory movements, and system access.
        </p>
      </div>

      {/* KPI Stats Grid */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statTop}>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>Total Audited Events</span>
              <span className={styles.statValue}>{stats.total}</span>
            </div>
            <div className={styles.statIcon} style={{ background: 'linear-gradient(135deg, #093961, #1E4F77)' }}>
              📜
            </div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statTop}>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>Financial Actions</span>
              <span className={styles.statValue}>{stats.financial}</span>
            </div>
            <div className={styles.statIcon} style={{ background: 'linear-gradient(135deg, #059669, #10b981)' }}>
              💰
            </div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statTop}>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>Narcotics Custody</span>
              <span className={styles.statValue}>{stats.narcotics}</span>
            </div>
            <div className={styles.statIcon} style={{ background: 'linear-gradient(135deg, #7c3aed, #8b5cf6)' }}>
              🔒
            </div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statTop}>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>Security & Auth</span>
              <span className={styles.statValue}>{stats.security}</span>
            </div>
            <div className={styles.statIcon} style={{ background: 'linear-gradient(135deg, #e11d48, #f43f5e)' }}>
              🛡️
            </div>
          </div>
        </div>
      </div>

      {/* Action Bar / Filters */}
      <div className={styles.actionsBar}>
        <div className={styles.filters}>
          {['all', 'financial', 'narcotics', 'inventory', 'security', 'clinical'].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`${styles.filterBtn} ${selectedCategory === cat ? styles.filterBtnActive : ''}`}
            >
              {cat === 'all' ? 'All Domains' : cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>

        <div className={styles.searchWrap}>
          <input
            type="text"
            placeholder="Search actor, action, table, details..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />
          <button onClick={handleExportCSV} className={styles.exportBtn}>
            📥 Export CSV
          </button>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className={styles.tableCard}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Actor</th>
                <th>Category</th>
                <th>Action</th>
                <th>Domain / Table</th>
                <th>Severity</th>
                <th>Details Summary</th>
                <th style={{ textAlign: 'right' }}>Inspect</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px' }}>
                    Loading immutable audit logs...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={8} className={styles.emptyState}>
                    No audit records found matching your filters.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id}>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                      {new Date(log.created_at).toLocaleDateString('en-NG', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td>
                      <div className={styles.actorCell}>
                        <div className={styles.actorAvatar}>
                          {(log.actor_name || 'U').charAt(0)}
                        </div>
                        <div>
                          <div className={styles.actorName}>{log.actor_name || 'System'}</div>
                          <div className={styles.actorRole}>{log.actor_role}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`${styles.badge} ${getCategoryBadgeClass(log.category)}`}>
                        {log.category}
                      </span>
                    </td>
                    <td>
                      <span className={getActionClass(log.action)}>
                        {log.action.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                      {log.table_name}
                    </td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: '12px' }}>
                        <span className={`${styles.severityDot} ${getSeverityDotClass(log.severity)}`} />
                        {log.severity.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '12px' }}>
                      {log.details ? Object.entries(log.details).map(([k, v]) => `${k}: ${v}`).join(' · ') : '—'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        onClick={() => setInspectedLog(log)}
                        className={styles.inspectBtn}
                      >
                        👁️ Inspect
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inspect Modal Drawer */}
      {inspectedLog && (
        <div className={styles.modalBackdrop} onClick={() => setInspectedLog(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>
                🔍 Audit Log Record — {inspectedLog.id}
              </h2>
              <button onClick={() => setInspectedLog(null)} className={styles.closeBtn}>
                ✕
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.metaGrid}>
                <div className={styles.metaItem}>
                  <div className={styles.metaLabel}>Timestamp</div>
                  <div className={styles.metaValue}>
                    {new Date(inspectedLog.created_at).toLocaleString('en-NG')}
                  </div>
                </div>
                <div className={styles.metaItem}>
                  <div className={styles.metaLabel}>Actor Attribution</div>
                  <div className={styles.metaValue}>
                    {inspectedLog.actor_name} ({inspectedLog.actor_role})
                  </div>
                </div>
                <div className={styles.metaItem}>
                  <div className={styles.metaLabel}>Action & Domain</div>
                  <div className={styles.metaValue}>
                    {inspectedLog.action.toUpperCase()} on {inspectedLog.table_name}
                  </div>
                </div>
                <div className={styles.metaItem}>
                  <div className={styles.metaLabel}>Target Record ID</div>
                  <div className={styles.metaValue} style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                    {inspectedLog.record_id}
                  </div>
                </div>
                {inspectedLog.ip_address && (
                  <div className={styles.metaItem}>
                    <div className={styles.metaLabel}>IP Address / Node</div>
                    <div className={styles.metaValue} style={{ fontFamily: 'monospace' }}>
                      {inspectedLog.ip_address}
                    </div>
                  </div>
                )}
                <div className={styles.metaItem}>
                  <div className={styles.metaLabel}>Severity Level</div>
                  <div className={styles.metaValue} style={{ textTransform: 'uppercase' }}>
                    {inspectedLog.severity}
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: '8px', fontSize: '12px', fontWeight: '700', color: 'var(--color-navy)' }}>
                IMMUTABLE AUDIT PAYLOAD (JSON):
              </div>
              <pre className={styles.jsonBox}>
                {JSON.stringify(inspectedLog.details || {}, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
