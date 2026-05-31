/**
 * Property-Based Tests for Free Product Identification
 *
 * **Feature: free-product-download, Property 1: Free Product Identification**
 * **Validates: Requirements 1.1, 1.2**
 *
 * These tests verify that free product identification correctly identifies
 * products as free based on is_free flag or zero prices.
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import type {
    Product,
    ProductType,
    DeliveryType,
    ProductPrice,
} from "~/lib/supabase/types";
import { checkFreeProduct, getProductActionText } from "./free-product";

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
const allZeroPricesArb = fc
    .array(productPriceArb(fc.constant(0), fc.constant(true)), {
        minLength: 1,
        maxLength: 5,
    });

/**
 * Generate an array of active prices with at least one non-zero
 */
const nonZeroPricesArb = fc
    .array(
        productPriceArb(
            fc.integer({ min: 1, max: 100000 }),
            fc.constant(true)
        ),
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

// ============================================
// Property Tests - Property 1: Free Product Identification
// ============================================

describe("Property 1: Free Product Identification", () => {
    /**
     * **Feature: free-product-download, Property 1: Free Product Identification**
     * **Validates: Requirements 1.1, 1.2**
     *
     * For any product, if is_free = true OR all active prices have price_amount = 0,
     * then checkFreeProduct SHALL return isFree = true; otherwise it SHALL return isFree = false.
     */

    it("products with is_free = true are identified as free", () => {
        fc.assert(
            fc.property(
                baseProductArb,
                nonZeroPricesArb,
                (baseProduct, prices) => {
                    const product: Product = {
                        ...baseProduct,
                        is_free: true,
                        prices,
                    };

                    const result = checkFreeProduct(product);
                    return result.isFree === true;
                }
            ),
            { numRuns: 100 }
        );
    });

    it("products with all active prices = 0 are identified as free", () => {
        fc.assert(
            fc.property(
                baseProductArb,
                allZeroPricesArb,
                (baseProduct, prices) => {
                    const product: Product = {
                        ...baseProduct,
                        is_free: false,
                        prices,
                    };

                    const result = checkFreeProduct(product);
                    return result.isFree === true;
                }
            ),
            { numRuns: 100 }
        );
    });

    it("products with is_free = false and non-zero prices are not free", () => {
        fc.assert(
            fc.property(
                baseProductArb,
                nonZeroPricesArb,
                (baseProduct, prices) => {
                    const product: Product = {
                        ...baseProduct,
                        is_free: false,
                        prices,
                    };

                    const result = checkFreeProduct(product);
                    return result.isFree === false;
                }
            ),
            { numRuns: 100 }
        );
    });

    it("products with undefined is_free and non-zero prices are not free", () => {
        fc.assert(
            fc.property(
                baseProductArb,
                nonZeroPricesArb,
                (baseProduct, prices) => {
                    const product: Product = {
                        ...baseProduct,
                        is_free: undefined,
                        prices,
                    };

                    const result = checkFreeProduct(product);
                    return result.isFree === false;
                }
            ),
            { numRuns: 100 }
        );
    });

    it("products with no prices and is_free = false are not free", () => {
        fc.assert(
            fc.property(baseProductArb, (baseProduct) => {
                const product: Product = {
                    ...baseProduct,
                    is_free: false,
                    prices: [],
                };

                const result = checkFreeProduct(product);
                return result.isFree === false;
            }),
            { numRuns: 100 }
        );
    });

    it("require_login is correctly returned from product", () => {
        fc.assert(
            fc.property(
                baseProductArb,
                fc.boolean(),
                (baseProduct, requireLogin) => {
                    const product: Product = {
                        ...baseProduct,
                        is_free: true,
                        require_login: requireLogin,
                    };

                    const result = checkFreeProduct(product);
                    return result.requireLogin === requireLogin;
                }
            ),
            { numRuns: 100 }
        );
    });

    it("require_login defaults to false when undefined", () => {
        fc.assert(
            fc.property(baseProductArb, (baseProduct) => {
                const product: Product = {
                    ...baseProduct,
                    is_free: true,
                    require_login: undefined,
                };

                const result = checkFreeProduct(product);
                return result.requireLogin === false;
            }),
            { numRuns: 100 }
        );
    });
});


// ============================================
// Property Tests - Property 2: Free Product Delivery Type Validation
// ============================================

describe("Property 2: Free Product Delivery Type Validation", () => {
    /**
     * **Feature: free-product-download, Property 2: Free Product Delivery Type Validation**
     * **Validates: Requirements 1.3, 1.4**
     *
     * For any product identified as free, if delivery_type is not "download",
     * then the product SHALL be marked as invalid (isValid = false) and download SHALL be prevented.
     */

    it("free products with delivery_type = download are valid", () => {
        fc.assert(
            fc.property(baseProductArb, (baseProduct) => {
                const product: Product = {
                    ...baseProduct,
                    is_free: true,
                    delivery_type: "download",
                };

                const result = checkFreeProduct(product);
                return result.isFree === true && result.isValid === true;
            }),
            { numRuns: 100 }
        );
    });

    it("free products with delivery_type != download are invalid", () => {
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

                    const result = checkFreeProduct(product);
                    return result.isFree === true && result.isValid === false;
                }
            ),
            { numRuns: 100 }
        );
    });

    it("paid products are always valid regardless of delivery_type", () => {
        fc.assert(
            fc.property(
                baseProductArb,
                deliveryTypeArb,
                nonZeroPricesArb,
                (baseProduct, deliveryType, prices) => {
                    const product: Product = {
                        ...baseProduct,
                        is_free: false,
                        delivery_type: deliveryType,
                        prices,
                    };

                    const result = checkFreeProduct(product);
                    return result.isFree === false && result.isValid === true;
                }
            ),
            { numRuns: 100 }
        );
    });

    it("deliveryType is correctly returned from product", () => {
        fc.assert(
            fc.property(
                baseProductArb,
                deliveryTypeArb,
                (baseProduct, deliveryType) => {
                    const product: Product = {
                        ...baseProduct,
                        delivery_type: deliveryType,
                    };

                    const result = checkFreeProduct(product);
                    return result.deliveryType === deliveryType;
                }
            ),
            { numRuns: 100 }
        );
    });
});


// ============================================
// Property Tests - Property 3: Button Text Based on Product Type
// ============================================

describe("Property 3: Button Text Based on Product Type", () => {
    /**
     * **Feature: free-product-download, Property 3: Button Text Based on Product Type**
     * **Validates: Requirements 2.1, 2.2**
     *
     * For any product, if the product is free then getProductActionText SHALL return
     * primaryAction = "下载"; otherwise it SHALL return primaryAction = "立即购买"
     * with secondaryAction = "加入购物车".
     */

    it("free products have primaryAction = 下载 and secondaryAction = null", () => {
        fc.assert(
            fc.property(baseProductArb, (baseProduct) => {
                const product: Product = {
                    ...baseProduct,
                    is_free: true,
                };

                const result = getProductActionText(product);
                return (
                    result.primaryAction === "下载" &&
                    result.secondaryAction === null
                );
            }),
            { numRuns: 100 }
        );
    });

    it("products with all zero prices have primaryAction = 下载", () => {
        fc.assert(
            fc.property(
                baseProductArb,
                allZeroPricesArb,
                (baseProduct, prices) => {
                    const product: Product = {
                        ...baseProduct,
                        is_free: false,
                        prices,
                    };

                    const result = getProductActionText(product);
                    return (
                        result.primaryAction === "下载" &&
                        result.secondaryAction === null
                    );
                }
            ),
            { numRuns: 100 }
        );
    });

    it("paid products have primaryAction = 立即购买 and secondaryAction = 加入购物车", () => {
        fc.assert(
            fc.property(
                baseProductArb,
                nonZeroPricesArb,
                (baseProduct, prices) => {
                    const product: Product = {
                        ...baseProduct,
                        is_free: false,
                        prices,
                    };

                    const result = getProductActionText(product);
                    return (
                        result.primaryAction === "立即购买" &&
                        result.secondaryAction === "加入购物车"
                    );
                }
            ),
            { numRuns: 100 }
        );
    });

    it("getProductActionText is consistent with checkFreeProduct", () => {
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
                    const actionText = getProductActionText(product);

                    if (freeCheck.isFree) {
                        return (
                            actionText.primaryAction === "下载" &&
                            actionText.secondaryAction === null
                        );
                    } else {
                        return (
                            actionText.primaryAction === "立即购买" &&
                            actionText.secondaryAction === "加入购物车"
                        );
                    }
                }
            ),
            { numRuns: 100 }
        );
    });
});
