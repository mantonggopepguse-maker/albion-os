'use client';

import { useState } from 'react';
import { useAnnouncements } from '@/hooks/use-supabase-data';
import { useAuth } from '@/lib/auth-context';
import Modal from '@/components/ui/Modal';
import type { AnnouncementScope, AnnouncementPriority } from '@/lib/types';
import styles from './AnnouncementBanner.module.css';

export default function AnnouncementBanner() {
  const { user } = useAuth();
  const { announcements, createNotice, dismissNotice } = useAnnouncements(
    user?.role,
    user?.location_id
  );

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState<AnnouncementPriority>('normal');
  const [scope, setScope] = useState<AnnouncementScope>(
    user?.role === 'clinic_admin' ? 'clinic' : 'all'
  );
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const canPost = ['super_admin', 'ceo', 'clinic_admin'].includes(user?.role || '');

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      setFormError('Please enter both title and message content');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    const res = await createNotice({
      title: title.trim(),
      message: message.trim(),
      scope,
      location_id: scope === 'clinic' ? user?.location_id : null,
      location_name: scope === 'clinic' ? user?.location_name : null,
      author_id: user?.id || 'admin',
      author_name: user?.full_name || 'Administrator',
      author_role: user?.role || 'super_admin',
      priority,
    });

    setSubmitting(false);
    if (res.success) {
      setTitle('');
      setMessage('');
      setIsModalOpen(false);
    } else {
      setFormError(res.error || 'Failed to post announcement');
    }
  };

  if (announcements.length === 0 && !canPost) return null;

  return (
    <>
      <div className={styles.bannerContainer}>
        {/* Post notice trigger for authorized leadership */}
        {canPost && (
          <div className={styles.bannerHeader}>
            <button
              onClick={() => setIsModalOpen(true)}
              className={styles.postNoticeBtn}
              title="Broadcast new announcement to team"
            >
              📢 + Broadcast Notice
            </button>
          </div>
        )}

        {/* Slim Cards */}
        {announcements.map((ann) => {
          const isUrgent = ann.priority === 'urgent';
          return (
            <div
              key={ann.id}
              className={`${styles.card} ${isUrgent ? styles.cardUrgent : styles.cardNormal}`}
              role={isUrgent ? 'alert' : 'status'}
            >
              <div className={styles.contentArea}>
                <div
                  className={`${styles.iconWrap} ${isUrgent ? styles.iconWrapUrgent : styles.iconWrapNormal}`}
                >
                  {isUrgent ? '🚨' : '📢'}
                </div>

                <div className={styles.textContent}>
                  <div className={styles.headerRow}>
                    <span
                      className={`${styles.badgePriority} ${isUrgent ? styles.badgePriorityUrgent : styles.badgePriorityNormal}`}
                    >
                      {isUrgent ? 'Urgent' : 'Notice'}
                    </span>
                    <span className={styles.badgeScope}>
                      {ann.scope === 'all'
                        ? 'Company Notice'
                        : `Clinic (${ann.location_name || 'Branch'})`}
                    </span>
                    <strong className={styles.title}>{ann.title}</strong>
                  </div>

                  <p className={styles.message}>{ann.message}</p>

                  <div className={styles.metaInfo}>
                    Posted by <strong>{ann.author_name}</strong> •{' '}
                    {new Date(ann.created_at).toLocaleDateString('en-NG', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              </div>

              {/* Action Area: Dedicated Mark as read button */}
              <div className={styles.actionsArea}>
                <button
                  className={`${styles.markReadBtn} ${isUrgent ? styles.markReadBtnUrgent : styles.markReadBtnNormal}`}
                  onClick={() => dismissNotice(ann.id)}
                  title="Mark notice as read and dismiss"
                >
                  <span>✓</span> Mark as read
                </button>
                <button
                  className={styles.dismissBtn}
                  onClick={() => dismissNotice(ann.id)}
                  title="Dismiss notification"
                  aria-label="Dismiss notification"
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Post Notice Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Broadcast Announcement">
        <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {formError && (
            <div style={{ padding: '8px 12px', background: '#fee2e2', color: '#b91c1c', borderRadius: 'var(--radius-md)', fontSize: '0.85rem' }}>
              {formError}
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-navy)', marginBottom: '4px' }}>
              Notice Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Q3 Field Stock Reconciliations / Ultrasound Training"
              style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: '0.9rem' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-navy)', marginBottom: '4px' }}>
              Message Details *
            </label>
            <textarea
              required
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write the details of the broadcast notice to personnel..."
              style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: '0.9rem' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-navy)', marginBottom: '4px' }}>
                Priority Level
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as AnnouncementPriority)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: '0.9rem' }}
              >
                <option value="normal">Normal Priority 📢</option>
                <option value="urgent">Urgent Priority 🚨</option>
              </select>
            </div>

            {user?.role === 'super_admin' || user?.role === 'ceo' ? (
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-navy)', marginBottom: '4px' }}>
                  Target Audience
                </label>
                <select
                  value={scope}
                  onChange={(e) => setScope(e.target.value as AnnouncementScope)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: '0.9rem' }}
                >
                  <option value="all">Company-Wide (All Staff)</option>
                  <option value="clinic">Clinic Personnel Only</option>
                </select>
              </div>
            ) : (
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-navy)', marginBottom: '4px' }}>
                  Branch Scope
                </label>
                <div style={{ padding: '8px 12px', background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', color: 'var(--color-slate)' }}>
                  {user?.location_name || 'My Clinic Branch'}
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              style={{ padding: '8px 16px', background: 'none', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: '8px 18px',
                background: 'var(--color-navy)',
                color: '#fff',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {submitting ? 'Broadcasting...' : 'Broadcast Notice'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
