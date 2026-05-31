/**
 * Property-Based Tests for Slug Uniqueness
 *
 * Tests for Requirements 1.3, 6.3:
 * - Property 2: Slug Uniqueness
 *
 * **Feature: product-url-slug, Property 2: Slug Uniqueness**
 * **Validates: Requirements 1.3, 6.3**
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { generateSlug, validateSlug } from './slug';

// ============================================
// Pure Function for Unique Slug Generation
// ============================================

/**
 * Generate a unique slug given a base name and existing slugs
 * This is a pure function version for testing without database
 *
 * @param baseName - The base name to generate slug from
 * @param existingSlugs - Set of existing slugs
 * @returns A unique slug
 */
function generateUniqueSlugPure(
    baseName: string,
    existingSlugs: Set<string>
): string {
    const baseSlug = generateSlug(baseName);

    if (!baseSlug) {
        // If base slug is empty, generate a fallback
        let fallback = 'product';
        let suffix = 1;
        while (existingSlugs.has(fallback)) {
            fallback = `product-${suffix}`;
            suffix++;
        }
        return fallback;
    }

    // Check if base slug is available
    if (!existingSlugs.has(baseSlug)) {
        return baseSlug;
    }

    // Try appending numeric suffixes
    let suffix = 2;
    const maxAttempts = 1000;

    while (suffix <= maxAttempts) {
        const candidateSlug = `${baseSlug}-${suffix}`;
        if (!existingSlugs.has(candidateSlug)) {
            return candidateSlug;
        }
        suffix++;
    }

    // Fallback: append timestamp-like suffix
    return `${baseSlug}-${Date.now()}`;
}

// ============================================
// Arbitraries (Generators)
// ============================================

/**
 * Generate a valid product name that will produce a non-empty slug
 */
const productNameArb = fc
    .tuple(
        // First character must be a letter
        fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('')),
        // Rest can be letters, numbers, spaces
        fc.array(
            fc.constantFrom(
                ...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 '.split('')
            ),
            { minLength: 1, maxLength: 20 }
        )
    )
    .map(([first, rest]) => first + rest.join(''));

/**
 * Generate a set of existing slugs (simulating database state)
 */
const existingSlugsArb = fc
    .array(productNameArb, { minLength: 0, maxLength: 20 })
    .map((names) => {
        const slugs = new Set<string>();
        for (const name of names) {
            const slug = generateSlug(name);
            if (slug) {
                slugs.add(slug);
            }
        }
        return slugs;
    });

/**
 * Generate a product name and a set of existing slugs
 */
const productWithExistingSlugsArb = fc.tuple(productNameArb, existingSlugsArb);

// ============================================
// Property Tests
// ============================================

describe('Property 2: Slug Uniqueness', () => {
    /**
     * **Feature: product-url-slug, Property 2: Slug Uniqueness**
     * **Validates: Requirements 1.3, 6.3**
     *
     * For any set of products, each product SHALL have a unique slug,
     * and when a slug conflict occurs, a numeric suffix SHALL be appended
     * to ensure uniqueness.
     */
    it('generated unique slug is not in existing slugs set', () => {
        fc.assert(
            fc.property(productWithExistingSlugsArb, ([name, existingSlugs]) => {
                const uniqueSlug = generateUniqueSlugPure(name, existingSlugs);

                // The generated unique slug should not be in the existing set
                // Requirements: 1.3
                expect(existingSlugs.has(uniqueSlug)).toBe(false);

                return true;
            }),
            { numRuns: 100 }
        );
    });

    it('generated unique slug is valid', () => {
        fc.assert(
            fc.property(productWithExistingSlugsArb, ([name, existingSlugs]) => {
                const uniqueSlug = generateUniqueSlugPure(name, existingSlugs);

                // The generated unique slug should pass validation
                // (unless it's a reserved word, which is handled separately)
                const validation = validateSlug(uniqueSlug);

                if (!validation.valid) {
                    // Only acceptable failure is reserved word
                    expect(validation.error).toContain('reserved word');
                }

                return true;
            }),
            { numRuns: 100 }
        );
    });

    it('uses base slug when available', () => {
        fc.assert(
            fc.property(productNameArb, (name) => {
                const baseSlug = generateSlug(name);

                // Skip if base slug is empty
                if (!baseSlug) {
                    return true;
                }

                // With empty existing slugs, should return base slug
                const emptySet = new Set<string>();
                const uniqueSlug = generateUniqueSlugPure(name, emptySet);

                expect(uniqueSlug).toBe(baseSlug);

                return true;
            }),
            { numRuns: 100 }
        );
    });

    it('appends numeric suffix when base slug exists', () => {
        fc.assert(
            fc.property(productNameArb, (name) => {
                const baseSlug = generateSlug(name);

                // Skip if base slug is empty
                if (!baseSlug) {
                    return true;
                }

                // Create a set with the base slug already taken
                const existingSlugs = new Set<string>([baseSlug]);
                const uniqueSlug = generateUniqueSlugPure(name, existingSlugs);

                // Should have appended a suffix
                // Requirements: 1.3, 6.3
                expect(uniqueSlug).not.toBe(baseSlug);
                expect(uniqueSlug.startsWith(baseSlug)).toBe(true);
                expect(uniqueSlug).toMatch(new RegExp(`^${baseSlug}-\\d+$`));

                return true;
            }),
            { numRuns: 100 }
        );
    });

    it('increments suffix when multiple conflicts exist', () => {
        fc.assert(
            fc.property(productNameArb, (name) => {
                const baseSlug = generateSlug(name);

                // Skip if base slug is empty
                if (!baseSlug) {
                    return true;
                }

                // Create a set with base slug and first few suffixes taken
                const existingSlugs = new Set<string>([
                    baseSlug,
                    `${baseSlug}-2`,
                    `${baseSlug}-3`,
                ]);
                const uniqueSlug = generateUniqueSlugPure(name, existingSlugs);

                // Should have found the next available suffix
                expect(uniqueSlug).toBe(`${baseSlug}-4`);

                return true;
            }),
            { numRuns: 100 }
        );
    });

    it('all slugs in a batch are unique', () => {
        fc.assert(
            fc.property(
                fc.array(productNameArb, { minLength: 2, maxLength: 10 }),
                (names) => {
                    const existingSlugs = new Set<string>();
                    const generatedSlugs: string[] = [];

                    // Generate unique slugs for each name
                    for (const name of names) {
                        const uniqueSlug = generateUniqueSlugPure(name, existingSlugs);
                        generatedSlugs.push(uniqueSlug);
                        existingSlugs.add(uniqueSlug);
                    }

                    // All generated slugs should be unique
                    // Requirements: 1.3
                    const uniqueSet = new Set(generatedSlugs);
                    expect(uniqueSet.size).toBe(generatedSlugs.length);

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });
});

// ============================================
// Edge Cases
// ============================================

describe('Slug Uniqueness Edge Cases', () => {
    it('handles empty name with existing slugs', () => {
        const existingSlugs = new Set<string>(['product', 'product-1']);
        const uniqueSlug = generateUniqueSlugPure('', existingSlugs);

        expect(uniqueSlug).toBeTruthy();
        expect(existingSlugs.has(uniqueSlug)).toBe(false);
    });

    it('handles many conflicts gracefully', () => {
        const baseSlug = 'test-product';
        const existingSlugs = new Set<string>();

        // Add base slug and suffixes 2-50
        existingSlugs.add(baseSlug);
        for (let i = 2; i <= 50; i++) {
            existingSlugs.add(`${baseSlug}-${i}`);
        }

        const uniqueSlug = generateUniqueSlugPure('Test Product', existingSlugs);

        expect(uniqueSlug).toBe(`${baseSlug}-51`);
        expect(existingSlugs.has(uniqueSlug)).toBe(false);
    });

    it('handles same name multiple times', () => {
        const existingSlugs = new Set<string>();
        const name = 'My Product';

        const slug1 = generateUniqueSlugPure(name, existingSlugs);
        existingSlugs.add(slug1);

        const slug2 = generateUniqueSlugPure(name, existingSlugs);
        existingSlugs.add(slug2);

        const slug3 = generateUniqueSlugPure(name, existingSlugs);
        existingSlugs.add(slug3);

        expect(slug1).toBe('my-product');
        expect(slug2).toBe('my-product-2');
        expect(slug3).toBe('my-product-3');
    });

    it('handles names that generate same base slug', () => {
        const existingSlugs = new Set<string>();

        // These should all generate 'hello-world' as base slug
        const names = ['Hello World', 'hello world', 'HELLO WORLD', 'Hello  World'];

        const slugs: string[] = [];
        for (const name of names) {
            const slug = generateUniqueSlugPure(name, existingSlugs);
            slugs.push(slug);
            existingSlugs.add(slug);
        }

        // All slugs should be unique
        const uniqueSet = new Set(slugs);
        expect(uniqueSet.size).toBe(slugs.length);

        // First should be base, rest should have suffixes
        expect(slugs[0]).toBe('hello-world');
        expect(slugs[1]).toBe('hello-world-2');
        expect(slugs[2]).toBe('hello-world-3');
        expect(slugs[3]).toBe('hello-world-4');
    });
});
