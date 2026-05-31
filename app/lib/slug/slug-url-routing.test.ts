/**
 * Property-Based Tests for Slug URL Routing
 *
 * Tests for Requirements 2.1, 7.1:
 * - Property 4: Slug URL Routing
 *
 * **Feature: product-url-slug, Property 4: Slug URL Routing**
 * **Validates: Requirements 2.1, 7.1**
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { generateSlug, validateSlug } from './slug';
import { isUUID } from './slug-lookup.server';

// ============================================
// Types for Testing
// ============================================

interface MockProduct {
    id: string;
    slug: string;
    name: string;
    is_active: boolean;
}

interface MockDatabase {
    products: Map<string, MockProduct>;
    slugIndex: Map<string, string>; // slug -> product id
}

interface RouteResult {
    status: number;
    product?: MockProduct;
    redirectTo?: string;
}

// ============================================
// Pure Function for Route Handling
// ============================================

/**
 * Pure function implementation of product route handling for testing
 * This mirrors the server loader implementation but uses in-memory data
 *
 * Requirements: 2.1, 7.1
 * - WHEN a user visits `/product/{slug}` THEN the Product_Detail_Page SHALL display the corresponding product
 * - WHEN fetching a product by slug THEN the API SHALL return the product data
 */
function handleProductRoute(
    slugParam: string,
    db: MockDatabase
): RouteResult {
    if (!slugParam || slugParam.trim() === '') {
        return { status: 400 };
    }

    const trimmedSlug = slugParam.trim();

    // Look up by slug in the index
    const productId = db.slugIndex.get(trimmedSlug);

    if (productId) {
        const product = db.products.get(productId);
        if (product && product.is_active) {
            // Found by slug - return product (Requirements 2.1, 7.1)
            return {
                status: 200,
                product,
            };
        }
    }

    // Check if it's a UUID (for redirect handling)
    if (isUUID(trimmedSlug)) {
        const product = db.products.get(trimmedSlug);
        if (product && product.is_active && product.slug) {
            // Found by UUID - redirect to slug URL (Requirements 2.2)
            return {
                status: 301,
                product,
                redirectTo: product.slug,
            };
        }
    }

    // Not found
    return { status: 404 };
}

// ============================================
// Arbitraries (Generators)
// ============================================

/**
 * Generate a valid UUID v4
 */
const hexCharArb = fc.constantFrom(...'0123456789abcdef'.split(''));

const hexStringArb = (length: number) =>
    fc.array(hexCharArb, { minLength: length, maxLength: length }).map((chars) => chars.join(''));

const uuidArb = fc
    .tuple(
        hexStringArb(8),
        hexStringArb(4),
        hexStringArb(3),
        fc.constantFrom(...'89ab'.split('')),
        hexStringArb(3),
        hexStringArb(12)
    )
    .map(([a, b, c, d, e, f]) => `${a}-${b}-4${c}-${d}${e}-${f}`.toLowerCase());

/**
 * Generate a valid product name that will produce a valid slug
 */
const productNameArb = fc
    .tuple(
        fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('')),
        fc.array(
            fc.constantFrom(
                ...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 '.split('')
            ),
            { minLength: 1, maxLength: 20 }
        )
    )
    .map(([first, rest]) => first + rest.join(''));

/**
 * Generate a mock product with valid slug
 */
const mockProductArb = fc
    .tuple(uuidArb, productNameArb, fc.boolean())
    .map(([id, name, isActive]) => {
        const slug = generateSlug(name);
        return {
            id,
            slug: slug || `product-${id.slice(0, 8)}`,
            name,
            is_active: isActive,
        };
    });

/**
 * Generate a mock database with products
 */
const mockDatabaseArb = fc
    .array(mockProductArb, { minLength: 1, maxLength: 10 })
    .map((products) => {
        const db: MockDatabase = {
            products: new Map(),
            slugIndex: new Map(),
        };

        // Ensure unique slugs
        const usedSlugs = new Set<string>();
        for (const product of products) {
            let slug = product.slug;
            let suffix = 2;
            while (usedSlugs.has(slug)) {
                slug = `${product.slug}-${suffix}`;
                suffix++;
            }
            usedSlugs.add(slug);

            const updatedProduct = { ...product, slug };
            db.products.set(product.id, updatedProduct);
            db.slugIndex.set(slug, product.id);
        }

        return db;
    });

/**
 * Generate a database with at least one active product
 */
const databaseWithActiveProductArb = fc
    .tuple(uuidArb, productNameArb)
    .map(([id, name]) => {
        const slug = generateSlug(name) || `product-${id.slice(0, 8)}`;
        const product: MockProduct = {
            id,
            slug,
            name,
            is_active: true,
        };

        const db: MockDatabase = {
            products: new Map([[id, product]]),
            slugIndex: new Map([[slug, id]]),
        };

        return { db, product };
    });

// ============================================
// Property Tests
// ============================================

describe('Property 4: Slug URL Routing', () => {
    /**
     * **Feature: product-url-slug, Property 4: Slug URL Routing**
     * **Validates: Requirements 2.1, 7.1**
     *
     * For any valid product slug, accessing `/product/{slug}` SHALL return the corresponding product data.
     */
    it('valid slug returns corresponding product with 200 status', () => {
        fc.assert(
            fc.property(databaseWithActiveProductArb, ({ db, product }) => {
                // Access the product by its slug
                const result = handleProductRoute(product.slug, db);

                // Requirements 2.1: WHEN a user visits `/product/{slug}` THEN the Product_Detail_Page SHALL display the corresponding product
                expect(result.status).toBe(200);
                expect(result.product).toBeDefined();
                expect(result.product?.id).toBe(product.id);
                expect(result.product?.slug).toBe(product.slug);
                expect(result.product?.name).toBe(product.name);

                return true;
            }),
            { numRuns: 100 }
        );
    });

    it('slug lookup returns product data with all required fields', () => {
        fc.assert(
            fc.property(databaseWithActiveProductArb, ({ db, product }) => {
                const result = handleProductRoute(product.slug, db);

                // Requirements 7.1: WHEN fetching a product by slug THEN the API SHALL return the product data
                expect(result.status).toBe(200);
                expect(result.product).toBeDefined();

                // Verify product has required fields
                expect(result.product?.id).toBeDefined();
                expect(result.product?.slug).toBeDefined();
                expect(result.product?.name).toBeDefined();

                // Verify the returned product matches the expected product
                expect(result.product?.id).toBe(product.id);
                expect(result.product?.slug).toBe(product.slug);

                return true;
            }),
            { numRuns: 100 }
        );
    });

    it('non-existent slug returns 404 status', () => {
        fc.assert(
            fc.property(
                fc.tuple(mockDatabaseArb, productNameArb),
                ([db, randomName]) => {
                    const randomSlug = generateSlug(randomName) || 'random-slug';

                    // Skip if the random slug happens to exist
                    if (db.slugIndex.has(randomSlug)) {
                        return true;
                    }

                    const result = handleProductRoute(randomSlug, db);

                    // Requirements 2.3: WHEN a slug does not exist THEN the Product_Detail_Page SHALL return a 404 error page
                    expect(result.status).toBe(404);
                    expect(result.product).toBeUndefined();

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    it('inactive product returns 404 status', () => {
        fc.assert(
            fc.property(
                fc.tuple(uuidArb, productNameArb),
                ([id, name]) => {
                    const slug = generateSlug(name) || `product-${id.slice(0, 8)}`;
                    const product: MockProduct = {
                        id,
                        slug,
                        name,
                        is_active: false, // Inactive product
                    };

                    const db: MockDatabase = {
                        products: new Map([[id, product]]),
                        slugIndex: new Map([[slug, id]]),
                    };

                    const result = handleProductRoute(slug, db);

                    // Inactive products should not be accessible
                    expect(result.status).toBe(404);

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    it('empty slug returns 400 status', () => {
        const db: MockDatabase = {
            products: new Map(),
            slugIndex: new Map(),
        };

        expect(handleProductRoute('', db).status).toBe(400);
        expect(handleProductRoute('   ', db).status).toBe(400);
    });

    it('slug lookup is case-sensitive', () => {
        fc.assert(
            fc.property(databaseWithActiveProductArb, ({ db, product }) => {
                // Slugs are always lowercase, so uppercase should not match
                const uppercaseSlug = product.slug.toUpperCase();

                // Skip if the slug is already all lowercase with no letters
                if (uppercaseSlug === product.slug) {
                    return true;
                }

                const result = handleProductRoute(uppercaseSlug, db);

                // Uppercase slug should not find the product (slugs are lowercase)
                expect(result.status).toBe(404);

                return true;
            }),
            { numRuns: 100 }
        );
    });

    it('slug with whitespace is trimmed', () => {
        fc.assert(
            fc.property(databaseWithActiveProductArb, ({ db, product }) => {
                // Add whitespace around the slug
                const slugWithWhitespace = `  ${product.slug}  `;

                const result = handleProductRoute(slugWithWhitespace, db);

                // Should still find the product after trimming
                expect(result.status).toBe(200);
                expect(result.product?.id).toBe(product.id);

                return true;
            }),
            { numRuns: 100 }
        );
    });
});

// ============================================
// Additional Routing Tests
// ============================================

describe('Slug URL Routing - Additional Cases', () => {
    it('multiple products with unique slugs are all accessible', () => {
        fc.assert(
            fc.property(mockDatabaseArb, (db) => {
                // Get all active products
                const activeProducts = Array.from(db.products.values()).filter(
                    (p) => p.is_active
                );

                // Each active product should be accessible by its slug
                for (const product of activeProducts) {
                    const result = handleProductRoute(product.slug, db);
                    expect(result.status).toBe(200);
                    expect(result.product?.id).toBe(product.id);
                }

                return true;
            }),
            { numRuns: 50 }
        );
    });

    it('slug format is preserved in response', () => {
        fc.assert(
            fc.property(databaseWithActiveProductArb, ({ db, product }) => {
                const result = handleProductRoute(product.slug, db);

                expect(result.status).toBe(200);

                // The returned slug should match exactly
                expect(result.product?.slug).toBe(product.slug);

                // Slug should be valid format
                const validation = validateSlug(result.product?.slug || '');
                expect(validation.valid).toBe(true);

                return true;
            }),
            { numRuns: 100 }
        );
    });
});

// ============================================
// Edge Cases
// ============================================

describe('Slug URL Routing - Edge Cases', () => {
    it('handles slug that looks like UUID but is not', () => {
        // A slug that has UUID-like format but is not a valid UUID
        const fakeUuidSlug = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';

        const db: MockDatabase = {
            products: new Map(),
            slugIndex: new Map(),
        };

        const result = handleProductRoute(fakeUuidSlug, db);

        // Should be treated as a slug lookup, not UUID
        expect(isUUID(fakeUuidSlug)).toBe(false);
        expect(result.status).toBe(404);
    });

    it('handles very long slug', () => {
        const longSlug = 'a'.repeat(255);

        const db: MockDatabase = {
            products: new Map(),
            slugIndex: new Map(),
        };

        const result = handleProductRoute(longSlug, db);

        // Should handle gracefully (404 since not found)
        expect(result.status).toBe(404);
    });

    it('handles slug with special characters that were sanitized', () => {
        // Generate a name with special characters
        const name = 'Product @#$% Test!';
        const slug = generateSlug(name);

        if (!slug) return;

        const id = '12345678-1234-4123-8123-123456789012';
        const product: MockProduct = {
            id,
            slug,
            name,
            is_active: true,
        };

        const db: MockDatabase = {
            products: new Map([[id, product]]),
            slugIndex: new Map([[slug, id]]),
        };

        const result = handleProductRoute(slug, db);

        // Should find the product with sanitized slug
        expect(result.status).toBe(200);
        expect(result.product?.slug).toBe(slug);
    });
});
