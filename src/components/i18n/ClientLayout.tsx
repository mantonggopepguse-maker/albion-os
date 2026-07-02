'use client';

import { I18nProvider } from '@/i18n/context';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return <I18nProvider>{children}</I18nProvider>;
}
