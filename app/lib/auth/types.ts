/**
 * Authentication Type Definitions
 * 
 * Types for user authentication and session management.
 * Based on Supabase Auth integration.
 */

// ============================================
// User Types
// ============================================

/**
 * User information from Supabase Auth
 */
export interface User {
    id: string;
    email: string;
    created_at: string;
}

/**
 * Session data from Supabase Auth
 */
export interface Session {
    access_token: string;
    refresh_token: string;
    expires_at: number;
    user: User;
}

/**
 * Session data stored in cookie
 * Contains only the tokens needed to restore the session
 */
export interface SessionCookie {
    access_token: string;
    refresh_token: string;
    expires_at: number;
}

// ============================================
// Auth Result Types
// ============================================

/**
 * Result of authentication operations
 */
export interface AuthResult {
    user: User | null;
    session: Session | null;
    error: AuthError | null;
}

/**
 * Auth error structure
 */
export interface AuthError {
    code: AuthErrorCode;
    message: string;
    details?: unknown;
}

/**
 * Auth error codes
 */
export type AuthErrorCode =
    | "INVALID_CREDENTIALS"
    | "EMAIL_EXISTS"
    | "WEAK_PASSWORD"
    | "SESSION_EXPIRED"
    | "UNAUTHORIZED"
    | "INVALID_SESSION"
    | "NETWORK_ERROR"
    | "SERVER_ERROR";

// ============================================
// Cookie Configuration
// ============================================

/**
 * Cookie options for session storage
 * Requirements 8.2: HTTP-only secure cookies
 */
export interface SessionCookieOptions {
    httpOnly: boolean;
    secure: boolean;
    sameSite: "lax" | "strict" | "none";
    maxAge: number;
    path: string;
}

// ============================================
// Auth Operation Types
// ============================================

/**
 * Login request data
 */
export interface LoginRequest {
    email: string;
    password: string;
}

/**
 * Registration request data
 */
export interface RegisterRequest {
    email: string;
    password: string;
}

/**
 * Password requirements for validation
 */
export const PASSWORD_REQUIREMENTS = {
    minLength: 8,
    requireLetter: true,
    requireNumber: true,
} as const;

