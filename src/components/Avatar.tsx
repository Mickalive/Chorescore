import { StyleSheet, Text, View } from 'react-native';

export function Avatar({ initials, color, size = 44 }: { initials: string; color: string; size?: number }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}
    >
      <Text style={[styles.initials, { fontSize: Math.max(12, size * 0.32) }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
});
