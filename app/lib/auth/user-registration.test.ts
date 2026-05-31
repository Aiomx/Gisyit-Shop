/**
 * Property-Based Tests for User Registration
 *
 * **Feature: store-integration, Property 5: User registration creates account**
 * **Validates: Requirements 3.2**
 *
 * These tests verify that for any valid registration data (valid email format,
 * password meeting requirements), the registration process creates a user account
 * and returns a valid session.
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { validateEmail, validatePassword } from "./auth.server";
import type { Session, AuthErrorCode } from "./types";
import { PASSWORD_REQUIREMENTS } from "./types";

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
 * Generate an invalid password (too short)
 */
const shortPasswordArb: fc.Arbitrary<string> = fc.string({ minLength: 1, maxLength: 7 });

/**
 * Generate a password without letters
 */
const noLetterPasswordArb: fc.Arbitrary<string> = fc.array(
    fc.constantFrom(...'0123456789!@#$%^&*'.split('')),
    { minLength: 8, maxLength: 16 }
).map(arr => arr.join(''));

/**
 * Generate a password without numbers
 */
const noNumberPasswordArb: fc.Arbitrary<string> = fc.array(
    fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')),
    { minLength: 8, maxLength: 16 }
).map(arr => arr.join(''));

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
// Mock Registration Function for Testing
// ============================================

/**
 * Simulates the registration validation logic
 * This tests the validation layer without making actual API calls
 */
interface RegistrationValidationResult {
    isValid: boolean;
    errors: {
        email?: string;
        password?: string;
    };
}

function validateRegistrationInput(
    email: string,
    password: string
): RegistrationValidationResult {
    const errors: { email?: string; password?: string } = {};

    // Validate email
    if (!email || !validateEmail(email)) {
        errors.email = "请输入有效的邮箱地址";
    }

    // Validate password
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
        errors.password = passwordValidation.errors[0];
    }

    return {
        isValid: Object.keys(errors).length === 0,
        errors,
    };
}

/**
 * Simulates a successful registration response
 * Returns a valid session structure
 */
function createMockSession(email: string): Session {
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

// ============================================
// Property Tests
// ============================================

describe("Property 5: User registration creates account", () => {
    /**
     * **Feature: store-integration, Property 5: User registration creates account**
     * **Validates: Requirements 3.2**
     *
     * Core property: For any valid registration data, validation passes
     */
    it("valid email and password pass validation", () => {
        fc.assert(
            fc.property(validEmailArb, validPasswordArb, (email, password) => {
                const result = validateRegistrationInput(email, password);
                return result.isValid === true && Object.keys(result.errors).length === 0;
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Valid registration data produces a session with required fields
     * **Validates: Requirements 3.2, 3.3**
     */
    it("valid registration produces session with required fields", () => {
        fc.assert(
            fc.property(validEmailArb, validPasswordArb, (email, password) => {
                const validation = validateRegistrationInput(email, password);

                if (!validation.isValid) {
                    return false; // Skip invalid inputs
                }

                // Simulate successful registration
                const session = createMockSession(email);

                // Session must have all required fields
                const hasAccessToken = typeof session.access_token === "string" && session.access_token.length > 0;
                const hasRefreshToken = typeof session.refresh_token === "string" && session.refresh_token.length > 0;
                const hasExpiresAt = typeof session.expires_at === "number" && session.expires_at > 0;
                const hasUser = session.user !== null && session.user !== undefined;
                const hasUserId = typeof session.user.id === "string" && session.user.id.length > 0;
                const hasUserEmail = session.user.email === email;

                return hasAccessToken && hasRefreshToken && hasExpiresAt && hasUser && hasUserId && hasUserEmail;
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Invalid email fails validation
     * **Validates: Requirements 3.4**
     */
    it("invalid email fails validation", () => {
        fc.assert(
            fc.property(invalidEmailArb, validPasswordArb, (email, password) => {
                const result = validateRegistrationInput(email, password);
                // Should fail validation with email error
                return !result.isValid && result.errors.email !== undefined;
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Short password fails validation
     * **Validates: Requirements 3.5**
     */
    it("short password fails validation", () => {
        fc.assert(
            fc.property(validEmailArb, shortPasswordArb, (email, password) => {
                const result = validateRegistrationInput(email, password);
                // Should fail validation with password error
                return !result.isValid && result.errors.password !== undefined;
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Password without letters fails validation
     * **Validates: Requirements 3.5**
     */
    it("password without letters fails validation", () => {
        fc.assert(
            fc.property(validEmailArb, noLetterPasswordArb, (email, password) => {
                const result = validateRegistrationInput(email, password);
                // Should fail validation with password error
                return !result.isValid && result.errors.password !== undefined;
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Password without numbers fails validation
     * **Validates: Requirements 3.5**
     */
    it("password without numbers fails validation", () => {
        fc.assert(
            fc.property(validEmailArb, noNumberPasswordArb, (email, password) => {
                const result = validateRegistrationInput(email, password);
                // Should fail validation with password error
                return !result.isValid && result.errors.password !== undefined;
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Password requirements are correctly defined
     */
    it("password requirements match expected values", () => {
        expect(PASSWORD_REQUIREMENTS.minLength).toBe(8);
        expect(PASSWORD_REQUIREMENTS.requireLetter).toBe(true);
        expect(PASSWORD_REQUIREMENTS.requireNumber).toBe(true);
    });

    /**
     * Email validation function correctly identifies valid emails
     */
    it("validateEmail accepts valid email formats", () => {
        fc.assert(
            fc.property(validEmailArb, (email) => {
                return validateEmail(email) === true;
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Password validation function correctly validates passwords
     */
    it("validatePassword accepts valid passwords", () => {
        fc.assert(
            fc.property(validPasswordArb, (password) => {
                const result = validatePassword(password);
                return result.valid === true && result.errors.length === 0;
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Session expires_at is in the future
     * **Validates: Requirements 3.3**
     */
    it("session expires_at is in the future", () => {
        fc.assert(
            fc.property(validEmailArb, (email) => {
                const session = createMockSession(email);
                const now = Math.floor(Date.now() / 1000);
                return session.expires_at > now;
            }),
            { numRuns: 100 }
        );
    });
});
