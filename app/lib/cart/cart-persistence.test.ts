/**
 * Property-Based Tests for Cart Persistence Round-Trip
 * 
 * **Feature: store-frontend, Property 5: Cart persistence round-trip**
 * **Validates: Requirements 3.5**
 * 
 * These tests verify that cart data persisted to storage and then retrieved
 * returns an equivalent cart state.
 */

import { describe, it, expect, beforeEach } from "vitest";
import fc from "fast-check";
import type { SessionCartData } from "./types";
import {
    parseCartSession,
    serializeCartSession,
    createCartSession,
    createCartSessionCookie,
    generateSessionId,
} from "./session.server";

// ============================================
// Arbitraries (Generators)
// ============================================

/**
 * Generate a valid session ID (32 alphanumeric characters)
 */
const alphanumericChar = fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split(''));
const sessionIdArb = fc.array(alphanumericChar, { minLength: 32, maxLength: 32 })
    .map(chars => chars.join(''));

/**
 * Generate a valid cart ID (UUID format or null)
 */
const cartIdArb = fc.oneof(
    fc.uuid(),
    fc.constant(null)
);

/**
 * Generate a valid ISO date string
 */
const isoDateArb = fc.integer({ min: 1577836800000, max: 1924905600000 }) // 2020-01-01 to 2030-12-31
    .map(timestamp => new Date(timestamp).toISOString());

/**
 * Generate a valid SessionCartData object
 */
const sessionCartDataArb: fc.Arbitrary<SessionCartData> = fc.record({
    cartId: cartIdArb,
    sessionId: sessionIdArb,
    createdAt: isoDateArb,
});

// ============================================
// Property Tests
// ============================================

describe("Property 5: Cart persistence round-trip", () => {
    /**
     * **Feature: store-frontend, Property 5: Cart persistence round-trip**
     * **Validates: Requirements 3.5**
     * 
     * For any valid SessionCartData, serializing and then parsing
     * should return an equivalent session state.
     */
    it("session serialization round-trip preserves data", () => {
        fc.assert(
            fc.property(
                sessionCartDataArb,
                (session) => {
                    // Serialize the session
                    const serialized = serializeCartSession(session);

                    // Create a mock cookie header with the serialized session
                    const cookieHeader = `store_cart_session=${serialized}`;

                    // Parse the session back
                    const parsed = parseCartSession(cookieHeader);

                    // Verify round-trip preserves all fields
                    expect(parsed).not.toBeNull();
                    expect(parsed!.cartId).toBe(session.cartId);
                    expect(parsed!.sessionId).toBe(session.sessionId);
                    expect(parsed!.createdAt).toBe(session.createdAt);

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Session cookie creation and parsing round-trip
     */
    it("cookie creation and parsing round-trip preserves session data", () => {
        fc.assert(
            fc.property(
                sessionCartDataArb,
                (session) => {
                    // Create a full Set-Cookie header
                    const setCookieHeader = createCartSessionCookie(session);

                    // Extract the cookie value from Set-Cookie header
                    // Format: store_cart_session=<value>; Path=/; HttpOnly; SameSite=Lax; Max-Age=...
                    const cookieValue = setCookieHeader.split(';')[0];

                    // Parse using the cookie value as Cookie header
                    const parsed = parseCartSession(cookieValue);

                    // Verify round-trip preserves all fields
                    expect(parsed).not.toBeNull();
                    expect(parsed!.cartId).toBe(session.cartId);
                    expect(parsed!.sessionId).toBe(session.sessionId);
                    expect(parsed!.createdAt).toBe(session.createdAt);

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * createCartSession generates valid session that can be round-tripped
     */
    it("newly created sessions can be round-tripped", () => {
        fc.assert(
            fc.property(
                cartIdArb,
                (cartId) => {
                    // Create a new session
                    const session = createCartSession(cartId);

                    // Verify session has required fields
                    expect(session.sessionId).toBeDefined();
                    expect(session.sessionId.length).toBe(32);
                    expect(session.createdAt).toBeDefined();
                    expect(session.cartId).toBe(cartId);

                    // Round-trip the session
                    const serialized = serializeCartSession(session);
                    const cookieHeader = `store_cart_session=${serialized}`;
                    const parsed = parseCartSession(cookieHeader);

                    // Verify round-trip
                    expect(parsed).not.toBeNull();
                    expect(parsed!.cartId).toBe(session.cartId);
                    expect(parsed!.sessionId).toBe(session.sessionId);
                    expect(parsed!.createdAt).toBe(session.createdAt);

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Session ID generation produces valid IDs
     */
    it("generated session IDs are valid for round-trip", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 100 }), // Just to run multiple times
                () => {
                    const sessionId = generateSessionId();

                    // Verify session ID format
                    expect(sessionId.length).toBe(32);
                    expect(/^[a-z0-9]+$/.test(sessionId)).toBe(true);

                    // Create session with generated ID
                    const session: SessionCartData = {
                        cartId: null,
                        sessionId,
                        createdAt: new Date().toISOString(),
                    };

                    // Round-trip
                    const serialized = serializeCartSession(session);
                    const cookieHeader = `store_cart_session=${serialized}`;
                    const parsed = parseCartSession(cookieHeader);

                    expect(parsed).not.toBeNull();
                    expect(parsed!.sessionId).toBe(sessionId);

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Parsing null or empty cookie header returns null
     */
    it("parsing null or empty cookie returns null", () => {
        expect(parseCartSession(null)).toBeNull();
        expect(parseCartSession("")).toBeNull();
        expect(parseCartSession("other_cookie=value")).toBeNull();
    });

    /**
     * Parsing invalid JSON returns null
     */
    it("parsing invalid session data returns null", () => {
        expect(parseCartSession("store_cart_session=invalid")).toBeNull();
        expect(parseCartSession("store_cart_session=%7B%7D")).toBeNull(); // Empty object
        expect(parseCartSession("store_cart_session=%7B%22foo%22%3A%22bar%22%7D")).toBeNull(); // Missing sessionId
    });

    /**
     * Multiple cookies in header - correct cookie is parsed
     */
    it("parses correct cookie from multiple cookies", () => {
        fc.assert(
            fc.property(
                sessionCartDataArb,
                (session) => {
                    const serialized = serializeCartSession(session);

                    // Create header with multiple cookies
                    const cookieHeader = `other_cookie=value; store_cart_session=${serialized}; another=test`;

                    const parsed = parseCartSession(cookieHeader);

                    expect(parsed).not.toBeNull();
                    expect(parsed!.sessionId).toBe(session.sessionId);

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Idempotence: Serializing twice produces the same result
     */
    it("serialization is idempotent", () => {
        fc.assert(
            fc.property(
                sessionCartDataArb,
                (session) => {
                    const serialized1 = serializeCartSession(session);
                    const serialized2 = serializeCartSession(session);

                    return serialized1 === serialized2;
                }
            ),
            { numRuns: 100 }
        );
    });
});
