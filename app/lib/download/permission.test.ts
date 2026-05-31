/**
 * Property-Based Tests for Download Permission Verification
 *
 * Tests for download permission validation logic.
 *
 * Requirements: 3.4, 5.1, 5.2, 5.3
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
    checkDownloadPermissionLogic,
    isValidDownloadOrderStatus,
    createPermissionResult,
} from "./permission.server";
import { VALID_DOWNLOAD_ORDER_STATUSES } from "./types";
import type { OrderStatus } from "~/lib/supabase/types";

// ============================================
// Order Status Arbitraries
// ============================================

/**
 * All possible order statuses
 */
const allOrderStatuses: OrderStatus[] = [
    "created",
    "pending_payment",
    "paid",
    "fulfilled",
    "completed",
    "cancelled",
];

/**
 * Valid order statuses that grant download permission
 */
const validDownloadStatuses: OrderStatus[] = ["paid", "fulfilled", "completed"];

/**
 * Invalid order statuses that deny download permission
 */
const invalidDownloadStatuses: OrderStatus[] = [
    "created",
    "pending_payment",
    "cancelled",
];

/**
 * Arbitrary for valid download order statuses
 */
const validOrderStatusArb = fc.constantFrom(...validDownloadStatuses);

/**
 * Arbitrary for invalid download order statuses
 */
const invalidOrderStatusArb = fc.constantFrom(...invalidDownloadStatuses);

/**
 * Arbitrary for any order status
 */
const anyOrderStatusArb = fc.constantFrom(...allOrderStatuses);

// ============================================
// Property 6: Download permission requires valid paid order
// **Feature: app-download-unlock, Property 6: Download permission requires valid paid order**
// **Validates: Requirements 3.4, 5.1, 5.2**
// ============================================

describe("Property 6: Download permission requires valid paid order", () => {
    /**
     * **Feature: app-download-unlock, Property 6: Download permission requires valid paid order**
     * **Validates: Requirements 3.4, 5.1, 5.2**
     *
     * For any download request, the system SHALL verify the user has an order
     * containing the product with status IN ('paid', 'fulfilled', 'completed'),
     * and deny access otherwise.
     */
    it("grants permission for valid order statuses (paid, fulfilled, completed)", () => {
        fc.assert(
            fc.property(
                fc.uuid(), // userId
                fc.uuid(), // productId
                validOrderStatusArb, // orderStatus
                (userId, productId, orderStatus) => {
                    const permission = checkDownloadPermissionLogic(
                        userId,
                        productId,
                        orderStatus
                    );
                    return permission.allowed === true;
                }
            ),
            { numRuns: 100 }
        );
    });

    it("denies permission for invalid order statuses (created, pending_payment, cancelled)", () => {
        fc.assert(
            fc.property(
                fc.uuid(), // userId
                fc.uuid(), // productId
                invalidOrderStatusArb, // orderStatus
                (userId, productId, orderStatus) => {
                    const permission = checkDownloadPermissionLogic(
                        userId,
                        productId,
                        orderStatus
                    );
                    return (
                        permission.allowed === false &&
                        permission.reason === "invalid_order_status"
                    );
                }
            ),
            { numRuns: 100 }
        );
    });

    it("denies permission when no order exists (null status)", () => {
        fc.assert(
            fc.property(
                fc.uuid(), // userId
                fc.uuid(), // productId
                (userId, productId) => {
                    const permission = checkDownloadPermissionLogic(
                        userId,
                        productId,
                        null // no order
                    );
                    return (
                        permission.allowed === false &&
                        permission.reason === "no_purchase"
                    );
                }
            ),
            { numRuns: 100 }
        );
    });

    it("permission result matches expected based on status validity", () => {
        fc.assert(
            fc.property(
                fc.uuid(), // userId
                fc.uuid(), // productId
                anyOrderStatusArb, // orderStatus
                (userId, productId, orderStatus) => {
                    const permission = checkDownloadPermissionLogic(
                        userId,
                        productId,
                        orderStatus
                    );
                    const shouldAllow = validDownloadStatuses.includes(orderStatus);
                    return permission.allowed === shouldAllow;
                }
            ),
            { numRuns: 100 }
        );
    });

    it("VALID_DOWNLOAD_ORDER_STATUSES contains exactly paid, fulfilled, completed", () => {
        expect(VALID_DOWNLOAD_ORDER_STATUSES).toEqual(["paid", "fulfilled", "completed"]);
    });
});

// ============================================
// Property 11: Unauthenticated download request returns unauthorized
// **Feature: app-download-unlock, Property 11: Unauthenticated download request returns unauthorized**
// **Validates: Requirements 5.3**
// ============================================

describe("Property 11: Unauthenticated download request returns unauthorized", () => {
    /**
     * **Feature: app-download-unlock, Property 11: Unauthenticated download request returns unauthorized**
     * **Validates: Requirements 5.3**
     *
     * For any download request without valid user authentication,
     * the system SHALL return an unauthorized error.
     */
    it("denies permission when userId is null (unauthenticated)", () => {
        fc.assert(
            fc.property(
                fc.uuid(), // productId
                fc.option(anyOrderStatusArb, { nil: undefined }), // orderStatus (may or may not exist)
                (productId, orderStatus) => {
                    const permission = checkDownloadPermissionLogic(
                        null, // unauthenticated
                        productId,
                        orderStatus ?? null
                    );
                    return (
                        permission.allowed === false &&
                        permission.reason === "no_auth"
                    );
                }
            ),
            { numRuns: 100 }
        );
    });

    it("unauthenticated request is denied regardless of order status", () => {
        fc.assert(
            fc.property(
                fc.uuid(), // productId
                validOrderStatusArb, // even with valid order status
                (productId, orderStatus) => {
                    const permission = checkDownloadPermissionLogic(
                        null, // unauthenticated
                        productId,
                        orderStatus
                    );
                    // Should still be denied due to no auth
                    return (
                        permission.allowed === false &&
                        permission.reason === "no_auth"
                    );
                }
            ),
            { numRuns: 100 }
        );
    });
});

// ============================================
// Helper Function Tests
// ============================================

describe("isValidDownloadOrderStatus", () => {
    it("returns true for valid statuses", () => {
        fc.assert(
            fc.property(validOrderStatusArb, (status) => {
                return isValidDownloadOrderStatus(status) === true;
            }),
            { numRuns: 100 }
        );
    });

    it("returns false for invalid statuses", () => {
        fc.assert(
            fc.property(invalidOrderStatusArb, (status) => {
                return isValidDownloadOrderStatus(status) === false;
            }),
            { numRuns: 100 }
        );
    });

    it("returns false for null", () => {
        expect(isValidDownloadOrderStatus(null)).toBe(false);
    });

    it("returns false for undefined", () => {
        expect(isValidDownloadOrderStatus(undefined)).toBe(false);
    });
});

describe("createPermissionResult", () => {
    it("creates allowed result with order_id", () => {
        fc.assert(
            fc.property(fc.uuid(), (orderId) => {
                const result = createPermissionResult(true, undefined, orderId);
                return (
                    result.allowed === true &&
                    result.order_id === orderId &&
                    result.reason === undefined
                );
            }),
            { numRuns: 100 }
        );
    });

    it("creates denied result with reason", () => {
        fc.assert(
            fc.property(
                fc.constantFrom("no_auth", "no_purchase", "invalid_order_status") as fc.Arbitrary<"no_auth" | "no_purchase" | "invalid_order_status">,
                (reason) => {
                    const result = createPermissionResult(false, reason);
                    return (
                        result.allowed === false &&
                        result.reason === reason &&
                        result.order_id === undefined
                    );
                }
            ),
            { numRuns: 100 }
        );
    });
});
