import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SEGMENT_MIN_HEIGHT,
  getSegmentContainerStyle,
  getSegmentOptionStyle,
} from '../src/components/segmentedLayout.js';
import { COLORS } from '../src/components/theme.js';

/**
 * DRC-05 (MOB-C4-F1) : contrat de mise en page du contrôle segmenté, sans
 * harnais UI (stratégie du dépôt). Le composant consomme exactement ces
 * styles ; le test épingle le repli « passage à la ligne » exigé pour le
 * filtre membre de l'historique sur petit écran et grandes tailles de texte,
 * et verrouille le mode historique « colonnes égales » des autres surfaces.
 */

test('mode défaut : colonnes égales, comportement historique inchangé', () => {
  const container = getSegmentContainerStyle(false);
  assert.equal(container.flexDirection, 'row');
  assert.equal('flexWrap' in container, false);

  const option = getSegmentOptionStyle(false);
  assert.ok('flex' in option);
  // Chaque segment occupe une colonne égale : c'est le rendu d'origine des
  // surfaces à segments fixes (période, classement, profil).
  assert.equal(option.flex, 1);
});

test('repli enveloppant : aucun segment compressé, la ligne se réorganise', () => {
  const container = getSegmentContainerStyle(true);
  // Le conteneur autorise le passage à la ligne au lieu de forcer N colonnes.
  assert.equal(container.flexWrap, 'wrap');

  const option = getSegmentOptionStyle(true);
  // flexShrink 0 + base auto : un segment garde sa largeur de contenu
  // (libellé lisible, cible joignable) et passe à la ligne si la place manque.
  assert.equal(option.flexShrink, 0);
  assert.equal(option.flexBasis, 'auto');
  assert.equal(option.flexGrow, 1);
  assert.equal('flex' in option, false);
});

test('les deux modes partagent cible tactile, couleurs et espacement', () => {
  for (const wrap of [false, true] as const) {
    const container = getSegmentContainerStyle(wrap);
    assert.equal(container.backgroundColor, COLORS.surfaceAlt);
    assert.equal(container.borderColor, COLORS.border);
    assert.equal(container.borderWidth, 1);
    assert.equal(container.gap, 4);

    const option = getSegmentOptionStyle(wrap);
    assert.ok(
      option.minHeight >= SEGMENT_MIN_HEIGHT && SEGMENT_MIN_HEIGHT >= 42,
      `cible tactile insuffisante en mode wrap=${wrap}`,
    );
    assert.ok(option.paddingHorizontal >= 8);
    assert.equal(option.alignItems, 'center');
    assert.equal(option.justifyContent, 'center');
  }
});
