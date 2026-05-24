import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { t as translate, type I18nKey, type Lang } from '@shared/i18n';

interface I18nContextValue {
  lang: Lang;
  t: (key: I18nKey) => string;
}

const I18nContext = createContext<I18nContextValue>({
  lang: 'he',
  t: (key) => translate('he', key),
});

export function I18nProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  const value = useMemo(
    () => ({
      lang,
      t: (key: I18nKey) => translate(lang, key),
    }),
    [lang]
  );

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
  }, [lang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT(): I18nContextValue {
  return useContext(I18nContext);
}
