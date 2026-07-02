export type Locale = 'en' | 'ha' | 'ig' | 'yo';

export const locales: Locale[] = ['en', 'ha', 'ig', 'yo'];

export const defaultLocale: Locale = 'en';

export const localeLabels: Record<Locale, string> = {
  en: 'English',
  ha: 'Hausa / هَوُسَا',
  ig: 'Igbo / Asụsụ Igbo',
  yo: 'Yoruba / Èdè Yorùbá',
};
