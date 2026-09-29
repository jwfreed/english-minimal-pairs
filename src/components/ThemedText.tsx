import { Text, type TextProps, StyleSheet } from 'react-native';

import { useThemeColor } from '@/src/hooks/useThemeColor';
import { font } from '@/src/constants/typography';

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link';
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = 'default',
  ...rest
}: ThemedTextProps) {
  const color = useThemeColor(
    { light: lightColor, dark: darkColor },
    type === 'link' ? 'primaryText' : 'text'
  );

  return (
    <Text
      style={[
        { color },
        type === 'default' ? styles.default : undefined,
        type === 'title' ? styles.title : undefined,
        type === 'defaultSemiBold' ? styles.defaultSemiBold : undefined,
        type === 'subtitle' ? styles.subtitle : undefined,
        type === 'link' ? styles.link : undefined,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  default: {
    ...font('400'),
    fontSize: 16,
    lineHeight: 24,
  },
  defaultSemiBold: {
    ...font('600'),
    fontSize: 16,
    lineHeight: 24,
  },
  title: {
    ...font('700'),
    fontSize: 32,
    lineHeight: 32,
  },
  subtitle: {
    ...font('700'),
    fontSize: 20,
  },
  link: {
    ...font('400'),
    lineHeight: 30,
    fontSize: 16,
  },
});
