/**
 * URL du dashboard web. Utilisée pour rediriger l'utilisateur depuis le mobile
 * vers les flows qui ne sont pas gérés sur mobile (création de compte/orga,
 * facturation, etc.) — l'app mobile reste dédiée au terrain.
 */
export const DASHBOARD_URL =
  process.env.EXPO_PUBLIC_DASHBOARD_URL || 'https://app.getbuildr.fr';

export const DASHBOARD_SIGNUP_URL = `${DASHBOARD_URL}/signup`;
export const DASHBOARD_CREATE_ORG_URL = `${DASHBOARD_URL}/settings?createOrg=1`;
