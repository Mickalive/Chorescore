import { COLORS, RADIUS, SPACING } from './theme';

/**
 * Contrat de mise en page du contrôle segmenté (DRC-05, MOB-C4-F1).
 *
 * Deux modes, une seule source de vérité partagée entre le composant et les
 * tests déterministes (aucun harnais UI dans ce dépôt) :
 *
 * - mode défaut (`wrap: false`) : colonnes égales — comportement historique
 *   conservé à l'identique pour les segments à nombre fixe et court
 *   (période de l'historique, classement, profil) ;
 * - mode repli (`wrap: true`) : les segments gardent leur largeur de contenu
 *   (`flexShrink: 0`, `flexBasis: 'auto'`) et passent à la ligne quand la
 *   place manque — petit écran, grandes tailles de texte ou foyer nombreux.
 *   Aucun segment n'est compressé jusqu'à devenir illisible ou injoignable.
 *
 * La cible tactile minimale (`SEGMENT_MIN_HEIGHT`) et les couleurs sont
 * identiques dans les deux modes : le repli ne dégrade ni contrastes ni
 * frappe, il réorganise seulement la ligne.
 */
export const SEGMENT_MIN_HEIGHT = 42;

export type SegmentContainerStyleEqual = {
  flexDirection: 'row';
  padding: number;
  borderRadius: number;
  backgroundColor: string;
  borderWidth: number;
  borderColor: string;
  gap: number;
};

export type SegmentContainerStyleWrap = SegmentContainerStyleEqual & {
  flexWrap: 'wrap';
};

export type SegmentContainerStyle = SegmentContainerStyleEqual | SegmentContainerStyleWrap;

export type SegmentOptionStyleEqual = {
  flex: number;
  minHeight: number;
  alignItems: 'center';
  justifyContent: 'center';
  paddingHorizontal: number;
  borderRadius: number;
};

export type SegmentOptionStyleWrap = {
  flexGrow: number;
  flexShrink: 0;
  flexBasis: 'auto';
  minHeight: number;
  alignItems: 'center';
  justifyContent: 'center';
  paddingHorizontal: number;
  borderRadius: number;
};

export type SegmentOptionStyle = SegmentOptionStyleEqual | SegmentOptionStyleWrap;

export function getSegmentContainerStyle(wrap: false): SegmentContainerStyleEqual;
export function getSegmentContainerStyle(wrap: true): SegmentContainerStyleWrap;
export function getSegmentContainerStyle(wrap: boolean): SegmentContainerStyle;
export function getSegmentContainerStyle(wrap: boolean): SegmentContainerStyle {
  if (wrap) {
    return {
      flexDirection: 'row',
      flexWrap: 'wrap',
      padding: 4,
      borderRadius: RADIUS.pill,
      backgroundColor: COLORS.surfaceAlt,
      borderWidth: 1,
      borderColor: COLORS.border,
      gap: 4,
    };
  }
  return {
    flexDirection: 'row',
    padding: 4,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 4,
  };
}

export function getSegmentOptionStyle(wrap: false): SegmentOptionStyleEqual;
export function getSegmentOptionStyle(wrap: true): SegmentOptionStyleWrap;
export function getSegmentOptionStyle(wrap: boolean): SegmentOptionStyle;
export function getSegmentOptionStyle(wrap: boolean): SegmentOptionStyle {
  if (wrap) {
    return {
      flexGrow: 1,
      flexShrink: 0,
      flexBasis: 'auto',
      minHeight: SEGMENT_MIN_HEIGHT,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: SPACING.sm,
      borderRadius: RADIUS.pill,
    };
  }
  return {
    flex: 1,
    minHeight: SEGMENT_MIN_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.pill,
  };
}
