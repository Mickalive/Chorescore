import { StyleSheet, Text, View } from 'react-native';
import { COLORS, SPACING } from './theme';

export function SectionTitle({ title, detail }: { title: string; detail?: string }) {
  return (
    <View style={styles.container}>
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      {detail === undefined ? null : <Text style={styles.detail}>{detail}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: 19,
    fontWeight: '800',
  },
  detail: {
    color: COLORS.textSecondary,
    marginTop: 2,
    lineHeight: 19,
    fontSize: 13,
  },
});
