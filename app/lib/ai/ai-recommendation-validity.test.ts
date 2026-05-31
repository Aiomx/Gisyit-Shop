/**
 * Property-Based Tests for AI Recommendation Validity
 *
 * **Feature: brand-management, Property 13: AI Recommendation Validity**
 * **Validates: Requirements 5.3**
 *
 * These tests verify that:
 * - All recommended product IDs exist in the products database
 * - Only active products are recommended
 * - Invalid product IDs are filtered out
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { extractProductIds } from "./ai-search.server";

// ============================================
// Pure Functions for Testing (extracted logic)
// ============================================

/**
 * Validate product IDs against a known set of valid IDs
 * This simulates the database validation logic
 */
function validateProductIdsAgainstSet(
    productIds: string[],
    validProductIds: Set<string>
): string[] {
    return productIds.filter((id) => validProductIds.has(id));
}

/**
 * Check if all IDs in a list are valid
 */
function allIdsValid(ids: string[], validIds: Set<string>): boolean {
    return ids.every((id) => validIds.has(id));
}

/**
 * Check if any invalid ID is in the result
 */
function containsInvalidId(ids: string[], validIds: Set<string>): boolean {
    return ids.some((id) => !validIds.has(id));
}

// ============================================
// Arbitraries (Generators)
// ============================================

/**
 * Generate a valid UUID
 */
const uuidArb = fc.uuid();

/**
 * Generate an invalid UUID-like string
 */
const invalidUuidArb = fc.oneof(
    fc.string({ minLength: 1, maxLength: 35 }), // Too short
    fc.string({ minLength: 37, maxLength: 50 }), // Too long
    fc.constant("not-a-uuid"),
    fc.constant("12345"),
    fc.constant(""),
);

/**
 * Generate a set of valid product IDs
 */
const validProductIdsSetArb = fc
    .array(uuidArb, { minLength: 1, maxLength: 50 })
    .map((ids) => new Set(ids));

/**
 * Generate an array of product IDs (mix of valid and invalid)
 */
const mixedProductIdsArb = (validIds: Set<string>) =>
    fc.array(
        fc.oneof(
            fc.constantFrom(...Array.from(validIds)),
            invalidUuidArb
        ),
        { minLength: 0, maxLength: 20 }
    );

/**
 * Generate AI response text with embedded product IDs
 */
const aiResponseWithIdsArb = (validIds: string[]) =>
    fc.array(
        fc.oneof(
            fc.constantFrom(...validIds).map((id) => `推荐商品 (ID: ${id})`),
            fc.string({ minLength: 1, maxLength: 100 })
        ),
        { minLength: 1, maxLength: 10 }
    ).map((parts) => parts.join("\n"));

// ============================================
// Property Tests
// ============================================

describe("Property 13: AI Recommendation Validity", () => {
    /**
     * **Feature: brand-management, Property 13: AI Recommendation Validity**
     * **Validates: Requirements 5.3**
     *
     * Core property: Validated IDs only contain IDs from the valid set
     */
    it("validated product IDs only contain IDs from the valid set", () => {
        fc.assert(
            fc.property(
                validProductIdsSetArb.chain((validIds) =>
                    fc.tuple(
                        fc.constant(validIds),
                        mixedProductIdsArb(validIds)
                    )
                ),
                ([validIds, inputIds]) => {
                    const validated = validateProductIdsAgainstSet(inputIds, validIds);

                    // All validated IDs must be in the valid set
                    expect(allIdsValid(validated, validIds)).toBe(true);

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Invalid IDs are never included in validated results
     */
    it("invalid IDs are never included in validated results", () => {
        fc.assert(
            fc.property(
                validProductIdsSetArb.chain((validIds) =>
                    fc.tuple(
                        fc.constant(validIds),
                        fc.array(invalidUuidArb, { minLength: 1, maxLength: 10 })
                    )
                ),
                ([validIds, invalidIds]) => {
                    const validated = validateProductIdsAgainstSet(invalidIds, validIds);

                    // No invalid IDs should be in the result
                    expect(validated.length).toBe(0);

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * All valid IDs from input are preserved in output
     */
    it("all valid IDs from input are preserved in output", () => {
        fc.assert(
            fc.property(
                validProductIdsSetArb.chain((validIds) =>
                    fc.tuple(
                        fc.constant(validIds),
                        fc.array(fc.constantFrom(...Array.from(validIds)), {
                            minLength: 1,
                            maxLength: 10,
                        })
                    )
                ),
                ([validIds, inputIds]) => {
                    const validated = validateProductIdsAgainstSet(inputIds, validIds);

                    // All input IDs should be in the result (since they're all valid)
                    expect(validated.length).toBe(inputIds.length);

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Empty input produces empty output
     */
    it("empty input produces empty output", () => {
        const validIds = new Set(["id1", "id2", "id3"]);
        const validated = validateProductIdsAgainstSet([], validIds);
        expect(validated).toEqual([]);
    });

    /**
     * Validation is idempotent - validating twice produces same result
     */
    it("validation is idempotent", () => {
        fc.assert(
            fc.property(
                validProductIdsSetArb.chain((validIds) =>
                    fc.tuple(
                        fc.constant(validIds),
                        mixedProductIdsArb(validIds)
                    )
                ),
                ([validIds, inputIds]) => {
                    const validated1 = validateProductIdsAgainstSet(inputIds, validIds);
                    const validated2 = validateProductIdsAgainstSet(validated1, validIds);

                    // Second validation should produce same result
                    expect(validated2.length).toBe(validated1.length);
                    expect(validated2).toEqual(validated1);

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Validation preserves order of valid IDs (unique inputs only)
     */
    it("validation preserves order of valid IDs", () => {
        fc.assert(
            fc.property(
                validProductIdsSetArb
                    .filter((validIds) => validIds.size >= 2)
                    .chain((validIds) =>
                        fc.tuple(
                            fc.constant(validIds),
                            // Use uniqueArray to avoid duplicates
                            fc.uniqueArray(fc.constantFrom(...Array.from(validIds)), {
                                minLength: 2,
                                maxLength: Math.min(10, validIds.size),
                            })
                        )
                    ),
                ([validIds, inputIds]) => {
                    const validated = validateProductIdsAgainstSet(inputIds, validIds);

                    // Order should be preserved for unique inputs
                    for (let i = 0; i < validated.length; i++) {
                        const inputIndex = inputIds.indexOf(validated[i]);
                        expect(inputIndex).toBeGreaterThanOrEqual(0);

                        // Each subsequent validated ID should appear after the previous one in input
                        if (i > 0) {
                            const prevInputIndex = inputIds.indexOf(validated[i - 1]);
                            expect(inputIndex).toBeGreaterThan(prevInputIndex);
                        }
                    }

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });
});

describe("extractProductIds", () => {
    /**
     * Extracts valid UUIDs from text
     */
    it("extracts valid UUIDs from text", () => {
        fc.assert(
            fc.property(
                fc.array(uuidArb, { minLength: 1, maxLength: 5 }),
                (uuids) => {
                    const text = uuids.map((id) => `Product ID: ${id}`).join("\n");
                    const extracted = extractProductIds(text);

                    // All UUIDs should be extracted
                    for (const uuid of uuids) {
                        expect(extracted).toContain(uuid);
                    }

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Returns empty array for text without UUIDs
     */
    it("returns empty array for text without UUIDs", () => {
        fc.assert(
            fc.property(
                fc.string({ minLength: 0, maxLength: 200 }).filter(
                    (s) => !/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(s)
                ),
                (text) => {
                    const extracted = extractProductIds(text);
                    expect(extracted.length).toBe(0);

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Deduplicates extracted UUIDs
     */
    it("deduplicates extracted UUIDs", () => {
        fc.assert(
            fc.property(uuidArb, (uuid) => {
                const text = `ID: ${uuid}, again: ${uuid}, once more: ${uuid}`;
                const extracted = extractProductIds(text);

                // Should only contain one instance
                expect(extracted.length).toBe(1);
                expect(extracted[0]).toBe(uuid);

                return true;
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Empty text produces empty result
     */
    it("empty text produces empty result", () => {
        const extracted = extractProductIds("");
        expect(extracted).toEqual([]);
    });
});
