'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { Locale } from './config';
import { defaultLocale } from './config';

type Messages = Record<string, Record<string, string>>;

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
  _translations: Messages;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

async function loadMessages(locale: Locale): Promise<Messages> {
  try {
    const mod = await import(`../../messages/${locale}.json`);
    return mod.default as Messages;
  } catch {
    const mod = await import(`../../messages/en.json`);
    return mod.default as Messages;
  }
}

function resolveKey(obj: Messages, key: string): string {
  const parts = key.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return key;
    }
  }
  return typeof current === 'string' ? current : key;
}

export function I18nProvider({ children, initialLocale }: { children: React.ReactNode; initialLocale?: Locale }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (initialLocale) return initialLocale;
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('albionos-locale') as Locale | null;
      if (stored && (['en', 'ha', 'ig', 'yo'] as Locale[]).includes(stored)) return stored;
    }
    return defaultLocale;
  });
  const [messages, setMessages] = useState<Messages>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadMessages(locale).then((msgs) => {
      setMessages(msgs);
      setLoaded(true);
      if (typeof window !== 'undefined') {
        localStorage.setItem('albionos-locale', locale);
        document.documentElement.lang = locale;
      }
    });
  }, [locale]);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
  }, []);

  const t = useCallback(
    (key: string): string => {
      if (!loaded) return key;
      return resolveKey(messages, key);
    },
    [messages, loaded]
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, _translations: messages }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}
