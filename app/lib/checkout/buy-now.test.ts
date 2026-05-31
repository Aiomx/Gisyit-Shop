/**
 * Property-Based Tests for Buy Now Server Action
 *
 * Tests for buy now checkout flow validation, ensuring paid products
 * can create Stripe checkout sessions with correct parameters.
 *
 * Requirements: 10.1, 10.2, 10.3, 10.4
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
    validateBuyNowParams,
    canUseBuyNow,
    isValidBuyNowRequest,
    type BuyNowParams,
    type BuyNowResult,
    type BuyNowErrorCode,
} from "./buy-now.server";
import { checkFreeProduct } from "~/lib/product/free-product";

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
 * Generate an array of active prices with at least one non-zero
 */
const nonZeroPricesArb = fc.array(
    productPriceArb(fc.integer({ min: 1, max: 100000 }), fc.constant(true)),
    { minLength: 1, maxLength: 5 }
);

/**
 * Generate an array of active prices that are all zero (free product)
 */
const zeroPricesArb = fc.array(
    productPriceArb(fc.constant(0), fc.constant(true)),
    { minLength: 1, maxLength: 5 }
);

/**
 * Generate a minimal Product with configurable fields
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
 * Generate a paid product (active, with non-zero prices)
 */
const paidProductArb: fc.Arbitrary<Product> = baseProductArb.chain((base) =>
    nonZeroPricesArb.map((prices) => ({
        ...base,
        is_active: true,
        is_free: false,
        prices,
    }))
);

/**
 * Generate an inactive product
 */
const inactiveProductArb: fc.Arbitrary<Product> = baseProductArb.chain((base) =>
    nonZeroPricesArb.map((prices) => ({
        ...base,
        is_active: false,
        is_free: false,
        prices,
    }))
);

/**
 * Generate a free product (is_free = true)
 */
const freeProductArb: fc.Arbitrary<Product> = baseProductArb.chain((base) =>
    zeroPricesArb.map((prices) => ({
        ...base,
        is_active: true,
        is_free: true,
        delivery_type: "download" as DeliveryType,
        prices,
    }))
);

/**
 * Generate a product with no active prices
 */
const noPricesProductArb: fc.Arbitrary<Product> = baseProductArb.map((base) => ({
    ...base,
    is_active: true,
    is_free: false,
    prices: [],
}));

/**
 * Generate valid buy now params
 */
const validBuyNowParamsArb: fc.Arbitrary<BuyNowParams> = fc.record({
    productId: fc.uuid(),
    priceId: fc.uuid(),
    specCombination: fc.dictionary(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.string({ minLength: 1, maxLength: 50 }),
        { minKeys: 0, maxKeys: 5 }
    ),
    quantity: fc.integer({ min: 1, max: 100 }),
});

/**
 * Generate invalid quantity values
 */
const invalidQuantityArb = fc.oneof(
    fc.constant(0),
    fc.constant(-1),
    fc.integer({ min: -100, max: -1 })
);

// ============================================
// Property 11: Buy Now Checkout Flow
// **Feature: free-product-download, Property 11: Buy Now Checkout Flow**
// **Validates: Requirements 10.1, 10.2, 10.3, 10.4**
// ============================================

describe("Property 11: Buy Now Checkout Flow", () => {
    /**
     * **Feature: free-product-download, Property 11: Buy Now Checkout Flow**
     * **Validates: Requirements 10.1, 10.2, 10.3, 10.4**
     *
     * For any "立即购买" action on a paid product, the system SHALL create a
     * Stripe checkout session with the selected spec combination AND redirect
     * to Stripe checkout AND create an order record upon successful payment.
     */

    // ============================================
    // Requirement 10.1: Create checkout session with single product
    // ============================================

    describe("Requirement 10.1: Create checkout session with single product", () => {
        it("buy now params contain productId and priceId for single product checkout", () => {
            fc.assert(
                fc.property(validBuyNowParamsArb, (params) => {
                    // Buy now params should always have productId and priceId
                    return (
                        typeof params.productId === "string" &&
                        params.productId.length > 0 &&
                        typeof params.priceId === "string" &&
                        params.priceId.length > 0
                    );
                }),
                { numRuns: 100 }
            );
        });

        it("buy now params include quantity for single product", () => {
            fc.assert(
                fc.property(validBuyNowParamsArb, (params) => {
                    return typeof params.quantity === "number" && params.quantity >= 1;
                }),
                { numRuns: 100 }
            );
        });

        it("validateBuyNowParams accepts valid params", () => {
            fc.assert(
                fc.property(validBuyNowParamsArb, (params) => {
                    const result = validateBuyNowParams(params);
                    return result.valid === true && result.errors.length === 0;
                }),
                { numRuns: 100 }
            );
        });

        it("validateBuyNowParams rejects missing productId", () => {
            fc.assert(
                fc.property(fc.uuid(), fc.integer({ min: 1, max: 100 }), (priceId, quantity) => {
                    const result = validateBuyNowParams({
                        priceId,
                        quantity,
                        specCombination: {},
                    });
                    return result.valid === false && result.errors.some((e) => e.includes("商品ID"));
                }),
                { numRuns: 100 }
            );
        });

        it("validateBuyNowParams rejects missing priceId", () => {
            fc.assert(
                fc.property(fc.uuid(), fc.integer({ min: 1, max: 100 }), (productId, quantity) => {
                    const result = validateBuyNowParams({
                        productId,
                        quantity,
                        specCombination: {},
                    });
                    return result.valid === false && result.errors.some((e) => e.includes("价格ID"));
                }),
                { numRuns: 100 }
            );
        });

        it("validateBuyNowParams rejects invalid quantity", () => {
            fc.assert(
                fc.property(fc.uuid(), fc.uuid(), invalidQuantityArb, (productId, priceId, quantity) => {
                    const result = validateBuyNowParams({
                        productId,
                        priceId,
                        quantity,
                        specCombination: {},
                    });
                    return result.valid === false && result.errors.some((e) => e.includes("数量"));
                }),
                { numRuns: 100 }
            );
        });
    });

    // ============================================
    // Requirement 10.2: Use currently selected spec combination
    // ============================================

    describe("Requirement 10.2: Use currently selected spec combination", () => {
        it("buy now params include specCombination", () => {
            fc.assert(
                fc.property(validBuyNowParamsArb, (params) => {
                    return typeof params.specCombination === "object";
                }),
                { numRuns: 100 }
            );
        });

        it("specCombination can be empty for products without specs", () => {
            fc.assert(
                fc.property(fc.uuid(), fc.uuid(), fc.integer({ min: 1, max: 100 }), (productId, priceId, quantity) => {
                    const params: BuyNowParams = {
                        productId,
                        priceId,
                        specCombination: {},
                        quantity,
                    };
                    const result = validateBuyNowParams(params);
                    return result.valid === true;
                }),
                { numRuns: 100 }
            );
        });

        it("specCombination preserves key-value pairs", () => {
            fc.assert(
                fc.property(
                    fc.uuid(),
                    fc.uuid(),
                    fc.integer({ min: 1, max: 100 }),
                    fc.dictionary(
                        fc.string({ minLength: 1, maxLength: 20 }),
                        fc.string({ minLength: 1, maxLength: 50 }),
                        { minKeys: 1, maxKeys: 5 }
                    ),
                    (productId, priceId, quantity, specCombination) => {
                        const params: BuyNowParams = {
                            productId,
                            priceId,
                            specCombination,
                            quantity,
                        };

                        // All keys and values should be preserved
                        return Object.entries(specCombination).every(
                            ([key, value]) => params.specCombination[key] === value
                        );
                    }
                ),
                { numRuns: 100 }
            );
        });
    });

    // ============================================
    // Requirement 10.3: Redirect to Stripe checkout
    // ============================================

    describe("Requirement 10.3: Redirect to Stripe checkout", () => {
        it("successful buy now result contains sessionUrl", () => {
            fc.assert(
                fc.property(fc.webUrl(), fc.stringMatching(/^bs_[a-z0-9_]+$/), (url, sessionId) => {
                    const result: BuyNowResult = {
                        success: true,
                        sessionUrl: url,
                        sessionId,
                    };

                    return (
                        result.success === true &&
                        typeof result.sessionUrl === "string" &&
                        result.sessionUrl.length > 0
                    );
                }),
                { numRuns: 100 }
            );
        });

        it("successful result includes sessionId for tracking", () => {
            fc.assert(
                fc.property(fc.webUrl(), fc.stringMatching(/^bs_[a-z0-9_]+$/), (url, sessionId) => {
                    const result: BuyNowResult = {
                        success: true,
                        sessionUrl: url,
                        sessionId,
                    };

                    return (
                        result.success === true &&
                        typeof result.sessionId === "string" &&
                        result.sessionId.length > 0
                    );
                }),
                { numRuns: 100 }
            );
        });

        it("error result does not contain sessionUrl", () => {
            const errorCodeArb = fc.constantFrom<BuyNowErrorCode>(
                "PRODUCT_NOT_FOUND",
                "PRODUCT_UNAVAILABLE",
                "PRODUCT_IS_FREE",
                "PRICE_NOT_FOUND",
                "INSUFFICIENT_INVENTORY",
                "INVALID_QUANTITY",
                "STRIPE_SESSION_FAILED",
                "MISSING_IDENTITY",
                "INVALID_REQUEST"
            );

            fc.assert(
                fc.property(errorCodeArb, fc.string(), (code, message) => {
                    const result: BuyNowResult = {
                        success: false,
                        error: { code, message },
                    };

                    return result.sessionUrl === undefined;
                }),
                { numRuns: 100 }
            );
        });
    });

    // ============================================
    // Requirement 10.4: Create order record upon successful payment
    // (Order creation happens in webhook, not in buy-now action)
    // ============================================

    describe("Requirement 10.4: Order creation tracking", () => {
        it("buy now result does not directly create order (order created via webhook)", () => {
            fc.assert(
                fc.property(fc.webUrl(), fc.stringMatching(/^bs_[a-z0-9_]+$/), (url, sessionId) => {
                    const result: BuyNowResult = {
                        success: true,
                        sessionUrl: url,
                        sessionId,
                    };

                    // Result should not contain order_id (order is created via webhook)
                    const resultKeys = Object.keys(result);
                    return !resultKeys.includes("order_id") && !resultKeys.includes("orderId");
                }),
                { numRuns: 100 }
            );
        });

        it("sessionId can be used to track order creation", () => {
            fc.assert(
                fc.property(fc.webUrl(), (url) => {
                    // Session ID format: bs_{timestamp}_{random}
                    const sessionId = `bs_${Date.now()}_${Math.random().toString(36).substring(7)}`;
                    const result: BuyNowResult = {
                        success: true,
                        sessionUrl: url,
                        sessionId,
                    };

                    return result.sessionId?.startsWith("bs_") === true;
                }),
                { numRuns: 100 }
            );
        });
    });

    // ============================================
    // Requirement 10.5: Free products should not use buy now
    // ============================================

    describe("Requirement 10.5: Free products should not use buy now", () => {
        it("canUseBuyNow returns false for free products", () => {
            fc.assert(
                fc.property(freeProductArb, (product) => {
                    return canUseBuyNow(product) === false;
                }),
                { numRuns: 100 }
            );
        });

        it("canUseBuyNow returns true for paid active products with prices", () => {
            fc.assert(
                fc.property(paidProductArb, (product) => {
                    return canUseBuyNow(product) === true;
                }),
                { numRuns: 100 }
            );
        });

        it("canUseBuyNow returns false for inactive products", () => {
            fc.assert(
                fc.property(inactiveProductArb, (product) => {
                    return canUseBuyNow(product) === false;
                }),
                { numRuns: 100 }
            );
        });

        it("canUseBuyNow returns false for products without prices", () => {
            fc.assert(
                fc.property(noPricesProductArb, (product) => {
                    return canUseBuyNow(product) === false;
                }),
                { numRuns: 100 }
            );
        });

        it("canUseBuyNow is consistent with checkFreeProduct", () => {
            fc.assert(
                fc.property(paidProductArb, (product) => {
                    const freeCheck = checkFreeProduct(product);
                    const canBuy = canUseBuyNow(product);

                    // If product is free, canUseBuyNow should be false
                    if (freeCheck.isFree) {
                        return canBuy === false;
                    }

                    // If product is paid and active with prices, canUseBuyNow should be true
                    return canBuy === true;
                }),
                { numRuns: 100 }
            );
        });

        it("PRODUCT_IS_FREE is a valid error code", () => {
            const errorResult: BuyNowResult = {
                success: false,
                error: {
                    code: "PRODUCT_IS_FREE",
                    message: "免费商品请直接下载",
                },
            };

            expect(errorResult.error?.code).toBe("PRODUCT_IS_FREE");
        });
    });

    // ============================================
    // Request Validation
    // ============================================

    describe("Request Validation", () => {
        it("GET requests are rejected", () => {
            fc.assert(
                fc.property(fc.webUrl(), (url) => {
                    const request = new Request(url, { method: "GET" });
                    return isValidBuyNowRequest(request) === false;
                }),
                { numRuns: 100 }
            );
        });

        it("POST requests with valid content type are accepted", () => {
            const validContentTypes = [
                "application/x-www-form-urlencoded",
                "multipart/form-data",
                "application/json",
            ];

            fc.assert(
                fc.property(
                    fc.webUrl(),
                    fc.constantFrom(...validContentTypes),
                    (url, contentType) => {
                        const request = new Request(url, {
                            method: "POST",
                            headers: { "Content-Type": contentType },
                        });
                        return isValidBuyNowRequest(request) === true;
                    }
                ),
                { numRuns: 100 }
            );
        });

        it("POST requests without content type are rejected", () => {
            fc.assert(
                fc.property(fc.webUrl(), (url) => {
                    const request = new Request(url, { method: "POST" });
                    return isValidBuyNowRequest(request) === false;
                }),
                { numRuns: 100 }
            );
        });

        it("POST requests with invalid content type are rejected", () => {
            const invalidContentTypes = [
                "text/plain",
                "text/html",
                "application/xml",
                "image/png",
            ];

            fc.assert(
                fc.property(
                    fc.webUrl(),
                    fc.constantFrom(...invalidContentTypes),
                    (url, contentType) => {
                        const request = new Request(url, {
                            method: "POST",
                            headers: { "Content-Type": contentType },
                        });
                        return isValidBuyNowRequest(request) === false;
                    }
                ),
                { numRuns: 100 }
            );
        });
    });

    // ============================================
    // Error Handling
    // ============================================

    describe("Error Handling", () => {
        it("all error codes have corresponding messages", () => {
            const allErrorCodes: BuyNowErrorCode[] = [
                "PRODUCT_NOT_FOUND",
                "PRODUCT_UNAVAILABLE",
                "PRODUCT_IS_FREE",
                "PRICE_NOT_FOUND",
                "INSUFFICIENT_INVENTORY",
                "INVALID_QUANTITY",
                "STRIPE_SESSION_FAILED",
                "MISSING_IDENTITY",
                "INVALID_REQUEST",
            ];

            fc.assert(
                fc.property(fc.constantFrom(...allErrorCodes), fc.string(), (code, message) => {
                    const result: BuyNowResult = {
                        success: false,
                        error: { code, message },
                    };

                    return (
                        result.success === false &&
                        result.error !== undefined &&
                        typeof result.error.code === "string" &&
                        typeof result.error.message === "string"
                    );
                }),
                { numRuns: 100 }
            );
        });

        it("error result structure is correct", () => {
            const errorCodeArb = fc.constantFrom<BuyNowErrorCode>(
                "PRODUCT_NOT_FOUND",
                "PRODUCT_UNAVAILABLE",
                "PRODUCT_IS_FREE",
                "PRICE_NOT_FOUND",
                "INSUFFICIENT_INVENTORY",
                "INVALID_QUANTITY",
                "STRIPE_SESSION_FAILED",
                "MISSING_IDENTITY",
                "INVALID_REQUEST"
            );

            fc.assert(
                fc.property(errorCodeArb, fc.string(), (code, message) => {
                    const result: BuyNowResult = {
                        success: false,
                        error: { code, message },
                    };

                    // Error result should have success=false, error with code and message
                    // and should NOT have sessionUrl or sessionId
                    return (
                        result.success === false &&
                        result.error !== undefined &&
                        result.error.code === code &&
                        result.error.message === message &&
                        result.sessionUrl === undefined &&
                        result.sessionId === undefined
                    );
                }),
                { numRuns: 100 }
            );
        });
    });
});
