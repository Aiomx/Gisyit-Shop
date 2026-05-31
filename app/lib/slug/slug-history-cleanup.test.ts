/**
 * Property-Based Tests for Slug History Cleanup
 *
 * Tests for Requirements 5.3:
 * - Property 9: Slug History Cleanup
 *
 * **Feature: product-url-slug, Property 9: Slug History Cleanup**
 * **Validates: Requirements 5.3**
 *
 * For any slug that is reused by another product, it SHALL be removed
 * from the slug_history table.
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
                    select: (fields: string) => ({
                        eq: (field: string, value: string) => ({
                            single: async () => {
                                if (field === 'old_slug') {
                                    const entry = mockSlugHistory.get(value);
                                    return {
                                        data: entry ? { ...entry, id: `id-${value}` } : null,
                                        error: entry ? null : { message: 'Not found' },
                                    };
                                }
                                return { data: null, error: { message: 'Not found' } };
                            },
                            order: (_field: string, _options: { ascending: boolean }) => {
                                const results: unknown[] = [];
                                mockSlugHistory.forEach((entry, slug) => {
                                    if (entry.product_id === value) {
                                        results.push({
                                            ...entry,
                                            old_slug: slug,
                                            id: `id-${slug}`,
                                            created_at: new Date().toISOString(),
                                        });
                                    }
                                });
                                return Promise.resolve({ data: results, error: null });
                            },
                        }),
                    }),
                    insert: (data: { product_id: string; old_slug: string }) => {
                        mockSlugHistory.set(data.old_slug, data);
                        return Promise.resolve({ error: null });
                    },
                    update: (data: { product_id: string; created_at: string }) => ({
                        eq: (field: string, value: string) => {
                            if (field === 'old_slug' && mockSlugHistory.has(value)) {
                                const existing = mockSlugHistory.get(value)!;
                                mockSlugHistory.set(value, { ...existing, product_id: data.product_id });
                            }
                            return Promise.resolve({ error: null });
                        },
                    }),
                    delete: () => ({
                        eq: (field: string, value: string) => {
                            if (field === 'old_slug') {
                                mockSlugHistory.delete(value);
                            }
                            return Promise.resolve({ error: null });
                        },
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
    isSlugInHistory,
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

describe('Property 9: Slug History Cleanup', () => {
    /**
     * **Feature: product-url-slug, Property 9: Slug History Cleanup**
     * **Validates: Requirements 5.3**
     *
     * For any slug that is reused by another product, it SHALL be removed
     * from the slug_history table.
     */
    it('removeFromHistory removes slug from history table', async () => {
        await fc.assert(
            fc.asyncProperty(uuidArb, validSlugArb, async (productId, slug) => {
                // Setup: Record a slug in history
                mockProducts.set(productId, { id: productId, slug: 'new-slug' });
                await recordSlugChange(productId, slug);

                // Verify slug is in history
                const beforeRemoval = await isSlugInHistory(slug);
                expect(beforeRemoval).toBe(true);

                // Remove the slug from history (simulating reuse by another product)
                await removeFromHistory(slug);

                // Verify slug is no longer in history
                const afterRemoval = await isSlugInHistory(slug);
                expect(afterRemoval).toBe(false);

                // Lookup should return null
                const lookupResult = await lookupByHistoricalSlug(slug);
                expect(lookupResult).toBeNull();

                // Cleanup
                mockSlugHistory.clear();
                mockProducts.clear();

                return true;
            }),
            { numRuns: 100 }
        );
    });

    it('removing non-existent slug does not throw', async () => {
        await fc.assert(
            fc.asyncProperty(validSlugArb, async (slug) => {
                // Slug is not in history
                const beforeRemoval = await isSlugInHistory(slug);
                expect(beforeRemoval).toBe(false);

                // Removing should not throw
                await removeFromHistory(slug);

                // Still not in history
                const afterRemoval = await isSlugInHistory(slug);
                expect(afterRemoval).toBe(false);

                return true;
            }),
            { numRuns: 100 }
        );
    });

    it('removing one slug does not affect other slugs in history', async () => {
        await fc.assert(
            fc.asyncProperty(
                uuidArb,
                fc.array(validSlugArb, { minLength: 2, maxLength: 5 }),
                async (productId, slugs) => {
                    // Ensure all slugs are unique
                    const uniqueSlugs = [...new Set(slugs)];
                    if (uniqueSlugs.length < 2) return true;

                    // Setup: Record all slugs in history
                    mockProducts.set(productId, { id: productId, slug: 'current-slug' });
                    for (const slug of uniqueSlugs) {
                        await recordSlugChange(productId, slug);
                    }

                    // Remove the first slug
                    const slugToRemove = uniqueSlugs[0];
                    const remainingSlugs = uniqueSlugs.slice(1);

                    await removeFromHistory(slugToRemove);

                    // Removed slug should not be in history
                    const removedInHistory = await isSlugInHistory(slugToRemove);
                    expect(removedInHistory).toBe(false);

                    // Other slugs should still be in history
                    for (const slug of remainingSlugs) {
                        const inHistory = await isSlugInHistory(slug);
                        expect(inHistory).toBe(true);
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

    it('slug reuse scenario: when slug is removed, lookup returns null', async () => {
        await fc.assert(
            fc.asyncProperty(
                uuidArb,
                uuidArb,
                validSlugArb,
                async (productId1, productId2, slug) => {
                    // Ensure different product IDs
                    if (productId1 === productId2) return true;

                    // Setup: Product 1 had this slug, then changed it
                    mockProducts.set(productId1, { id: productId1, slug: 'new-slug-1' });
                    await recordSlugChange(productId1, slug);

                    // Verify slug is in history pointing to product 1
                    const beforeReuse = await lookupByHistoricalSlug(slug);
                    expect(beforeReuse).not.toBeNull();
                    expect(beforeReuse?.productId).toBe(productId1);

                    // Product 2 wants to use this slug - remove from history first
                    await removeFromHistory(slug);

                    // Now the slug should not be in history
                    const afterReuse = await lookupByHistoricalSlug(slug);
                    expect(afterReuse).toBeNull();

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

describe('Slug History Cleanup Edge Cases', () => {
    it('handles empty slug gracefully', async () => {
        // Should not throw
        await removeFromHistory('');
        expect(mockSlugHistory.size).toBe(0);
    });

    it('handles whitespace-only slug gracefully', async () => {
        // Should not throw
        await removeFromHistory('   ');
        expect(mockSlugHistory.size).toBe(0);
    });

    it('isSlugInHistory returns false for empty slug', async () => {
        const result = await isSlugInHistory('');
        expect(result).toBe(false);
    });

    it('isSlugInHistory returns false for whitespace-only slug', async () => {
        const result = await isSlugInHistory('   ');
        expect(result).toBe(false);
    });
});
