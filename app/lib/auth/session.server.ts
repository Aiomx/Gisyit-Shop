/**
 * Session Management (Server-side only)
 * 
 * Handles user session creation, retrieval, and destruction.
 * Uses HTTP-only secure cookies for session storage.
 * 
 * Requirements: 8.2, 8.3
 * - 8.2: Use HTTP-only secure cookies
 * - 8.3: Never expose tokens to client-side JavaScript
 */

import type { Session, SessionCookie, SessionCookieOptions } from "./types";

// ============================================
// Cookie Configuration
// ============================================

/**
 * Cookie name for user session
 */
export const USER_SESSION_COOKIE = "store_user_session";

/**
 * Default cookie options
 * Requirements 8.2: HTTP-only secure cookies
 */
export function getSessionCookieOptions(): SessionCookieOptions {
    return {
        httpOnly: true,  // Requirements 8.2: HTTP-only
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: "/",
    };
}

// ============================================
// Session Cookie Operations
// ============================================

/**
 * Serialize session data to cookie value
 * Only stores tokens, not user data (Requirements 8.3)
 */
export function serializeSessionCookie(session: Session): string {
    const cookieData: SessionCookie = {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at,
    };
    return encodeURIComponent(JSON.stringify(cookieData));
}

/**
 * Parse session cookie from cookie header
 */
export function parseSessionCookie(cookieHeader: string | null): SessionCookie | null {
    if (!cookieHeader) {
        return null;
    }

    try {
        const cookies = parseCookies(cookieHeader);
        const sessionData = cookies[USER_SESSION_COOKIE];

        if (!sessionData) {
            return null;
        }

        const decoded = decodeURIComponent(sessionData);
        const parsed = JSON.parse(decoded) as SessionCookie;

        // Validate session cookie structure
        if (!parsed.access_token || !parsed.refresh_token || !parsed.expires_at) {
            return null;
        }

        return parsed;
    } catch {
        return null;
    }
}

/**
 * Parse cookies from header string
 */
function parseCookies(cookieHeader: string): Record<string, string> {
    const cookies: Record<string, string> = {};

    cookieHeader.split(";").forEach((cookie) => {
        const [name, ...rest] = cookie.trim().split("=");
        if (name && rest.length > 0) {
            cookies[name] = rest.join("=");
        }
    });

    return cookies;
}

// ============================================
// Session Management Functions
// ============================================

/**
 * Create a Set-Cookie header for user session
 * Requirements 8.2: HTTP-only secure cookies
 * 
 * @param session - The session data from Supabase Auth
 * @returns Set-Cookie header value
 */
export function createSessionCookieHeader(session: Session): string {
    const value = serializeSessionCookie(session);
    const options = getSessionCookieOptions();

    const parts = [
        `${USER_SESSION_COOKIE}=${value}`,
        `Path=${options.path}`,
        `Max-Age=${options.maxAge}`,
        `SameSite=${options.sameSite.charAt(0).toUpperCase() + options.sameSite.slice(1)}`,
    ];

    // Requirements 8.2: Always set HttpOnly
    parts.push("HttpOnly");

    if (options.secure) {
        parts.push("Secure");
    }

    return parts.join("; ");
}

/**
 * Create a user session and return a redirect response with session cookie
 * 
 * @param session - The session data from Supabase Auth
 * @param redirectTo - URL to redirect to after session creation
 * @returns Response with Set-Cookie header and redirect
 */
export async function createUserSession(
    session: Session,
    redirectTo: string
): Promise<Response> {
    const cookieHeader = createSessionCookieHeader(session);

    return new Response(null, {
        status: 302,
        headers: {
            Location: redirectTo,
            "Set-Cookie": cookieHeader,
        },
    });
}

/**
 * Get user session from request
 * Returns null if no valid session exists
 * 
 * @param request - The incoming request
 * @returns Session cookie data or null
 */
export async function getUserSession(
    request: Request
): Promise<SessionCookie | null> {
    const cookieHeader = request.headers.get("Cookie");
    const sessionCookie = parseSessionCookie(cookieHeader);

    if (!sessionCookie) {
        return null;
    }

    // Check if session has expired
    const now = Math.floor(Date.now() / 1000);
    if (sessionCookie.expires_at < now) {
        return null;
    }

    return sessionCookie;
}

/**
 * Create a Set-Cookie header to clear the session cookie
 * Requirements 5.3: Clear all session-related data from cookies
 */
export function createClearSessionCookieHeader(): string {
    return `${USER_SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`;
}

/**
 * Destroy user session and return a redirect response
 * Requirements 5.1, 5.3: Terminate session and clear cookies
 * 
 * @param request - The incoming request (for any cleanup needed)
 * @param redirectTo - URL to redirect to after logout (default: homepage)
 * @returns Response with cleared cookie and redirect
 */
export async function destroyUserSession(
    _request: Request,
    redirectTo: string = "/"
): Promise<Response> {
    const clearCookieHeader = createClearSessionCookieHeader();

    return new Response(null, {
        status: 302,
        headers: {
            Location: redirectTo,
            "Set-Cookie": clearCookieHeader,
        },
    });
}

/**
 * Check if a session cookie is expired
 */
export function isSessionExpired(sessionCookie: SessionCookie): boolean {
    const now = Math.floor(Date.now() / 1000);
    return sessionCookie.expires_at < now;
}

/**
 * Get remaining session time in seconds
 */
export function getSessionRemainingTime(sessionCookie: SessionCookie): number {
    const now = Math.floor(Date.now() / 1000);
    return Math.max(0, sessionCookie.expires_at - now);
}

