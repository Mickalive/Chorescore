import assert from 'node:assert/strict';
import test from 'node:test';
import { COLORS } from '../src/components/theme.js';

/**
 * DRC-05 (contraste textMuted) : mesure WCAG 2.x déterministe des paires
 * texte/fond réellement employées par l'application. Le calcul est implémenté
 * ici (luminance relative + ratio) afin qu toute évolution du jeton central
 * `theme.ts` soit validée contre le seuil AA 4,5:1 sans outil externe.
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
