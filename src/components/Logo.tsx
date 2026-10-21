// SadBarz logos: the "SB" mark (sad face in the B) and the $adBarz wordmark.
import React from 'react';
import { Image, type ImageStyle, type StyleProp } from 'react-native';

const MARK_RATIO = 682 / 649; // width / height of assets/logo-mark.png

export function LogoMark({ size = 32, style }: { size?: number; style?: StyleProp<ImageStyle> }) {
  return (
    <Image
      source={require('../../assets/logo-mark.png')}
      style={[{ width: size * MARK_RATIO, height: size }, style]}
      resizeMode="contain"
      accessibilityLabel="SadBarz"
    />
  );
}
