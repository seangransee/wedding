export const ADMIN_PASSWORD = "__ADMIN_PASSWORD_REMOVED__";
export const ADMIN_COOKIE_NAME = "sexi-admin";
export const GUEST_COOKIE_NAME = "sexi-guest";
export const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365 * 5;

export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  };
}
