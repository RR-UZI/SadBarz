// Who a routine is for (the examples): Principiante, Intermedio or Avanzado.
import React from 'react';

import { useT } from '../i18n';
import { colors } from '../theme';
import type { Level } from '../types';
import { Badge } from './ui';

const COLOR: Record<Level, string> = { beginner: colors.success, intermediate: colors.warn, advanced: colors.danger };

export function LevelBadge({ level }: { level?: Level }) {
  const t = useT();
  if (!level) return null;
  return <Badge label={t(`level.${level}`)} color={COLOR[level]} textColor={colors.accentText} />;
}
