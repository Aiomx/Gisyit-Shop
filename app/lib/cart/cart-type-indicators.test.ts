/**
 * Property-Based Tests for Cart Type Indicators
 *
 * **Feature: store-frontend, Property 7: Cart displays type indicators for mixed products**
 * **Validates: Requirements 4.5**
 *
 * These tests verify that cart items display correct type indicators:
 * - Digital products (app, game_card, game_cdk, game_digital) show "数字商品"
 * - Physical products (physical, overseas) show "实物商品"
 * - Mixed carts correctly categorize each item
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import type { ProductType, DeliveryType } from "~/lib/supabase/types";
import type { CartItemWithProduct } from "./types";
import {
    getProductTypeCategory,
    type ProductTypeCategory,
} from "~/components/product/type-badge";

// ============================================
// Type Indicator Logic (extracted for testing)
// ============================================

/**
 * Digital product types - should display "数字商品"
 */
const DIGITAL_PRODUCT_TYPES: ProductType[] = [
    "app",
    "game_card",
    "game_cdk",
    "game_digital",
];

/**
 * Physical product types - should display "实物商品"
 */
const PHYSICAL_PRODUCT_TYPES: ProductType[] = ["physical", "overseas"];

/**
 * All valid product types
 */
const ALL_PRODUCT_TYPES: ProductType[] = [
    ...DIGITAL_PRODUCT_TYPES,
    ...PHYSICAL_PRODUCT_TYPES,
];

/**
 * Check if a cart has mixed product types (both digital and physical)
 */
function hasMixedProductTypes(items: CartItemWithProduct[]): boolean {
    const hasDigital = items.some((item) =>
        DIGITAL_PRODUCT_TYPES.includes(item.product.product_type)
    );
    const hasPhysical = items.some((item) =>
        PHYSICAL_PRODUCT_TYPES.includes(item.product.product_type)
    );
    return hasDigital && hasPhysical;
}

/**
 * Get expected type category for a product type
 */
function getExpectedTypeCategory(productType: ProductType): ProductTypeCategory {
    if (DIGITAL_PRODUCT_TYPES.includes(productType)) {
        return "digital";
    }
    return "physical";
}

// ============================================
// Arbitraries (Generators)
// ============================================

/**
 * Generate a digital product type
 */
const digitalProductTypeArb: fc.Arbitrary<ProductType> = fc.constantFrom(
    ...DIGITAL_PRODUCT_TYPES
);

/**
 * Generate a physical product type
 */
const physicalProductTypeArb: fc.Arbitrary<ProductType> = fc.constantFrom(
    ...PHYSICAL_PRODUCT_TYPES
);

/**
 * Generate any valid product type
 */
const productTypeArb: fc.Arbitrary<ProductType> = fc.constantFrom(
    ...ALL_PRODUCT_TYPES
);

/**
 * Generate a valid delivery type
 */
const deliveryTypeArb: fc.Arbitrary<DeliveryType> = fc.constantFrom(
    "download",
    "license_key",
    "cdk",
    "shipment",
    "manual"
);

/**
 * Generate a valid currency
 */
const currencyArb = fc.constantFrom("CNY", "USD");

/**
 * Generate a valid price
 */
const priceArb = fc
    .integer({ min: 1, max: 9999999 })
    .map((cents) => cents / 100);

/**
 * Generate a valid quantity
 */
const quantityArb = fc.integer({ min: 1, max: 99 });

/**
 * Generate a valid ISO date string
 */
const isoDateArb = fc
    .integer({ min: 1577836800000, max: 1924905600000 })
    .map((timestamp) => new Date(timestamp).toISOString());

/**
 * Generate a product with a specific product type
 */
const productWithTypeArb = (productType: fc.Arbitrary<ProductType>) =>
    fc.record({
        id: fc.uuid(),
        product_code: fc
            .integer({ min: 0, max: 99999999 })
            .map((n) => `Gis${n.toString().padStart(8, "0")}`),
        name: fc.string({ minLength: 1, maxLength: 100 }),
        product_type: productType,
        delivery_type: deliveryTypeArb,
        category_id: fc.uuid(),
        is_active: fc.constant(true),
        has_discount: fc.boolean(),
        has_demo_video: fc.boolean(),
        created_at: isoDateArb,
        updated_at: isoDateArb,
    });

/**
 * Generate a cart item with a specific product type
 */
const cartItemWithTypeArb = (
    productType: fc.Arbitrary<ProductType>
): fc.Arbitrary<CartItemWithProduct> =>
    fc.record({
        id: fc.uuid(),
        cart_id: fc.uuid(),
        product_id: fc.uuid(),
        price_id: fc.uuid(),
        spec_combination: fc.option(
            fc.dictionary(
                fc.string({ minLength: 1, maxLength: 20 }),
                fc.string({ minLength: 1, maxLength: 50 })
            ),
            { nil: undefined }
        ),
        quantity: quantityArb,
        snapshot_price: priceArb,
        snapshot_currency: currencyArb,
        created_at: isoDateArb,
        updated_at: isoDateArb,
        product: productWithTypeArb(productType),
    });

/**
 * Generate a cart item with any product type
 */
const cartItemArb = cartItemWithTypeArb(productTypeArb);

/**
 * Generate a digital cart item
 */
const digitalCartItemArb = cartItemWithTypeArb(digitalProductTypeArb);

/**
 * Generate a physical cart item
 */
const physicalCartItemArb = cartItemWithTypeArb(physicalProductTypeArb);

/**
 * Generate a mixed cart (at least one digital and one physical item)
 */
const mixedCartArb: fc.Arbitrary<CartItemWithProduct[]> = fc
    .tuple(
        fc.array(digitalCartItemArb, { minLength: 1, maxLength: 5 }),
        fc.array(physicalCartItemArb, { minLength: 1, maxLength: 5 })
    )
    .map(([digital, physical]) => [...digital, ...physical]);

// ============================================
// Property Tests
// ============================================

describe("Property 7: Cart displays type indicators for mixed products", () => {
    /**
     * **Feature: store-frontend, Property 7: Cart displays type indicators for mixed products**
     * **Validates: Requirements 4.5**
     *
     * Core property: Each cart item displays the correct type indicator
     */
    it("each cart item displays the correct type indicator based on product type", () => {
        fc.assert(
            fc.property(cartItemArb, (item) => {
                const expectedCategory = getExpectedTypeCategory(
                    item.product.product_type
                );
                const actualCategory = getProductTypeCategory(
                    item.product.product_type
                );

                expect(actualCategory).toBe(expectedCategory);
                return true;
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Digital product types return "digital" category
     */
    it("digital product types return 'digital' category", () => {
        fc.assert(
            fc.property(digitalProductTypeArb, (productType) => {
                const category = getProductTypeCategory(productType);
                expect(category).toBe("digital");
                return true;
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Physical product types return "physical" category
     */
    it("physical product types return 'physical' category", () => {
        fc.assert(
            fc.property(physicalProductTypeArb, (productType) => {
                const category = getProductTypeCategory(productType);
                expect(category).toBe("physical");
                return true;
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Mixed cart correctly identifies both digital and physical items
     */
    it("mixed cart correctly categorizes each item", () => {
        fc.assert(
            fc.property(mixedCartArb, (items) => {
                // Verify the cart is actually mixed
                expect(hasMixedProductTypes(items)).toBe(true);

                // Verify each item has the correct type indicator
                for (const item of items) {
                    const expectedCategory = getExpectedTypeCategory(
                        item.product.product_type
                    );
                    const actualCategory = getProductTypeCategory(
                        item.product.product_type
                    );
                    expect(actualCategory).toBe(expectedCategory);
                }

                return true;
            }),
            { numRuns: 100 }
        );
    });

    /**
     * All product types map to exactly one of two categories
     */
    it("all product types map to either 'digital' or 'physical'", () => {
        fc.assert(
            fc.property(productTypeArb, (productType) => {
                const category = getProductTypeCategory(productType);
                expect(["digital", "physical"]).toContain(category);
                return true;
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Type categorization is deterministic (same input always gives same output)
     */
    it("type categorization is deterministic", () => {
        fc.assert(
            fc.property(productTypeArb, (productType) => {
                const category1 = getProductTypeCategory(productType);
                const category2 = getProductTypeCategory(productType);
                expect(category1).toBe(category2);
                return true;
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Specific product type mappings are correct
     */
    describe("specific product type mappings", () => {
        it("'app' maps to 'digital'", () => {
            expect(getProductTypeCategory("app")).toBe("digital");
        });

        it("'game_card' maps to 'digital'", () => {
            expect(getProductTypeCategory("game_card")).toBe("digital");
        });

        it("'game_cdk' maps to 'digital'", () => {
            expect(getProductTypeCategory("game_cdk")).toBe("digital");
        });

        it("'game_digital' maps to 'digital'", () => {
            expect(getProductTypeCategory("game_digital")).toBe("digital");
        });

        it("'physical' maps to 'physical'", () => {
            expect(getProductTypeCategory("physical")).toBe("physical");
        });

        it("'overseas' maps to 'physical'", () => {
            expect(getProductTypeCategory("overseas")).toBe("physical");
        });
    });

    /**
     * Cart with only digital items has no physical indicators
     */
    it("cart with only digital items has no physical indicators", () => {
        fc.assert(
            fc.property(
                fc.array(digitalCartItemArb, { minLength: 1, maxLength: 10 }),
                (items) => {
                    for (const item of items) {
                        const category = getProductTypeCategory(
                            item.product.product_type
                        );
                        expect(category).toBe("digital");
                    }
                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Cart with only physical items has no digital indicators
     */
    it("cart with only physical items has no digital indicators", () => {
        fc.assert(
            fc.property(
                fc.array(physicalCartItemArb, { minLength: 1, maxLength: 10 }),
                (items) => {
                    for (const item of items) {
                        const category = getProductTypeCategory(
                            item.product.product_type
                        );
                        expect(category).toBe("physical");
                    }
                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });
});
