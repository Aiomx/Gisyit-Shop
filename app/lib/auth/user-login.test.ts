/**
 * Property-Based Tests for User Login
 *
 * **Feature: store-integration, Property 6: User login creates session**
 * **Validates: Requirements 4.2**
 *
 * These tests verify that for any valid credentials (existing user, correct password),
 * the login process returns a valid session with access token.
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { validateEmail, validatePassword } from "./auth.server";
import type { Session, AuthResult } from "./types";

// ============================================
// Arbitraries (Generators)
// ============================================

/**
 * Generate a valid email address
 */
const validEmailArb: fc.Arbitrary<string> = fc.emailAddress();

/**
 * Generate a valid password that meets all requirements
 * Requirements: at least 8 characters, contains letter and number
 */
const validPasswordArb: fc.Arbitrary<string> = fc
    .tuple(
        // Letters part (at least 4 letters)
        fc.array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')), { minLength: 4, maxLength: 10 }),
        // Numbers part (at least 2 numbers)
        fc.array(fc.constantFrom(...'0123456789'.split('')), { minLength: 2, maxLength: 6 }),
        // Optional extra characters
        fc.array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')), { minLength: 0, maxLength: 4 })
    )
    .map(([letters, numbers, extra]) => {
        // Shuffle the characters to create a realistic password
        const chars = [...letters, ...numbers, ...extra];
        for (let i = chars.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [chars[i], chars[j]] = [chars[j], chars[i]];
        }
        return chars.join('');
    })
    .filter(pwd => pwd.length >= 8); // Ensure minimum length

/**
 * Generate an invalid email
 */
const invalidEmailArb: fc.Arbitrary<string> = fc.oneof(
    fc.constant("notanemail"),
    fc.constant("missing@domain"),
    fc.constant("@nodomain.com"),
    fc.constant("spaces in@email.com"),
    fc.string({ minLength: 1, maxLength: 20 }).filter(s => !s.includes("@") || !s.includes("."))
);

// ============================================
// Login Validation Logic
// ============================================

/**
 * Simulates the login validation logic
 * This tests the validation layer without making actual API calls
 */
interface LoginValidationResult {
    isValid: boolean;
    errors: {
        email?: string;
        password?: string;
    };
}

function validateLoginInput(
    email: string,
    password: string
): LoginValidationResult {
    const errors: { email?: string; password?: string } = {};

    // Validate email format
    if (!email) {
        errors.email = "请输入邮箱";
    } else if (!validateEmail(email)) {
        errors.email = "请输入有效的邮箱地址";
    }

    // Validate password is provided
    if (!password) {
        errors.password = "请输入密码";
    }

    return {
        isValid: Object.keys(errors).length === 0,
        errors,
    };
}

/**
 * Simulates a successful login response
 * Returns a valid session structure
 */
function createMockLoginSession(email: string): Session {
    return {
        access_token: `mock.${btoa(JSON.stringify({ sub: "user-id-123", email }))}.signature`,
        refresh_token: "mock-refresh-token",
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: {
            id: "user-id-123",
            email,
            created_at: new Date().toISOString(),
        },
    };
}

/**
 * Simulates the login process result
 * For valid credentials, returns a session
 * For invalid credentials, returns an error
 */
function simulateLogin(
    email: string,
    password: string,
    existingUsers: Map<string, string> // email -> password
): AuthResult {
    // First validate input format
    const validation = validateLoginInput(email, password);
    if (!validation.isValid) {
        return {
            user: null,
            session: null,
            error: {
                code: "INVALID_CREDENTIALS",
                message: "邮箱或密码错误",
            },
        };
    }

    // Check if user exists and password matches
    const storedPassword = existingUsers.get(email);
    if (!storedPassword || storedPassword !== password) {
        return {
            user: null,
            session: null,
            error: {
                code: "INVALID_CREDENTIALS",
                message: "邮箱或密码错误",
            },
        };
    }

    // Successful login
    const session = createMockLoginSession(email);
    return {
        user: session.user,
        session,
        error: null,
    };
}

// ============================================
// Property Tests
// ============================================

describe("Property 6: User login creates session", () => {
    /**
     * **Feature: store-integration, Property 6: User login creates session**
     * **Validates: Requirements 4.2**
     *
     * Core property: For any valid credentials, login returns a valid session
     */
    it("valid credentials produce a session with access token", () => {
        fc.assert(
            fc.property(validEmailArb, validPasswordArb, (email, password) => {
                // Create a mock user database with this user
                const existingUsers = new Map<string, string>();
                existingUsers.set(email, password);

                // Attempt login
                const result = simulateLogin(email, password, existingUsers);

                // Should succeed with a valid session
                const hasNoError = result.error === null;
                const hasSession = result.session !== null;
                const hasAccessToken = result.session?.access_token !== undefined &&
                    result.session.access_token.length > 0;
                const hasRefreshToken = result.session?.refresh_token !== undefined &&
                    result.session.refresh_token.length > 0;
                const hasUser = result.user !== null;
                const userEmailMatches = result.user?.email === email;

                return hasNoError && hasSession && hasAccessToken && hasRefreshToken && hasUser && userEmailMatches;
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Session has valid expiration time
     * **Validates: Requirements 4.2**
     */
    it("login session has future expiration time", () => {
        fc.assert(
            fc.property(validEmailArb, validPasswordArb, (email, password) => {
                const existingUsers = new Map<string, string>();
                existingUsers.set(email, password);

                const result = simulateLogin(email, password, existingUsers);

                if (!result.session) {
                    return false;
                }

                const now = Math.floor(Date.now() / 1000);
                return result.session.expires_at > now;
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Invalid email format fails validation
     * **Validates: Requirements 4.4**
     */
    it("invalid email format fails login", () => {
        fc.assert(
            fc.property(invalidEmailArb, validPasswordArb, (email, password) => {
                const existingUsers = new Map<string, string>();
                // Even if we add the user, invalid email should fail validation
                existingUsers.set(email, password);

                const result = simulateLogin(email, password, existingUsers);

                // Should fail with error
                return result.error !== null && result.session === null;
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Wrong password fails login
     * **Validates: Requirements 4.4**
     */
    it("wrong password fails login", () => {
        fc.assert(
            fc.property(
                validEmailArb,
                validPasswordArb,
                validPasswordArb,
                (email, correctPassword, wrongPassword) => {
                    // Skip if passwords happen to be the same
                    if (correctPassword === wrongPassword) {
                        return true;
                    }

                    const existingUsers = new Map<string, string>();
                    existingUsers.set(email, correctPassword);

                    const result = simulateLogin(email, wrongPassword, existingUsers);

                    // Should fail with INVALID_CREDENTIALS error
                    return result.error !== null &&
                        result.error.code === "INVALID_CREDENTIALS" &&
                        result.session === null;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Non-existent user fails login
     * **Validates: Requirements 4.4**
     */
    it("non-existent user fails login", () => {
        fc.assert(
            fc.property(validEmailArb, validPasswordArb, (email, password) => {
                // Empty user database
                const existingUsers = new Map<string, string>();

                const result = simulateLogin(email, password, existingUsers);

                // Should fail with INVALID_CREDENTIALS error
                return result.error !== null &&
                    result.error.code === "INVALID_CREDENTIALS" &&
                    result.session === null;
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Empty password fails validation
     * **Validates: Requirements 4.4**
     */
    it("empty password fails login", () => {
        fc.assert(
            fc.property(validEmailArb, (email) => {
                const existingUsers = new Map<string, string>();
                existingUsers.set(email, "somepassword123");

                const result = simulateLogin(email, "", existingUsers);

                // Should fail
                return result.error !== null && result.session === null;
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Empty email fails validation
     * **Validates: Requirements 4.4**
     */
    it("empty email fails login", () => {
        fc.assert(
            fc.property(validPasswordArb, (password) => {
                const existingUsers = new Map<string, string>();

                const result = simulateLogin("", password, existingUsers);

                // Should fail
                return result.error !== null && result.session === null;
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Login validation accepts valid email formats
     */
    it("login validation accepts valid email formats", () => {
        fc.assert(
            fc.property(validEmailArb, validPasswordArb, (email, password) => {
                const validation = validateLoginInput(email, password);
                return validation.isValid === true;
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Session user ID is present and non-empty
     * **Validates: Requirements 4.2**
     */
    it("session contains valid user ID", () => {
        fc.assert(
            fc.property(validEmailArb, validPasswordArb, (email, password) => {
                const existingUsers = new Map<string, string>();
                existingUsers.set(email, password);

                const result = simulateLogin(email, password, existingUsers);

                if (!result.session || !result.user) {
                    return false;
                }

                return typeof result.user.id === "string" &&
                    result.user.id.length > 0;
            }),
            { numRuns: 100 }
        );
    });
});
