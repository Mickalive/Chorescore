import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  getSegmentContainerStyle,
  getSegmentOptionStyle,
} from './segmentedLayout';
import { COLORS } from './theme';

export type SegmentOption = {
  value: string;
  label: string;
};

export function SegmentedControl({
  options,
  value,
  onChange,
  accessibilityLabel,
  wrap = false,
}: {
  options: SegmentOption[];
  value: string;
  onChange: (value: string) => void;
  accessibilityLabel: string;
  /**
   * DRC-05 (MOB-C4-F1) : repli pour les segments au nombre ou au libellé
   * variable (filtre membre de l'historique). `true` laisse les segments
   * passer à la ligne au lieu de se compresser sur petit écran ou en grandes
   * tailles de texte ; les rôles radio et la cible tactile sont conservés.
   */
  wrap?: boolean;
}) {
  return (
    <View
      style={getSegmentContainerStyle(wrap)}
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
            style={[getSegmentOptionStyle(wrap), selected && styles.selected]}
          >
            <Text style={[styles.label, selected && styles.selectedLabel]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
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
