'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import styles from '../login/login.module.css';

function SignUpForm() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { signUp } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    const result = await signUp(email, password, fullName);

    if (result.success) {
      setSuccess(true);
      setTimeout(() => router.push('/dashboard'), 1500);
    } else {
      setError(result.error || 'Sign up failed');
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
          <div className={styles.brandFeatures}>
            <div className={styles.feature}>
              <span className={styles.featureIcon}>📦</span>
              <span>Inventory Tracking</span>
            </div>
            <div className={styles.feature}>
              <span className={styles.featureIcon}>🧾</span>
              <span>Sales & Invoicing</span>
            </div>
            <div className={styles.feature}>
              <span className={styles.featureIcon}>💰</span>
              <span>Financial Management</span>
            </div>
            <div className={styles.feature}>
              <span className={styles.featureIcon}>💬</span>
              <span>Team Communication</span>
            </div>
          </div>
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
            <h2 className={styles.formTitle}>Create Account</h2>
            <p className={styles.formSubtitle}>Join AlbionOS</p>
          </div>

          {error && (
            <div className={styles.errorAlert}>
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className={styles.errorAlert} style={{ background: 'var(--color-success-tint)', color: 'var(--color-success)' }}>
              <span>✓</span>
              <span>Account created! Redirecting to dashboard...</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.inputGroup}>
              <label htmlFor="fullName" className={styles.label}>
                Full Name
              </label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your full name"
                className={styles.input}
                required
                autoComplete="name"
              />
            </div>

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

            <div className={styles.inputGroup}>
              <label htmlFor="password" className={styles.label}>
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a password"
                className={styles.input}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>

            <button
              type="submit"
              className={styles.submitBtn}
              disabled={isSubmitting || success}
            >
              {isSubmitting ? (
                <span className={styles.spinner} />
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          <div className={styles.quickLogin} style={{ borderTop: 'none', marginTop: 'var(--space-4)' }}>
            <p className={styles.quickLoginTitle} style={{ textTransform: 'none', letterSpacing: 0 }}>
              Already have an account?{' '}
              <Link href="/login" style={{ color: 'var(--color-navy)', fontWeight: 600 }}>
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SignUpPage() {
  return (
    <AuthProvider>
      <SignUpForm />
    </AuthProvider>
  );
}
