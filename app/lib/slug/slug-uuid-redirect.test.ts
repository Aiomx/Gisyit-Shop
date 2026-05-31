/**
 * Property-Based Tests for UUID to Slug Redirect
 *
 * Tests for Requirements 2.2, 5.2:
 * - Property 5: UUID to Slug Redirect
 *
 * **Feature: product-url-slug, Property 5: UUID to Slug Redirect**
 * **Validates: Requirements 2.2, 5.2**
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { generateSlug } from './slug';
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

interface MockSlugHistory {
    product_id: string;
    old_slug: string;
}

interface MockDatabase {
    products: Map<string, MockProduct>;
    slugIndex: Map<string, string>; // slug -> product id
    slugHistory: Map<string, MockSlugHistory>; // old_slug -> history entry
}

interface RouteResult {
    status: number;
    product?: MockProduct;
    redirectTo?: string;
    isHistorical?: boolean;
}

// ============================================
// Pure Function for Route Handling with Redirect
// ============================================

/**
 * Pure function implementation of product route handling with redirect logic
 * This mirrors the server loader implementation but uses in-memory data
 *
 * Requirements: 2.2, 5.2
 * - WHEN a user visits `/product/{uuid}` THEN the Product_Detail_Page SHALL redirect to `/product/{slug}` with 301 status
 * - WHEN a user visits an old slug THEN the system SHALL redirect to the current slug with 301 status
 */
function handleProductRouteWithRedirect(
    identifier: string,
    db: MockDatabase
): RouteResult {
    if (!identifier || identifier.trim() === '') {
        return { status: 400 };
    }

    const trimmedIdentifier = identifier.trim();

    // Check if identifier is a UUID
    if (isUUID(trimmedIdentifier)) {
        const product = db.products.get(trimmedIdentifier);
        if (product && product.is_active && product.slug) {
            // Found by UUID - redirect to slug URL (Requirements 2.2)
            return {
                status: 301,
                product,
                redirectTo: product.slug,
            };
        }
        // UUID not found
        return { status: 404 };
    }

    // Look up by slug in the index
    const productId = db.slugIndex.get(trimmedIdentifier);
    if (productId) {
        const product = db.products.get(productId);
        if (product && product.is_active) {
            // Found by slug - return product (no redirect)
            return {
                status: 200,
                product,
            };
        }
    }

    // Look up in slug history (Requirements 5.2)
    const historyEntry = db.slugHistory.get(trimmedIdentifier);
    if (historyEntry) {
        const product = db.products.get(historyEntry.product_id);
        if (product && product.is_active && product.slug) {
            // Found historical slug - redirect to current slug
            return {
                status: 301,
                product,
                redirectTo: product.slug,
                isHistorical: true,
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
 * Generate a database with an active product
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
            slugHistory: new Map(),
        };

        return { db, product };
    });

/**
 * Generate a database with a product and its historical slug
 */
const databaseWithHistoricalSlugArb = fc
    .tuple(uuidArb, productNameArb, productNameArb)
    .filter(([_, currentName, oldName]) => {
        // Ensure old and current names generate different slugs
        const currentSlug = generateSlug(currentName);
        const oldSlug = generateSlug(oldName);
        return currentSlug !== oldSlug && currentSlug && oldSlug;
    })
    .map(([id, currentName, oldName]) => {
        const currentSlug = generateSlug(currentName)!;
        const oldSlug = generateSlug(oldName)!;

        const product: MockProduct = {
            id,
            slug: currentSlug,
            name: currentName,
            is_active: true,
        };

        const db: MockDatabase = {
            products: new Map([[id, product]]),
            slugIndex: new Map([[currentSlug, id]]),
            slugHistory: new Map([
                [oldSlug, { product_id: id, old_slug: oldSlug }],
            ]),
        };

        return { db, product, oldSlug };
    });

// ============================================
// Property Tests
// ============================================

describe('Property 5: UUID to Slug Redirect', () => {
    /**
     * **Feature: product-url-slug, Property 5: UUID to Slug Redirect**
     * **Validates: Requirements 2.2, 5.2**
     *
     * For any product accessed by UUID, the system SHALL redirect to `/product/{slug}` with 301 status.
     */
    it('UUID access returns 301 redirect to slug', () => {
        fc.assert(
            fc.property(databaseWithActiveProductArb, ({ db, product }) => {
                // Access the product by its UUID
                const result = handleProductRouteWithRedirect(product.id, db);

                // Requirements 2.2: WHEN a user visits `/product/{uuid}` THEN the Product_Detail_Page SHALL redirect to `/product/{slug}` with 301 status
                expect(result.status).toBe(301);
                expect(result.redirectTo).toBe(product.slug);
                expect(result.product?.id).toBe(product.id);

                return true;
            }),
            { numRuns: 100 }
        );
    });

    it('UUID redirect target is the current slug', () => {
        fc.assert(
            fc.property(databaseWithActiveProductArb, ({ db, product }) => {
                const result = handleProductRouteWithRedirect(product.id, db);

                // The redirect target should be the product's current slug
                expect(result.status).toBe(301);
                expect(result.redirectTo).toBe(product.slug);

                // Following the redirect should return 200
                const followedResult = handleProductRouteWithRedirect(result.redirectTo!, db);
                expect(followedResult.status).toBe(200);
                expect(followedResult.product?.id).toBe(product.id);

                return true;
            }),
            { numRuns: 100 }
        );
    });

    it('slug access does not redirect', () => {
        fc.assert(
            fc.property(databaseWithActiveProductArb, ({ db, product }) => {
                // Access the product by its slug
                const result = handleProductRouteWithRedirect(product.slug, db);

                // Slug access should return 200, not redirect
                expect(result.status).toBe(200);
                expect(result.redirectTo).toBeUndefined();
                expect(result.product?.id).toBe(product.id);

                return true;
            }),
            { numRuns: 100 }
        );
    });

    it('historical slug access returns 301 redirect to current slug', () => {
        fc.assert(
            fc.property(databaseWithHistoricalSlugArb, ({ db, product, oldSlug }) => {
                // Access the product by its old slug
                const result = handleProductRouteWithRedirect(oldSlug, db);

                // Requirements 5.2: WHEN a user visits an old slug THEN the system SHALL redirect to the current slug with 301 status
                expect(result.status).toBe(301);
                expect(result.redirectTo).toBe(product.slug);
                expect(result.isHistorical).toBe(true);
                expect(result.product?.id).toBe(product.id);

                return true;
            }),
            { numRuns: 100 }
        );
    });

    it('historical slug redirect target is the current slug', () => {
        fc.assert(
            fc.property(databaseWithHistoricalSlugArb, ({ db, product, oldSlug }) => {
                const result = handleProductRouteWithRedirect(oldSlug, db);

                // The redirect target should be the product's current slug
                expect(result.status).toBe(301);
                expect(result.redirectTo).toBe(product.slug);

                // Following the redirect should return 200
                const followedResult = handleProductRouteWithRedirect(result.redirectTo!, db);
                expect(followedResult.status).toBe(200);
                expect(followedResult.product?.id).toBe(product.id);

                return true;
            }),
            { numRuns: 100 }
        );
    });

    it('non-existent UUID returns 404', () => {
        fc.assert(
            fc.property(
                fc.tuple(databaseWithActiveProductArb, uuidArb),
                ([{ db }, randomUuid]) => {
                    // Skip if the random UUID happens to exist
                    if (db.products.has(randomUuid)) {
                        return true;
                    }

                    const result = handleProductRouteWithRedirect(randomUuid, db);

                    // Non-existent UUID should return 404
                    expect(result.status).toBe(404);
                    expect(result.product).toBeUndefined();
                    expect(result.redirectTo).toBeUndefined();

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    it('inactive product UUID returns 404', () => {
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
                        slugHistory: new Map(),
                    };

                    const result = handleProductRouteWithRedirect(id, db);

                    // Inactive products should return 404 even when accessed by UUID
                    expect(result.status).toBe(404);

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });
});

// ============================================
// Redirect Chain Tests
// ============================================

describe('UUID to Slug Redirect - Redirect Chains', () => {
    it('UUID redirect is a single hop to slug', () => {
        fc.assert(
            fc.property(databaseWithActiveProductArb, ({ db, product }) => {
                // Access by UUID
                const uuidResult = handleProductRouteWithRedirect(product.id, db);
                expect(uuidResult.status).toBe(301);

                // Follow the redirect
                const slugResult = handleProductRouteWithRedirect(uuidResult.redirectTo!, db);

                // Should be a direct 200 response, not another redirect
                expect(slugResult.status).toBe(200);
                expect(slugResult.redirectTo).toBeUndefined();

                return true;
            }),
            { numRuns: 100 }
        );
    });

    it('historical slug redirect is a single hop to current slug', () => {
        fc.assert(
            fc.property(databaseWithHistoricalSlugArb, ({ db, product, oldSlug }) => {
                // Access by historical slug
                const historyResult = handleProductRouteWithRedirect(oldSlug, db);
                expect(historyResult.status).toBe(301);

                // Follow the redirect
                const slugResult = handleProductRouteWithRedirect(historyResult.redirectTo!, db);

                // Should be a direct 200 response, not another redirect
                expect(slugResult.status).toBe(200);
                expect(slugResult.redirectTo).toBeUndefined();

                return true;
            }),
            { numRuns: 100 }
        );
    });

    it('all access methods lead to same product', () => {
        fc.assert(
            fc.property(databaseWithHistoricalSlugArb, ({ db, product, oldSlug }) => {
                // Access by UUID
                const uuidResult = handleProductRouteWithRedirect(product.id, db);
                // Access by current slug
                const slugResult = handleProductRouteWithRedirect(product.slug, db);
                // Access by historical slug
                const historyResult = handleProductRouteWithRedirect(oldSlug, db);

                // All should reference the same product
                expect(uuidResult.product?.id).toBe(product.id);
                expect(slugResult.product?.id).toBe(product.id);
                expect(historyResult.product?.id).toBe(product.id);

                // UUID and historical should redirect to current slug
                expect(uuidResult.redirectTo).toBe(product.slug);
                expect(historyResult.redirectTo).toBe(product.slug);

                // Current slug should not redirect
                expect(slugResult.redirectTo).toBeUndefined();

                return true;
            }),
            { numRuns: 100 }
        );
    });
});

// ============================================
// Edge Cases
// ============================================

describe('UUID to Slug Redirect - Edge Cases', () => {
    it('handles product without slug (edge case)', () => {
        const id = '12345678-1234-4123-8123-123456789012';
        const product: MockProduct = {
            id,
            slug: '', // Empty slug
            name: 'Test Product',
            is_active: true,
        };

        const db: MockDatabase = {
            products: new Map([[id, product]]),
            slugIndex: new Map(),
            slugHistory: new Map(),
        };

        const result = handleProductRouteWithRedirect(id, db);

        // Product without slug should return 404 (can't redirect)
        expect(result.status).toBe(404);
    });

    it('handles UUID with different case', () => {
        fc.assert(
            fc.property(databaseWithActiveProductArb, ({ db, product }) => {
                // UUID with uppercase letters
                const uppercaseUuid = product.id.toUpperCase();

                // isUUID should still recognize it
                expect(isUUID(uppercaseUuid)).toBe(true);

                // Note: In the pure function test, Map lookup is case-sensitive.
                // In the real implementation with Supabase, UUID comparison is case-insensitive.
                // This test verifies the UUID detection works correctly.

                return true;
            }),
            { numRuns: 100 }
        );
    });

    it('handles multiple historical slugs for same product', () => {
        const id = '12345678-1234-4123-8123-123456789012';
        const currentSlug = 'current-product';
        const oldSlug1 = 'old-product-one';
        const oldSlug2 = 'old-product-two';

        const product: MockProduct = {
            id,
            slug: currentSlug,
            name: 'Current Product',
            is_active: true,
        };

        const db: MockDatabase = {
            products: new Map([[id, product]]),
            slugIndex: new Map([[currentSlug, id]]),
            slugHistory: new Map([
                [oldSlug1, { product_id: id, old_slug: oldSlug1 }],
                [oldSlug2, { product_id: id, old_slug: oldSlug2 }],
            ]),
        };

        // Both old slugs should redirect to current slug
        const result1 = handleProductRouteWithRedirect(oldSlug1, db);
        const result2 = handleProductRouteWithRedirect(oldSlug2, db);

        expect(result1.status).toBe(301);
        expect(result1.redirectTo).toBe(currentSlug);

        expect(result2.status).toBe(301);
        expect(result2.redirectTo).toBe(currentSlug);
    });

    it('handles empty identifier', () => {
        const db: MockDatabase = {
            products: new Map(),
            slugIndex: new Map(),
            slugHistory: new Map(),
        };

        expect(handleProductRouteWithRedirect('', db).status).toBe(400);
        expect(handleProductRouteWithRedirect('   ', db).status).toBe(400);
    });
});
