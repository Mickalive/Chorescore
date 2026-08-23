import { Pressable, StyleSheet, Text, View } from 'react-native';
import { COLORS, RADIUS, SPACING } from './theme';

export function NoticeBanner({ message, onDismiss }: { message: string | null; onDismiss: () => void }) {
  if (message === null) {
    return null;
  }

  return (
    <View style={styles.container} accessibilityLiveRegion="polite">
      <Text style={styles.text}>{message}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Fermer le message"
        onPress={onDismiss}
        style={styles.close}
      >
        <Text style={styles.closeText}>Fermer</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#EDF8F6',
    borderColor: COLORS.success,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  text: {
    flex: 1,
    color: COLORS.textPrimary,
    lineHeight: 20,
  },
  close: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: SPACING.sm,
  },
  closeText: {
    color: COLORS.textSecondary,
    fontWeight: '700',
  },
});
