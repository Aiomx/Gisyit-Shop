/**
 * Property-Based Tests for Slug Generation Format
 *
 * Tests for Requirements 1.1, 1.2, 1.4, 1.5:
 * - Property 1: Slug Generation Format
 *
 * **Feature: product-url-slug, Property 1: Slug Generation Format**
 * **Validates: Requirements 1.1, 1.2, 1.4, 1.5**
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { generateSlug, validateSlug } from './slug';

// ============================================
// Arbitraries (Generators)
// ============================================

/**
 * Generate a product name with letters, numbers, spaces, and common special characters
 */
const productNameArb = fc
    .array(
        fc.constantFrom(
            ...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 -_!@#$%&()'.split('')
        ),
        { minLength: 1, maxLength: 50 }
    )
    .map((chars) => chars.join(''));

/**
 * Generate a product name that contains at least one letter
 * This ensures the generated slug will have content
 */
const productNameWithLetterArb = fc
    .tuple(
        fc.array(
            fc.constantFrom(
                ...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 -_'.split('')
            ),
            { minLength: 0, maxLength: 20 }
        ),
        fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('')),
        fc.array(
            fc.constantFrom(
                ...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 -_'.split('')
            ),
            { minLength: 0, maxLength: 20 }
        )
    )
    .map(([before, letter, after]) => [...before, letter, ...after].join(''));

/**
 * Generate a simple product name (letters and spaces only)
 */
const simpleProductNameArb = fc
    .array(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz '.split('')), {
        minLength: 2,
        maxLength: 30,
    })
    .map((chars) => chars.join(''))
    .filter((name) => /[a-zA-Z]/.test(name)); // Ensure at least one letter

// ============================================
// Property Tests
// ============================================

describe('Property 1: Slug Generation Format', () => {
    /**
     * **Feature: product-url-slug, Property 1: Slug Generation Format**
     * **Validates: Requirements 1.1, 1.2, 1.4, 1.5**
     *
     * For any product name, the generated slug SHALL contain only lowercase letters,
     * numbers, and hyphens, SHALL start with a letter, and SHALL have a minimum
     * length of 2 characters.
     */
    it('generated slug contains only lowercase letters, numbers, and hyphens', () => {
        fc.assert(
            fc.property(productNameWithLetterArb, (name) => {
                const slug = generateSlug(name);

                // Skip empty slugs (from names with no valid characters)
                if (slug === '') {
                    return true;
                }

                // Slug should only contain lowercase letters, numbers, and hyphens
                // Requirements: 1.4
                expect(slug).toMatch(/^[a-z0-9-]+$/);

                return true;
            }),
            { numRuns: 100 }
        );
    });

    it('generated slug starts with a letter', () => {
        fc.assert(
            fc.property(productNameWithLetterArb, (name) => {
                const slug = generateSlug(name);

                // Skip empty slugs
                if (slug === '') {
                    return true;
                }

                // Slug should start with a letter
                // Requirements: 1.5
                expect(slug).toMatch(/^[a-z]/);

                return true;
            }),
            { numRuns: 100 }
        );
    });

    it('generated slug has minimum length of 2 characters', () => {
        fc.assert(
            fc.property(productNameWithLetterArb, (name) => {
                const slug = generateSlug(name);

                // Skip empty slugs
                if (slug === '') {
                    return true;
                }

                // Slug should have minimum length of 2
                // Requirements: 1.5
                expect(slug.length).toBeGreaterThanOrEqual(2);

                return true;
            }),
            { numRuns: 100 }
        );
    });

    it('generated slug converts uppercase to lowercase', () => {
        fc.assert(
            fc.property(simpleProductNameArb, (name) => {
                const slug = generateSlug(name);

                // Skip empty slugs
                if (slug === '') {
                    return true;
                }

                // Slug should not contain uppercase letters
                // Requirements: 1.2
                expect(slug).not.toMatch(/[A-Z]/);

                return true;
            }),
            { numRuns: 100 }
        );
    });

    it('generated slug replaces spaces with hyphens', () => {
        fc.assert(
            fc.property(simpleProductNameArb, (name) => {
                const slug = generateSlug(name);

                // Skip empty slugs
                if (slug === '') {
                    return true;
                }

                // Slug should not contain spaces
                // Requirements: 1.2
                expect(slug).not.toContain(' ');

                return true;
            }),
            { numRuns: 100 }
        );
    });

    it('generated slug has no consecutive hyphens', () => {
        fc.assert(
            fc.property(productNameArb, (name) => {
                const slug = generateSlug(name);

                // Skip empty slugs
                if (slug === '') {
                    return true;
                }

                // Slug should not have consecutive hyphens
                expect(slug).not.toMatch(/--/);

                return true;
            }),
            { numRuns: 100 }
        );
    });

    it('generated slug has no leading or trailing hyphens', () => {
        fc.assert(
            fc.property(productNameArb, (name) => {
                const slug = generateSlug(name);

                // Skip empty slugs
                if (slug === '') {
                    return true;
                }

                // Slug should not start or end with hyphen
                expect(slug).not.toMatch(/^-/);
                expect(slug).not.toMatch(/-$/);

                return true;
            }),
            { numRuns: 100 }
        );
    });

    it('generated slug passes validation', () => {
        fc.assert(
            fc.property(productNameWithLetterArb, (name) => {
                const slug = generateSlug(name);

                // Skip empty slugs
                if (slug === '') {
                    return true;
                }

                // Generated slug should pass validation (unless it's a reserved word)
                const validation = validateSlug(slug);

                // If validation fails, it should only be because of reserved words
                if (!validation.valid) {
                    expect(validation.error).toContain('reserved word');
                }

                return true;
            }),
            { numRuns: 100 }
        );
    });
});

// ============================================
// Edge Cases
// ============================================

describe('Slug Generation Edge Cases', () => {
    it('handles empty string', () => {
        expect(generateSlug('')).toBe('');
    });

    it('handles whitespace-only string', () => {
        expect(generateSlug('   ')).toBe('');
    });

    it('handles string with only special characters', () => {
        expect(generateSlug('!@#$%^&*()')).toBe('');
    });

    it('handles string starting with numbers', () => {
        const slug = generateSlug('123 Product');
        expect(slug).toMatch(/^[a-z]/); // Should start with letter
        expect(slug).toBe('p-123-product');
    });

    it('handles Chinese characters by removing them', () => {
        const slug = generateSlug('商品 Product');
        expect(slug).toBe('product');
    });

    it('handles mixed content', () => {
        const slug = generateSlug('GoPay 2.0 - Premium Edition!');
        expect(slug).toBe('gopay-20-premium-edition');
    });

    it('handles single letter input', () => {
        const slug = generateSlug('A');
        expect(slug.length).toBeGreaterThanOrEqual(2);
        expect(slug).toBe('ax');
    });

    it('handles underscores by converting to hyphens', () => {
        const slug = generateSlug('product_name_here');
        expect(slug).toBe('product-name-here');
    });
});
