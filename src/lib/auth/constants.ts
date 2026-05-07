export const AUTH_COOKIE_NAME = "warehouse_admin_token";
export const AUTH_EXPIRES_IN = 60 * 60 * 24 * 7; // 7 days

export function shouldUseSecureAuthCookie() {
  return process.env.APP_URL?.startsWith("https://") ?? process.env.NODE_ENV === "production";
}
