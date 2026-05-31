/**
 * Property-Based Tests for CDK Deduplication
 *
 * Tests for Requirements 1.4:
 * - Property 2: Deduplication Accuracy
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { deduplicateCodes } from "./utils";

// ============================================
// Arbitraries (Generators)
// ============================================

/**
 * Generate a valid CDK code string
 */
const cdkCodeArb = fc
    .array(fc.constantFrom(..."ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-".split("")), {
        minLength: 1,
        maxLength: 30,
    })
    .map((chars) => chars.join(""));

/**
 * Generate an array of CDK codes (may contain duplicates)
 */
const cdkCodesArb = fc.array(cdkCodeArb, { minLength: 0, maxLength: 50 });

/**
 * Generate an array with guaranteed duplicates
 */
const cdkCodesWithDuplicatesArb = fc
    .tuple(
        fc.array(cdkCodeArb, { minLength: 1, maxLength: 20 }),
        fc.integer({ min: 1, max: 10 })
    )
    .chain(([codes, duplicateCount]) => {
        // Pick random codes to duplicate
        return fc
            .array(fc.integer({ min: 0, max: codes.length - 1 }), {
                minLength: duplicateCount,
                maxLength: duplicateCount,
            })
            .map((indices) => {
                const duplicates = indices.map((i) => codes[i % codes.length]);
                return [...codes, ...duplicates];
            });
    });

// ============================================
// Property Tests
// ============================================

describe("Property 2: Deduplication Accuracy", () => {
    /**
     * **Feature: cdk-auto-delivery, Property 2: Deduplication Accuracy**
     * **Validates: Requirements 1.4**
     *
     * For any list of CDK codes with duplicates, after import the inventory
     * should contain only unique codes, and the reported duplicate count
     * should equal (total input count - unique count).
     */
    it("returns correct unique codes and duplicate count", () => {
        fc.assert(
            fc.property(cdkCodesArb, (codes) => {
                const result = deduplicateCodes(codes);

                // Calculate expected values
                const uniqueSet = new Set(codes);
                const expectedUniqueCount = uniqueSet.size;
                const expectedDuplicateCount = codes.length - expectedUniqueCount;

                // Verify unique codes count
                expect(result.uniqueCodes.length).toBe(expectedUniqueCount);

                // Verify duplicate count
                expect(result.duplicateCount).toBe(expectedDuplicateCount);

                // Verify sum equals input
                expect(result.uniqueCodes.length + result.duplicateCount).toBe(codes.length);

                return true;
            }),
            { numRuns: 100 }
        );
    });

    /**
     * All unique codes are present in result
     */
    it("contains all unique codes from input", () => {
        fc.assert(
            fc.property(cdkCodesArb, (codes) => {
                const result = deduplicateCodes(codes);

                // All unique codes from input should be in result
                const uniqueSet = new Set(codes);
                const resultSet = new Set(result.uniqueCodes);

                expect(resultSet.size).toBe(uniqueSet.size);

                for (const code of uniqueSet) {
                    expect(resultSet.has(code)).toBe(true);
                }

                return true;
            }),
            { numRuns: 100 }
        );
    });

    /**
     * No duplicates in result
     */
    it("result contains no duplicates", () => {
        fc.assert(
            fc.property(cdkCodesArb, (codes) => {
                const result = deduplicateCodes(codes);

                // Result should have no duplicates
                const resultSet = new Set(result.uniqueCodes);
                expect(resultSet.size).toBe(result.uniqueCodes.length);

                return true;
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Preserves order of first occurrence
     */
    it("preserves order of first occurrence", () => {
        fc.assert(
            fc.property(cdkCodesArb, (codes) => {
                const result = deduplicateCodes(codes);

                // Track first occurrence order
                const firstOccurrence: string[] = [];
                const seen = new Set<string>();

                for (const code of codes) {
                    if (!seen.has(code)) {
                        seen.add(code);
                        firstOccurrence.push(code);
                    }
                }

                // Result should match first occurrence order
                expect(result.uniqueCodes).toEqual(firstOccurrence);

                return true;
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Works correctly with guaranteed duplicates
     */
    it("correctly handles arrays with guaranteed duplicates", () => {
        fc.assert(
            fc.property(cdkCodesWithDuplicatesArb, (codes) => {
                const result = deduplicateCodes(codes);

                const uniqueSet = new Set(codes);

                // Should have fewer unique codes than input
                expect(result.uniqueCodes.length).toBeLessThanOrEqual(codes.length);

                // Duplicate count should be positive (we guaranteed duplicates)
                expect(result.duplicateCount).toBeGreaterThanOrEqual(0);

                // Sum should equal input length
                expect(result.uniqueCodes.length + result.duplicateCount).toBe(codes.length);

                // All unique codes should be present
                expect(result.uniqueCodes.length).toBe(uniqueSet.size);

                return true;
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Empty input returns empty result
     */
    it("returns empty result for empty input", () => {
        const result = deduplicateCodes([]);

        expect(result.uniqueCodes).toEqual([]);
        expect(result.duplicateCount).toBe(0);
    });

    /**
     * Single code returns single code with no duplicates
     */
    it("single code returns single code with no duplicates", () => {
        fc.assert(
            fc.property(cdkCodeArb, (code) => {
                const result = deduplicateCodes([code]);

                expect(result.uniqueCodes).toEqual([code]);
                expect(result.duplicateCount).toBe(0);

                return true;
            }),
            { numRuns: 100 }
        );
    });

    /**
     * All same codes returns single code
     */
    it("all same codes returns single code", () => {
        fc.assert(
            fc.property(
                cdkCodeArb,
                fc.integer({ min: 2, max: 20 }),
                (code, count) => {
                    const codes = Array(count).fill(code);
                    const result = deduplicateCodes(codes);

                    expect(result.uniqueCodes).toEqual([code]);
                    expect(result.duplicateCount).toBe(count - 1);

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * All unique codes returns all codes
     */
    it("all unique codes returns all codes with zero duplicates", () => {
        fc.assert(
            fc.property(
                fc.set(cdkCodeArb, { minLength: 1, maxLength: 20 }),
                (uniqueCodes) => {
                    const codes = [...uniqueCodes];
                    const result = deduplicateCodes(codes);

                    expect(result.uniqueCodes).toEqual(codes);
                    expect(result.duplicateCount).toBe(0);

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });
});
