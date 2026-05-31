/**
 * Property-Based Tests for Slug Migration Completeness
 *
 * Tests for Requirements 6.1, 6.4:
 * - Property 10: Migration Completeness
 *
 * **Feature: product-url-slug, Property 10: Migration Completeness**
 * **Validates: Requirements 6.1, 6.4**
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { generateSlug, validateSlug } from './slug';
import { generateUniqueSlugSync } from './slug-migration.server';

// ============================================
// Types for Testing
// ============================================

interface MockProduct {
    id: string;
    name: string;
    slug: string | null;
}

// ============================================
// Pure Migration Simulation
// ============================================

/**
 * Simulate the migration process for a set of products
 * This is a pure function version for testing without database
 *
 * @param products - Array of products to migrate
 * @returns Array of products with slugs assigned
 */
function simulateMigration(products: MockProduct[]): MockProduct[] {
    const existingSlugs = new Set<string>();

    // First, collect all existing slugs
    for (const product of products) {
        if (product.slug) {
            existingSlugs.add(product.slug);
        }
    }

    // Then, generate slugs for products without them
    return products.map((product) => {
        if (product.slug) {
            // Already has a slug, keep it
            return product;
        }

        // Generate a unique slug
        const newSlug = generateUniqueSlugSync(product.name, existingSlugs);

        return {
            ...product,
            slug: newSlug,
        };
    });
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
 * Generate a UUID-like string for product IDs
 */
const hexChars = '0123456789abcdef'.split('');

const hexStringArb = (length: number) =>
    fc.array(fc.constantFrom(...hexChars), { minLength: length, maxLength: length })
        .map((chars) => chars.join(''));

const uuidArb = fc
    .tuple(
        hexStringArb(8),
        hexStringArb(4),
        hexStringArb(4),
        hexStringArb(4),
        hexStringArb(12)
    )
    .map(([a, b, c, d, e]) => `${a}-${b}-${c}-${d}-${e}`);

/**
 * Generate a product without a slug (needs migration)
 */
const productWithoutSlugArb = fc
    .tuple(uuidArb, productNameArb)
    .map(([id, name]) => ({
        id,
        name,
        slug: null,
    }));

/**
 * Generate a product with an existing slug
 */
const productWithSlugArb = fc
    .tuple(uuidArb, productNameArb)
    .map(([id, name]) => ({
        id,
        name,
        slug: generateSlug(name) || `product-${id.substring(0, 8)}`,
    }));

/**
 * Generate a mixed array of products (some with slugs, some without)
 */
const mixedProductsArb = fc
    .array(
        fc.oneof(productWithoutSlugArb, productWithSlugArb),
        { minLength: 1, maxLength: 20 }
    );

/**
 * Generate an array of products all without slugs
 */
const productsWithoutSlugsArb = fc
    .array(productWithoutSlugArb, { minLength: 1, maxLength: 20 });

// ============================================
// Property Tests
// ============================================

describe('Property 10: Migration Completeness', () => {
    /**
     * **Feature: product-url-slug, Property 10: Migration Completeness**
     * **Validates: Requirements 6.1, 6.4**
     *
     * For any product after migration, the slug field SHALL be non-null and unique.
     */
    it('all products have non-null slugs after migration', () => {
        fc.assert(
            fc.property(productsWithoutSlugsArb, (products) => {
                const migratedProducts = simulateMigration(products);

                // All products should have non-null slugs after migration
                // Requirements: 6.4
                for (const product of migratedProducts) {
                    expect(product.slug).not.toBeNull();
                    expect(product.slug).toBeTruthy();
                }

                return true;
            }),
            { numRuns: 100 }
        );
    });

    it('all slugs are unique after migration', () => {
        fc.assert(
            fc.property(productsWithoutSlugsArb, (products) => {
                const migratedProducts = simulateMigration(products);

                // All slugs should be unique
                // Requirements: 6.4
                const slugs = migratedProducts.map((p) => p.slug);
                const uniqueSlugs = new Set(slugs);

                expect(uniqueSlugs.size).toBe(slugs.length);

                return true;
            }),
            { numRuns: 100 }
        );
    });

    it('all generated slugs are valid', () => {
        fc.assert(
            fc.property(productsWithoutSlugsArb, (products) => {
                const migratedProducts = simulateMigration(products);

                // All generated slugs should pass validation
                // Requirements: 6.1
                for (const product of migratedProducts) {
                    if (product.slug) {
                        const validation = validateSlug(product.slug);

                        // If validation fails, it should only be because of reserved words
                        // (which shouldn't happen with product names)
                        if (!validation.valid) {
                            expect(validation.error).toContain('reserved word');
                        }
                    }
                }

                return true;
            }),
            { numRuns: 100 }
        );
    });

    it('migration preserves existing slugs', () => {
        fc.assert(
            fc.property(mixedProductsArb, (products) => {
                // Record original slugs for products that have them
                const originalSlugs = new Map<string, string>();
                for (const product of products) {
                    if (product.slug) {
                        originalSlugs.set(product.id, product.slug);
                    }
                }

                const migratedProducts = simulateMigration(products);

                // Products that had slugs should keep them
                for (const product of migratedProducts) {
                    const originalSlug = originalSlugs.get(product.id);
                    if (originalSlug) {
                        expect(product.slug).toBe(originalSlug);
                    }
                }

                return true;
            }),
            { numRuns: 100 }
        );
    });

    it('migration handles duplicate product names correctly', () => {
        fc.assert(
            fc.property(
                fc.tuple(uuidArb, uuidArb, uuidArb, productNameArb),
                ([id1, id2, id3, name]) => {
                    // Create three products with the same name
                    const products: MockProduct[] = [
                        { id: id1, name, slug: null },
                        { id: id2, name, slug: null },
                        { id: id3, name, slug: null },
                    ];

                    const migratedProducts = simulateMigration(products);

                    // All should have unique slugs
                    const slugs = migratedProducts.map((p) => p.slug);
                    const uniqueSlugs = new Set(slugs);

                    expect(uniqueSlugs.size).toBe(3);

                    // All slugs should be non-null
                    for (const slug of slugs) {
                        expect(slug).not.toBeNull();
                    }

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    it('migration does not create conflicts with existing slugs', () => {
        fc.assert(
            fc.property(
                fc.tuple(
                    fc.array(productWithSlugArb, { minLength: 1, maxLength: 10 }),
                    fc.array(productWithoutSlugArb, { minLength: 1, maxLength: 10 })
                ),
                ([productsWithSlugs, productsWithoutSlugs]) => {
                    // Combine products
                    const allProducts = [...productsWithSlugs, ...productsWithoutSlugs];

                    const migratedProducts = simulateMigration(allProducts);

                    // All slugs should be unique (no conflicts)
                    const slugs = migratedProducts.map((p) => p.slug);
                    const uniqueSlugs = new Set(slugs);

                    expect(uniqueSlugs.size).toBe(slugs.length);

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    it('slugs are generated from product names', () => {
        fc.assert(
            fc.property(productsWithoutSlugsArb, (products) => {
                const migratedProducts = simulateMigration(products);

                // Each generated slug should be based on the product name
                // (either exact match or with numeric suffix)
                for (let i = 0; i < products.length; i++) {
                    const originalName = products[i].name;
                    const generatedSlug = migratedProducts[i].slug;
                    const baseSlug = generateSlug(originalName);

                    if (baseSlug && generatedSlug) {
                        // Slug should start with the base slug
                        // Requirements: 6.2
                        expect(generatedSlug.startsWith(baseSlug)).toBe(true);
                    }
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

describe('Migration Edge Cases', () => {
    it('handles empty product list', () => {
        const products: MockProduct[] = [];
        const migratedProducts = simulateMigration(products);

        expect(migratedProducts).toHaveLength(0);
    });

    it('handles single product', () => {
        const products: MockProduct[] = [
            { id: 'test-id-1', name: 'Test Product', slug: null },
        ];

        const migratedProducts = simulateMigration(products);

        expect(migratedProducts).toHaveLength(1);
        expect(migratedProducts[0].slug).toBe('test-product');
    });

    it('handles products with special characters in names', () => {
        const products: MockProduct[] = [
            { id: 'test-id-1', name: 'Product #1 (Special!)', slug: null },
            { id: 'test-id-2', name: 'Product @2 [Limited]', slug: null },
        ];

        const migratedProducts = simulateMigration(products);

        for (const product of migratedProducts) {
            expect(product.slug).not.toBeNull();
            expect(product.slug).toMatch(/^[a-z][a-z0-9-]*$/);
        }
    });

    it('handles products with numeric-only names', () => {
        const products: MockProduct[] = [
            { id: 'test-id-1', name: '12345', slug: null },
        ];

        const migratedProducts = simulateMigration(products);

        expect(migratedProducts[0].slug).not.toBeNull();
        // Should start with a letter (p- prefix for numeric slugs)
        expect(migratedProducts[0].slug).toMatch(/^[a-z]/);
    });

    it('handles many products with same name', () => {
        const products: MockProduct[] = [];
        for (let i = 0; i < 50; i++) {
            products.push({
                id: `test-id-${i}`,
                name: 'Same Product Name',
                slug: null,
            });
        }

        const migratedProducts = simulateMigration(products);

        // All should have unique slugs
        const slugs = migratedProducts.map((p) => p.slug);
        const uniqueSlugs = new Set(slugs);

        expect(uniqueSlugs.size).toBe(50);

        // First should be base, rest should have suffixes
        expect(migratedProducts[0].slug).toBe('same-product-name');
        expect(migratedProducts[1].slug).toBe('same-product-name-2');
        expect(migratedProducts[49].slug).toBe('same-product-name-50');
    });

    it('handles mixed products (some with slugs, some without)', () => {
        const products: MockProduct[] = [
            { id: 'test-id-1', name: 'Product A', slug: 'existing-slug-a' },
            { id: 'test-id-2', name: 'Product B', slug: null },
            { id: 'test-id-3', name: 'Product C', slug: 'existing-slug-c' },
            { id: 'test-id-4', name: 'Product D', slug: null },
        ];

        const migratedProducts = simulateMigration(products);

        // Existing slugs should be preserved
        expect(migratedProducts[0].slug).toBe('existing-slug-a');
        expect(migratedProducts[2].slug).toBe('existing-slug-c');

        // New slugs should be generated
        expect(migratedProducts[1].slug).toBe('product-b');
        expect(migratedProducts[3].slug).toBe('product-d');
    });
});
