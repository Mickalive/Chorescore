import { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppButton } from '@/src/components/AppButton';
import { Card } from '@/src/components/Card';
import { Screen } from '@/src/components/Screen';
import { COLORS, RADIUS, SPACING } from '@/src/components/theme';
import { useApp } from '@/src/store/AppProvider';

export default function OnboardingScreen() {
  const router = useRouter();
  const { completeOnboarding } = useApp();
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [analyticsOptIn, setAnalyticsOptIn] = useState(false);

  const continueToDemo = () => {
    if (!termsAccepted) {
      return;
    }
    completeOnboarding(analyticsOptIn);
    router.replace('/');
  };

  return (
    <Screen contentContainerStyle={styles.screen}>
      <View style={styles.brandMark} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Text style={styles.brandLetters}>CS</Text>
      </View>
      <Text style={styles.brand}>ChoreScore</Text>
      <Text accessibilityRole="header" style={styles.title}>Prendre soin du foyer, ensemble.</Text>
      <Text style={styles.subtitle}>
        Explore une démonstration mobile avec des données entièrement fictives. Rien ne quitte cet appareil et rien n’est conservé.
      </Text>

      <View style={styles.featureGrid}>
        <Card style={styles.featureCard}>
          <Text style={styles.featureNumber}>01</Text>
          <Text style={styles.featureTitle}>Enregistrer</Text>
          <Text style={styles.featureText}>Chrono ou saisie manuelle, selon ce qui est le plus simple.</Text>
        </Card>
        <Card style={styles.featureCard}>
          <Text style={styles.featureNumber}>02</Text>
          <Text style={styles.featureTitle}>Comprendre</Text>
          <Text style={styles.featureText}>Un indicateur partagé, limité aux tâches réellement saisies.</Text>
        </Card>
      </View>

      <Card style={styles.consentCard}>
        <Text style={styles.cardTitle}>Conditions de la démo</Text>
        <Text style={styles.cardBody}>
          Cette version ne crée aucun compte, ne traite aucun paiement et ne constitue pas un relevé objectif du travail domestique.
        </Text>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: termsAccepted }}
          accessibilityLabel="J’ai compris les conditions de la démonstration"
          onPress={() => setTermsAccepted((current) => !current)}
          style={styles.checkRow}
        >
          <View style={[styles.checkbox, termsAccepted && styles.checkboxChecked]}>
            <Text style={styles.checkmark}>{termsAccepted ? '✓' : ''}</Text>
          </View>
          <Text style={styles.checkLabel}>J’ai compris et j’accepte les conditions de cette démonstration.</Text>
        </Pressable>
      </Card>

      <Card style={styles.consentCard}>
        <View style={styles.switchRow}>
          <View style={styles.switchCopy}>
            <Text style={styles.cardTitle}>Analytics optionnels</Text>
            <Text style={styles.cardBody}>
              Désactivés par défaut. Même activés, les événements restent uniquement en mémoire dans cette démo.
            </Text>
          </View>
          <Switch
            accessibilityLabel="Autoriser les analytics optionnels en mémoire"
            value={analyticsOptIn}
            onValueChange={setAnalyticsOptIn}
            trackColor={{ false: COLORS.border, true: COLORS.primary }}
            thumbColor={analyticsOptIn ? COLORS.success : COLORS.surface}
          />
        </View>
      </Card>

      <AppButton
        label="Entrer dans la démo"
        onPress={continueToDemo}
        disabled={!termsAccepted}
        accessibilityHint="Ouvre le foyer fictif Rivage"
        style={styles.primaryAction}
      />
      <Text style={styles.footer}>Le consentement analytics reste indépendant des conditions essentielles.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingTop: SPACING.xl,
  },
  brandMark: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.textPrimary,
  },
  brandLetters: {
    color: COLORS.surface,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  brand: {
    color: COLORS.success,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginTop: SPACING.md,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: 36,
    lineHeight: 42,
    fontWeight: '800',
    marginTop: SPACING.sm,
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 16,
    lineHeight: 24,
    marginTop: SPACING.sm,
  },
  featureGrid: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.lg,
  },
  featureCard: {
    flex: 1,
  },
  featureNumber: {
    color: COLORS.success,
    fontWeight: '800',
    fontSize: 12,
  },
  featureTitle: {
    color: COLORS.textPrimary,
    fontWeight: '800',
    fontSize: 16,
    marginTop: SPACING.xs,
  },
  featureText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: SPACING.xs,
  },
  consentCard: {
    marginTop: SPACING.md,
  },
  cardTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  cardBody: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginTop: SPACING.xs,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    minHeight: 52,
    marginTop: SPACING.md,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: RADIUS.sm,
    borderWidth: 2,
    borderColor: COLORS.textSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: COLORS.success,
    borderColor: COLORS.success,
  },
  checkmark: {
    color: COLORS.surface,
    fontWeight: '900',
  },
  checkLabel: {
    flex: 1,
    color: COLORS.textPrimary,
    lineHeight: 20,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  switchCopy: {
    flex: 1,
  },
  primaryAction: {
    marginTop: SPACING.lg,
  },
  footer: {
    color: COLORS.textMuted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: SPACING.sm,
    marginBottom: SPACING.lg,
  },
});
