import { Image, type ImageStyle, type StyleProp } from 'react-native';

export function BrandMark({ width = 92, style }: { width?: number; style?: StyleProp<ImageStyle> }) {
  return (
    <Image
      accessibilityLabel="HAO"
      resizeMode="contain"
      source={require('@/assets/brand/hao-wordmark.png')}
      style={[{ width, height: width * 0.35 }, style]}
    />
  );
}
