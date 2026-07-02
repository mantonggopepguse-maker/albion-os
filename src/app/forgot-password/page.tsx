'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import styles from '../login/login.module.css';

function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { resetPassword } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    const result = await resetPassword(email);

    if (result.success) {
      setSent(true);
      setIsSubmitting(false);
    } else {
      setError(result.error || 'Failed to send reset email');
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.brandPanel}>
        <div className={styles.brandContent}>
          <div className={styles.brandLogo}>
            <div className={styles.logoMark}>A</div>
            <h1 className={styles.brandTitle}>AlbionOS</h1>
          </div>
          <p className={styles.brandTagline}>
            Enterprise Pharmaceutical Management Suite
          </p>
          <div className={styles.brandFooter}>
            <p>Albion Pharmaceutical Co. Ltd.</p>
            <p>Nigeria&apos;s Trusted Veterinary Partner</p>
          </div>
        </div>
        <div className={styles.circle1} />
        <div className={styles.circle2} />
        <div className={styles.circle3} />
      </div>

      <div className={styles.formPanel}>
        <div className={styles.formContainer}>
          <div className={styles.formHeader}>
            <h2 className={styles.formTitle}>Reset Password</h2>
            <p className={styles.formSubtitle}>
              Enter your email and we&apos;ll send you a reset link
            </p>
          </div>

          {error && (
            <div className={styles.errorAlert}>
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {sent && (
            <div className={styles.errorAlert} style={{ background: 'var(--color-success-tint)', color: 'var(--color-success)' }}>
              <span>✓</span>
              <span>Check your email for the reset link.</span>
            </div>
          )}

          {!sent && (
            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.inputGroup}>
                <label htmlFor="email" className={styles.label}>
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@albionpharma.com"
                  className={styles.input}
                  required
                  autoComplete="email"
                />
              </div>

              <button
                type="submit"
                className={styles.submitBtn}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <span className={styles.spinner} />
                ) : (
                  'Send Reset Link'
                )}
              </button>
            </form>
          )}

          <div className={styles.quickLogin} style={{ borderTop: 'none', marginTop: 'var(--space-4)' }}>
            <p className={styles.quickLoginTitle} style={{ textTransform: 'none', letterSpacing: 0 }}>
              <Link href="/login" style={{ color: 'var(--color-navy)', fontWeight: 600 }}>
                Back to Sign In
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <AuthProvider>
      <ForgotPasswordForm />
    </AuthProvider>
  );
}
