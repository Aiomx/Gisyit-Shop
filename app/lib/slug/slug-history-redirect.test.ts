/**
 * Property-Based Tests for Historical Slug Redirect
 *
 * Tests for Requirements 5.1, 5.2:
 * - Property 8: Historical Slug Redirect
 *
 * **Feature: product-url-slug, Property 8: Historical Slug Redirect**
 * **Validates: Requirements 5.1, 5.2**
 *
 * For any historical slug (old slug after modification), accessing it
 * SHALL redirect to the current slug with 301 status.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';

// ============================================
// Mock Supabase Client
// ============================================

// Mock data store for testing
let mockSlugHistory: Map<string, { product_id: string; old_slug: string }>;
let mockProducts: Map<string, { id: string; slug: string }>;

// Mock the supabase client
vi.mock('~/lib/supabase/client.server', () => ({
    getSupabaseClient: () => ({
        from: (table: string) => {
            if (table === 'slug_history') {
                return {
                    select: () => ({
                        eq: (field: string, value: string) => ({
                            single: async () => {
                                if (field === 'old_slug') {
                                    const entry = mockSlugHistory.get(value);
                                    return {
                                        data: entry || null,
                                        error: entry ? null : { message: 'Not found' },
                                    };
                                }
                                return { data: null, error: { message: 'Not found' } };
                            },
                            order: () => ({
                                then: async (resolve: (result: { data: unknown[]; error: null }) => void) => {
                                    const results: unknown[] = [];
                                    mockSlugHistory.forEach((entry, slug) => {
                                        if (entry.product_id === value) {
                                            results.push({ ...entry, old_slug: slug, id: `id-${slug}`, created_at: new Date().toISOString() });
                                        }
                                    });
                                    resolve({ data: results, error: null });
                                },
                            }),
                        }),
                        order: (field: string, options: { ascending: boolean }) => ({
                            then: async (resolve: (result: { data: unknown[]; error: null }) => void) => {
                                resolve({ data: [], error: null });
                            },
                        }),
                    }),
                    insert: (data: { product_id: string; old_slug: string }) => ({
                        then: async (resolve: (result: { error: null }) => void) => {
                            mockSlugHistory.set(data.old_slug, data);
                            resolve({ error: null });
                        },
                    }),
                    update: (data: { product_id: string; created_at: string }) => ({
                        eq: (field: string, value: string) => ({
                            then: async (resolve: (result: { error: null }) => void) => {
                                if (field === 'old_slug' && mockSlugHistory.has(value)) {
                                    const existing = mockSlugHistory.get(value)!;
                                    mockSlugHistory.set(value, { ...existing, product_id: data.product_id });
                                }
                                resolve({ error: null });
                            },
                        }),
                    }),
                    delete: () => ({
                        eq: (field: string, value: string) => ({
                            then: async (resolve: (result: { error: null }) => void) => {
                                if (field === 'old_slug') {
                                    mockSlugHistory.delete(value);
                                }
                                resolve({ error: null });
                            },
                        }),
                    }),
                };
            }
            if (table === 'products') {
                return {
                    select: () => ({
                        eq: (field: string, value: string) => ({
                            single: async () => {
                                if (field === 'id') {
                                    const product = mockProducts.get(value);
                                    return {
                                        data: product || null,
                                        error: product ? null : { message: 'Not found' },
                                    };
                                }
                                return { data: null, error: { message: 'Not found' } };
                            },
                        }),
                    }),
                };
            }
            return {
                select: () => ({
                    eq: () => ({
                        single: async () => ({ data: null, error: { message: 'Not found' } }),
                    }),
                }),
            };
        },
    }),
}));

// Import after mocking
import {
    recordSlugChange,
    lookupByHistoricalSlug,
    removeFromHistory,
    getSlugHistory,
} from './slug-history.server';

// ============================================
// Arbitraries (Generators)
// ============================================

/**
 * Generate a valid slug (lowercase letters, numbers, hyphens, starts with letter)
 */
const validSlugArb = fc
    .tuple(
        fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')),
        fc.array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-'.split('')), {
            minLength: 1,
            maxLength: 20,
        })
    )
    .map(([first, rest]) => first + rest.join(''))
    .filter((slug) => !slug.endsWith('-') && !slug.includes('--'));

/**
 * Generate a valid UUID v4
 */
const hexChars = '0123456789abcdef'.split('');
const uuidArb = fc
    .tuple(
        fc.array(fc.constantFrom(...hexChars), { minLength: 8, maxLength: 8 }),
        fc.array(fc.constantFrom(...hexChars), { minLength: 4, maxLength: 4 }),
        fc.array(fc.constantFrom(...hexChars), { minLength: 3, maxLength: 3 }),
        fc.array(fc.constantFrom(...hexChars), { minLength: 4, maxLength: 4 }),
        fc.array(fc.constantFrom(...hexChars), { minLength: 12, maxLength: 12 })
    )
    .map(([a, b, c, d, e]) => `${a.join('')}-${b.join('')}-4${c.join('')}-${d.join('')}-${e.join('')}`);

/**
 * Generate a product with id and slug
 */
const productArb = fc.record({
    id: uuidArb,
    slug: validSlugArb,
});

/**
 * Generate a slug change scenario (old slug -> new slug for a product)
 */
const slugChangeArb = fc.record({
    productId: uuidArb,
    oldSlug: validSlugArb,
    newSlug: validSlugArb,
}).filter((change) => change.oldSlug !== change.newSlug);

// ============================================
// Setup
// ============================================

beforeEach(() => {
    mockSlugHistory = new Map();
    mockProducts = new Map();
});

// ============================================
// Property Tests
// ============================================

describe('Property 8: Historical Slug Redirect', () => {
    /**
     * **Feature: product-url-slug, Property 8: Historical Slug Redirect**
     * **Validates: Requirements 5.1, 5.2**
     *
     * For any historical slug (old slug after modification), accessing it
     * SHALL redirect to the current slug with 301 status.
     */
    it('recorded historical slug can be looked up and returns current slug', async () => {
        await fc.assert(
            fc.asyncProperty(slugChangeArb, async (change) => {
                // Setup: Create a product with the new slug
                mockProducts.set(change.productId, {
                    id: change.productId,
                    slug: change.newSlug,
                });

                // Record the slug change (old slug -> new slug)
                await recordSlugChange(change.productId, change.oldSlug);

                // Lookup by historical slug should return the current slug
                const result = await lookupByHistoricalSlug(change.oldSlug);

                // Should find the historical slug
                expect(result).not.toBeNull();
                expect(result?.productId).toBe(change.productId);
                expect(result?.currentSlug).toBe(change.newSlug);

                // Cleanup
                mockSlugHistory.clear();
                mockProducts.clear();

                return true;
            }),
            { numRuns: 100 }
        );
    });

    it('non-existent historical slug returns null', async () => {
        await fc.assert(
            fc.asyncProperty(validSlugArb, async (slug) => {
                // Lookup a slug that was never recorded
                const result = await lookupByHistoricalSlug(slug);

                // Should not find anything
                expect(result).toBeNull();

                return true;
            }),
            { numRuns: 100 }
        );
    });

    it('multiple slug changes for same product all redirect to current slug', async () => {
        await fc.assert(
            fc.asyncProperty(
                uuidArb,
                fc.array(validSlugArb, { minLength: 2, maxLength: 5 }),
                async (productId, slugHistory) => {
                    // Ensure all slugs are unique
                    const uniqueSlugs = [...new Set(slugHistory)];
                    if (uniqueSlugs.length < 2) return true;

                    // The last slug is the current one
                    const currentSlug = uniqueSlugs[uniqueSlugs.length - 1];
                    const historicalSlugs = uniqueSlugs.slice(0, -1);

                    // Setup: Create product with current slug
                    mockProducts.set(productId, {
                        id: productId,
                        slug: currentSlug,
                    });

                    // Record all historical slugs
                    for (const oldSlug of historicalSlugs) {
                        await recordSlugChange(productId, oldSlug);
                    }

                    // All historical slugs should redirect to current slug
                    for (const oldSlug of historicalSlugs) {
                        const result = await lookupByHistoricalSlug(oldSlug);
                        expect(result).not.toBeNull();
                        expect(result?.currentSlug).toBe(currentSlug);
                    }

                    // Cleanup
                    mockSlugHistory.clear();
                    mockProducts.clear();

                    return true;
                }
            ),
            { numRuns: 50 }
        );
    });
});

// ============================================
// Edge Cases
// ============================================

describe('Historical Slug Redirect Edge Cases', () => {
    it('handles empty slug gracefully', async () => {
        const result = await lookupByHistoricalSlug('');
        expect(result).toBeNull();
    });

    it('handles whitespace-only slug gracefully', async () => {
        const result = await lookupByHistoricalSlug('   ');
        expect(result).toBeNull();
    });

    it('recordSlugChange handles empty inputs gracefully', async () => {
        // Should not throw
        await recordSlugChange('', 'old-slug');
        await recordSlugChange('product-id', '');
        await recordSlugChange('', '');

        // Nothing should be recorded
        expect(mockSlugHistory.size).toBe(0);
    });
});
