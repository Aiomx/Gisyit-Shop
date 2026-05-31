/**
 * Property-Based Tests for Reserved Word Rejection
 *
 * Tests for Requirements 1.6, 1.7:
 * - Property 3: Reserved Word Rejection
 *
 * **Feature: product-url-slug, Property 3: Reserved Word Rejection**
 * **Validates: Requirements 1.6, 1.7**
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { validateSlug, RESERVED_SLUGS, isReservedSlug } from './slug';

// ============================================
// Arbitraries (Generators)
// ============================================

/**
 * Generate a reserved slug from the RESERVED_SLUGS list
 */
const reservedSlugArb = fc.constantFrom(...RESERVED_SLUGS);

/**
 * Generate a valid slug that is NOT a reserved word
 * - Starts with a letter
 * - Contains only lowercase letters, numbers, hyphens
 * - At least 2 characters
 * - Not in RESERVED_SLUGS
 */
const nonReservedSlugArb = fc
    .tuple(
        // First character must be a letter
        fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')),
        // Rest can be letters, numbers, or hyphens
        fc.array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-'.split('')), {
            minLength: 1,
            maxLength: 20,
        })
    )
    .map(([first, rest]) => first + rest.join(''))
    // Remove trailing hyphens
    .map((slug) => slug.replace(/-+$/, ''))
    // Ensure minimum length
    .filter((slug) => slug.length >= 2)
    // Filter out reserved words
    .filter((slug) => !RESERVED_SLUGS.includes(slug as (typeof RESERVED_SLUGS)[number]));

// ============================================
// Property Tests
// ============================================

describe('Property 3: Reserved Word Rejection', () => {
    /**
     * **Feature: product-url-slug, Property 3: Reserved Word Rejection**
     * **Validates: Requirements 1.6, 1.7**
     *
     * For any slug that matches a reserved word (new, edit, admin, api, create,
     * delete, update, list, search), the validation SHALL reject it.
     */
    it('rejects all reserved words', () => {
        fc.assert(
            fc.property(reservedSlugArb, (reservedSlug) => {
                const result = validateSlug(reservedSlug);

                // Reserved words should be rejected
                // Requirements: 1.6, 1.7
                expect(result.valid).toBe(false);
                expect(result.error).toContain('reserved word');

                return true;
            }),
            { numRuns: 100 }
        );
    });

    it('isReservedSlug returns true for all reserved words', () => {
        fc.assert(
            fc.property(reservedSlugArb, (reservedSlug) => {
                // isReservedSlug should return true for reserved words
                expect(isReservedSlug(reservedSlug)).toBe(true);

                return true;
            }),
            { numRuns: 100 }
        );
    });

    it('accepts valid non-reserved slugs', () => {
        fc.assert(
            fc.property(nonReservedSlugArb, (slug) => {
                const result = validateSlug(slug);

                // Non-reserved valid slugs should be accepted
                expect(result.valid).toBe(true);
                expect(result.error).toBeUndefined();

                return true;
            }),
            { numRuns: 100 }
        );
    });

    it('isReservedSlug returns false for non-reserved slugs', () => {
        fc.assert(
            fc.property(nonReservedSlugArb, (slug) => {
                // isReservedSlug should return false for non-reserved slugs
                expect(isReservedSlug(slug)).toBe(false);

                return true;
            }),
            { numRuns: 100 }
        );
    });

    it('reserved word check is case-insensitive for isReservedSlug', () => {
        fc.assert(
            fc.property(reservedSlugArb, (reservedSlug) => {
                // Test uppercase version
                const upperCase = reservedSlug.toUpperCase();
                expect(isReservedSlug(upperCase)).toBe(true);

                // Test mixed case
                const mixedCase =
                    reservedSlug.charAt(0).toUpperCase() + reservedSlug.slice(1).toLowerCase();
                expect(isReservedSlug(mixedCase)).toBe(true);

                return true;
            }),
            { numRuns: 100 }
        );
    });
});

// ============================================
// Edge Cases
// ============================================

describe('Reserved Word Edge Cases', () => {
    it('all defined reserved words are rejected', () => {
        // Explicitly test each reserved word
        const expectedReserved = [
            'new',
            'edit',
            'admin',
            'api',
            'create',
            'delete',
            'update',
            'list',
            'search',
        ];

        for (const word of expectedReserved) {
            const result = validateSlug(word);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('reserved word');
        }
    });

    it('RESERVED_SLUGS contains all expected words', () => {
        const expectedReserved = [
            'new',
            'edit',
            'admin',
            'api',
            'create',
            'delete',
            'update',
            'list',
            'search',
        ];

        expect(RESERVED_SLUGS).toHaveLength(expectedReserved.length);

        for (const word of expectedReserved) {
            expect(RESERVED_SLUGS).toContain(word);
        }
    });

    it('slugs containing reserved words as substrings are accepted', () => {
        // These should be valid because they're not exact matches
        const validSlugs = [
            'new-product',
            'product-new',
            'admin-panel',
            'my-api',
            'create-item',
            'delete-me',
            'update-now',
            'list-items',
            'search-results',
            'newest',
            'editing',
            'administrator',
        ];

        for (const slug of validSlugs) {
            const result = validateSlug(slug);
            expect(result.valid).toBe(true);
        }
    });

    it('reserved words with prefixes or suffixes are accepted', () => {
        const validSlugs = ['new1', 'edit2', 'admin3', 'api4', 'xnew', 'xedit', 'xadmin'];

        for (const slug of validSlugs) {
            const result = validateSlug(slug);
            expect(result.valid).toBe(true);
        }
    });
});
