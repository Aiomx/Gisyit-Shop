/**
 * Property-Based Tests for CDK Text Parsing
 *
 * Tests for Requirements 1.1, 1.3:
 * - Property 1: Text Parsing Consistency
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { parseTextInput } from "./utils";

// ============================================
// Arbitraries (Generators)
// ============================================

/**
 * Generate a valid CDK code string (non-empty, no newlines)
 */
const cdkCodeArb = fc
    .array(fc.constantFrom(..."ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-".split("")), {
        minLength: 1,
        maxLength: 30,
    })
    .map((chars) => chars.join(""));

/**
 * Generate a newline character (various formats)
 */
const newlineArb = fc.constantFrom("\n", "\r\n", "\r");

/**
 * Generate optional whitespace (spaces/tabs)
 */
const whitespaceArb = fc
    .array(fc.constantFrom(" ", "\t"), { minLength: 0, maxLength: 3 })
    .map((chars) => chars.join(""));

/**
 * Generate a CDK code with optional surrounding whitespace
 */
const cdkCodeWithWhitespaceArb = fc
    .tuple(whitespaceArb, cdkCodeArb, whitespaceArb)
    .map(([before, code, after]) => before + code + after);

// ============================================
// Property Tests
// ============================================

describe("Property 1: Text Parsing Consistency", () => {
    /**
     * **Feature: cdk-auto-delivery, Property 1: Text Parsing Consistency**
     * **Validates: Requirements 1.1, 1.3**
     *
     * For any text input containing CDK codes separated by newlines,
     * parsing the text should produce exactly the non-empty trimmed lines
     * as individual codes, with the count of parsed codes equal to the
     * count of non-empty lines.
     */
    it("parses text into correct number of non-empty trimmed codes", () => {
        fc.assert(
            fc.property(
                fc.array(cdkCodeArb, { minLength: 1, maxLength: 20 }),
                newlineArb,
                (codes, newline) => {
                    // Join codes with the newline character
                    const text = codes.join(newline);

                    const result = parseTextInput(text);

                    // Should have same number of codes as input
                    expect(result.codes.length).toBe(codes.length);
                    expect(result.lineCount).toBe(codes.length);

                    // Each code should match the input (after trimming)
                    for (let i = 0; i < codes.length; i++) {
                        expect(result.codes[i]).toBe(codes[i].trim());
                    }

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Whitespace around codes is trimmed
     */
    it("trims whitespace from each code", () => {
        fc.assert(
            fc.property(
                fc.array(cdkCodeWithWhitespaceArb, { minLength: 1, maxLength: 10 }),
                newlineArb,
                (codesWithWhitespace, newline) => {
                    const text = codesWithWhitespace.join(newline);

                    const result = parseTextInput(text);

                    // Each result should be trimmed
                    for (const code of result.codes) {
                        expect(code).toBe(code.trim());
                        expect(code.length).toBeGreaterThan(0);
                    }

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Empty lines are filtered out
     */
    it("filters out empty lines", () => {
        fc.assert(
            fc.property(
                fc.array(cdkCodeArb, { minLength: 1, maxLength: 10 }),
                fc.array(fc.constantFrom("", "  ", "\t", "   \t  "), { minLength: 1, maxLength: 5 }),
                newlineArb,
                (codes, emptyLines, newline) => {
                    // Interleave codes with empty lines
                    const mixed: string[] = [];
                    for (let i = 0; i < Math.max(codes.length, emptyLines.length); i++) {
                        if (i < codes.length) mixed.push(codes[i]);
                        if (i < emptyLines.length) mixed.push(emptyLines[i]);
                    }

                    const text = mixed.join(newline);
                    const result = parseTextInput(text);

                    // Should only have the non-empty codes
                    expect(result.codes.length).toBe(codes.length);

                    // No empty strings in result
                    for (const code of result.codes) {
                        expect(code.length).toBeGreaterThan(0);
                    }

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Handles all newline formats consistently
     */
    it("handles Unix (\\n), Windows (\\r\\n), and old Mac (\\r) newlines", () => {
        fc.assert(
            fc.property(
                fc.array(cdkCodeArb, { minLength: 2, maxLength: 10 }),
                (codes) => {
                    const unixText = codes.join("\n");
                    const windowsText = codes.join("\r\n");
                    const macText = codes.join("\r");

                    const unixResult = parseTextInput(unixText);
                    const windowsResult = parseTextInput(windowsText);
                    const macResult = parseTextInput(macText);

                    // All should produce the same result
                    expect(unixResult.codes).toEqual(codes);
                    expect(windowsResult.codes).toEqual(codes);
                    expect(macResult.codes).toEqual(codes);

                    expect(unixResult.lineCount).toBe(codes.length);
                    expect(windowsResult.lineCount).toBe(codes.length);
                    expect(macResult.lineCount).toBe(codes.length);

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Empty input returns empty result
     */
    it("returns empty result for empty input", () => {
        expect(parseTextInput("")).toEqual({ codes: [], lineCount: 0 });
        expect(parseTextInput("   ")).toEqual({ codes: [], lineCount: 0 });
        expect(parseTextInput("\n\n\n")).toEqual({ codes: [], lineCount: 0 });
        expect(parseTextInput("  \n  \n  ")).toEqual({ codes: [], lineCount: 0 });
    });

    /**
     * Single code without newline is parsed correctly
     */
    it("parses single code without newline", () => {
        fc.assert(
            fc.property(cdkCodeArb, (code) => {
                const result = parseTextInput(code);

                expect(result.codes.length).toBe(1);
                expect(result.codes[0]).toBe(code.trim());
                expect(result.lineCount).toBe(1);

                return true;
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Preserves order of codes
     */
    it("preserves the order of codes", () => {
        fc.assert(
            fc.property(
                fc.array(cdkCodeArb, { minLength: 2, maxLength: 20 }),
                newlineArb,
                (codes, newline) => {
                    const text = codes.join(newline);
                    const result = parseTextInput(text);

                    // Order should be preserved
                    for (let i = 0; i < codes.length; i++) {
                        expect(result.codes[i]).toBe(codes[i]);
                    }

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });
});
