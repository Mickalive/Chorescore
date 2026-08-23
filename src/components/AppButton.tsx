import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { COLORS, RADIUS, SPACING } from './theme';

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
};

export function AppButton({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  accessibilityHint,
  style,
}: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text style={[styles.label, variant === 'primary' && styles.primaryLabel, variant === 'danger' && styles.dangerLabel]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 46,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  primary: {
    backgroundColor: COLORS.textPrimary,
  },
  secondary: {
    backgroundColor: COLORS.secondary,
    borderColor: COLORS.primary,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderColor: COLORS.border,
  },
  danger: {
    backgroundColor: '#FFF4F1',
    borderColor: COLORS.error,
  },
  label: {
    color: COLORS.textPrimary,
    fontWeight: '700',
    fontSize: 15,
  },
  primaryLabel: {
    color: COLORS.surface,
  },
  dangerLabel: {
    color: '#A9422F',
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.99 }],
  },
  disabled: {
    opacity: 0.45,
  },
});
