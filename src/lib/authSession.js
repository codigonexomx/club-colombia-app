export const SESSION_EXPIRES_IN_MS = 14 * 24 * 60 * 60 * 1000;
export const SESSION_MAX_AGE_SECONDS = SESSION_EXPIRES_IN_MS / 1000;

export function getSessionCookieName() {
  return process.env.NODE_ENV === "production" ? "__Host-cc_session" : "cc_session";
}

export function getSelectedRoleCookieName() {
  return process.env.NODE_ENV === "production" ? "__Host-cc_selected_role" : "cc_selected_role";
}

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS
  };
}

export function getSessionCookieNamesToClear() {
  return ["cc_session", "__Host-cc_session", "cc_selected_role", "__Host-cc_selected_role"];
}
