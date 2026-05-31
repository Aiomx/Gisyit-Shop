/**
 * Property-Based Tests for AI Response Sanitization
 *
 * **Feature: brand-management, Property 14: AI Response Sanitization**
 * **Validates: Requirements 6.4**
 *
 * These tests verify that:
 * - AI responses do not contain API keys
 * - AI responses do not contain internal system paths
 * - AI responses do not contain other sensitive information
 * - Sanitization removes all sensitive patterns
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
    sanitizeAIResponse,
    containsSensitiveInfo,
} from "./ai-search.server";

// ============================================
// Sensitive Pattern Generators
// ============================================

/**
 * Generate API key patterns
 */
const apiKeyArb = fc.oneof(
    // sk-xxx pattern (OpenAI, Stripe, etc.)
    fc.stringMatching(/^sk[-_][a-zA-Z0-9]{20,40}$/),
    // api_key=xxx pattern
    fc.tuple(
        fc.constantFrom("api_key", "apiKey", "API_KEY"),
        fc.constantFrom("=", ": "),
        fc.stringMatching(/^[a-zA-Z0-9-_]{10,40}$/)
    ).map(([key, sep, value]) => `${key}${sep}${value}`),
    // secret=xxx pattern
    fc.tuple(
        fc.constantFrom("secret", "SECRET"),
        fc.constantFrom("=", ": "),
        fc.stringMatching(/^[a-zA-Z0-9-_]{10,40}$/)
    ).map(([key, sep, value]) => `${key}${sep}${value}`),
    // password=xxx pattern
    fc.tuple(
        fc.constantFrom("password", "PASSWORD"),
        fc.constantFrom("=", ": "),
        fc.stringMatching(/^[^\s]{5,20}$/)
    ).map(([key, sep, value]) => `${key}${sep}${value}`),
    // token=xxx pattern
    fc.tuple(
        fc.constantFrom("token", "TOKEN"),
        fc.constantFrom("=", ": "),
        fc.stringMatching(/^[a-zA-Z0-9-_.]{10,40}$/)
    ).map(([key, sep, value]) => `${key}${sep}${value}`)
);

/**
 * Generate internal path patterns
 */
const internalPathArb = fc.oneof(
    // Unix paths
    fc.tuple(
        fc.constantFrom("/app/lib/", "/home/user/", "/var/www/"),
        fc.stringMatching(/^[a-zA-Z0-9/_.-]{5,30}$/)
    ).map(([prefix, path]) => `${prefix}${path}`),
    // Windows paths
    fc.tuple(
        fc.constantFrom("C:\\Users\\", "C:\\Program Files\\", "D:\\Projects\\"),
        fc.stringMatching(/^[a-zA-Z0-9\\_.-]{5,30}$/)
    ).map(([prefix, path]) => `${prefix}${path}`)
);

/**
 * Generate database connection string patterns
 */
const dbConnectionArb = fc.oneof(
    fc.tuple(
        fc.constantFrom("postgres://", "postgresql://"),
        fc.stringMatching(/^[a-zA-Z0-9:@._-]{10,50}$/)
    ).map(([prefix, conn]) => `${prefix}${conn}`),
    fc.tuple(
        fc.constant("mysql://"),
        fc.stringMatching(/^[a-zA-Z0-9:@._-]{10,50}$/)
    ).map(([prefix, conn]) => `${prefix}${conn}`),
    fc.tuple(
        fc.constantFrom("mongodb://", "mongodb+srv://"),
        fc.stringMatching(/^[a-zA-Z0-9:@._-]{10,50}$/)
    ).map(([prefix, conn]) => `${prefix}${conn}`)
);

/**
 * Generate environment variable patterns
 */
const envVarArb = fc.oneof(
    fc.constantFrom(
        "process.env.SUPABASE_URL",
        "process.env.DEEPSEEK_API_KEY",
        "process.env.STRIPE_SECRET_KEY",
        "SUPABASE_ANON_KEY",
        "DEEPSEEK_API_KEY",
        "STRIPE_WEBHOOK_SECRET"
    )
);

/**
 * Generate any sensitive pattern
 */
const sensitivePatternArb = fc.oneof(
    apiKeyArb,
    internalPathArb,
    dbConnectionArb,
    envVarArb
);

/**
 * Generate safe text (no sensitive patterns)
 */
const safeTextArb = fc.stringMatching(/^[a-zA-Z0-9\u4e00-\u9fa5\s,.!?，。！？：；""''（）\-]{0,200}$/);

/**
 * Generate text with embedded sensitive pattern
 */
const textWithSensitiveArb = fc.tuple(
    safeTextArb,
    sensitivePatternArb,
    safeTextArb
).map(([before, sensitive, after]) => `${before} ${sensitive} ${after}`);

// ============================================
// Property Tests
// ============================================

describe("Property 14: AI Response Sanitization", () => {
    /**
     * **Feature: brand-management, Property 14: AI Response Sanitization**
     * **Validates: Requirements 6.4**
     *
     * Core property: Sanitized responses do not contain sensitive patterns
     */
    it("sanitized responses do not contain API keys", () => {
        fc.assert(
            fc.property(
                fc.tuple(safeTextArb, apiKeyArb, safeTextArb),
                ([before, apiKey, after]) => {
                    const input = `${before} ${apiKey} ${after}`;
                    const sanitized = sanitizeAIResponse(input);

                    // API key should be redacted
                    expect(sanitized).not.toContain(apiKey);

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Sanitized responses do not contain internal paths
     */
    it("sanitized responses do not contain internal paths", () => {
        fc.assert(
            fc.property(
                fc.tuple(safeTextArb, internalPathArb, safeTextArb),
                ([before, path, after]) => {
                    const input = `${before} ${path} ${after}`;
                    const sanitized = sanitizeAIResponse(input);

                    // Path should be redacted
                    expect(sanitized).not.toContain(path);

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Sanitized responses do not contain database connection strings
     */
    it("sanitized responses do not contain database connection strings", () => {
        fc.assert(
            fc.property(
                fc.tuple(safeTextArb, dbConnectionArb, safeTextArb),
                ([before, conn, after]) => {
                    const input = `${before} ${conn} ${after}`;
                    const sanitized = sanitizeAIResponse(input);

                    // Connection string should be redacted
                    expect(sanitized).not.toContain(conn);

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Sanitized responses do not contain environment variable references
     */
    it("sanitized responses do not contain environment variable references", () => {
        fc.assert(
            fc.property(
                fc.tuple(safeTextArb, envVarArb, safeTextArb),
                ([before, envVar, after]) => {
                    const input = `${before} ${envVar} ${after}`;
                    const sanitized = sanitizeAIResponse(input);

                    // Environment variable should be redacted
                    expect(sanitized).not.toContain(envVar);

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Safe text is preserved after sanitization
     */
    it("safe text is preserved after sanitization", () => {
        fc.assert(
            fc.property(safeTextArb, (safeText) => {
                const sanitized = sanitizeAIResponse(safeText);

                // Safe text should be unchanged
                expect(sanitized).toBe(safeText);

                return true;
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Sanitization is idempotent
     */
    it("sanitization is idempotent", () => {
        fc.assert(
            fc.property(textWithSensitiveArb, (text) => {
                const sanitized1 = sanitizeAIResponse(text);
                const sanitized2 = sanitizeAIResponse(sanitized1);

                // Second sanitization should produce same result
                expect(sanitized2).toBe(sanitized1);

                return true;
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Empty input produces empty output
     */
    it("empty input produces empty output", () => {
        const sanitized = sanitizeAIResponse("");
        expect(sanitized).toBe("");
    });

    /**
     * Sanitized output contains [REDACTED] marker for sensitive content
     */
    it("sanitized output contains [REDACTED] marker for sensitive content", () => {
        fc.assert(
            fc.property(textWithSensitiveArb, (text) => {
                const sanitized = sanitizeAIResponse(text);

                // If original had sensitive content, sanitized should have [REDACTED]
                if (containsSensitiveInfo(text)) {
                    expect(sanitized).toContain("[REDACTED]");
                }

                return true;
            }),
            { numRuns: 100 }
        );
    });
});

describe("containsSensitiveInfo", () => {
    /**
     * Detects API keys
     */
    it("detects API keys", () => {
        fc.assert(
            fc.property(
                fc.tuple(safeTextArb, apiKeyArb, safeTextArb),
                ([before, apiKey, after]) => {
                    const text = `${before} ${apiKey} ${after}`;
                    expect(containsSensitiveInfo(text)).toBe(true);

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Detects internal paths
     */
    it("detects internal paths", () => {
        fc.assert(
            fc.property(
                fc.tuple(safeTextArb, internalPathArb, safeTextArb),
                ([before, path, after]) => {
                    const text = `${before} ${path} ${after}`;
                    expect(containsSensitiveInfo(text)).toBe(true);

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Returns false for safe text
     */
    it("returns false for safe text", () => {
        fc.assert(
            fc.property(safeTextArb, (safeText) => {
                expect(containsSensitiveInfo(safeText)).toBe(false);

                return true;
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Returns false for empty string
     */
    it("returns false for empty string", () => {
        expect(containsSensitiveInfo("")).toBe(false);
    });
});
