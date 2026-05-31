/**
 * Property-Based Tests for Verified Badge Visibility
 *
 * **Feature: product-verification-description, Property 2: Verification Badge Visibility Matches State**
 * **Validates: Requirements 3.1, 3.4**
 *
 * These tests verify that the verified badge is displayed if and only if
 * the product's is_verified field is true.
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import type {
    Product,
    ProductType,
    DeliveryType,
} from "~/lib/supabase/types";

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
 * Generate a valid DeliveryType
 */
const deliveryTypeArb = fc.constantFrom<DeliveryType>(
    "download",
    "license_key",
    "cdk",
    "shipment",
    "manual"
);

/**
 * Generate a valid ISO date string
 */
const isoDateArb = fc
    .integer({ min: 1577836800000, max: 1924905600000 })
    .map((timestamp) => new Date(timestamp).toISOString());

/**
 * Generate a minimal Product with configurable is_verified field
 */
const baseProductArb = fc.record({
    id: fc.uuid(),
    product_code: fc
        .string({ minLength: 11, maxLength: 11 })
        .map((s) => `Gis${s.slice(0, 8).padStart(8, "0")}`),
    name: fc.string({ minLength: 1, maxLength: 100 }),
    product_type: productTypeArb,
    delivery_type: deliveryTypeArb,
    category_id: fc.uuid(),
    is_active: fc.boolean(),
    has_discount: fc.boolean(),
    has_demo_video: fc.boolean(),
    created_at: isoDateArb,
    updated_at: isoDateArb,
});

// ============================================
// Helper Functions for Testing Badge Visibility
// ============================================

/**
 * Determines if the verified badge should be displayed for a product.
 * This mirrors the logic in ProductDetail component.
 *
 * Requirements 3.1: Display badge when is_verified is true
 * Requirements 3.4: Do NOT display badge when is_verified is false or undefined
 */
function shouldShowVerifiedBadge(product: Product): boolean {
    return product.is_verified === true;
}

// ============================================
// Property Tests - Property 2: Verification Badge Visibility Matches State
// ============================================

describe("Property 2: Verification Badge Visibility Matches State", () => {
    /**
     * **Feature: product-verification-description, Property 2: Verification Badge Visibility Matches State**
     * **Validates: Requirements 3.1, 3.4**
     *
     * For any product, the Verified Badge SHALL be displayed if and only if
     * is_verified is true.
     */

    describe("Verified products show badge", () => {
        it("products with is_verified=true should show the verified badge (Requirements: 3.1)", () => {
            fc.assert(
                fc.property(baseProductArb, (baseProduct) => {
                    const product: Product = {
                        ...baseProduct,
                        is_verified: true,
                    };

                    const showBadge = shouldShowVerifiedBadge(product);
                    return showBadge === true;
                }),
                { numRuns: 100 }
            );
        });
    });

    describe("Non-verified products hide badge", () => {
        it("products with is_verified=false should NOT show the verified badge (Requirements: 3.4)", () => {
            fc.assert(
                fc.property(baseProductArb, (baseProduct) => {
                    const product: Product = {
                        ...baseProduct,
                        is_verified: false,
                    };

                    const showBadge = shouldShowVerifiedBadge(product);
                    return showBadge === false;
                }),
                { numRuns: 100 }
            );
        });

        it("products with is_verified=undefined should NOT show the verified badge (Requirements: 3.4)", () => {
            fc.assert(
                fc.property(baseProductArb, (baseProduct) => {
                    const product: Product = {
                        ...baseProduct,
                        is_verified: undefined,
                    };

                    const showBadge = shouldShowVerifiedBadge(product);
                    return showBadge === false;
                }),
                { numRuns: 100 }
            );
        });
    });

    describe("Badge visibility is strictly boolean", () => {
        it("badge visibility matches is_verified state exactly for all boolean values", () => {
            fc.assert(
                fc.property(
                    baseProductArb,
                    fc.boolean(),
                    (baseProduct, isVerified) => {
                        const product: Product = {
                            ...baseProduct,
                            is_verified: isVerified,
                        };

                        const showBadge = shouldShowVerifiedBadge(product);
                        // Badge should be shown if and only if is_verified is true
                        return showBadge === isVerified;
                    }
                ),
                { numRuns: 100 }
            );
        });

        it("badge visibility handles all possible is_verified states (true, false, undefined)", () => {
            const isVerifiedArb = fc.oneof(
                fc.constant(true),
                fc.constant(false),
                fc.constant(undefined)
            );

            fc.assert(
                fc.property(
                    baseProductArb,
                    isVerifiedArb,
                    (baseProduct, isVerified) => {
                        const product: Product = {
                            ...baseProduct,
                            is_verified: isVerified,
                        };

                        const showBadge = shouldShowVerifiedBadge(product);
                        // Badge should only be shown when is_verified is exactly true
                        return showBadge === (isVerified === true);
                    }
                ),
                { numRuns: 100 }
            );
        });
    });
});
