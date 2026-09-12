'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ClinicQueueRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/clinic/appointments');
  }, [router]);

  return (
    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
      <p>Redirecting to Clinical Appointments...</p>
    </div>
  );
}
