/**
 * Property-Based Tests for CDK Code Validation
 *
 * Tests for Requirements 2.1, 2.2, 2.3, 2.4:
 * - Property 4: Regex Validation Correctness
 * - Property 5: Default Validation Acceptance
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { validateCode } from "./utils";

// ============================================
// Arbitraries (Generators)
// ============================================

/**
 * Generate a valid CDK code string (non-empty, alphanumeric with dashes)
 */
const cdkCodeArb = fc
    .array(fc.constantFrom(..."ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-".split("")), {
        minLength: 1,
        maxLength: 30,
    })
    .map((chars) => chars.join(""));

/**
 * Generate a non-empty trimmed string (any printable characters except newlines)
 */
const nonEmptyTrimmedStringArb = fc
    .array(fc.constantFrom(..."ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_!@#$%^&*()".split("")), {
        minLength: 1,
        maxLength: 50,
    })
    .map((chars) => chars.join("").trim())
    .filter((s) => s.length > 0);

/**
 * Generate optional whitespace (spaces/tabs)
 */
const whitespaceArb = fc
    .array(fc.constantFrom(" ", "\t"), { minLength: 0, maxLength: 3 })
    .map((chars) => chars.join(""));

/**
 * Generate a code with optional surrounding whitespace
 */
const codeWithWhitespaceArb = fc
    .tuple(whitespaceArb, cdkCodeArb, whitespaceArb)
    .map(([before, code, after]) => before + code + after);

/**
 * Generate a simple regex pattern that matches alphanumeric codes
 * We use patterns that are guaranteed to be valid regex
 */
const simplePatternArb = fc.constantFrom(
    "^[A-Z0-9]+$",           // All uppercase alphanumeric
    "^[A-Z0-9-]+$",          // Uppercase alphanumeric with dashes
    "^[A-Za-z0-9]+$",        // Mixed case alphanumeric
    "^STEAM-[A-Z0-9]+$",     // Steam-style codes
    "^[A-Z]{4}-[A-Z]{4}$",   // 4-4 format
    "^.+$",                  // Any non-empty string
);

// ============================================
// Property Tests
// ============================================

describe("Property 4: Regex Validation Correctness", () => {
    /**
     * **Feature: cdk-auto-delivery, Property 4: Regex Validation Correctness**
     * **Validates: Requirements 2.1, 2.2, 2.3**
     *
     * For any CDK code and regex pattern, the validation result should match
     * the JavaScript RegExp.test() result. Codes matching the pattern should
     * be accepted with available status; non-matching codes should be rejected.
     */
    it("validation result matches RegExp.test() for valid patterns", () => {
        fc.assert(
            fc.property(
                cdkCodeArb,
                simplePatternArb,
                (code, pattern) => {
                    const result = validateCode(code, pattern);
                    const regex = new RegExp(pattern);
                    const expectedMatch = regex.test(code);

                    if (expectedMatch) {
                        // Code matches pattern - should be valid
                        expect(result.valid).toBe(true);
                        expect(result.normalizedCode).toBe(code.trim());
                        expect(result.error).toBeUndefined();
                    } else {
                        // Code doesn't match pattern - should be invalid
                        expect(result.valid).toBe(false);
                        expect(result.error).toBeDefined();
                    }

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Codes matching the pattern are accepted
     * Requirements: 2.2
     */
    it("accepts codes that match the configured pattern", () => {
        fc.assert(
            fc.property(
                // Generate codes that will match ^[A-Z0-9]+$ pattern
                fc.array(fc.constantFrom(..."ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".split("")), {
                    minLength: 1,
                    maxLength: 20,
                }).map((chars) => chars.join("")),
                (code) => {
                    const pattern = "^[A-Z0-9]+$";
                    const result = validateCode(code, pattern);

                    expect(result.valid).toBe(true);
                    expect(result.normalizedCode).toBe(code);

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Codes not matching the pattern are rejected
     * Requirements: 2.3
     */
    it("rejects codes that do not match the configured pattern", () => {
        fc.assert(
            fc.property(
                // Generate codes with lowercase letters (won't match ^[A-Z0-9]+$)
                fc.array(fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz".split("")), {
                    minLength: 1,
                    maxLength: 20,
                }).map((chars) => chars.join("")),
                (code) => {
                    const pattern = "^[A-Z0-9]+$"; // Only uppercase
                    const result = validateCode(code, pattern);

                    expect(result.valid).toBe(false);
                    expect(result.error).toBeDefined();
                    expect(result.error).toContain("does not match pattern");

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Whitespace is trimmed before validation
     */
    it("trims whitespace before validating against pattern", () => {
        fc.assert(
            fc.property(
                codeWithWhitespaceArb,
                (codeWithWhitespace) => {
                    const pattern = "^[A-Z0-9-]+$";
                    const result = validateCode(codeWithWhitespace, pattern);
                    const trimmedCode = codeWithWhitespace.trim();

                    // The trimmed code should be validated
                    const regex = new RegExp(pattern);
                    const expectedMatch = regex.test(trimmedCode);

                    expect(result.valid).toBe(expectedMatch);
                    if (result.valid) {
                        expect(result.normalizedCode).toBe(trimmedCode);
                    }

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });
});

describe("Property 5: Default Validation Acceptance", () => {
    /**
     * **Feature: cdk-auto-delivery, Property 5: Default Validation Acceptance**
     * **Validates: Requirements 2.4**
     *
     * For any non-empty trimmed string, when no regex pattern is configured,
     * the string should be accepted as a valid CDK code.
     */
    it("accepts any non-empty trimmed string when no pattern is configured", () => {
        fc.assert(
            fc.property(
                nonEmptyTrimmedStringArb,
                (code) => {
                    // No pattern provided
                    const result = validateCode(code, undefined);

                    expect(result.valid).toBe(true);
                    expect(result.normalizedCode).toBe(code.trim());

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Empty pattern is treated as no pattern
     */
    it("treats empty pattern as no pattern configured", () => {
        fc.assert(
            fc.property(
                nonEmptyTrimmedStringArb,
                fc.constantFrom("", "   ", "\t"),
                (code, emptyPattern) => {
                    const result = validateCode(code, emptyPattern);

                    expect(result.valid).toBe(true);
                    expect(result.normalizedCode).toBe(code.trim());

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Empty codes are always rejected
     */
    it("rejects empty codes regardless of pattern", () => {
        fc.assert(
            fc.property(
                fc.constantFrom("", "   ", "\t\t", "  \t  "),
                fc.option(simplePatternArb, { nil: undefined }),
                (emptyCode, pattern) => {
                    const result = validateCode(emptyCode, pattern);

                    expect(result.valid).toBe(false);
                    expect(result.error).toBe("Code cannot be empty");

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Codes with only whitespace are rejected
     */
    it("rejects whitespace-only codes", () => {
        const whitespaceOnlyArb = fc
            .array(fc.constantFrom(" ", "\t"), { minLength: 1, maxLength: 10 })
            .map((chars) => chars.join(""));

        fc.assert(
            fc.property(whitespaceOnlyArb, (whitespaceCode) => {
                const result = validateCode(whitespaceCode);

                expect(result.valid).toBe(false);
                expect(result.error).toBe("Code cannot be empty");

                return true;
            }),
            { numRuns: 100 }
        );
    });
});

// ============================================
// Edge Cases
// ============================================

describe("CDK Validation Edge Cases", () => {
    /**
     * Invalid regex patterns are handled gracefully
     */
    it("handles invalid regex patterns gracefully", () => {
        const invalidPatterns = ["[", "(", "\\", "*", "+?", "(?<"];

        for (const pattern of invalidPatterns) {
            const result = validateCode("VALID-CODE", pattern);
            expect(result.valid).toBe(false);
            expect(result.error).toContain("Invalid regex pattern");
        }
    });

    /**
     * Special regex characters in codes are handled correctly
     */
    it("validates codes with special characters correctly", () => {
        // Pattern that allows special characters
        const pattern = "^.+$";

        const specialCodes = ["CODE.WITH.DOTS", "CODE+PLUS", "CODE*STAR"];

        for (const code of specialCodes) {
            const result = validateCode(code, pattern);
            expect(result.valid).toBe(true);
            expect(result.normalizedCode).toBe(code);
        }
    });

    /**
     * Case sensitivity is respected
     */
    it("respects case sensitivity in patterns", () => {
        const uppercasePattern = "^[A-Z]+$";
        const lowercasePattern = "^[a-z]+$";

        expect(validateCode("UPPERCASE", uppercasePattern).valid).toBe(true);
        expect(validateCode("uppercase", uppercasePattern).valid).toBe(false);

        expect(validateCode("lowercase", lowercasePattern).valid).toBe(true);
        expect(validateCode("LOWERCASE", lowercasePattern).valid).toBe(false);
    });
});
