/**
 * Property-Based Tests for Product Detail UI Elements
 *
 * **Feature: free-product-download, Property 4: Product Detail UI Elements**
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 *
 * These tests verify that the product detail page correctly displays
 * different UI elements based on whether the product is free or paid.
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import type {
    Product,
    ProductType,
    DeliveryType,
    ProductPrice,
} from "~/lib/supabase/types";
import {
    checkFreeProduct,
    shouldShowPrice,
    shouldShowCartOptions,
    getProductActionText,
} from "~/lib/product/free-product";

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
 * Generate a ProductPrice with configurable price amount and active status
 */
const productPriceArb = (
    priceAmount: fc.Arbitrary<number>,
    isActive: fc.Arbitrary<boolean>
): fc.Arbitrary<ProductPrice> =>
    fc.record({
        id: fc.uuid(),
        product_id: fc.uuid(),
        price_amount: priceAmount,
        currency: fc.constant("CNY"),
        is_active: isActive,
        created_at: isoDateArb,
    });

/**
 * Generate an array of active prices that are all zero
 */
const allZeroPricesArb = fc.array(
    productPriceArb(fc.constant(0), fc.constant(true)),
    { minLength: 1, maxLength: 5 }
);

/**
 * Generate an array of active prices with at least one non-zero
 */
const nonZeroPricesArb = fc.array(
    productPriceArb(fc.integer({ min: 1, max: 100000 }), fc.constant(true)),
    { minLength: 1, maxLength: 5 }
);

/**
 * Generate a minimal Product with configurable free-related fields
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

/**
 * Generate a free product (is_free = true, delivery_type = download)
 */
const freeProductArb = fc.record({
    ...baseProductArb.model,
    is_free: fc.constant(true),
    delivery_type: fc.constant<DeliveryType>("download"),
    require_login: fc.boolean(),
});

/**
 * Generate a paid product (is_free = false, non-zero prices)
 */
const paidProductArb = fc
    .tuple(baseProductArb, nonZeroPricesArb)
    .map(([base, prices]) => ({
        ...base,
        is_free: false,
        prices,
    }));

// ============================================
// Property Tests - Property 4: Product Detail UI Elements
// ============================================

describe("Property 4: Product Detail UI Elements", () => {
    /**
     * **Feature: free-product-download, Property 4: Product Detail UI Elements**
     * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
     *
     * For any free product detail page, the UI SHALL show only a download button
     * AND hide price display AND hide cart/checkout entry points;
     * for paid products, the UI SHALL show both "立即购买" and "加入购物车" buttons.
     */

    describe("Free product UI elements", () => {
        it("free products should hide price display (Requirements: 3.3)", () => {
            fc.assert(
                fc.property(freeProductArb, (baseProduct) => {
                    const product: Product = baseProduct as Product;

                    const showPrice = shouldShowPrice(product);
                    return showPrice === false;
                }),
                { numRuns: 100 }
            );
        });

        it("free products should hide cart/checkout options (Requirements: 3.4)", () => {
            fc.assert(
                fc.property(freeProductArb, (baseProduct) => {
                    const product: Product = baseProduct as Product;

                    const showCartOptions = shouldShowCartOptions(product);
                    return showCartOptions === false;
                }),
                { numRuns: 100 }
            );
        });

        it("free products should show download button (Requirements: 3.2)", () => {
            fc.assert(
                fc.property(freeProductArb, (baseProduct) => {
                    const product: Product = baseProduct as Product;

                    const actionText = getProductActionText(product);
                    // Free products should have "下载" as primary action
                    // and no secondary action (no cart button)
                    return (
                        actionText.primaryAction === "下载" &&
                        actionText.secondaryAction === null
                    );
                }),
                { numRuns: 100 }
            );
        });

        it("free products with all zero prices should also hide price and cart", () => {
            fc.assert(
                fc.property(
                    baseProductArb,
                    allZeroPricesArb,
                    (baseProduct, prices) => {
                        const product: Product = {
                            ...baseProduct,
                            is_free: false, // Not explicitly free, but all prices are zero
                            prices,
                        };

                        const showPrice = shouldShowPrice(product);
                        const showCartOptions = shouldShowCartOptions(product);

                        // Products with all zero prices are treated as free
                        return showPrice === false && showCartOptions === false;
                    }
                ),
                { numRuns: 100 }
            );
        });
    });

    describe("Paid product UI elements", () => {
        it("paid products should show price display (Requirements: 3.3 inverse)", () => {
            fc.assert(
                fc.property(paidProductArb, (product) => {
                    const showPrice = shouldShowPrice(product as Product);
                    return showPrice === true;
                }),
                { numRuns: 100 }
            );
        });

        it("paid products should show cart/checkout options (Requirements: 3.4 inverse)", () => {
            fc.assert(
                fc.property(paidProductArb, (product) => {
                    const showCartOptions = shouldShowCartOptions(
                        product as Product
                    );
                    return showCartOptions === true;
                }),
                { numRuns: 100 }
            );
        });

        it("paid products should show buy now and add to cart buttons (Requirements: 3.1)", () => {
            fc.assert(
                fc.property(paidProductArb, (product) => {
                    const actionText = getProductActionText(product as Product);
                    // Paid products should have "立即购买" as primary action
                    // and "加入购物车" as secondary action
                    return (
                        actionText.primaryAction === "立即购买" &&
                        actionText.secondaryAction === "加入购物车"
                    );
                }),
                { numRuns: 100 }
            );
        });
    });

    describe("UI element consistency", () => {
        it("shouldShowPrice and shouldShowCartOptions are consistent with checkFreeProduct", () => {
            fc.assert(
                fc.property(
                    baseProductArb,
                    fc.option(allZeroPricesArb),
                    fc.option(fc.constant(true)),
                    (baseProduct, maybePrices, maybeIsFree) => {
                        const product: Product = {
                            ...baseProduct,
                            is_free: maybeIsFree ?? undefined,
                            prices: maybePrices ?? undefined,
                        };

                        const freeCheck = checkFreeProduct(product);
                        const showPrice = shouldShowPrice(product);
                        const showCartOptions = shouldShowCartOptions(product);

                        // If product is free, price and cart should be hidden
                        // If product is not free, price and cart should be shown
                        if (freeCheck.isFree) {
                            return showPrice === false && showCartOptions === false;
                        } else {
                            return showPrice === true && showCartOptions === true;
                        }
                    }
                ),
                { numRuns: 100 }
            );
        });

        it("getProductActionText is consistent with UI visibility functions", () => {
            fc.assert(
                fc.property(
                    baseProductArb,
                    fc.option(nonZeroPricesArb),
                    fc.boolean(),
                    (baseProduct, maybePrices, isFree) => {
                        const product: Product = {
                            ...baseProduct,
                            is_free: isFree,
                            prices: maybePrices ?? undefined,
                        };

                        const actionText = getProductActionText(product);
                        const showCartOptions = shouldShowCartOptions(product);

                        // If secondaryAction is null, cart options should be hidden
                        // If secondaryAction is "加入购物车", cart options should be shown
                        if (actionText.secondaryAction === null) {
                            return showCartOptions === false;
                        } else {
                            return showCartOptions === true;
                        }
                    }
                ),
                { numRuns: 100 }
            );
        });
    });

    describe("Free product validity affects UI", () => {
        it("invalid free products (non-download delivery) are still identified as free for UI purposes", () => {
            const nonDownloadDeliveryArb = fc.constantFrom<DeliveryType>(
                "license_key",
                "cdk",
                "shipment",
                "manual"
            );

            fc.assert(
                fc.property(
                    baseProductArb,
                    nonDownloadDeliveryArb,
                    (baseProduct, deliveryType) => {
                        const product: Product = {
                            ...baseProduct,
                            is_free: true,
                            delivery_type: deliveryType,
                        };

                        const freeCheck = checkFreeProduct(product);
                        const showPrice = shouldShowPrice(product);
                        const showCartOptions = shouldShowCartOptions(product);

                        // Even invalid free products should hide price and cart
                        // (the download button will be disabled due to isValid = false)
                        return (
                            freeCheck.isFree === true &&
                            freeCheck.isValid === false &&
                            showPrice === false &&
                            showCartOptions === false
                        );
                    }
                ),
                { numRuns: 100 }
            );
        });
    });
});
