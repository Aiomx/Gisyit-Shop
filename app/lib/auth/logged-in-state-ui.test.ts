/**
 * Property-Based Tests for Logged-in State UI
 *
 * **Feature: store-integration, Property 7: Logged-in state reflected in UI**
 * **Validates: Requirements 4.5**
 *
 * These tests verify that for any page request with a valid session,
 * the response includes user information for display in the header.
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { getUserForHeader } from "./auth.server";
import {
    USER_SESSION_COOKIE,
    serializeSessionCookie,
} from "./session.server";
import type { Session, User } from "./types";

// ============================================
// Arbitraries (Generators)
// ============================================

/**
 * Generate a valid email address
 */
const emailArb: fc.Arbitrary<string> = fc.emailAddress();

/**
 * Generate a valid user
 */
const userArb: fc.Arbitrary<User> = fc.record({
    id: fc.uuid(),
    email: emailArb,
    created_at: fc.constant(new Date().toISOString()),
});

/**
 * Generate a valid JWT-like access token with email in payload
 * Format: header.payload.signature (base64url encoded)
 */
const jwtTokenWithEmailArb = (email: string, userId: string): string => {
    const headerB64 = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const payloadB64 = btoa(JSON.stringify({
        sub: userId,
        email: email,
        exp: Math.floor(Date.now() / 1000) + 3600,
    }));
    const signatureB64 = btoa("signature");
    return `${headerB64}.${payloadB64}.${signatureB64}`;
};

/**
 * Generate a valid session with email in JWT
 */
const sessionWithEmailArb: fc.Arbitrary<Session> = fc.record({
    user: userArb,
    refresh_token: fc.string({ minLength: 20, maxLength: 100 }),
    expires_at: fc.integer({
        min: Math.floor(Date.now() / 1000) + 60,
        max: Math.floor(Date.now() / 1000) + 86400 * 30
    }),
}).map(({ user, refresh_token, expires_at }) => ({
    access_token: jwtTokenWithEmailArb(user.email, user.id),
    refresh_token,
    expires_at,
    user,
}));

/**
 * Generate an expired session
 */
const expiredSessionArb: fc.Arbitrary<Session> = fc.record({
    user: userArb,
    refresh_token: fc.string({ minLength: 20, maxLength: 100 }),
    expires_at: fc.integer({
        min: Math.floor(Date.now() / 1000) - 86400,
        max: Math.floor(Date.now() / 1000) - 1
    }),
}).map(({ user, refresh_token, expires_at }) => ({
    access_token: jwtTokenWithEmailArb(user.email, user.id),
    refresh_token,
    expires_at,
    user,
}));

/**
 * Create a mock request with session cookie
 */
function createRequestWithSession(session: Session): Request {
    const cookieValue = serializeSessionCookie(session);
    return new Request("http://localhost/", {
        headers: {
            Cookie: `${USER_SESSION_COOKIE}=${cookieValue}`,
        },
    });
}

/**
 * Create a mock request without session cookie
 */
function createRequestWithoutSession(): Request {
    return new Request("http://localhost/");
}

// ============================================
// Property Tests
// ============================================

describe("Property 7: Logged-in state reflected in UI", () => {
    /**
     * **Feature: store-integration, Property 7: Logged-in state reflected in UI**
     * **Validates: Requirements 4.5**
     *
     * Core property: For any page request with a valid session,
     * the response SHALL include user information for display in the header.
     */
    it("valid session returns user info with email and isLoggedIn true", async () => {
        await fc.assert(
            fc.asyncProperty(sessionWithEmailArb, async (session) => {
                const request = createRequestWithSession(session);
                const userInfo = await getUserForHeader(request);

                // Should be logged in
                if (!userInfo.isLoggedIn) {
                    return false;
                }

                // Should have email matching the session user
                return userInfo.email === session.user.email;
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Request without session returns isLoggedIn false
     * **Validates: Requirements 4.5**
     */
    it("request without session returns isLoggedIn false", async () => {
        const request = createRequestWithoutSession();
        const userInfo = await getUserForHeader(request);

        expect(userInfo.isLoggedIn).toBe(false);
        expect(userInfo.email).toBeUndefined();
    });

    /**
     * Expired session returns isLoggedIn false
     * **Validates: Requirements 4.5**
     */
    it("expired session returns isLoggedIn false", async () => {
        await fc.assert(
            fc.asyncProperty(expiredSessionArb, async (session) => {
                const request = createRequestWithSession(session);
                const userInfo = await getUserForHeader(request);

                // Should NOT be logged in for expired session
                return userInfo.isLoggedIn === false;
            }),
            { numRuns: 100 }
        );
    });

    /**
     * User info email matches the email in the JWT token
     * **Validates: Requirements 4.5**
     */
    it("user info email matches JWT token email", async () => {
        await fc.assert(
            fc.asyncProperty(sessionWithEmailArb, async (session) => {
                const request = createRequestWithSession(session);
                const userInfo = await getUserForHeader(request);

                if (!userInfo.isLoggedIn) {
                    return false;
                }

                // Email should match what was encoded in the JWT
                return userInfo.email === session.user.email;
            }),
            { numRuns: 100 }
        );
    });

    /**
     * UserHeaderInfo type discriminates correctly
     * **Validates: Requirements 4.5**
     */
    it("UserHeaderInfo type discriminates correctly based on isLoggedIn", async () => {
        // Test logged in case
        const validSession: Session = {
            access_token: jwtTokenWithEmailArb("test@example.com", "user-123"),
            refresh_token: "refresh-token",
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            user: {
                id: "user-123",
                email: "test@example.com",
                created_at: new Date().toISOString(),
            },
        };

        const loggedInRequest = createRequestWithSession(validSession);
        const loggedInInfo = await getUserForHeader(loggedInRequest);

        if (loggedInInfo.isLoggedIn) {
            // TypeScript should narrow this to the logged-in variant
            expect(typeof loggedInInfo.email).toBe("string");
            expect(loggedInInfo.email.length).toBeGreaterThan(0);
        } else {
            // This branch should not be reached for valid session
            expect(loggedInInfo.isLoggedIn).toBe(true);
        }

        // Test logged out case
        const loggedOutRequest = createRequestWithoutSession();
        const loggedOutInfo = await getUserForHeader(loggedOutRequest);

        if (!loggedOutInfo.isLoggedIn) {
            // TypeScript should narrow this to the logged-out variant
            expect(loggedOutInfo.email).toBeUndefined();
        } else {
            // This branch should not be reached for no session
            expect(loggedOutInfo.isLoggedIn).toBe(false);
        }
    });

    /**
     * Invalid cookie format returns isLoggedIn false
     * **Validates: Requirements 4.5**
     */
    it("invalid cookie format returns isLoggedIn false", async () => {
        const invalidCookies = [
            "invalid-json",
            "{}",
            '{"access_token":""}',
            '{"access_token":"a.b.c"}', // missing other fields
        ];

        for (const invalidCookie of invalidCookies) {
            const request = new Request("http://localhost/", {
                headers: {
                    Cookie: `${USER_SESSION_COOKIE}=${encodeURIComponent(invalidCookie)}`,
                },
            });

            const userInfo = await getUserForHeader(request);
            expect(userInfo.isLoggedIn).toBe(false);
        }
    });

    /**
     * JWT without email claim returns isLoggedIn false
     * **Validates: Requirements 4.5**
     */
    it("JWT without email claim returns isLoggedIn false", async () => {
        // Create a JWT without email
        const headerB64 = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
        const payloadB64 = btoa(JSON.stringify({
            sub: "user-123",
            // No email field
            exp: Math.floor(Date.now() / 1000) + 3600,
        }));
        const signatureB64 = btoa("signature");
        const tokenWithoutEmail = `${headerB64}.${payloadB64}.${signatureB64}`;

        const session: Session = {
            access_token: tokenWithoutEmail,
            refresh_token: "refresh-token",
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            user: {
                id: "user-123",
                email: "test@example.com",
                created_at: new Date().toISOString(),
            },
        };

        const request = createRequestWithSession(session);
        const userInfo = await getUserForHeader(request);

        // Should return not logged in since email can't be extracted
        expect(userInfo.isLoggedIn).toBe(false);
    });
});
