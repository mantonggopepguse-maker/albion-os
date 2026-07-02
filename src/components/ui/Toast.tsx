/**
 * @file Toast.tsx — Toast notification component for AlbionOS
 *
 * Provides visual feedback for user actions (success, error, info).
 * Auto-dismisses after a configurable duration.
 *
 * @example
 * ```tsx
 * <Toast message="Customer added successfully!" type="success" onClose={() => setToast(null)} />
 * ```
 */
'use client';

import { useEffect } from 'react';
import styles from './Toast.module.css';

interface ToastProps {
  /** The message to display. */
  message: string;
  /** Visual style — determines icon and colour. */
  type: 'success' | 'error' | 'info';
  /** Callback to remove the toast from state. */
  onClose: () => void;
  /** Auto-dismiss duration in ms. Defaults to 3500ms. */
  duration?: number;
}

/**
 * Toast — floating notification that auto-dismisses.
 *
 * Rendered at the top-right of the viewport via fixed positioning.
 * Slides in from the right with a smooth animation.
 */
export default function Toast({ message, type, onClose, duration = 3500 }: ToastProps) {
  /* Auto-dismiss after the specified duration */
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  /* Map type to emoji icon for visual clarity */
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };

  return (
    <div className={`${styles.toast} ${styles[type]}`} role="alert">
      <span className={styles.icon}>{icons[type]}</span>
      <span className={styles.message}>{message}</span>
      <button className={styles.close} onClick={onClose} aria-label="Dismiss">✕</button>
    </div>
  );
}
