import { View, type ViewProps } from 'react-native';

export function ThemedView({ style, ...otherProps }: ViewProps) {
  return <View style={style} {...otherProps} />;
}