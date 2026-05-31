/**
 * Property-Based Tests for Logout Session Clearing
 *
 * **Feature: store-integration, Property 8: Logout clears session**
 * **Validates: Requirements 5.1, 5.3**
 *
 * These tests verify that logout properly clears all session cookies
 * and terminates the user session.
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
    createClearSessionCookieHeader,
    destroyUserSession,
    USER_SESSION_COOKIE,
    createSessionCookieHeader,
    parseSessionCookie,
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
 */
const jwtTokenArb: fc.Arbitrary<string> = fc.tuple(
    fc.string({ minLength: 10, maxLength: 50 }),
    fc.uuid(),
    fc.string({ minLength: 10, maxLength: 50 })
).map(([header, sub, signature]) => {
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

/**
 * Generate a valid redirect URL path
 */
const redirectPathArb: fc.Arbitrary<string> = fc.oneof(
    fc.constant("/"),
    fc.constant("/home"),
    fc.constant("/products"),
    fc.stringMatching(/^\/[a-z0-9-]{1,20}(\/[a-z0-9-]{1,20})?$/)
);

// ============================================
// Property Tests
// ============================================

describe("Property 8: Logout clears session", () => {
    /**
     * **Feature: store-integration, Property 8: Logout clears session**
     * **Validates: Requirements 5.1, 5.3**
     *
     * Core property: For any logout action, the session SHALL be terminated
     * and all session cookies SHALL be cleared.
     */
    it("clear session cookie header sets Max-Age to 0", () => {
        const clearHeader = createClearSessionCookieHeader();

        // Max-Age=0 causes the browser to immediately delete the cookie
        expect(clearHeader).toContain("Max-Age=0");
    });

    /**
     * Clear session cookie header uses correct cookie name
     * **Validates: Requirements 5.3**
     */
    it("clear session cookie header uses correct cookie name", () => {
        const clearHeader = createClearSessionCookieHeader();

        expect(clearHeader).toContain(`${USER_SESSION_COOKIE}=`);
    });

    /**
     * Clear session cookie header sets empty value
     * **Validates: Requirements 5.3**
     */
    it("clear session cookie header sets empty value", () => {
        const clearHeader = createClearSessionCookieHeader();

        // Cookie should be set to empty value
        expect(clearHeader).toMatch(new RegExp(`^${USER_SESSION_COOKIE}=;`));
    });

    /**
     * Clear session cookie header maintains HttpOnly flag
     * **Validates: Requirements 5.3, 8.2**
     */
    it("clear session cookie header maintains HttpOnly flag", () => {
        const clearHeader = createClearSessionCookieHeader();

        expect(clearHeader.toLowerCase()).toContain("httponly");
    });

    /**
     * Clear session cookie header contains Path directive
     * **Validates: Requirements 5.3**
     */
    it("clear session cookie header contains Path directive", () => {
        const clearHeader = createClearSessionCookieHeader();

        expect(clearHeader).toContain("Path=/");
    });

    /**
     * destroyUserSession returns redirect response
     * **Validates: Requirements 5.2**
     */
    it("destroyUserSession returns redirect response", async () => {
        fc.assert(
            await fc.asyncProperty(redirectPathArb, async (redirectTo) => {
                const request = new Request("http://localhost/auth/logout", {
                    method: "POST",
                });

                const response = await destroyUserSession(request, redirectTo);

                // Should be a redirect response
                return response.status === 302;
            }),
            { numRuns: 100 }
        );
    });

    /**
     * destroyUserSession redirects to specified URL
     * **Validates: Requirements 5.2**
     */
    it("destroyUserSession redirects to specified URL", async () => {
        fc.assert(
            await fc.asyncProperty(redirectPathArb, async (redirectTo) => {
                const request = new Request("http://localhost/auth/logout", {
                    method: "POST",
                });

                const response = await destroyUserSession(request, redirectTo);
                const location = response.headers.get("Location");

                return location === redirectTo;
            }),
            { numRuns: 100 }
        );
    });

    /**
     * destroyUserSession sets clear cookie header
     * **Validates: Requirements 5.3**
     */
    it("destroyUserSession sets clear cookie header", async () => {
        fc.assert(
            await fc.asyncProperty(redirectPathArb, async (redirectTo) => {
                const request = new Request("http://localhost/auth/logout", {
                    method: "POST",
                });

                const response = await destroyUserSession(request, redirectTo);
                const setCookie = response.headers.get("Set-Cookie");

                // Should have Set-Cookie header with Max-Age=0
                return setCookie !== null && setCookie.includes("Max-Age=0");
            }),
            { numRuns: 100 }
        );
    });

    /**
     * destroyUserSession defaults to homepage redirect
     * **Validates: Requirements 5.2**
     */
    it("destroyUserSession defaults to homepage redirect", async () => {
        const request = new Request("http://localhost/auth/logout", {
            method: "POST",
        });

        const response = await destroyUserSession(request);
        const location = response.headers.get("Location");

        expect(location).toBe("/");
    });

    /**
     * After clearing, parsing the cookie returns null
     * **Validates: Requirements 5.3**
     */
    it("cleared cookie cannot be parsed as valid session", () => {
        fc.assert(
            fc.property(sessionArb, (session) => {
                // First create a valid session cookie
                const validCookieHeader = createSessionCookieHeader(session);

                // Then get the clear cookie header
                const clearHeader = createClearSessionCookieHeader();

                // Extract just the cookie value part (before the first semicolon)
                const clearCookieValue = clearHeader.split(";")[0];

                // Parsing the cleared cookie should return null
                const parsed = parseSessionCookie(clearCookieValue);

                return parsed === null;
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Clear cookie header is properly formatted
     * **Validates: Requirements 5.3**
     */
    it("clear cookie header is properly formatted", () => {
        const clearHeader = createClearSessionCookieHeader();

        // Should have multiple parts separated by "; "
        const parts = clearHeader.split("; ");

        // At minimum: name=value, Path, Max-Age, HttpOnly, SameSite
        expect(parts.length).toBeGreaterThanOrEqual(4);
    });

    /**
     * Clear cookie header contains SameSite directive
     * **Validates: Requirements 5.3**
     */
    it("clear cookie header contains SameSite directive", () => {
        const clearHeader = createClearSessionCookieHeader();

        expect(clearHeader.toLowerCase()).toContain("samesite=");
    });
});
