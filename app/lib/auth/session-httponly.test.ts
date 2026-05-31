/**
 * Property-Based Tests for Session Cookies HTTP-only
 *
 * **Feature: store-integration, Property 13: Session cookies are HTTP-only**
 * **Validates: Requirements 8.2**
 *
 * These tests verify that session cookies are always created with the HttpOnly flag,
 * ensuring that session tokens are never exposed to client-side JavaScript.
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
    createSessionCookieHeader,
    getSessionCookieOptions,
    serializeSessionCookie,
    USER_SESSION_COOKIE,
} from "./session.server";
import type { Session, User } from "./types";

// ============================================
// Arbitraries (Generators)
// ============================================

/**
 * Generate a valid user
 */
const userArb: fc.Arbitrary<User> = fc.record({
    id: fc.uuid(),
    email: fc.emailAddress(),
    created_at: fc.constant(new Date().toISOString()),
});

/**
 * Generate a valid JWT-like access token
 * Format: header.payload.signature (base64url encoded)
 */
const jwtTokenArb: fc.Arbitrary<string> = fc.tuple(
    fc.string({ minLength: 10, maxLength: 50 }),
    fc.uuid(),
    fc.string({ minLength: 10, maxLength: 50 })
).map(([header, sub, signature]) => {
    // Create a simple JWT-like structure
    const headerB64 = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const payloadB64 = btoa(JSON.stringify({ sub, exp: Math.floor(Date.now() / 1000) + 3600 }));
    const signatureB64 = btoa(signature);
    return `${headerB64}.${payloadB64}.${signatureB64}`;
});

/**
 * Generate a valid session
 */
const sessionArb: fc.Arbitrary<Session> = fc.record({
    access_token: jwtTokenArb,
    refresh_token: fc.string({ minLength: 20, maxLength: 100 }),
    expires_at: fc.integer({ min: Math.floor(Date.now() / 1000), max: Math.floor(Date.now() / 1000) + 86400 * 30 }),
    user: userArb,
});

// ============================================
// Property Tests
// ============================================

describe("Property 13: Session cookies are HTTP-only", () => {
    /**
     * **Feature: store-integration, Property 13: Session cookies are HTTP-only**
     * **Validates: Requirements 8.2**
     *
     * Core property: For any session cookie created, the cookie SHALL have httpOnly flag set to true
     */
    it("all session cookies have HttpOnly flag", () => {
        fc.assert(
            fc.property(sessionArb, (session) => {
                const cookieHeader = createSessionCookieHeader(session);

                // The cookie header must contain "HttpOnly" (case-insensitive check)
                const hasHttpOnly = cookieHeader.toLowerCase().includes("httponly");
                return hasHttpOnly;
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Cookie options always specify httpOnly as true
     * **Validates: Requirements 8.2**
     */
    it("cookie options always have httpOnly set to true", () => {
        const options = getSessionCookieOptions();
        expect(options.httpOnly).toBe(true);
    });

    /**
     * Session cookie header contains the correct cookie name
     */
    it("session cookie header uses correct cookie name", () => {
        fc.assert(
            fc.property(sessionArb, (session) => {
                const cookieHeader = createSessionCookieHeader(session);
                return cookieHeader.startsWith(`${USER_SESSION_COOKIE}=`);
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Session cookie header contains Path directive
     */
    it("session cookie header contains Path directive", () => {
        fc.assert(
            fc.property(sessionArb, (session) => {
                const cookieHeader = createSessionCookieHeader(session);
                return cookieHeader.includes("Path=/");
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Session cookie header contains SameSite directive
     */
    it("session cookie header contains SameSite directive", () => {
        fc.assert(
            fc.property(sessionArb, (session) => {
                const cookieHeader = createSessionCookieHeader(session);
                return cookieHeader.toLowerCase().includes("samesite=");
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Session cookie header contains Max-Age directive
     */
    it("session cookie header contains Max-Age directive", () => {
        fc.assert(
            fc.property(sessionArb, (session) => {
                const cookieHeader = createSessionCookieHeader(session);
                return cookieHeader.includes("Max-Age=");
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Serialized session cookie only contains tokens, not user data
     * **Validates: Requirements 8.3** - Never expose tokens to client-side JavaScript
     * (The cookie value itself doesn't contain sensitive user data beyond tokens)
     */
    it("serialized session only contains tokens, not full user object", () => {
        fc.assert(
            fc.property(sessionArb, (session) => {
                const serialized = serializeSessionCookie(session);
                const decoded = decodeURIComponent(serialized);
                const parsed = JSON.parse(decoded);

                // Should have tokens
                const hasAccessToken = "access_token" in parsed;
                const hasRefreshToken = "refresh_token" in parsed;
                const hasExpiresAt = "expires_at" in parsed;

                // Should NOT have full user object (only tokens are stored)
                const hasNoUser = !("user" in parsed);

                return hasAccessToken && hasRefreshToken && hasExpiresAt && hasNoUser;
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Cookie header is properly formatted
     */
    it("cookie header is properly formatted with semicolon separators", () => {
        fc.assert(
            fc.property(sessionArb, (session) => {
                const cookieHeader = createSessionCookieHeader(session);

                // Should have multiple parts separated by "; "
                const parts = cookieHeader.split("; ");

                // At minimum: name=value, Path, Max-Age, SameSite, HttpOnly
                return parts.length >= 5;
            }),
            { numRuns: 100 }
        );
    });

    /**
     * HttpOnly flag is always present regardless of session content
     */
    it("HttpOnly flag is present for any valid session", () => {
        // Test with edge cases
        const edgeCaseSessions: Session[] = [
            {
                access_token: "a.b.c",
                refresh_token: "refresh",
                expires_at: Math.floor(Date.now() / 1000) + 1,
                user: { id: "1", email: "a@b.c", created_at: new Date().toISOString() },
            },
            {
                access_token: "x".repeat(1000) + "." + "y".repeat(1000) + "." + "z".repeat(1000),
                refresh_token: "r".repeat(500),
                expires_at: Math.floor(Date.now() / 1000) + 86400 * 365,
                user: { id: "uuid-long-id", email: "very.long.email@example.com", created_at: new Date().toISOString() },
            },
        ];

        for (const session of edgeCaseSessions) {
            const cookieHeader = createSessionCookieHeader(session);
            expect(cookieHeader.toLowerCase()).toContain("httponly");
        }
    });
});

