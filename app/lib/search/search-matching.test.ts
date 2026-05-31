/**
 * Property-Based Tests for Search Matching
 * 
 * **Feature: store-frontend, Property 12: Search returns matching products**
 * **Validates: Requirements 7.1**
 * 
 * These tests verify that search functionality correctly returns products
 * where name or description contains the query string (case-insensitive).
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import type { Product, ProductType } from "~/lib/supabase/types";
import {
    searchProducts,
    productMatchesQuery,
    validateSearchResults,
} from "./index";

// ============================================
// Arbitraries (Generators)
// ============================================

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
 * Generate a valid ISO date string
 */
const isoDateArb = fc.integer({ min: 1577836800000, max: 1924905600000 })
    .map(timestamp => new Date(timestamp).toISOString());

/**
 * Generate a non-empty string for product names
 */
const productNameArb = fc.string({ minLength: 1, maxLength: 100 })
    .filter(s => s.trim().length > 0);

/**
 * Generate an optional description
 */
const descriptionArb = fc.option(
    fc.string({ minLength: 1, maxLength: 500 }),
    { nil: undefined }
);

/**
 * Generate a minimal Product with required fields for search
 */
const productArb = fc.record({
    id: fc.uuid(),
    product_code: fc.string({ minLength: 11, maxLength: 11 }).map(s => `Gis${s.slice(0, 8).padStart(8, '0')}`),
    name: productNameArb,
    description: descriptionArb,
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
const productsArrayArb = fc.array(productArb, { minLength: 0, maxLength: 50 });

/**
 * Generate a non-empty search query
 */
const searchQueryArb = fc.string({ minLength: 1, maxLength: 50 })
    .filter(s => s.trim().length > 0);

// ============================================
// Property Tests
// ============================================

describe("Property 12: Search returns matching products", () => {
    /**
     * **Feature: store-frontend, Property 12: Search returns matching products**
     * **Validates: Requirements 7.1**
     * 
     * For any search query, all returned products SHALL have names or descriptions
     * containing the query string (case-insensitive).
     */
    it("all search results contain the query string in name or description", () => {
        fc.assert(
            fc.property(
                productsArrayArb,
                searchQueryArb,
                (products, query) => {
                    const results = searchProducts(products, query);
                    const normalizedQuery = query.toLowerCase().trim();

                    // Every result must contain the query in name or description
                    return results.every(product => {
                        const nameMatch = product.name.toLowerCase().includes(normalizedQuery);
                        const descMatch = product.description?.toLowerCase().includes(normalizedQuery) || false;
                        return nameMatch || descMatch;
                    });
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Search is case-insensitive
     * 
     * Searching with different cases of the same query should return the same results.
     */
    it("search is case-insensitive", () => {
        fc.assert(
            fc.property(
                productsArrayArb,
                searchQueryArb,
                (products, query) => {
                    const lowerResults = searchProducts(products, query.toLowerCase());
                    const upperResults = searchProducts(products, query.toUpperCase());
                    const mixedResults = searchProducts(products, query);

                    // All case variations should return the same number of results
                    return lowerResults.length === upperResults.length &&
                        upperResults.length === mixedResults.length;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Completeness: All products matching the query are included
     * 
     * For any query, all products with matching name or description
     * should be present in the search results.
     */
    it("search includes all products with matching name or description", () => {
        fc.assert(
            fc.property(
                productsArrayArb,
                searchQueryArb,
                (products, query) => {
                    const results = searchProducts(products, query);
                    const normalizedQuery = query.toLowerCase().trim();

                    // Count products that should match
                    const expectedCount = products.filter(p => {
                        const nameMatch = p.name.toLowerCase().includes(normalizedQuery);
                        const descMatch = p.description?.toLowerCase().includes(normalizedQuery) || false;
                        return nameMatch || descMatch;
                    }).length;

                    return results.length === expectedCount;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * productMatchesQuery is consistent with searchProducts
     */
    it("productMatchesQuery is consistent with searchProducts", () => {
        fc.assert(
            fc.property(
                productArb,
                searchQueryArb,
                (product, query) => {
                    const results = searchProducts([product], query);
                    const matches = productMatchesQuery(product, query);

                    // If product matches, it should be in results
                    // If product doesn't match, results should be empty
                    return matches === (results.length === 1);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * validateSearchResults returns true for search results
     */
    it("validateSearchResults returns true for search results", () => {
        fc.assert(
            fc.property(
                productsArrayArb,
                searchQueryArb,
                (products, query) => {
                    const results = searchProducts(products, query);
                    return validateSearchResults(results, query);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Empty query returns no results
     */
    it("empty query returns no results", () => {
        fc.assert(
            fc.property(
                productsArrayArb,
                fc.constantFrom("", "   ", "\t", "\n"),
                (products, emptyQuery) => {
                    const results = searchProducts(products, emptyQuery);
                    return results.length === 0;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Search is idempotent
     * 
     * Searching the results again with the same query should return the same results.
     */
    it("search is idempotent", () => {
        fc.assert(
            fc.property(
                productsArrayArb,
                searchQueryArb,
                (products, query) => {
                    const results1 = searchProducts(products, query);
                    const results2 = searchProducts(results1, query);

                    // Second search should return the same products
                    return results1.length === results2.length &&
                        results1.every((p, i) => p.id === results2[i].id);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Products with query in name are found
     * 
     * If we inject the query into a product's name, it should be found.
     */
    it("products with query in name are found", () => {
        fc.assert(
            fc.property(
                productArb,
                searchQueryArb,
                (product, query) => {
                    // Create a product with the query in its name
                    const productWithQuery: Product = {
                        ...product,
                        name: `${product.name} ${query} suffix`,
                    };

                    const results = searchProducts([productWithQuery], query);
                    return results.length === 1 && results[0].id === productWithQuery.id;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Products with query in description are found
     * 
     * If we inject the query into a product's description, it should be found.
     */
    it("products with query in description are found", () => {
        fc.assert(
            fc.property(
                productArb,
                searchQueryArb,
                (product, query) => {
                    // Create a product with the query in its description
                    const productWithQuery: Product = {
                        ...product,
                        name: "Unrelated Name XYZ",
                        description: `Some description with ${query} in it`,
                    };

                    const results = searchProducts([productWithQuery], query);
                    return results.length === 1 && results[0].id === productWithQuery.id;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Empty products array returns empty results
     */
    it("searching empty array returns empty array", () => {
        fc.assert(
            fc.property(
                searchQueryArb,
                (query) => {
                    const results = searchProducts([], query);
                    return results.length === 0;
                }
            ),
            { numRuns: 100 }
        );
    });
});
