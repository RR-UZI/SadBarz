// Resistance band pieces: the colored dot, a pill naming the band, and the picker.
import React from 'react';
import { Pressable, View } from 'react-native';

import { useT } from '../i18n';
import { BANDS, bandById, bandRange } from '../lib/bands';
import { colors, radius, space } from '../theme';
import type { BandColor } from '../types';
import { Row, Txt } from './ui';

export function BandDot({ band, size = 12 }: { band: BandColor; size?: number }) {
  const b = bandById(band);
  if (!b) return null;
  // the black band gets a light ring so it shows on the dark background
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: b.hex, borderWidth: 1, borderColor: band === 'black' ? colors.muted : b.hex }} />;
}

/** "● Banda roja", tappable in the editor. */
export function BandPill({ band, onPress, open }: { band?: BandColor; onPress: () => void; open?: boolean }) {
  const t = useT();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={band ? t(`band.${band}`) : t('band.add')}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: band || open ? colors.accent : colors.border,
        backgroundColor: colors.surface,
      }}
    >
      {band ? <BandDot band={band} /> : null}
      <Txt variant="small" style={{ fontWeight: '700' }}>
        {band ? t(`band.${band}`) : t('band.add')}
      </Txt>
    </Pressable>
  );
}

/** Every band with how much it helps; tapping one picks it, "Sin banda" clears it. */
export function BandPicker({ value, onChange }: { value?: BandColor; onChange: (b: BandColor | undefined) => void }) {
  const t = useT();
  return (
    <View style={{ gap: 4, backgroundColor: colors.surface, borderRadius: radius.md, padding: space.sm }}>
      {BANDS.map((b) => {
        const on = value === b.id;
        return (
          <Pressable
            key={b.id}
            onPress={() => onChange(b.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 8, paddingHorizontal: space.sm, borderRadius: radius.sm, backgroundColor: on ? colors.surface2 : 'transparent' }}
          >
            <BandDot band={b.id} size={16} />
            <Txt style={{ fontWeight: on ? '800' : '600', flex: 1 }}>{t(`band.color.${b.id}`)}</Txt>
            <Txt variant="small" color={colors.muted}>
              −{bandRange(b)}
            </Txt>
          </Pressable>
        );
      })}
      <Row style={{ justifyContent: 'space-between', paddingHorizontal: space.sm, paddingTop: 4 }}>
        <Txt variant="tiny" color={colors.faint} style={{ flex: 1 }}>
          {t('band.help')}
        </Txt>
        {value ? (
          <Pressable onPress={() => onChange(undefined)} hitSlop={8}>
            <Txt variant="small" color={colors.accent}>
              {t('band.none')}
            </Txt>
          </Pressable>
        ) : null}
      </Row>
    </View>
  );
}
