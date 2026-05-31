/**
 * Auth Module Server Exports
 *
 * This file exports server-only authentication functions.
 * Import from "~/lib/auth/index.server" in server-side code (loaders, actions).
 */

// Re-export client-safe types and constants
export type {
    User,
    Session,
    SessionCookie,
    SessionCookieOptions,
    AuthResult,
    AuthError,
    AuthErrorCode,
    LoginRequest,
    RegisterRequest,
} from "./types";

export { PASSWORD_REQUIREMENTS } from "./types";

// Session management (server-side only)
export {
    USER_SESSION_COOKIE,
    getSessionCookieOptions,
    serializeSessionCookie,
    parseSessionCookie,
    createSessionCookieHeader,
    createUserSession,
    getUserSession,
    createClearSessionCookieHeader,
    destroyUserSession,
    isSessionExpired,
    getSessionRemainingTime,
} from "./session.server";

// Auth utilities (server-side only)
export {
    getAuthErrorMessage,
    createAuthError,
    requireUserSession,
    getOptionalUser,
    getUserIdFromSession,
    getUserForHeader,
    hasValidSession,
    validatePassword,
    validateEmail,
} from "./auth.server";

export type { OptionalUserInfo, UserHeaderInfo } from "./auth.server";

// Auth service (server-side only)
export { registerUser, loginUser, logoutUser } from "./auth-service.server";

// Registration types (server-side only)
export type { RegistrationResult } from "./registration.server";
