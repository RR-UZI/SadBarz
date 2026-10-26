import React from 'react';
import { Image, Text, View } from 'react-native';

import { colors } from '../theme';

// Round profile photo, or the athlete's initials when there is none.
export function Avatar({ uri, name, size = 40 }: { uri?: string | null; name?: string; size?: number }) {
  const initials = (name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: 'hidden',
        backgroundColor: colors.surface2,
        borderWidth: Math.max(1, size / 40),
        borderColor: colors.accent,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size }} accessibilityIgnoresInvertColors />
      ) : (
        <Text style={{ color: colors.accent, fontWeight: '900', fontSize: size * 0.38 }}>{initials || '?'}</Text>
      )}
    </View>
  );
}
