'use client';

import { useState, useRef, useEffect } from 'react';
import { useI18n } from '@/i18n/context';
import { locales, localeLabels } from '@/i18n/config';

export default function LocaleSwitcher() {
  const { locale, setLocale } = useI18n();
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
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          padding: '4px 10px',
          fontSize: 'var(--font-size-xs)',
          cursor: 'pointer',
          fontFamily: 'inherit',
          color: 'var(--color-slate)',
        }}
        aria-label="Switch language"
      >
        {localeLabels[locale]}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 4,
            background: '#fff',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-clay-pop)',
            zIndex: 1000,
            minWidth: 160,
          }}
        >
          {locales.map((l) => (
            <button
              key={l}
              onClick={() => {
                setLocale(l);
                setOpen(false);
              }}
              style={{
                display: 'block',
                width: '100%',
                padding: '8px 14px',
                border: 'none',
                background: l === locale ? 'var(--color-surface-hover)' : 'transparent',
                cursor: 'pointer',
                fontSize: 'var(--font-size-sm)',
                textAlign: 'left',
                fontFamily: 'inherit',
                color: 'var(--color-slate)',
                fontWeight: l === locale ? 600 : 400,
              }}
            >
              {localeLabels[l]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
