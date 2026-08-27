import assert from 'node:assert/strict';
import test from 'node:test';
import { COLORS } from '../src/components/theme.js';

/**
 * DRC-05 (contraste textMuted + textSecondary) : mesure WCAG 2.x déterministe
 * des paires texte/fond réellement employées par l'application. Le calcul est
 * implémenté ici (luminance relative + ratio) afin que toute évolution du
 * jeton central `theme.ts` soit validée contre le seuil AA 4,5:1 sans outil
 * externe.
 *
 * Fonds réels de `textMuted` (inventaire du code, cf. rapport du codeur) :
 * - COLORS.background (#FEFEFE) : aides de modales, pied d'onboarding,
 *   avertissement du classement, ligne « Plan actuel » du paywall ;
 * - COLORS.surface (#FFFFFF) : cartes (méta d'entrée et minutes de
 *   l'historique, méta du classement, détail des MetricCard, valeurs du
 *   graphique) et barre d'onglets inactive ;
 * - COLORS.surfaceAlt (#F8F9FA) : note de rétention de l'historique ;
 * - '#F7FCFB' : carte du membre courant dans le classement ;
 * - '#FFFDF5' : carte Pro du paywall (styles.proCard en override de planCard,
 *   libellé « par mois et par foyer » styles.perMonth) — fond codé en dur
 *   hors jetons du thème, candidat à une future tokenisation.
 *
 * Inventaire secondaire de `textSecondary` (MOB-CYCLE32961708279-SEG) — tous
 * les fonds réels où `color: COLORS.textSecondary` est rendu dans app/ et src/ :
 * - COLORS.background (#FEFEFE) : reportFile historique, body du PaywallModal,
 *   aides de modales (ManualEntry, TaskForm, EntryCorrection), avertissement
 *   du classement, pied d'onboarding, ScreenHeader, SectionTitle, HydrationGate ;
 * - COLORS.surface (#FFFFFF) : planCard Standard du paywall, Carte méta
 *   d'entrée, MetricCard, NativeBarChart, ContributionBar track ;
 * - COLORS.surfaceAlt (#F8F9FA) : libellés non sélectionnés du SegmentedControl
 *   (filtre membre historique, périodes historique/classement/profil), emptyText
 *   du classement, archivedNote et planNote de l'historique, capNote du profil,
 *   ContributionBar, TaskForm sections secondaires ;
 * - '#F7FCFB' : rang du membre courant dans le classement (rank), membre
 *   sélectionné du profil (selectedMember) — fond codé en dur hors jetons ;
 * - '#FFFDF5' : planDetail et disclaimer du Pro dans PaywallModal — fond
 *   codé en dur hors jetons du thème ;
 * - COLORS.secondary (#F1FAEE) : disclaimer du PaywallModal, section de
 *   tâches archivées (TaskForm), demoBanner, avertissement du classement ;
 * - '#EDF8F6' : closeText du NoticeBanner — fond codé en dur hors jetons ;
 * - '#F6FCFA' : TaskRow — fond codé en dur hors jetons.
 *
 * Le test couvre aussi les paires de remplacement documentées lors des audits
 * précédents pour empêcher toute régression silencieuse du thème.
 */

function srgbToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function parseHex(hex: string): { r: number; g: number; b: number } {
  const match = /^#([0-9A-Fa-f]{6})$/.exec(hex);
  if (match === null || match[1] === undefined) {
    throw new Error(`Couleur hex #RRGGBB attendue, reçu : « ${hex} »`);
  }
  const int = Number.parseInt(match[1], 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

function relativeLuminance(hex: string): number {
  const { r, g, b } = parseHex(hex);
  return (
    0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b)
  );
}

export function contrastRatio(foreground: string, background: string): number {
  const lf = relativeLuminance(foreground);
  const lb = relativeLuminance(background);
  const lighter = Math.max(lf, lb);
  const darker = Math.min(lf, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

test('le jeton textMuted atteint AA (≥ 4,5:1) sur chaque fond où il est réellement employé', () => {
  const mutedBackgrounds: Array<[string, string]> = [
    [COLORS.background, 'background — modales, onboarding, classement, paywall'],
    [COLORS.surface, 'surface — cartes et barre d’onglets'],
    [COLORS.surfaceAlt, 'surfaceAlt — note de rétention de l’historique'],
    ['#F7FCFB', 'carte courante du classement'],
    ['#FFFDF5', 'carte Pro du paywall (proCard — perMonth)'],
  ];
  for (const [background, usage] of mutedBackgrounds) {
    const ratio = contrastRatio(COLORS.textMuted, background);
    assert.ok(
      ratio >= 4.5,
      `textMuted ${COLORS.textMuted} sur ${usage} (${background}) : ${ratio.toFixed(2)}:1 < 4,5:1`,
    );
  }
});

test('l’ancien jeton textMuted échouait bien le seuil : le test détecte une régression', () => {
  // Garde-fou de la mesure elle-même : la valeur fautive historique doit
  // rester sous 4,5:1 sur surface claire, sinon le test ci-dessus ne
  // prouverait rien.
  const legacyRatio = contrastRatio('#6D8793', COLORS.surface);
  assert.ok(legacyRatio < 4.5);
});

test('les paires de remplacement documentées par les audits restent conformes', () => {
  // reportFile (historique) : textSecondary sur background, constat F6-R2.
  assert.ok(contrastRatio(COLORS.textSecondary, COLORS.background) >= 4.5);
  // breakdownMeta / lockedText : textSecondary sur carte blanche.
  assert.ok(contrastRatio(COLORS.textSecondary, COLORS.surface) >= 4.5);
  // emptyText (états vides) : textPrimary sur surfaceAlt, constat F1 32688156479.
  assert.ok(contrastRatio(COLORS.textPrimary, COLORS.surfaceAlt) >= 4.5);
  // Libellé sélectionné du contrôle segmenté : textPrimary sur surfaceAlt.
  assert.ok(contrastRatio(COLORS.textPrimary, COLORS.surfaceAlt) >= 4.5);
});

test('le jeton textSecondary atteint AA (≥ 4,5:1) sur chaque fond réel de l\'inventaire secondaire', () => {
  const secondaryBackgrounds: Array<[string, string]> = [
    [COLORS.background, 'background — reportFile, body paywall, modales, onboarding, ScreenHeader, SectionTitle'],
    [COLORS.surface, 'surface — planCard, Carte méta, MetricCard, NativeBarChart'],
    [COLORS.surfaceAlt, 'surfaceAlt — SegmentedControl non sélectionné (filtre membre, périodes), emptyText, archivedNote, planNote, capNote, ContributionBar'],
    ['#F7FCFB', 'carte courante classement (rank) et profil sélectionné (selectedMember) — fond codé en dur'],
    ['#FFFDF5', 'planDetail et disclaimer Pro paywall — fond codé en dur'],
    [COLORS.secondary, 'secondary — disclaimer paywall, section archivées, demoBanner, avertissement classement'],
    ['#EDF8F6', 'NoticeBanner closeText — fond codé en dur'],
    ['#F6FCFA', 'TaskRow — fond codé en dur'],
  ];
  for (const [background, usage] of secondaryBackgrounds) {
    const ratio = contrastRatio(COLORS.textSecondary, background);
    assert.ok(
      ratio >= 4.5,
      `textSecondary ${COLORS.textSecondary} sur ${usage} (${background}) : ${ratio.toFixed(2)}:1 < 4,5:1`,
    );
  }
});

test('l\'ancien jeton textSecondary #457B9D échouait bien le seuil sur surfaceAlt et #F7FCFB : le test détecte une régression', () => {
  // MOB-CYCLE32961708279-SEG : #457B9D sur surfaceAlt = 4,36:1 < 4,5:1 et
  // sur #F7FCFB = 4,43:1 < 4,5:1. Ces deux paires doivent rester sous seuil
  // pour que le test prouve la détection de régression.
  const legacyOnSurfaceAlt = contrastRatio('#457B9D', COLORS.surfaceAlt);
  assert.ok(legacyOnSurfaceAlt < 4.5, `ancien #457B9D sur surfaceAlt devrait être < 4,5:1, mesuré ${legacyOnSurfaceAlt.toFixed(2)}:1`);
  const legacyOnCurrentCard = contrastRatio('#457B9D', '#F7FCFB');
  assert.ok(legacyOnCurrentCard < 4.5, `ancien #457B9D sur #F7FCFB devrait être < 4,5:1, mesuré ${legacyOnCurrentCard.toFixed(2)}:1`);
});
