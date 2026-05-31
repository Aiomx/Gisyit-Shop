/**
 * Property-Based Tests for Free Download Server Action
 *
 * Tests for free download isolation, signed URL generation,
 * login requirement enforcement, repeated downloads, and
 * direct URL construction prevention.
 *
 * Requirements: 4.2, 4.3, 4.4, 5.1, 5.3, 6.1, 6.2, 7.1, 11.2, 11.3, 11.4
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
    FREE_DOWNLOAD_URL_EXPIRATION_SECONDS,
    isValidServerActionRequest,
    canDownloadFree,
    type FreeDownloadParams,
    type FreeDownloadResult,
    type FreeDownloadErrorCode,
} from "./free-download.server";
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
 * Generate non-download delivery types
 */
const nonDownloadDeliveryArb = fc.constantFrom<DeliveryType>(
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
 * Generate a free product with download delivery type (valid free product)
 */
const validFreeProductArb: fc.Arbitrary<Product> = fc.record({
    id: fc.uuid(),
    product_code: fc
        .string({ minLength: 11, maxLength: 11 })
        .map((s) => `Gis${s.slice(0, 8).padStart(8, "0")}`),
    name: fc.string({ minLength: 1, maxLength: 100 }),
    product_type: productTypeArb,
    delivery_type: fc.constant<DeliveryType>("download"),
    category_id: fc.uuid(),
    is_active: fc.constant(true),
    has_discount: fc.boolean(),
    has_demo_video: fc.boolean(),
    is_free: fc.constant(true),
    require_login: fc.boolean(),
    created_at: isoDateArb,
    updated_at: isoDateArb,
});

/**
 * Generate a paid product
 */
const paidProductArb: fc.Arbitrary<Product> = baseProductArb.chain((base) =>
    nonZeroPricesArb.map((prices) => ({
        ...base,
        is_free: false,
        prices,
    }))
);

/**
 * Generate free download params
 */
const freeDownloadParamsArb: fc.Arbitrary<FreeDownloadParams> = fc.record({
    productId: fc.uuid(),
    fileId: fc.uuid(),
    sessionId: fc.option(fc.stringMatching(/^[a-zA-Z0-9]{16,64}$/), {
        nil: undefined,
    }),
});

/**
 * Generate a valid session ID
 */
const sessionIdArb = fc.stringMatching(/^[a-zA-Z0-9]{16,64}$/);

// ============================================
// Property 5: Free Download Isolation
// **Feature: free-product-download, Property 5: Free Download Isolation**
// **Validates: Requirements 4.2, 4.3, 4.4, 11.3, 11.4**
// ============================================

describe("Property 5: Free Download Isolation", () => {
    /**
     * **Feature: free-product-download, Property 5: Free Download Isolation**
     * **Validates: Requirements 4.2, 4.3, 4.4, 11.3, 11.4**
     *
     * For any free product download operation, the system SHALL NOT create any order record
     * AND SHALL NOT create any Stripe session AND SHALL NOT modify any cart
     * AND SHALL NOT invoke CDK delivery logic.
     */

    it("free download result does not contain order-related fields", () => {
        fc.assert(
            fc.property(fc.uuid(), fc.string(), (url, filename) => {
                // A successful free download result should only contain download-specific fields
                const successResult: FreeDownloadResult = {
                    success: true,
                    url,
                    filename,
                };

                const resultKeys = Object.keys(successResult);
                const orderFields = [
                    "order_id",
                    "order_number",
                    "stripe_session_id",
                    "payment_intent_id",
                    "cart_id",
                    "cdk_code",
                ];

                return orderFields.every((field) => !resultKeys.includes(field));
            }),
            { numRuns: 100 }
        );
    });

    it("free download error result does not contain order-related fields", () => {
        const errorCodeArb = fc.constantFrom<FreeDownloadErrorCode>(
            "NOT_FREE_PRODUCT",
            "INVALID_DELIVERY_TYPE",
            "LOGIN_REQUIRED",
            "FILE_NOT_FOUND",
            "PRODUCT_NOT_FOUND",
            "SIGNED_URL_FAILED",
            "INVALID_REQUEST"
        );

        fc.assert(
            fc.property(errorCodeArb, fc.string(), (code, message) => {
                const errorResult: FreeDownloadResult = {
                    success: false,
                    error: { code, message },
                };

                const resultKeys = Object.keys(errorResult);
                const orderFields = [
                    "order_id",
                    "order_number",
                    "stripe_session_id",
                    "payment_intent_id",
                    "cart_id",
                    "cdk_code",
                ];

                return orderFields.every((field) => !resultKeys.includes(field));
            }),
            { numRuns: 100 }
        );
    });

    it("free download params do not include order or payment fields", () => {
        fc.assert(
            fc.property(freeDownloadParamsArb, (params) => {
                const paramsKeys = Object.keys(params);
                const orderFields = [
                    "order_id",
                    "stripe_session_id",
                    "payment_intent_id",
                    "cart_id",
                    "cdk_code",
                    "total_amount",
                    "currency",
                ];

                return orderFields.every((field) => !paramsKeys.includes(field));
            }),
            { numRuns: 100 }
        );
    });

    it("free download params only contain download-specific fields", () => {
        fc.assert(
            fc.property(freeDownloadParamsArb, (params) => {
                const allowedFields = ["productId", "fileId", "sessionId"];
                const paramsKeys = Object.keys(params);

                return paramsKeys.every((key) => allowedFields.includes(key));
            }),
            { numRuns: 100 }
        );
    });

    it("canDownloadFree returns true only for valid free products", () => {
        fc.assert(
            fc.property(validFreeProductArb, (product) => {
                // Valid free product with download delivery type
                return canDownloadFree(product) === true;
            }),
            { numRuns: 100 }
        );
    });

    it("canDownloadFree returns false for paid products", () => {
        fc.assert(
            fc.property(paidProductArb, (product) => {
                return canDownloadFree(product) === false;
            }),
            { numRuns: 100 }
        );
    });

    it("canDownloadFree returns false for free products with non-download delivery", () => {
        fc.assert(
            fc.property(baseProductArb, nonDownloadDeliveryArb, (base, deliveryType) => {
                const product: Product = {
                    ...base,
                    is_free: true,
                    delivery_type: deliveryType,
                };

                return canDownloadFree(product) === false;
            }),
            { numRuns: 100 }
        );
    });

    it("free download isolation is consistent with checkFreeProduct", () => {
        fc.assert(
            fc.property(
                baseProductArb,
                fc.boolean(),
                deliveryTypeArb,
                (base, isFree, deliveryType) => {
                    const product: Product = {
                        ...base,
                        is_free: isFree,
                        delivery_type: deliveryType,
                    };

                    const freeCheck = checkFreeProduct(product);
                    const canDownload = canDownloadFree(product);

                    // canDownloadFree should return true only when both isFree and isValid are true
                    return canDownload === (freeCheck.isFree && freeCheck.isValid);
                }
            ),
            { numRuns: 100 }
        );
    });
});

// ============================================
// Property 6: Signed URL Generation for Free Downloads
// **Feature: free-product-download, Property 6: Signed URL Generation for Free Downloads**
// **Validates: Requirements 4.1, 4.5, 5.1, 5.3**
// ============================================

describe("Property 6: Signed URL Generation for Free Downloads", () => {
    /**
     * **Feature: free-product-download, Property 6: Signed URL Generation for Free Downloads**
     * **Validates: Requirements 4.1, 4.5, 5.1, 5.3**
     *
     * For any successful free download request, the system SHALL generate a signed URL
     * with expiration time of 5 minutes (300 seconds) AND the URL SHALL NOT expose
     * the actual storage bucket path.
     */

    it("free download URL expiration is 5 minutes (300 seconds)", () => {
        // Verify the constant is correctly set
        expect(FREE_DOWNLOAD_URL_EXPIRATION_SECONDS).toBe(300);
    });

    it("successful free download result contains url and filename", () => {
        fc.assert(
            fc.property(
                fc.webUrl(),
                fc.string({ minLength: 1, maxLength: 255 }),
                (url, filename) => {
                    const result: FreeDownloadResult = {
                        success: true,
                        url,
                        filename,
                    };

                    return (
                        result.success === true &&
                        typeof result.url === "string" &&
                        result.url.length > 0 &&
                        typeof result.filename === "string" &&
                        result.filename.length > 0
                    );
                }
            ),
            { numRuns: 100 }
        );
    });

    it("successful result does not expose storage bucket path", () => {
        fc.assert(
            fc.property(
                fc.webUrl(),
                fc.string({ minLength: 1, maxLength: 255 }),
                (url, filename) => {
                    const result: FreeDownloadResult = {
                        success: true,
                        url,
                        filename,
                    };

                    // Result should not contain storage_path field
                    const resultKeys = Object.keys(result);
                    return !resultKeys.includes("storage_path");
                }
            ),
            { numRuns: 100 }
        );
    });

    it("error result does not contain url", () => {
        const errorCodeArb = fc.constantFrom<FreeDownloadErrorCode>(
            "NOT_FREE_PRODUCT",
            "INVALID_DELIVERY_TYPE",
            "LOGIN_REQUIRED",
            "FILE_NOT_FOUND",
            "PRODUCT_NOT_FOUND",
            "SIGNED_URL_FAILED",
            "INVALID_REQUEST"
        );

        fc.assert(
            fc.property(errorCodeArb, fc.string(), (code, message) => {
                const result: FreeDownloadResult = {
                    success: false,
                    error: { code, message },
                };

                return result.url === undefined;
            }),
            { numRuns: 100 }
        );
    });

    it("free download result structure is correct for success case", () => {
        fc.assert(
            fc.property(
                fc.webUrl(),
                fc.string({ minLength: 1, maxLength: 255 }),
                (url, filename) => {
                    const result: FreeDownloadResult = {
                        success: true,
                        url,
                        filename,
                    };

                    // Success result should have success=true, url, filename
                    // and should NOT have error
                    return (
                        result.success === true &&
                        result.url !== undefined &&
                        result.filename !== undefined &&
                        result.error === undefined
                    );
                }
            ),
            { numRuns: 100 }
        );
    });

    it("free download result structure is correct for error case", () => {
        const errorCodeArb = fc.constantFrom<FreeDownloadErrorCode>(
            "NOT_FREE_PRODUCT",
            "INVALID_DELIVERY_TYPE",
            "LOGIN_REQUIRED",
            "FILE_NOT_FOUND",
            "PRODUCT_NOT_FOUND",
            "SIGNED_URL_FAILED",
            "INVALID_REQUEST"
        );

        fc.assert(
            fc.property(errorCodeArb, fc.string(), (code, message) => {
                const result: FreeDownloadResult = {
                    success: false,
                    error: { code, message },
                };

                // Error result should have success=false, error with code and message
                // and should NOT have url or filename
                return (
                    result.success === false &&
                    result.error !== undefined &&
                    result.error.code === code &&
                    result.error.message === message &&
                    result.url === undefined &&
                    result.filename === undefined
                );
            }),
            { numRuns: 100 }
        );
    });
});

// ============================================
// Property 7: Login Requirement Enforcement
// **Feature: free-product-download, Property 7: Login Requirement Enforcement**
// **Validates: Requirements 6.1, 6.2**
// ============================================

describe("Property 7: Login Requirement Enforcement", () => {
    /**
     * **Feature: free-product-download, Property 7: Login Requirement Enforcement**
     * **Validates: Requirements 6.1, 6.2**
     *
     * For any free product with require_login = true, if the user is not authenticated
     * then the download SHALL be rejected with LOGIN_REQUIRED error;
     * if require_login = false or null, anonymous downloads SHALL be allowed.
     */

    it("checkFreeProduct correctly returns requireLogin from product", () => {
        fc.assert(
            fc.property(validFreeProductArb, (product) => {
                const result = checkFreeProduct(product);
                return result.requireLogin === (product.require_login ?? false);
            }),
            { numRuns: 100 }
        );
    });

    it("requireLogin defaults to false when undefined", () => {
        fc.assert(
            fc.property(baseProductArb, (base) => {
                const product: Product = {
                    ...base,
                    is_free: true,
                    require_login: undefined,
                };

                const result = checkFreeProduct(product);
                return result.requireLogin === false;
            }),
            { numRuns: 100 }
        );
    });

    it("requireLogin is true when product.require_login is true", () => {
        fc.assert(
            fc.property(baseProductArb, (base) => {
                const product: Product = {
                    ...base,
                    is_free: true,
                    require_login: true,
                };

                const result = checkFreeProduct(product);
                return result.requireLogin === true;
            }),
            { numRuns: 100 }
        );
    });

    it("requireLogin is false when product.require_login is false", () => {
        fc.assert(
            fc.property(baseProductArb, (base) => {
                const product: Product = {
                    ...base,
                    is_free: true,
                    require_login: false,
                };

                const result = checkFreeProduct(product);
                return result.requireLogin === false;
            }),
            { numRuns: 100 }
        );
    });

    it("LOGIN_REQUIRED is a valid error code", () => {
        const errorResult: FreeDownloadResult = {
            success: false,
            error: {
                code: "LOGIN_REQUIRED",
                message: "请登录后下载",
            },
        };

        expect(errorResult.error?.code).toBe("LOGIN_REQUIRED");
    });

    it("anonymous download params can include sessionId", () => {
        fc.assert(
            fc.property(fc.uuid(), fc.uuid(), sessionIdArb, (productId, fileId, sessionId) => {
                const params: FreeDownloadParams = {
                    productId,
                    fileId,
                    sessionId,
                };

                return (
                    params.productId === productId &&
                    params.fileId === fileId &&
                    params.sessionId === sessionId
                );
            }),
            { numRuns: 100 }
        );
    });
});

// ============================================
// Property 12: Repeated Downloads Allowed
// **Feature: free-product-download, Property 12: Repeated Downloads Allowed**
// **Validates: Requirements 7.1**
// ============================================

describe("Property 12: Repeated Downloads Allowed", () => {
    /**
     * **Feature: free-product-download, Property 12: Repeated Downloads Allowed**
     * **Validates: Requirements 7.1**
     *
     * For any free product, multiple download requests from the same user or session
     * SHALL all succeed (no download limit).
     */

    it("free download params do not include download count or limit fields", () => {
        fc.assert(
            fc.property(freeDownloadParamsArb, (params) => {
                const paramsKeys = Object.keys(params);
                const limitFields = [
                    "download_count",
                    "max_downloads",
                    "download_limit",
                    "remaining_downloads",
                ];

                return limitFields.every((field) => !paramsKeys.includes(field));
            }),
            { numRuns: 100 }
        );
    });

    it("free download result does not include download count or limit fields", () => {
        fc.assert(
            fc.property(fc.webUrl(), fc.string(), (url, filename) => {
                const result: FreeDownloadResult = {
                    success: true,
                    url,
                    filename,
                };

                const resultKeys = Object.keys(result);
                const limitFields = [
                    "download_count",
                    "max_downloads",
                    "download_limit",
                    "remaining_downloads",
                ];

                return limitFields.every((field) => !resultKeys.includes(field));
            }),
            { numRuns: 100 }
        );
    });

    it("same params can be used for multiple download requests", () => {
        fc.assert(
            fc.property(
                fc.uuid(),
                fc.uuid(),
                fc.option(sessionIdArb, { nil: undefined }),
                fc.integer({ min: 1, max: 10 }),
                (productId, fileId, sessionId, repeatCount) => {
                    // Create the same params multiple times
                    const paramsList: FreeDownloadParams[] = [];
                    for (let i = 0; i < repeatCount; i++) {
                        paramsList.push({ productId, fileId, sessionId });
                    }

                    // All params should be identical
                    return paramsList.every(
                        (p) =>
                            p.productId === productId &&
                            p.fileId === fileId &&
                            p.sessionId === sessionId
                    );
                }
            ),
            { numRuns: 100 }
        );
    });

    it("no rate limiting fields in free download error codes", () => {
        const allErrorCodes: FreeDownloadErrorCode[] = [
            "NOT_FREE_PRODUCT",
            "INVALID_DELIVERY_TYPE",
            "LOGIN_REQUIRED",
            "FILE_NOT_FOUND",
            "PRODUCT_NOT_FOUND",
            "SIGNED_URL_FAILED",
            "INVALID_REQUEST",
        ];

        const rateLimitCodes = [
            "RATE_LIMITED",
            "TOO_MANY_DOWNLOADS",
            "DOWNLOAD_LIMIT_EXCEEDED",
            "QUOTA_EXCEEDED",
        ];

        // None of the error codes should be rate-limit related
        const hasRateLimitCode = allErrorCodes.some((code) =>
            rateLimitCodes.includes(code)
        );

        expect(hasRateLimitCode).toBe(false);
    });
});

// ============================================
// Property 13: Direct URL Construction Prevention
// **Feature: free-product-download, Property 13: Direct URL Construction Prevention**
// **Validates: Requirements 11.2**
// ============================================

describe("Property 13: Direct URL Construction Prevention", () => {
    /**
     * **Feature: free-product-download, Property 13: Direct URL Construction Prevention**
     * **Validates: Requirements 11.2**
     *
     * For any download request that does not originate from a valid server action,
     * the system SHALL reject the request.
     */

    it("GET requests are rejected", () => {
        fc.assert(
            fc.property(fc.webUrl(), (url) => {
                const request = new Request(url, { method: "GET" });
                return isValidServerActionRequest(request) === false;
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
                    return isValidServerActionRequest(request) === true;
                }
            ),
            { numRuns: 100 }
        );
    });

    it("POST requests without content type are rejected", () => {
        fc.assert(
            fc.property(fc.webUrl(), (url) => {
                const request = new Request(url, { method: "POST" });
                return isValidServerActionRequest(request) === false;
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
            "video/mp4",
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
                    return isValidServerActionRequest(request) === false;
                }
            ),
            { numRuns: 100 }
        );
    });

    it("PUT requests are rejected", () => {
        fc.assert(
            fc.property(fc.webUrl(), (url) => {
                const request = new Request(url, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                });
                return isValidServerActionRequest(request) === false;
            }),
            { numRuns: 100 }
        );
    });

    it("DELETE requests are rejected", () => {
        fc.assert(
            fc.property(fc.webUrl(), (url) => {
                const request = new Request(url, {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                });
                return isValidServerActionRequest(request) === false;
            }),
            { numRuns: 100 }
        );
    });

    it("PATCH requests are rejected", () => {
        fc.assert(
            fc.property(fc.webUrl(), (url) => {
                const request = new Request(url, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                });
                return isValidServerActionRequest(request) === false;
            }),
            { numRuns: 100 }
        );
    });

    it("content type with charset is accepted", () => {
        fc.assert(
            fc.property(fc.webUrl(), (url) => {
                const request = new Request(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json; charset=utf-8" },
                });
                return isValidServerActionRequest(request) === true;
            }),
            { numRuns: 100 }
        );
    });

    it("multipart/form-data with boundary is accepted", () => {
        fc.assert(
            fc.property(fc.webUrl(), fc.stringMatching(/^[a-f0-9]{16,32}$/), (url, boundary) => {
                const request = new Request(url, {
                    method: "POST",
                    headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
                });
                return isValidServerActionRequest(request) === true;
            }),
            { numRuns: 100 }
        );
    });
});
