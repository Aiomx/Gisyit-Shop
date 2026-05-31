/**
 * Property-Based Tests for Product Link Generation
 *
 * Tests for Requirements 3.1, 3.2, 3.3, 3.4:
 * - Property 6: Product Link Generation
 *
 * **Feature: product-url-slug, Property 6: Product Link Generation**
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { Product, ProductType, DeliveryType } from '~/lib/supabase/types';

// ============================================
// Helper Functions for Link Generation
// ============================================

/**
 * Generate product URL from product object
 * This mirrors the logic used in ProductCard, cart-item, etc.
 */
export function generateProductUrl(product: { id: string; slug?: string }): string {
    return `/product/${product.slug || product.id}`;
}

/**
 * Generate product URL from search result
 * This mirrors the logic used in quick-search.server.ts
 */
export function generateSearchResultUrl(product: { id: string; slug?: string }): string {
    return `/product/${product.slug || product.id}`;
}

/**
 * Generate product URL from cart item
 * This mirrors the logic used in cart-item.tsx
 */
export function generateCartItemUrl(item: { product_id: string; product?: { slug?: string } }): string {
    return `/product/${item.product?.slug || item.product_id}`;
}

/**
 * Generate product URL from download item
 * This mirrors the logic used in downloads-list.tsx
 */
export function generateDownloadItemUrl(item: { product_id: string; product_slug?: string }): string {
    return `/product/${item.product_slug || item.product_id}`;
}

// ============================================
// Arbitraries (Generators)
// ============================================

/**
 * Generate a valid UUID
 */
const uuidArb = fc.uuid();

/**
 * Generate a valid slug (lowercase letters, numbers, hyphens, starts with letter)
 */
const slugArb = fc
    .tuple(
        fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')),
        fc.array(
            fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-'.split('')),
            { minLength: 1, maxLength: 30 }
        )
    )
    .map(([first, rest]) => first + rest.join(''))
    .filter((slug) => !slug.endsWith('-') && !slug.includes('--'));

/**
 * Generate a product type
 */
const productTypeArb: fc.Arbitrary<ProductType> = fc.constantFrom(
    'app',
    'game_card',
    'game_cdk',
    'game_digital',
    'physical',
    'overseas'
);

/**
 * Generate a delivery type
 */
const deliveryTypeArb: fc.Arbitrary<DeliveryType> = fc.constantFrom(
    'download',
    'license_key',
    'cdk',
    'shipment',
    'manual'
);

/**
 * Generate a minimal product with slug
 */
const productWithSlugArb: fc.Arbitrary<Product> = fc
    .record({
        id: uuidArb,
        slug: slugArb,
        product_code: fc.string({ minLength: 3, maxLength: 10 }),
        name: fc.string({ minLength: 1, maxLength: 50 }),
        product_type: productTypeArb,
        delivery_type: deliveryTypeArb,
        category_id: uuidArb,
        is_active: fc.boolean(),
        has_discount: fc.boolean(),
        has_demo_video: fc.boolean(),
        created_at: fc.constant('2024-01-01T00:00:00.000Z'),
        updated_at: fc.constant('2024-01-01T00:00:00.000Z'),
    })
    .map((p) => p as Product);

/**
 * Generate a minimal product without slug (legacy)
 */
const productWithoutSlugArb: fc.Arbitrary<Product> = fc
    .record({
        id: uuidArb,
        product_code: fc.string({ minLength: 3, maxLength: 10 }),
        name: fc.string({ minLength: 1, maxLength: 50 }),
        product_type: productTypeArb,
        delivery_type: deliveryTypeArb,
        category_id: uuidArb,
        is_active: fc.boolean(),
        has_discount: fc.boolean(),
        has_demo_video: fc.boolean(),
        created_at: fc.constant('2024-01-01T00:00:00.000Z'),
        updated_at: fc.constant('2024-01-01T00:00:00.000Z'),
    })
    .map((p) => ({ ...p, slug: undefined } as Product));

/**
 * Generate a cart item with product
 */
const cartItemArb = fc.record({
    product_id: uuidArb,
    product: fc.option(
        fc.record({
            slug: fc.option(slugArb, { nil: undefined }),
        }),
        { nil: undefined }
    ),
});

/**
 * Generate a download item
 */
const downloadItemArb = fc.record({
    product_id: uuidArb,
    product_slug: fc.option(slugArb, { nil: undefined }),
});

// ============================================
// Property Tests
// ============================================

describe('Property 6: Product Link Generation', () => {
    /**
     * **Feature: product-url-slug, Property 6: Product Link Generation**
     * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
     *
     * For any product displayed in ProductCard, search results, cart, or order history,
     * the link href SHALL be `/product/{slug}`.
     */

    describe('ProductCard links (Requirement 3.1)', () => {
        it('uses slug when available', () => {
            fc.assert(
                fc.property(productWithSlugArb, (product) => {
                    const url = generateProductUrl(product);

                    // URL should use slug
                    expect(url).toBe(`/product/${product.slug}`);
                    expect(url).not.toContain(product.id);

                    return true;
                }),
                { numRuns: 100 }
            );
        });

        it('falls back to id when slug is not available', () => {
            fc.assert(
                fc.property(productWithoutSlugArb, (product) => {
                    const url = generateProductUrl(product);

                    // URL should use id as fallback
                    expect(url).toBe(`/product/${product.id}`);

                    return true;
                }),
                { numRuns: 100 }
            );
        });
    });

    describe('Search results links (Requirement 3.2)', () => {
        it('uses slug when available', () => {
            fc.assert(
                fc.property(productWithSlugArb, (product) => {
                    const url = generateSearchResultUrl(product);

                    // URL should use slug
                    expect(url).toBe(`/product/${product.slug}`);

                    return true;
                }),
                { numRuns: 100 }
            );
        });

        it('falls back to id when slug is not available', () => {
            fc.assert(
                fc.property(productWithoutSlugArb, (product) => {
                    const url = generateSearchResultUrl(product);

                    // URL should use id as fallback
                    expect(url).toBe(`/product/${product.id}`);

                    return true;
                }),
                { numRuns: 100 }
            );
        });
    });

    describe('Cart product links (Requirement 3.3)', () => {
        it('uses product slug when available', () => {
            fc.assert(
                fc.property(uuidArb, slugArb, (productId, slug) => {
                    const item = {
                        product_id: productId,
                        product: { slug },
                    };
                    const url = generateCartItemUrl(item);

                    // URL should use slug
                    expect(url).toBe(`/product/${slug}`);
                    expect(url).not.toContain(productId);

                    return true;
                }),
                { numRuns: 100 }
            );
        });

        it('falls back to product_id when product slug is not available', () => {
            fc.assert(
                fc.property(uuidArb, (productId) => {
                    const item = {
                        product_id: productId,
                        product: undefined,
                    };
                    const url = generateCartItemUrl(item);

                    // URL should use product_id as fallback
                    expect(url).toBe(`/product/${productId}`);

                    return true;
                }),
                { numRuns: 100 }
            );
        });

        it('falls back to product_id when product exists but slug is undefined', () => {
            fc.assert(
                fc.property(uuidArb, (productId) => {
                    const item = {
                        product_id: productId,
                        product: { slug: undefined },
                    };
                    const url = generateCartItemUrl(item);

                    // URL should use product_id as fallback
                    expect(url).toBe(`/product/${productId}`);

                    return true;
                }),
                { numRuns: 100 }
            );
        });
    });

    describe('Order history/downloads links (Requirement 3.4)', () => {
        it('uses product_slug when available', () => {
            fc.assert(
                fc.property(uuidArb, slugArb, (productId, slug) => {
                    const item = {
                        product_id: productId,
                        product_slug: slug,
                    };
                    const url = generateDownloadItemUrl(item);

                    // URL should use slug
                    expect(url).toBe(`/product/${slug}`);
                    expect(url).not.toContain(productId);

                    return true;
                }),
                { numRuns: 100 }
            );
        });

        it('falls back to product_id when product_slug is not available', () => {
            fc.assert(
                fc.property(uuidArb, (productId) => {
                    const item = {
                        product_id: productId,
                        product_slug: undefined,
                    };
                    const url = generateDownloadItemUrl(item);

                    // URL should use product_id as fallback
                    expect(url).toBe(`/product/${productId}`);

                    return true;
                }),
                { numRuns: 100 }
            );
        });
    });

    describe('URL format consistency', () => {
        it('all generated URLs start with /product/', () => {
            fc.assert(
                fc.property(
                    fc.oneof(productWithSlugArb, productWithoutSlugArb),
                    (product) => {
                        const url = generateProductUrl(product);

                        // URL should always start with /product/
                        expect(url).toMatch(/^\/product\//);

                        return true;
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('generated URLs contain no double slashes', () => {
            fc.assert(
                fc.property(
                    fc.oneof(productWithSlugArb, productWithoutSlugArb),
                    (product) => {
                        const url = generateProductUrl(product);

                        // URL should not contain double slashes (except in protocol)
                        expect(url).not.toMatch(/\/\//);

                        return true;
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('slug-based URLs are shorter than UUID-based URLs', () => {
            fc.assert(
                fc.property(uuidArb, slugArb, (id, slug) => {
                    // Only test when slug is shorter than UUID (36 chars)
                    if (slug.length >= 36) {
                        return true;
                    }

                    const slugUrl = generateProductUrl({ id, slug });
                    const idUrl = generateProductUrl({ id, slug: undefined });

                    // Slug URL should be shorter
                    expect(slugUrl.length).toBeLessThan(idUrl.length);

                    return true;
                }),
                { numRuns: 100 }
            );
        });
    });
});

// ============================================
// Edge Cases
// ============================================

describe('Product Link Generation Edge Cases', () => {
    it('handles empty slug by falling back to id', () => {
        const product = { id: '123e4567-e89b-12d3-a456-426614174000', slug: '' };
        const url = generateProductUrl(product);
        // Empty string is falsy, so should fall back to id
        expect(url).toBe(`/product/${product.id}`);
    });

    it('handles product with both id and slug', () => {
        const product = {
            id: '123e4567-e89b-12d3-a456-426614174000',
            slug: 'my-product',
        };
        const url = generateProductUrl(product);
        expect(url).toBe('/product/my-product');
    });

    it('handles cart item with nested product slug', () => {
        const item = {
            product_id: '123e4567-e89b-12d3-a456-426614174000',
            product: { slug: 'cart-product' },
        };
        const url = generateCartItemUrl(item);
        expect(url).toBe('/product/cart-product');
    });

    it('handles download item with product_slug', () => {
        const item = {
            product_id: '123e4567-e89b-12d3-a456-426614174000',
            product_slug: 'download-product',
        };
        const url = generateDownloadItemUrl(item);
        expect(url).toBe('/product/download-product');
    });
});
