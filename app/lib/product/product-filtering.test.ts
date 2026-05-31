/**
 * Property-Based Tests for Product Listing Categorization
 * 
 * **Feature: store-frontend, Property 1: Product listing displays correct categorization**
 * **Validates: Requirements 1.2, 1.3, 1.4, 1.5**
 * 
 * These tests verify that product filtering by store section correctly
 * categorizes products based on their product_type.
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import type { Product, ProductType, StoreSection } from "~/lib/supabase/types";
import {
    filterProductsBySection,
    isProductInSection,
    SECTION_PRODUCT_TYPES,
    validateProductsInSection,
    getSectionForProductType,
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
 * Generate a valid StoreSection
 */
const storeSectionArb = fc.constantFrom<StoreSection>(
    "apps",
    "games",
    "store",
    "overseas"
);

/**
 * Generate a valid ISO date string
 */
const isoDateArb = fc.integer({ min: 1577836800000, max: 1924905600000 }) // 2020-01-01 to 2030-12-31
    .map(timestamp => new Date(timestamp).toISOString());

/**
 * Generate a minimal Product with required fields for filtering
 */
const productArb = fc.record({
    id: fc.uuid(),
    product_code: fc.string({ minLength: 11, maxLength: 11 }).map(s => `Gis${s.slice(0, 8).padStart(8, '0')}`),
    name: fc.string({ minLength: 1, maxLength: 100 }),
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

// ============================================
// Property Tests
// ============================================

describe("Property 1: Product listing displays correct categorization", () => {
    /**
     * **Feature: store-frontend, Property 1: Product listing displays correct categorization**
     * **Validates: Requirements 1.2, 1.3, 1.4, 1.5**
     * 
     * For any store section and any set of products, the filtered products
     * SHALL only include items matching the section's product types.
     */
    it("filtered products only contain valid product types for the section", () => {
        fc.assert(
            fc.property(
                productsArrayArb,
                storeSectionArb,
                (products, section) => {
                    const filtered = filterProductsBySection(products, section);
                    const validTypes = SECTION_PRODUCT_TYPES[section];

                    // Every filtered product must have a product_type in the valid types list
                    return filtered.every(product => validTypes.includes(product.product_type));
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Requirement 1.2: /apps displays only 'app' type products
     */
    it("apps section only contains app type products", () => {
        fc.assert(
            fc.property(
                productsArrayArb,
                (products) => {
                    const filtered = filterProductsBySection(products, "apps");
                    return filtered.every(product => product.product_type === "app");
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Requirement 1.3: /games displays game_card, game_cdk, game_digital products
     */
    it("games section only contains game type products", () => {
        fc.assert(
            fc.property(
                productsArrayArb,
                (products) => {
                    const filtered = filterProductsBySection(products, "games");
                    const gameTypes: ProductType[] = ["game_card", "game_cdk", "game_digital"];
                    return filtered.every(product => gameTypes.includes(product.product_type));
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Requirement 1.4: /store displays only 'physical' type products
     */
    it("store section only contains physical type products", () => {
        fc.assert(
            fc.property(
                productsArrayArb,
                (products) => {
                    const filtered = filterProductsBySection(products, "store");
                    return filtered.every(product => product.product_type === "physical");
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Requirement 1.5: /overseas displays only 'overseas' type products
     */
    it("overseas section only contains overseas type products", () => {
        fc.assert(
            fc.property(
                productsArrayArb,
                (products) => {
                    const filtered = filterProductsBySection(products, "overseas");
                    return filtered.every(product => product.product_type === "overseas");
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Completeness: All products with matching types are included
     * 
     * For any section, all products with valid types for that section
     * should be present in the filtered result.
     */
    it("filtering includes all products with matching types", () => {
        fc.assert(
            fc.property(
                productsArrayArb,
                storeSectionArb,
                (products, section) => {
                    const filtered = filterProductsBySection(products, section);
                    const validTypes = SECTION_PRODUCT_TYPES[section];

                    // Count products that should be included
                    const expectedCount = products.filter(p => validTypes.includes(p.product_type)).length;

                    return filtered.length === expectedCount;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Idempotence: Filtering twice produces the same result
     */
    it("filtering is idempotent", () => {
        fc.assert(
            fc.property(
                productsArrayArb,
                storeSectionArb,
                (products, section) => {
                    const filtered1 = filterProductsBySection(products, section);
                    const filtered2 = filterProductsBySection(filtered1, section);

                    // Second filter should return the same products
                    return filtered1.length === filtered2.length &&
                        filtered1.every((p, i) => p.id === filtered2[i].id);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * isProductInSection is consistent with filterProductsBySection
     */
    it("isProductInSection is consistent with filterProductsBySection", () => {
        fc.assert(
            fc.property(
                productArb,
                storeSectionArb,
                (product, section) => {
                    const filtered = filterProductsBySection([product], section);
                    const isInSection = isProductInSection(product, section);

                    // If product is in section, it should be in filtered result
                    // If product is not in section, filtered should be empty
                    return isInSection === (filtered.length === 1);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * validateProductsInSection returns true for properly filtered products
     */
    it("validateProductsInSection returns true for filtered products", () => {
        fc.assert(
            fc.property(
                productsArrayArb,
                storeSectionArb,
                (products, section) => {
                    const filtered = filterProductsBySection(products, section);
                    return validateProductsInSection(filtered, section);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * getSectionForProductType is inverse of SECTION_PRODUCT_TYPES mapping
     */
    it("getSectionForProductType correctly maps product types to sections", () => {
        fc.assert(
            fc.property(
                productTypeArb,
                (productType) => {
                    const section = getSectionForProductType(productType);
                    const validTypes = SECTION_PRODUCT_TYPES[section];
                    return validTypes.includes(productType);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Empty input produces empty output
     */
    it("filtering empty array returns empty array", () => {
        fc.assert(
            fc.property(
                storeSectionArb,
                (section) => {
                    const filtered = filterProductsBySection([], section);
                    return filtered.length === 0;
                }
            ),
            { numRuns: 100 }
        );
    });
});
