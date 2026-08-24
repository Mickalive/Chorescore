import { Pressable, StyleSheet, Text, View } from 'react-native';
import { COLORS, RADIUS, SPACING } from './theme';

export type SegmentOption = {
  value: string;
  label: string;
};

export function SegmentedControl({
  options,
  value,
  onChange,
  accessibilityLabel,
}: {
  options: SegmentOption[];
  value: string;
  onChange: (value: string) => void;
  accessibilityLabel: string;
}) {
  return (
    <View
      style={styles.container}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
    >
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[styles.option, selected && styles.selected]}
          >
            <Text style={[styles.label, selected && styles.selectedLabel]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 4,
  },
  option: {
    flex: 1,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.pill,
  },
  selected: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  label: {
    color: COLORS.textSecondary,
    fontWeight: '600',
    fontSize: 13,
  },
  selectedLabel: {
    color: COLORS.textPrimary,
    fontWeight: '800',
  },
});
