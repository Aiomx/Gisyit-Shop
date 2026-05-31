/**
 * Auth Utility Functions (Server-side only)
 * 
 * Provides route protection and user retrieval utilities.
 * 
 * Requirements: 8.4
 * - Redirect to login when session expires
 */

import type { User, Session, SessionCookie, AuthError, AuthErrorCode } from "./types";
import { getUserSession, isSessionExpired } from "./session.server";

// ============================================
// Error Messages
// ============================================

/**
 * User-friendly error messages for auth errors
 */
const authErrorMessages: Record<AuthErrorCode, string> = {
    INVALID_CREDENTIALS: "邮箱或密码错误",
    EMAIL_EXISTS: "该邮箱已被注册",
    WEAK_PASSWORD: "密码强度不足，请使用至少 8 位包含字母和数字的密码",
    SESSION_EXPIRED: "登录已过期，请重新登录",
    UNAUTHORIZED: "请先登录",
    INVALID_SESSION: "会话无效，请重新登录",
    NETWORK_ERROR: "网络连接失败，请稍后重试",
    SERVER_ERROR: "服务器错误，请稍后重试",
};

/**
 * Get user-friendly error message from error code
 */
export function getAuthErrorMessage(code: AuthErrorCode): string {
    return authErrorMessages[code] || authErrorMessages.SERVER_ERROR;
}

/**
 * Create an auth error object
 */
export function createAuthError(
    code: AuthErrorCode,
    details?: unknown
): AuthError {
    return {
        code,
        message: getAuthErrorMessage(code),
        details,
    };
}

// ============================================
// Route Protection
// ============================================

/**
 * Require a valid user session for protected routes
 * Redirects to login if no valid session exists
 * 
 * Requirements 8.4: Redirect to login when session expires
 * 
 * @param request - The incoming request
 * @param redirectTo - URL to redirect to for login (default: /auth/login)
 * @returns Session cookie if valid
 * @throws Response redirect if no valid session
 */
export async function requireUserSession(
    request: Request,
    redirectTo: string = "/auth/login"
): Promise<SessionCookie> {
    const sessionCookie = await getUserSession(request);

    if (!sessionCookie) {
        // No session found, redirect to login
        const url = new URL(request.url);
        const returnTo = url.pathname + url.search;
        const loginUrl = new URL(redirectTo, url.origin);

        // Add return URL as query parameter
        if (returnTo && returnTo !== "/") {
            loginUrl.searchParams.set("returnTo", returnTo);
        }

        throw new Response(null, {
            status: 302,
            headers: {
                Location: loginUrl.toString(),
            },
        });
    }

    // Check if session is expired
    if (isSessionExpired(sessionCookie)) {
        const url = new URL(request.url);
        const loginUrl = new URL(redirectTo, url.origin);
        loginUrl.searchParams.set("expired", "true");

        throw new Response(null, {
            status: 302,
            headers: {
                Location: loginUrl.toString(),
            },
        });
    }

    return sessionCookie;
}

// ============================================
// User Retrieval
// ============================================

/**
 * User info extracted from session
 * This is a minimal representation for display purposes
 */
export type OptionalUserInfo = {
    id: string;
    isLoggedIn: true;
} | {
    id: null;
    isLoggedIn: false;
}

/**
 * Get optional user information from request
 * Returns user info if logged in, or null indicator if not
 * Does NOT redirect - use for pages that work for both logged-in and anonymous users
 * 
 * @param request - The incoming request
 * @returns User info or null indicator
 */
export async function getOptionalUser(
    request: Request
): Promise<OptionalUserInfo> {
    const sessionCookie = await getUserSession(request);

    if (!sessionCookie || isSessionExpired(sessionCookie)) {
        return {
            id: null,
            isLoggedIn: false,
        };
    }

    // In a full implementation, we would decode the JWT to get user info
    // For now, we return a placeholder that indicates logged-in state
    // The actual user ID would come from the JWT payload
    return {
        id: extractUserIdFromToken(sessionCookie.access_token),
        isLoggedIn: true,
    };
}

/**
 * Extract user ID from JWT access token
 * JWT format: header.payload.signature
 * Payload contains 'sub' claim with user ID
 */
function extractUserIdFromToken(accessToken: string): string {
    try {
        const parts = accessToken.split(".");
        if (parts.length !== 3) {
            return "unknown";
        }

        // Decode the payload (base64url)
        const payload = parts[1];
        const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
        const parsed = JSON.parse(decoded);

        return parsed.sub || "unknown";
    } catch {
        return "unknown";
    }
}

/**
 * Extract user email from JWT access token
 * JWT format: header.payload.signature
 * Payload contains 'email' claim with user email
 */
function extractUserEmailFromToken(accessToken: string): string | null {
    try {
        const parts = accessToken.split(".");
        if (parts.length !== 3) {
            return null;
        }

        // Decode the payload (base64url)
        const payload = parts[1];
        const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
        const parsed = JSON.parse(decoded);

        return parsed.email || null;
    } catch {
        return null;
    }
}

/**
 * Get user ID from session cookie
 * Returns null if no valid session
 */
export async function getUserIdFromSession(
    request: Request
): Promise<string | null> {
    const userInfo = await getOptionalUser(request);

    if (!userInfo.isLoggedIn) {
        return null;
    }

    return userInfo.id;
}

/**
 * User info for header display
 * Requirements 4.5: Display account status in header
 */
export type UserHeaderInfo = {
    email: string;
    isLoggedIn: true;
} | {
    email?: undefined;
    isLoggedIn: false;
}

/**
 * Get user info for header display
 * Returns email and login status for UI display
 * Requirements 4.5: Display account status in header
 * 
 * @param request - The incoming request
 * @returns User info for header display
 */
export async function getUserForHeader(
    request: Request
): Promise<UserHeaderInfo> {
    const sessionCookie = await getUserSession(request);

    if (!sessionCookie || isSessionExpired(sessionCookie)) {
        return {
            isLoggedIn: false,
        };
    }

    const email = extractUserEmailFromToken(sessionCookie.access_token);

    if (!email) {
        return {
            isLoggedIn: false,
        };
    }

    return {
        email,
        isLoggedIn: true,
    };
}

// ============================================
// Session Validation
// ============================================

/**
 * Check if request has a valid session
 * Does not redirect, just returns boolean
 */
export async function hasValidSession(request: Request): Promise<boolean> {
    const sessionCookie = await getUserSession(request);

    if (!sessionCookie) {
        return false;
    }

    return !isSessionExpired(sessionCookie);
}

/**
 * Validate password meets requirements
 * Requirements 3.5: Display password requirements
 */
export function validatePassword(password: string): {
    valid: boolean;
    errors: string[];
} {
    const errors: string[] = [];

    if (password.length < 8) {
        errors.push("密码长度至少为 8 位");
    }

    if (!/[a-zA-Z]/.test(password)) {
        errors.push("密码必须包含字母");
    }

    if (!/[0-9]/.test(password)) {
        errors.push("密码必须包含数字");
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

/**
 * Validate email format
 */
export function validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

