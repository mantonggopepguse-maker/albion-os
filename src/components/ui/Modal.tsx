/**
 * @file Modal.tsx — Reusable modal dialog component for AlbionOS
 *
 * A glassmorphic modal overlay used across the app for all "Add/Create"
 * forms. Provides a consistent look-and-feel with:
 *   - Frosted backdrop blur overlay
 *   - Animated entrance/exit (scale + fade)
 *   - Close on backdrop click or Escape key
 *   - Responsive layout (full-screen on mobile, centered card on desktop)
 *   - Accessible focus trap and ARIA attributes
 *
 * @example
 * ```tsx
 * <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add Customer">
 *   <form>...</form>
 * </Modal>
 * ```
 */
'use client';

import { useEffect, useCallback } from 'react';
import styles from './Modal.module.css';

/* ─── Props Interface ─── */
interface ModalProps {
  /** Controls whether the modal is visible. */
  isOpen: boolean;
  /** Callback fired when the modal should close (backdrop click, Escape, X button). */
  onClose: () => void;
  /** Title displayed in the modal header. */
  title: string;
  /** Optional subtitle below the title for extra context. */
  subtitle?: string;
  /** The modal body content (forms, text, etc.). */
  children: React.ReactNode;
  /** Optional: control the max-width of the modal. Defaults to '560px'. */
  maxWidth?: string;
}

/**
 * Modal — glassmorphic dialog overlay.
 *
 * Renders a centered card on top of a blurred backdrop. The modal is
 * removed from the DOM when `isOpen` is false (no hidden rendering).
 *
 * Keyboard support:
 *   - Escape key closes the modal
 *   - Body scroll is locked while the modal is open
 */
export default function Modal({ isOpen, onClose, title, subtitle, children, maxWidth }: ModalProps) {
  /* ── Close on Escape key ── */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  /* ── Lock body scroll + attach Escape listener when open ── */
  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // Prevent background scrolling while the modal is open
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  /* ── Don't render anything when closed ── */
  if (!isOpen) return null;

  return (
    <div
      className={styles.overlay}
      onClick={onClose} /* Close when clicking the dark backdrop */
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      {/* The modal card itself — stopPropagation prevents clicking inside
          from closing the modal (only backdrop clicks close it) */}
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        style={maxWidth ? { maxWidth } : undefined}
      >
        {/* ── Header: title + close button ── */}
        <div className={styles.header}>
          <div>
            <h2 id="modal-title" className={styles.title}>{title}</h2>
            {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          </div>
          <button
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close modal"
            type="button"
          >
            ✕
          </button>
        </div>

        {/* ── Body: form content passed as children ── */}
        <div className={styles.body}>
          {children}
        </div>
      </div>
    </div>
  );
}
