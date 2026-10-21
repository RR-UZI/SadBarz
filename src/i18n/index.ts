import { useCallback } from 'react';

import { useApp } from '../store/AppStore';
import type { Language } from '../types';
import { en } from './en';
import { es, type StringKey } from './es';

const dictionaries: Record<Language, Record<StringKey, string>> = { es, en };

export function translate(lang: Language, key: StringKey, vars?: Record<string, string | number>) {
  let text = dictionaries[lang][key] ?? es[key] ?? key;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replace(`{${name}}`, String(value));
    }
  }
  return text;
}

export function useT() {
  const { settings } = useApp();
  return useCallback(
    (key: StringKey, vars?: Record<string, string | number>) => translate(settings.language, key, vars),
    [settings.language],
  );
}

export type { StringKey };
