export const COLORS = {
  primary: '#A8DADC',
  secondary: '#F1FAEE',
  accent: '#E9C46A',
  success: '#2A9D8F',
  warning: '#F4A261',
  error: '#E76F51',
  background: '#FEFEFE',
  surface: '#FFFFFF',
  surfaceAlt: '#F8F9FA',
  textPrimary: '#264653',
  textSecondary: '#457B9D',
  // DRC-05 (passe contraste textMuted, directives/TASKS.json) : jeton central
  // ajusté pour atteindre ≥ 4,5:1 (AA) sur chaque fond réellement employé —
  // background #FEFEFE ≈ 5,20:1, surface #FFFFFF ≈ 5,24:1, surfaceAlt
  // #F8F9FA ≈ 4,98:1, la carte courante du classement #F7FCFB ≈ 5,06:1 et la
  // carte Pro du paywall #FFFDF5 (fond codé en dur hors jetons, candidat à
  // une future tokenisation) ≈ 5,15:1 (l'ancien #6D8793 plafonnait à
  // ≈ 3,76:1). Mesure vérifiée de façon déterministe par
  // tests/theme-contrast.test.ts.
  textMuted: '#56707C',
  textDisabled: '#9BAEB7',
  border: '#DCE7EA',
  shadow: '#264653',
} as const;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const RADIUS = {
  sm: 10,
  md: 16,
  lg: 24,
  pill: 999,
} as const;
