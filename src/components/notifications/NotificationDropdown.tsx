'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useNotifications } from '@/lib/notifications-context';

const severityColors: Record<string, string> = {
  high: '#dc2626',
  medium: '#b45309',
  low: '#2563eb',
};

const severityDots: Record<string, string> = {
  high: '🔴',
  medium: '🟠',
  low: '🔵',
};

export default function NotificationDropdown() {
  const { notifications, unreadCount, markAsRead, dismiss, dismissAll } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          position: 'relative',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: 20,
          padding: 4,
          lineHeight: 1,
        }}
        title="Notifications"
      >
        🔔
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -2,
              right: -4,
              background: '#dc2626',
              color: '#fff',
              fontSize: 10,
              fontWeight: 700,
              borderRadius: '50%',
              width: 18,
              height: 18,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 8,
            width: 360,
            maxHeight: 480,
            overflowY: 'auto',
            background: '#fff',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            zIndex: 2000,
          }}
        >
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--color-border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <strong style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-navy)' }}>
              Notifications
            </strong>
            {notifications.length > 0 && (
              <button
                onClick={dismissAll}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-gray)',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Dismiss all
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--color-gray)', fontSize: 'var(--font-size-sm)' }}>
              No notifications
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                onMouseEnter={() => markAsRead(n.id)}
                style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid var(--color-border-light)',
                  background: n.read ? 'transparent' : 'var(--color-surface)',
                  cursor: 'default',
                  transition: 'background 0.15s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <span style={{ fontSize: 12 }}>{severityDots[n.severity] || '🔵'}</span>
                      <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-slate)' }}>
                        {n.title}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--color-gray)', lineHeight: 1.4 }}>
                      {n.message}
                    </p>
                  </div>
                  <button
                    onClick={() => dismiss(n.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 14,
                      color: 'var(--color-gray)',
                      padding: 2,
                      flexShrink: 0,
                    }}
                    title="Dismiss"
                  >
                    ✕
                  </button>
                </div>
                {n.link && (
                  <Link
                    href={n.link}
                    onClick={() => setOpen(false)}
                    style={{
                      display: 'inline-block',
                      marginTop: 4,
                      fontSize: 11,
                      color: 'var(--color-navy)',
                      fontWeight: 600,
                      textDecoration: 'none',
                    }}
                  >
                    View →
                  </Link>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
