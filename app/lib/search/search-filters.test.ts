/**
 * Property-Based Tests for Search Result Filtering
 *
 * **Feature: brand-management, Property 10: Search Result Filtering**
 * **Validates: Requirements 3.5, 4.3**
 *
 * These tests verify that:
 * - Search results only include active brands (is_active = true)
 * - Search results only include brands where name matches the search term
 * - Search results only include active products
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import type { Brand, BrandGroup, Product, ProductType } from "~/lib/supabase/types";
import type { SearchResult } from "~/components/search/search-results";

// ============================================
// Pure Functions for Testing (extracted logic)
// ============================================

/**
 * Filter brands for search results
 * This is the core filtering logic used by quick search
 * 
 * Requirements: 3.5, 4.3
 * - Only returns active brands (is_active = true)
 * - Only returns brands where name matches the search term
 */
function filterBrandsForSearch(brands: Brand[], query: string): Brand[] {
    const searchTerm = query.trim().toLowerCase();

    if (!searchTerm) {
        return [];
    }

    return brands.filter((brand) =>
        brand.is_active === true &&
        brand.name.toLowerCase().includes(searchTerm)
    );
}

/**
 * Filter products for search results
 * 
 * Requirements: 4.3
 * - Only returns active products (is_active = true)
 * - Only returns products where name, subtitle, or description matches
 */
function filterProductsForSearch(products: Product[], query: string): Product[] {
    const searchTerm = query.trim().toLowerCase();

    if (!searchTerm) {
        return [];
    }

    return products.filter((product) => {
        if (!product.is_active) return false;

        const nameMatch = product.name.toLowerCase().includes(searchTerm);
        const subtitleMatch = product.subtitle?.toLowerCase().includes(searchTerm) || false;
        const descMatch = product.description?.toLowerCase().includes(searchTerm) || false;

        return nameMatch || subtitleMatch || descMatch;
    });
}

/**
 * Convert brands to search results
 */
function brandsToSearchResults(brands: Brand[]): SearchResult[] {
    return brands.map((brand) => ({
        type: "brand" as const,
        id: brand.id,
        name: brand.name,
        image: brand.logo_url || undefined,
        url: `/brands/${brand.slug}`,
    }));
}

/**
 * Convert products to search results
 */
function productsToSearchResults(products: Product[]): SearchResult[] {
    return products.map((product) => ({
        type: "product" as const,
        id: product.id,
        name: product.name,
        subtitle: product.subtitle || undefined,
        url: `/products/${product.id}`,
    }));
}

/**
 * Check if all brand results are active
 */
function allBrandResultsActive(brands: Brand[], results: SearchResult[]): boolean {
    const brandResults = results.filter(r => r.type === "brand");
    return brandResults.every((result) => {
        const brand = brands.find(b => b.id === result.id);
        return brand?.is_active === true;
    });
}

/**
 * Check if all brand results match the query
 */
function allBrandResultsMatchQuery(results: SearchResult[], query: string): boolean {
    const searchTerm = query.trim().toLowerCase();
    const brandResults = results.filter(r => r.type === "brand");
    return brandResults.every((result) =>
        result.name.toLowerCase().includes(searchTerm)
    );
}

// ============================================
// Arbitraries (Generators)
// ============================================

/**
 * Generate a valid brand group
 */
const brandGroupArb: fc.Arbitrary<BrandGroup> = fc.constantFrom(
    "os",
    "platform",
    "store",
    "other"
);

/**
 * Generate a valid slug (lowercase letters, numbers, hyphens)
 */
const slugArb = fc
    .array(
        fc.oneof(
            fc.integer({ min: 97, max: 122 }).map((c) => String.fromCharCode(c)), // a-z
            fc.integer({ min: 48, max: 57 }).map((c) => String.fromCharCode(c)), // 0-9
            fc.constant("-")
        ),
        { minLength: 1, maxLength: 50 }
    )
    .map((chars) => chars.join(""))
    .filter((s) => !s.startsWith("-") && !s.endsWith("-") && !s.includes("--"));

/**
 * Generate a valid ISO date string
 */
const isoDateArb = fc
    .integer({ min: 1577836800000, max: 1924905600000 })
    .map((timestamp) => new Date(timestamp).toISOString());

/**
 * Generate a valid Brand
 */
const brandArb: fc.Arbitrary<Brand> = fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 100 }),
    slug: slugArb,
    logo_url: fc.option(fc.webUrl(), { nil: undefined }),
    brand_group: brandGroupArb,
    sort_order: fc.integer({ min: 0, max: 1000 }),
    is_active: fc.boolean(),
    description: fc.option(fc.string({ maxLength: 500 }), { nil: undefined }),
    created_at: isoDateArb,
    updated_at: isoDateArb,
});

/**
 * Generate an active brand (is_active = true)
 */
const activeBrandArb: fc.Arbitrary<Brand> = brandArb.map((brand) => ({
    ...brand,
    is_active: true,
}));

/**
 * Generate an inactive brand (is_active = false)
 */
const inactiveBrandArb: fc.Arbitrary<Brand> = brandArb.map((brand) => ({
    ...brand,
    is_active: false,
}));

/**
 * Generate an array of brands (mixed active/inactive)
 */
const brandsArb = fc.array(brandArb, { minLength: 0, maxLength: 20 });

/**
 * Generate a valid ProductType
 */
const productTypeArb = fc.constantFrom<ProductType>(
    "app",
    "game_card",
    "game_cdk",
    "game_digital",
    "physical",
    "overseas"
);

/**
 * Generate a minimal Product
 */
const productArb: fc.Arbitrary<Product> = fc.record({
    id: fc.uuid(),
    product_code: fc.string({ minLength: 11, maxLength: 11 }).map(s => `Gis${s.slice(0, 8).padStart(8, '0')}`),
    name: fc.string({ minLength: 1, maxLength: 100 }),
    subtitle: fc.option(fc.string({ maxLength: 200 }), { nil: undefined }),
    description: fc.option(fc.string({ maxLength: 500 }), { nil: undefined }),
    product_type: productTypeArb,
    delivery_type: fc.constantFrom("download", "license_key", "cdk", "shipment", "manual"),
    category_id: fc.uuid(),
    is_active: fc.boolean(),
    has_discount: fc.boolean(),
    has_demo_video: fc.boolean(),
    created_at: isoDateArb,
    updated_at: isoDateArb,
}) as fc.Arbitrary<Product>;

/**
 * Generate an array of products
 */
const productsArb = fc.array(productArb, { minLength: 0, maxLength: 20 });

/**
 * Generate a non-empty search query
 */
const searchQueryArb = fc.string({ minLength: 1, maxLength: 50 })
    .filter(s => s.trim().length > 0);

// ============================================
// Property Tests
// ============================================

describe("Property 10: Search Result Filtering", () => {
    /**
     * **Feature: brand-management, Property 10: Search Result Filtering**
     * **Validates: Requirements 3.5, 4.3**
     *
     * Core property: Search results only include active brands
     */
    it("search results only include active brands", () => {
        fc.assert(
            fc.property(brandsArb, searchQueryArb, (brands, query) => {
                const filtered = filterBrandsForSearch(brands, query);
                const results = brandsToSearchResults(filtered);

                // All brand results must be from active brands
                expect(allBrandResultsActive(brands, results)).toBe(true);

                return true;
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Search results only include brands where name matches the query
     */
    it("search results only include brands where name matches query", () => {
        fc.assert(
            fc.property(brandsArb, searchQueryArb, (brands, query) => {
                const filtered = filterBrandsForSearch(brands, query);
                const results = brandsToSearchResults(filtered);

                // All brand results must match the query
                expect(allBrandResultsMatchQuery(results, query)).toBe(true);

                return true;
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Inactive brands are never included in search results
     */
    it("inactive brands are never included in search results", () => {
        fc.assert(
            fc.property(
                fc.tuple(
                    fc.array(activeBrandArb, { minLength: 0, maxLength: 10 }),
                    inactiveBrandArb,
                    fc.array(activeBrandArb, { minLength: 0, maxLength: 10 })
                ),
                searchQueryArb,
                ([before, inactive, after], query) => {
                    const brands = [...before, inactive, ...after];
                    const filtered = filterBrandsForSearch(brands, query);

                    // Inactive brand should never be in results
                    expect(filtered.some(b => b.id === inactive.id)).toBe(false);

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Active brands matching query are included in results
     */
    it("active brands matching query are included in results", () => {
        // Use a brand generator that ensures non-whitespace names
        const brandWithValidNameArb = activeBrandArb.filter(b => b.name.trim().length > 0);

        fc.assert(
            fc.property(brandWithValidNameArb, (brand) => {
                // Use part of the brand name as query
                const query = brand.name.slice(0, Math.max(1, Math.floor(brand.name.length / 2)));

                // Skip if query becomes empty after trim (edge case)
                if (query.trim().length === 0) {
                    return true;
                }

                const filtered = filterBrandsForSearch([brand], query);

                // Brand should be in results if name contains query (after trim)
                const shouldMatch = brand.name.toLowerCase().includes(query.trim().toLowerCase());
                expect(filtered.length === 1).toBe(shouldMatch);

                return true;
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Search is case-insensitive for brands
     */
    it("brand search is case-insensitive", () => {
        fc.assert(
            fc.property(brandsArb, searchQueryArb, (brands, query) => {
                const lowerResults = filterBrandsForSearch(brands, query.toLowerCase());
                const upperResults = filterBrandsForSearch(brands, query.toUpperCase());

                // Both should return same number of results
                expect(lowerResults.length).toBe(upperResults.length);

                return true;
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Empty query returns no results
     */
    it("empty query returns no brand results", () => {
        fc.assert(
            fc.property(
                brandsArb,
                fc.constantFrom("", "   ", "\t", "\n"),
                (brands, emptyQuery) => {
                    const filtered = filterBrandsForSearch(brands, emptyQuery);
                    expect(filtered.length).toBe(0);

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Search results only include active products
     */
    it("search results only include active products", () => {
        fc.assert(
            fc.property(productsArb, searchQueryArb, (products, query) => {
                const filtered = filterProductsForSearch(products, query);

                // All product results must be active
                expect(filtered.every(p => p.is_active === true)).toBe(true);

                return true;
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Inactive products are never included in search results
     */
    it("inactive products are never included in search results", () => {
        fc.assert(
            fc.property(productArb, searchQueryArb, (product, query) => {
                const inactiveProduct = { ...product, is_active: false };
                const filtered = filterProductsForSearch([inactiveProduct], query);

                // Inactive product should never be in results
                expect(filtered.length).toBe(0);

                return true;
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Products matching query in name are included
     */
    it("active products matching query in name are included", () => {
        // Use a product generator that ensures non-whitespace names
        const productWithValidNameArb = productArb.filter(p => p.name.trim().length > 0);

        fc.assert(
            fc.property(productWithValidNameArb, (product) => {
                const activeProduct = { ...product, is_active: true };
                // Use part of the product name as query
                const query = activeProduct.name.slice(0, Math.max(1, Math.floor(activeProduct.name.length / 2)));

                // Skip if query becomes empty after trim (edge case)
                if (query.trim().length === 0) {
                    return true;
                }

                const filtered = filterProductsForSearch([activeProduct], query);

                // Product should be in results if name contains query (after trim)
                const shouldMatch = activeProduct.name.toLowerCase().includes(query.trim().toLowerCase());
                expect(filtered.length === 1).toBe(shouldMatch);

                return true;
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Combined search preserves type information
     */
    it("search results preserve type information", () => {
        fc.assert(
            fc.property(brandsArb, productsArb, searchQueryArb, (brands, products, query) => {
                const filteredBrands = filterBrandsForSearch(brands, query);
                const filteredProducts = filterProductsForSearch(products, query);

                const brandResults = brandsToSearchResults(filteredBrands);
                const productResults = productsToSearchResults(filteredProducts);

                // All brand results should have type "brand"
                expect(brandResults.every(r => r.type === "brand")).toBe(true);

                // All product results should have type "product"
                expect(productResults.every(r => r.type === "product")).toBe(true);

                return true;
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Search results have required fields
     */
    it("search results have required fields", () => {
        fc.assert(
            fc.property(brandsArb, searchQueryArb, (brands, query) => {
                const filtered = filterBrandsForSearch(brands, query);
                const results = brandsToSearchResults(filtered);

                // Each result should have required fields
                for (const result of results) {
                    expect(result.type).toBeDefined();
                    expect(result.id).toBeDefined();
                    expect(result.name).toBeDefined();
                    expect(result.url).toBeDefined();
                    expect(result.url.startsWith("/brands/")).toBe(true);
                }

                return true;
            }),
            { numRuns: 100 }
        );
    });
});
