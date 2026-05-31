/**
 * Cart Session Management (Server-side only)
 * 
 * Handles cart session for both anonymous and logged-in users.
 * - Anonymous users: Session ID stored in cookie
 * - Logged-in users: User ID from auth (future implementation)
 * 
 * Requirements: 3.2, 3.3
 */

import type { SessionCartData } from "./types";

// Cookie name for cart session
const CART_SESSION_COOKIE = "store_cart_session";

// Session ID length
const SESSION_ID_LENGTH = 32;

/**
 * Generate a random session ID for anonymous users
 */
export function generateSessionId(): string {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < SESSION_ID_LENGTH; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

/**
 * Parse cart session from cookie header
 */
export function parseCartSession(cookieHeader: string | null): SessionCartData | null {
    if (!cookieHeader) {
        return null;
    }

    try {
        const cookies = parseCookies(cookieHeader);
        const sessionData = cookies[CART_SESSION_COOKIE];

        if (!sessionData) {
            return null;
        }

        const decoded = decodeURIComponent(sessionData);
        const parsed = JSON.parse(decoded) as SessionCartData;

        // Validate session data structure
        if (!parsed.sessionId || typeof parsed.sessionId !== "string") {
            return null;
        }

        return parsed;
    } catch {
        return null;
    }
}

/**
 * Create a new cart session
 */
export function createCartSession(cartId: string | null = null): SessionCartData {
    return {
        cartId,
        sessionId: generateSessionId(),
        createdAt: new Date().toISOString(),
    };
}

/**
 * Serialize cart session to cookie value
 */
export function serializeCartSession(session: SessionCartData): string {
    return encodeURIComponent(JSON.stringify(session));
}

/**
 * Create Set-Cookie header for cart session
 */
export function createCartSessionCookie(session: SessionCartData): string {
    const value = serializeCartSession(session);
    const maxAge = 60 * 60 * 24 * 30; // 30 days

    return `${CART_SESSION_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
}

/**
 * Get or create cart session from request
 * Returns existing session or creates a new one
 */
export function getOrCreateCartSession(request: Request): {
    session: SessionCartData;
    isNew: boolean;
} {
    const cookieHeader = request.headers.get("Cookie");
    const existingSession = parseCartSession(cookieHeader);

    if (existingSession) {
        return { session: existingSession, isNew: false };
    }

    return { session: createCartSession(), isNew: true };
}

/**
 * Update cart ID in session
 */
export function updateCartSessionCartId(
    session: SessionCartData,
    cartId: string
): SessionCartData {
    return {
        ...session,
        cartId,
    };
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

/**
 * Get user ID from request (uses auth session)
 * Returns null for anonymous users
 */
export async function getUserIdFromRequest(request: Request): Promise<string | null> {
    // Import dynamically to avoid circular dependencies
    const { getUserIdFromSession } = await import("~/lib/auth/index.server");
    return getUserIdFromSession(request);
}

/**
 * Determine cart identifier based on user state
 * 
 * - Anonymous users: cart is identified by session_id
 * - Logged-in users: returns both user_id and session_id
 * 
 * The session_id is stored in a cookie and persists across page loads.
 * When a user logs in, their user_id is used for order creation.
 */
export async function getCartIdentifier(request: Request): Promise<{
    type: "user" | "session";
    id: string;
    userId: string | null;
    session: SessionCartData;
    isNewSession: boolean;
}> {
    const { session, isNew } = getOrCreateCartSession(request);

    // Try to get user ID from auth session
    const userId = await getUserIdFromRequest(request);

    if (userId) {
        // Logged-in user: return user type with user ID
        return {
            type: "user",
            id: userId,
            userId,
            session,
            isNewSession: isNew,
        };
    }

    // Anonymous user: use session_id
    return {
        type: "session",
        id: session.sessionId,
        userId: null,
        session,
        isNewSession: isNew,
    };
}
