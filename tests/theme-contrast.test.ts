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
 * Fonds réels de `textMuted` (inventaire du code) :
 * - COLORS.background (#F7F2EB) : fond dominant écran, aides de modales,
 *   pied d'onboarding ;
 * - COLORS.surface (#FFFDF9) : cartes (méta d'entrée, minutes de
 *   l'historique, méta du classement, détail des MetricCard) ;
 * - COLORS.surfaceAlt (#F6F2ED) : note de rétention de l'historique ;
 * - '#F8F4EF' : carte active du chrono (TaskRow) et carte courante du
 *   classement (Score currentCard) ;
 * - '#FFFBF0' : carte Pro du paywall (proCard).
 *
 * Inventaire secondaire de `textSecondary` — tous les fonds réels où
 * `color: COLORS.textSecondary` est rendu dans app/ et src/ :
 * - COLORS.background (#F7F2EB) : ScreenHeader, SectionTitle, HydrationGate ;
 * - COLORS.surface (#FFFDF9) : planCard Standard du paywall, Carte métra
 *   d'entrée, MetricCard, NativeBarChart, ContributionBar track ;
 * - COLORS.surfaceAlt (#F6F2ED) : libellés non sélectionnés du SegmentedControl,
 *   emptyText, archivedNote, capNote, ContributionBar, TaskForm sections ;
 * - '#F8F4EF' : carte active du chrono et carte courante du classement ;
 * - '#FFFBF0' : planDetail et disclaimer du Pro dans PaywallModal ;
 * - COLORS.secondary (#F1FAEE) : disclaimer du PaywallModal, demoBanner ;
 * - '#EFF8F0' : NoticeBanner container ;
 * - '#F8F4EF' : TaskRow active card.
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
    [COLORS.background, 'background — fond dominant écran, aides de modales'],
    [COLORS.surface, 'surface — cartes et barre d\'onglets'],
    [COLORS.surfaceAlt, 'surfaceAlt — note de rétention de l\'historique'],
    ['#F8F4EF', 'carte active du chrono et carte courante du classement'],
    ['#FFFBF0', 'carte Pro du paywall (proCard)'],
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
    [COLORS.background, 'background — ScreenHeader, SectionTitle, HydrationGate'],
    [COLORS.surface, 'surface — planCard, Carte métra, MetricCard, NativeBarChart'],
    [COLORS.surfaceAlt, 'surfaceAlt — SegmentedControl non sélectionné, emptyText, archivedNote, capNote, ContributionBar'],
    ['#F8F4EF', 'carte active chrono et carte courante classement — fond codé en dur'],
    ['#FFFBF0', 'planDetail et disclaimer Pro paywall — fond codé en dur'],
    [COLORS.secondary, 'secondary — disclaimer paywall, demoBanner'],
    ['#EFF8F0', 'NoticeBanner container — fond codé en dur'],
    ['#F8F4EF', 'TaskRow active card — fond codé en dur'],
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

test('DRC-05 : le fond dominant n\'est ni blanc pur ni gris froid — teinte chaude requirement', () => {
  // Vérifie que background n'est ni #FFFFFF (blanc pur) ni #FEFEFE (quasi-blanc)
  // ni aucun gris froid. Le fond doit être teinté pour éviter le blanc dominant.
  const bg = parseHex(COLORS.background);
  // Un fond teinté a au moins une composante chaude (R > B). background pur
  // aurait R=G=B. Ici on exige R > B + 2 pour garantir la teinte chaude.
  assert.ok(
    bg.r > bg.b + 2,
    `background ${COLORS.background} devrait avoir une teinte chaude (R > B), mesuré R=${bg.r} B=${bg.b}`,
  );
  // Le blanc pur ou quasi-pur a R ≥ 254. Notre fond doit être nettement plus foncé.
  assert.ok(
    bg.r < 253,
    `background ${COLORS.background} ne devrait pas être blanc pur (R ≥ 253)`,
  );
});
