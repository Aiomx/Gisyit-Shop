/**
 * Auth Module Public Exports (Client-safe)
 *
 * This file only exports types and constants that are safe for client-side use.
 * Server-only exports are in index.server.ts
 */

// Types (client-safe)
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

// Constants (client-safe)
export { PASSWORD_REQUIREMENTS } from "./types";
