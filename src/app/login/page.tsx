/**
 * @file login/page.tsx — Login Page (`/login`)
 *
 * The AlbionOS login screen, built as a **split-panel layout**:
 *   • Left panel  — brand showcase (logo, tagline, feature highlights,
 *                    decorative CSS circles for visual depth).
 *   • Right panel — the actual login form + demo quick-login buttons.
 *
 * Design decisions:
 *   - The split-panel pattern is a common enterprise UI convention that
 *     balances branding visibility with a focused login experience.
 *   - `LoginForm` is an internal (non-exported) component that consumes
 *     the auth context via `useAuth()`.
 *   - `LoginPage` is the exported page component; it wraps `LoginForm`
 *     inside an `<AuthProvider>` because `useAuth()` requires an
 *     `AuthProvider` ancestor. The provider is NOT placed in the root
 *     layout so that each route tree gets its own isolated instance.
 *
 * Authentication flow:
 *   1. User fills in email + password → `handleSubmit` calls `login()`
 *      from the auth context (Supabase-powered).
 *   2. On success → `router.push('/dashboard')`.
 *   3. On failure → an inline error alert is displayed.
 *   4. Demo accounts can be accessed via the quick-login grid, which
 *      auto-fills credentials and triggers `login()` immediately.
 */

'use client';

/* ────────────────────────────────────────────
   Dependencies
   ──────────────────────────────────────────── */
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AuthProvider, useAuth, DEMO_PROFILES, DemoProfile, QUICK_LOGIN_USERS, DEV_PASSWORD, ENABLE_DEMO_LOGIN } from '@/lib/auth-context';
import styles from './login.module.css';

/* ────────────────────────────────────────────
   Clinic Demo Profiles (Cross-App Handoff)
   ──────────────────────────────────────────── */
const CLINIC_DEMO_USERS = [
  {
    role: 'Super Admin',
    name: 'Dr. Emeka Moneke',
    systemRole: 'SUPER_ADMIN',
    email: 'superadmin@albionpetclinic.com',
    icon: '👑',
    badgeColor: '#7c3aed',
    desc: 'Multi-clinic & system config'
  },
  {
    role: 'Clinic Admin',
    name: 'Dr. Kalu Okonkwo',
    systemRole: 'Admin',
    email: 'admin@albionpetclinic.com',
    icon: '🏢',
    badgeColor: '#0f766e',
    desc: 'Clinic ops, staff & financials'
  },
  {
    role: 'Veterinarian',
    name: 'Dr. Amaka Bello, DVM',
    systemRole: 'Veterinarian',
    email: 'vet@albionpetclinic.com',
    icon: '🩺',
    badgeColor: '#059669',
    desc: 'Treatments, surgery & AI hub'
  },
  {
    role: 'Receptionist',
    name: 'Chioma Eze',
    systemRole: 'Receptionist',
    email: 'reception@albionpetclinic.com',
    icon: '📋',
    badgeColor: '#0284c7',
    desc: 'Queue, appointments & POS'
  },
  {
    role: 'Lab Scientist',
    name: 'Babatunde Adeleke',
    systemRole: 'Lab Scientist',
    email: 'lab@albionpetclinic.com',
    icon: '🧪',
    badgeColor: '#4f46e5',
    desc: 'Lab hub, tests & pathology'
  },
  {
    role: 'Vet Technician',
    name: 'Ibrahim Musa',
    systemRole: 'Vet Tech',
    email: 'vettech@albionpetclinic.com',
    icon: '❤️',
    badgeColor: '#e11d48',
    desc: 'ICU board & patient vitals'
  },
];

/* ────────────────────────────────────────────
   LoginForm — Internal form component
   ──────────────────────────────────────────── */

/**
 * LoginForm — renders the full split-panel login UI.
 *
 * This component is intentionally NOT exported. It lives inside this file
 * and is rendered as a child of `<AuthProvider>` by the exported `LoginPage`.
 *
 * @returns The two-panel login screen (brand panel + form panel).
 */
function LoginForm() {
  /* ── Local form state ── */
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeDemoEmail, setActiveDemoEmail] = useState<string | null>(null);
  const [workspaceTab, setWorkspaceTab] = useState<'PHARMA' | 'CLINIC'>('PHARMA');

  /* ── Auth context & router ── */
  const { login, loginAsDemo } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  /* ── Auto-login on incoming ?demo_role=... ── */
  useEffect(() => {
    const demoRole = searchParams.get('demo_role');
    if (demoRole) {
      const normalized = demoRole.toLowerCase();
      const matchedProfile = DEMO_PROFILES.find(
        (p) => p.role.toLowerCase() === normalized || p.email.toLowerCase().includes(normalized)
      );
      if (matchedProfile) {
        handleDemoLogin(matchedProfile);
      }
    }
  }, [searchParams]);

  /* ── Clinic handoff redirect helper ── */
  const handleClinicHandoff = (demo: typeof CLINIC_DEMO_USERS[0]) => {
    const matchedProfile = DEMO_PROFILES.find((p) => {
      const emailMatch = p.email.toLowerCase().includes(demo.systemRole.toLowerCase()) ||
                         p.role.toLowerCase() === demo.systemRole.toLowerCase();
      const roleMatch = p.roleTitle.toLowerCase().includes(demo.role.toLowerCase()) ||
                        p.name.toLowerCase() === demo.name.toLowerCase();
      return emailMatch || roleMatch;
    });

    if (matchedProfile) {
      handleDemoLogin(matchedProfile);
    } else {
      const fallback = DEMO_PROFILES.find((p) => p.role === 'clinic_admin') || DEMO_PROFILES[0];
      handleDemoLogin(fallback);
    }
  };

  /* ── Form Handlers ── */

  /**
   * handleSubmit — processes the standard email/password login.
   *
   * Flow:
   *  1. Prevents the default form submission (SPA pattern).
   *  2. Clears any previous error and sets a loading state.
   *  3. Calls the `login()` function from auth context (Supabase-powered).
   *  4. On success → navigates to `/dashboard`.
   *  5. On failure → displays the error message and re-enables the form.
   *
   * @param e - The React form submission event.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    const result = await login(email, password);

    if (result.success) {
      router.push('/dashboard');
    } else {
      setError(result.error || 'Login failed');
      setIsSubmitting(false);
    }
  };

  /**
   * handleDemoLogin — 1-click instant demo profile authentication.
   * Directly sets the authenticated user role and loads their dashboard.
   */
  const handleDemoLogin = async (profile: DemoProfile) => {
    setError('');
    setActiveDemoEmail(profile.email);
    setIsSubmitting(true);
    try {
      const result = await loginAsDemo(profile);
      if (result.success) {
        router.push('/dashboard');
      } else {
        setError(result.error || 'Failed to login as demo user');
        setIsSubmitting(false);
        setActiveDemoEmail(null);
      }
    } catch {
      setError('An error occurred during demo login');
      setIsSubmitting(false);
      setActiveDemoEmail(null);
    }
  };


  /* ── Render ── */
  return (
    <div className={styles.container}>

      {/* ========================================
          Left Panel — Brand Showcase
          Displays the AlbionOS logo, tagline,
          feature highlights, and company info.
          The decorative circles are purely cosmetic
          CSS elements for visual depth.
          ======================================== */}
      <div className={styles.brandPanel}>
        <div className={styles.brandContent}>
          <div className={styles.brandLogo}>
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-400 via-emerald-500 to-teal-700 p-0.5 shadow-xl shadow-teal-500/30 flex items-center justify-center flex-shrink-0">
              <div className="w-full h-full rounded-[14px] bg-slate-950/20 backdrop-blur-md flex items-center justify-center overflow-hidden">
                <svg className="w-7 h-7 text-white drop-shadow-md" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="10" width="18" height="9" rx="4.5" transform="rotate(-30 12 14.5)" fill="currentColor" fillOpacity="0.25" />
                  <path d="M12 5v14M5 12h14" strokeWidth="2.5" />
                  <path d="M17 7c-2 0-4 1.5-4 4.5" stroke="currentColor" strokeWidth="2" opacity="0.85" />
                </svg>
              </div>
            </div>
            <h1 className={styles.brandTitle}>Albion OS</h1>
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
        {/* Decorative circles — positioned absolutely in CSS to create
            a layered, modern background effect on the brand panel. */}
        <div className={styles.circle1} />
        <div className={styles.circle2} />
        <div className={styles.circle3} />
      </div>

      {/* ========================================
          Right Panel — Login Form
          Contains the sign-in form, inline error
          display, and the demo quick-login grid.
          ======================================== */}
      <div className={styles.formPanel}>
        <div className={styles.formContainer}>
          {/* Form Header */}
          <div className={styles.formHeader}>
            <h2 className={styles.formTitle}>Welcome Back</h2>
            <p className={styles.formSubtitle}>Sign in to your AlbionOS account</p>
          </div>

          {/* Inline Error Alert — conditionally rendered when `error` is non-empty */}
          {error && (
            <div className={styles.errorAlert}>
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Standard Login Form */}
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

            <div className={styles.inputGroup}>
              <label htmlFor="password" className={styles.label}>
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className={styles.input}
                required
                autoComplete="current-password"
              />
            </div>

            {/* Submit button shows a CSS spinner while `isSubmitting` is true */}
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <span className={styles.spinner} />
              ) : (
                'Sign In'
              )}
            </button>

            <div style={{ textAlign: 'center', marginTop: 'var(--space-3)' }}>
              <Link
                href="/forgot-password"
                style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-gray)' }}
              >
                Forgot password?
              </Link>
            </div>
          </form>

          {/* ── Quick Login Section (Demo Accounts) ──
               1-click instant access for all 11 enterprise & clinical roles. */}
          {ENABLE_DEMO_LOGIN && (
            <div className={styles.quickLogin}>
              <div className={styles.quickLoginHeader}>
                <p className={styles.quickLoginTitle}>Unified 1-Click Access</p>
                <span className={styles.quickLoginBadge}>All 11 Roles</span>
              </div>
              <p className={styles.quickLoginSubtitle}>
                Select any profile below to immediately explore that role&apos;s functions across both suites:
              </p>

              {/* Workspace Segmented Tabs */}
              <div className={styles.workspaceTabs}>
                <button
                  type="button"
                  onClick={() => setWorkspaceTab('PHARMA')}
                  className={`${styles.workspaceTab} ${workspaceTab === 'PHARMA' ? styles.workspaceTabActive : ''}`}
                >
                  💊 Pharma OS (5)
                </button>
                <button
                  type="button"
                  onClick={() => setWorkspaceTab('CLINIC')}
                  className={`${styles.workspaceTab} ${workspaceTab === 'CLINIC' ? styles.workspaceTabActive : ''}`}
                >
                  🐾 Clinic Fleet (6)
                </button>
              </div>

              {/* Tab 1: Pharma OS Profiles (Current App) */}
              {workspaceTab === 'PHARMA' && (
                <div className={styles.quickLoginGrid}>
                  {DEMO_PROFILES.map((profile) => (
                    <button
                      key={profile.email}
                      type="button"
                      className={styles.demoCard}
                      disabled={isSubmitting}
                      onClick={() => handleDemoLogin(profile)}
                      title={`Log in as ${profile.name} (${profile.roleTitle})`}
                    >
                      <div className={styles.demoCardLeft}>
                        <div
                          className={styles.demoCardIcon}
                          style={{
                            background: `${profile.badgeColor}18`,
                            border: `1px solid ${profile.badgeColor}33`,
                          }}
                        >
                          {profile.icon}
                        </div>
                        <div className={styles.demoCardContent}>
                          <div className={styles.demoCardTop}>
                            <span className={styles.demoCardName}>{profile.name}</span>
                            <span
                              className={styles.demoCardRoleTag}
                              style={{
                                background: `${profile.badgeColor}15`,
                                color: profile.badgeColor,
                              }}
                            >
                              {profile.roleTitle}
                            </span>
                          </div>
                          <span className={styles.demoCardDesc}>{profile.description}</span>
                        </div>
                      </div>
                      <div className={styles.demoCardAction}>
                        {activeDemoEmail === profile.email ? (
                          <span className={styles.spinner} style={{ width: 14, height: 14, borderWidth: 2 }} />
                        ) : (
                          '→'
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Tab 2: Clinic Profiles (Handoff to Pet Clinic App) */}
              {workspaceTab === 'CLINIC' && (
                <div className={styles.quickLoginGrid}>
                  {CLINIC_DEMO_USERS.map((demo) => (
                    <button
                      key={demo.email}
                      type="button"
                      className={`${styles.demoCard} ${styles.clinicDemoCard}`}
                      disabled={isSubmitting}
                      onClick={() => handleClinicHandoff(demo)}
                      title={`1-Click handoff to Albion Pet Clinic as ${demo.name} (${demo.role})`}
                    >
                      <div className={styles.demoCardLeft}>
                        <div
                          className={styles.demoCardIcon}
                          style={{
                            background: `${demo.badgeColor}18`,
                            border: `1px solid ${demo.badgeColor}33`,
                          }}
                        >
                          {demo.icon}
                        </div>
                        <div className={styles.demoCardContent}>
                          <div className={styles.demoCardTop}>
                            <span className={styles.demoCardName}>{demo.name}</span>
                            <span
                              className={styles.demoCardRoleTag}
                              style={{
                                background: `${demo.badgeColor}15`,
                                color: demo.badgeColor,
                              }}
                            >
                              {demo.role}
                            </span>
                          </div>
                          <span className={styles.demoCardDesc}>{demo.desc}</span>
                        </div>
                      </div>
                      <div className={styles.demoCardAction}>
                        {isSubmitting ? (
                          <span className={styles.spinner} style={{ width: 14, height: 14, borderWidth: 2 }} />
                        ) : (
                          '→'
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────
   LoginPage — Exported Page Component
   ──────────────────────────────────────────── */

/**
 * LoginPage — the default export for the `/login` route.
 *
 * Wraps `LoginForm` inside an `<AuthProvider>` and `<Suspense>`
 * so that `useAuth()` and `useSearchParams()` work seamlessly.
 *
 * @returns The auth-provider-wrapped login form.
 */
export default function LoginPage() {
  return (
    <AuthProvider>
      <Suspense fallback={<div className={styles.container} />}>
        <LoginForm />
      </Suspense>
    </AuthProvider>
  );
}

