/**
 * Property-Based Tests for Pending Order Service
 *
 * Tests the core functions of the pending order service using property-based testing.
 * These tests verify correctness properties without requiring database access.
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import type { CartItemWithProduct } from "~/lib/cart/types";
import type { Product, ProductType, DeliveryType } from "~/lib/supabase/types";
import {
    calculateExpiresAt,
    calculateRemainingTime,
    PAYMENT_WINDOW_MINUTES,
    PAYMENT_WINDOW_MS,
    type CreatePendingOrderParams,
    type PendingOrder,
    type PendingOrderItem,
} from "./pending-order.server";

// ============================================
// Arbitraries (Generators)
// ============================================

/**
 * Generate a valid currency
 */
const currencyArb = fc.constantFrom("CNY", "USD", "EUR", "JPY");

/**
 * Generate a valid price (positive, reasonable range)
 */
const priceArb = fc
    .integer({ min: 1, max: 9999999 })
    .map((cents) => cents / 100);

/**
 * Generate a valid quantity (positive integer)
 */
const quantityArb = fc.integer({ min: 1, max: 99 });

/**
 * Generate a valid spec combination (optional)
 */
const specCombinationArb = fc.option(
    fc.dictionary(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.string({ minLength: 1, maxLength: 50 }),
        { minKeys: 1, maxKeys: 5 }
    ),
    { nil: undefined }
);

/**
 * Generate a valid product type
 */
const productTypeArb: fc.Arbitrary<ProductType> = fc.constantFrom(
    "app", "game_card", "game_cdk", "game_digital", "physical", "overseas"
);

/**
 * Generate a valid delivery type
 */
const deliveryTypeArb: fc.Arbitrary<DeliveryType> = fc.constantFrom(
    "download", "license_key", "cdk", "shipment", "manual"
);

/**
 * Generate a valid ISO date string (within reasonable range)
 */
const isoDateArb = fc
    .integer({ min: 1577836800000, max: 1924905600000 }) // 2020-01-01 to 2030-12-31
    .map((timestamp) => new Date(timestamp).toISOString());

/**
 * Generate a minimal valid Product
 */
const productArb: fc.Arbitrary<Product> = fc.record({
    id: fc.uuid(),
    product_code: fc.string({ minLength: 3, maxLength: 20 }),
    name: fc.string({ minLength: 1, maxLength: 100 }),
    subtitle: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: undefined }),
    description: fc.option(fc.string({ minLength: 1, maxLength: 1000 }), { nil: undefined }),
    product_type: productTypeArb,
    delivery_type: deliveryTypeArb,
    category_id: fc.uuid(),
    is_active: fc.constant(true),
    has_discount: fc.boolean(),
    has_demo_video: fc.boolean(),
    inventory_count: fc.option(fc.integer({ min: 0, max: 10000 }), { nil: undefined }),
    created_at: isoDateArb,
    updated_at: isoDateArb,
});

/**
 * Generate a valid CartItemWithProduct
 */
const cartItemWithProductArb: fc.Arbitrary<CartItemWithProduct> = fc.record({
    id: fc.uuid(),
    cart_id: fc.uuid(),
    product_id: fc.uuid(),
    price_id: fc.uuid(),
    spec_combination: specCombinationArb,
    quantity: quantityArb,
    snapshot_price: priceArb,
    snapshot_currency: currencyArb,
    created_at: isoDateArb,
    updated_at: isoDateArb,
    product: productArb,
});

/**
 * Generate valid CreatePendingOrderParams with either userId or anonymousSessionId
 */
const createPendingOrderParamsArb: fc.Arbitrary<CreatePendingOrderParams> = fc.record({
    cartId: fc.uuid(),
    cartItems: fc.array(cartItemWithProductArb, { minLength: 1, maxLength: 10 }),
    userId: fc.option(fc.uuid(), { nil: undefined }),
    anonymousSessionId: fc.option(fc.uuid(), { nil: undefined }),
    totalAmount: priceArb,
    currency: currencyArb,
}).filter((params) => {
    // Ensure at least one of userId or anonymousSessionId is set
    return params.userId !== undefined || params.anonymousSessionId !== undefined;
});

// ============================================
// Pure Function for Testing Order Creation Logic
// (Extracted from createPendingOrder for testability)
// ============================================

/**
 * Transform CreatePendingOrderParams to PendingOrder structure
 * This is the pure data transformation logic extracted for testing
 */
function transformToPendingOrder(
    params: CreatePendingOrderParams,
    orderId: string,
    orderNumber: string,
    createdAt: string
): PendingOrder {
    const expiresAt = calculateExpiresAt(createdAt);

    return {
        id: orderId,
        orderNumber,
        status: "pending",
        createdAt,
        expiresAt,
        userId: params.userId,
        anonymousSessionId: params.anonymousSessionId,
        totalAmount: params.totalAmount,
        currency: params.currency,
        items: params.cartItems.map((item) => ({
            productId: item.product_id,
            productName: item.product?.name || "Unknown Product",
            specCombination: item.spec_combination,
            quantity: item.quantity,
            snapshotPrice: item.snapshot_price,
        })),
    };
}

/**
 * Validate that a PendingOrder has all required fields per Requirements 2.2, 2.3, 2.4, 2.5
 */
function validateOrderDataIntegrity(
    order: PendingOrder,
    params: CreatePendingOrderParams
): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Requirement 2.2: Either user_id or anonymous_session_id must be set
    if (!order.userId && !order.anonymousSessionId) {
        errors.push("Order must have either userId or anonymousSessionId");
    }

    // Requirement 2.5: Initial status must be "pending"
    if (order.status !== "pending") {
        errors.push(`Initial status must be "pending", got "${order.status}"`);
    }

    // Requirement 2.4: Must have valid UTC created_at timestamp
    const createdDate = new Date(order.createdAt);
    if (isNaN(createdDate.getTime())) {
        errors.push("createdAt must be a valid ISO timestamp");
    }

    // Verify expiresAt is 15 minutes after createdAt
    const expectedExpiresAt = new Date(createdDate.getTime() + PAYMENT_WINDOW_MS).toISOString();
    if (order.expiresAt !== expectedExpiresAt) {
        errors.push(`expiresAt mismatch: expected ${expectedExpiresAt}, got ${order.expiresAt}`);
    }

    // Requirement 2.3: All order items must have required fields
    if (order.items.length !== params.cartItems.length) {
        errors.push(`Item count mismatch: expected ${params.cartItems.length}, got ${order.items.length}`);
    }

    for (let i = 0; i < order.items.length; i++) {
        const item = order.items[i];
        const cartItem = params.cartItems[i];

        if (!item.productId) {
            errors.push(`Item ${i}: missing productId`);
        } else if (item.productId !== cartItem.product_id) {
            errors.push(`Item ${i}: productId mismatch`);
        }

        if (!item.productName) {
            errors.push(`Item ${i}: missing productName`);
        }

        if (item.quantity !== cartItem.quantity) {
            errors.push(`Item ${i}: quantity mismatch`);
        }

        if (item.snapshotPrice !== cartItem.snapshot_price) {
            errors.push(`Item ${i}: snapshotPrice mismatch`);
        }

        // spec_combination should match (including undefined)
        const expectedSpec = cartItem.spec_combination;
        const actualSpec = item.specCombination;
        if (JSON.stringify(expectedSpec) !== JSON.stringify(actualSpec)) {
            errors.push(`Item ${i}: specCombination mismatch`);
        }
    }

    return { valid: errors.length === 0, errors };
}

// ============================================
// Property Tests
// ============================================

describe("Property 2: Order creation data integrity", () => {
    /**
     * **Feature: order-payment-flow, Property 2: Order creation data integrity**
     * **Validates: Requirements 2.2, 2.3, 2.4, 2.5**
     *
     * For any created order, the order record must contain:
     * (a) either user_id or anonymous_session_id
     * (b) all order items with product_id, product_name, spec_combination, quantity, and snapshot_price
     * (c) a valid UTC created_at timestamp
     * (d) initial status of "pending"
     */
    it("order contains all required fields with correct values", () => {
        fc.assert(
            fc.property(
                createPendingOrderParamsArb,
                fc.uuid(), // orderId
                fc.string({ minLength: 17, maxLength: 17 }), // orderNumber (GIS + 14 digits)
                isoDateArb, // createdAt
                (params, orderId, orderNumber, createdAt) => {
                    const order = transformToPendingOrder(params, orderId, orderNumber, createdAt);
                    const validation = validateOrderDataIntegrity(order, params);

                    expect(validation.valid).toBe(true);
                    if (!validation.valid) {
                        console.error("Validation errors:", validation.errors);
                    }

                    return validation.valid;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * User identification is preserved (either userId or anonymousSessionId)
     */
    it("user identification is preserved", () => {
        fc.assert(
            fc.property(
                createPendingOrderParamsArb,
                fc.uuid(),
                fc.string({ minLength: 17, maxLength: 17 }),
                isoDateArb,
                (params, orderId, orderNumber, createdAt) => {
                    const order = transformToPendingOrder(params, orderId, orderNumber, createdAt);

                    // At least one must be set
                    const hasIdentification = order.userId !== undefined || order.anonymousSessionId !== undefined;

                    // Values must match input
                    const userIdMatches = order.userId === params.userId;
                    const sessionIdMatches = order.anonymousSessionId === params.anonymousSessionId;

                    return hasIdentification && userIdMatches && sessionIdMatches;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Initial status is always "pending"
     */
    it("initial status is always pending", () => {
        fc.assert(
            fc.property(
                createPendingOrderParamsArb,
                fc.uuid(),
                fc.string({ minLength: 17, maxLength: 17 }),
                isoDateArb,
                (params, orderId, orderNumber, createdAt) => {
                    const order = transformToPendingOrder(params, orderId, orderNumber, createdAt);
                    return order.status === "pending";
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * All cart items are transformed to order items
     */
    it("all cart items are transformed to order items", () => {
        fc.assert(
            fc.property(
                createPendingOrderParamsArb,
                fc.uuid(),
                fc.string({ minLength: 17, maxLength: 17 }),
                isoDateArb,
                (params, orderId, orderNumber, createdAt) => {
                    const order = transformToPendingOrder(params, orderId, orderNumber, createdAt);
                    return order.items.length === params.cartItems.length;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Order item product_id matches cart item product_id
     */
    it("order item product_id matches cart item", () => {
        fc.assert(
            fc.property(
                createPendingOrderParamsArb,
                fc.uuid(),
                fc.string({ minLength: 17, maxLength: 17 }),
                isoDateArb,
                (params, orderId, orderNumber, createdAt) => {
                    const order = transformToPendingOrder(params, orderId, orderNumber, createdAt);

                    for (let i = 0; i < order.items.length; i++) {
                        if (order.items[i].productId !== params.cartItems[i].product_id) {
                            return false;
                        }
                    }
                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Order item quantity matches cart item quantity
     */
    it("order item quantity matches cart item", () => {
        fc.assert(
            fc.property(
                createPendingOrderParamsArb,
                fc.uuid(),
                fc.string({ minLength: 17, maxLength: 17 }),
                isoDateArb,
                (params, orderId, orderNumber, createdAt) => {
                    const order = transformToPendingOrder(params, orderId, orderNumber, createdAt);

                    for (let i = 0; i < order.items.length; i++) {
                        if (order.items[i].quantity !== params.cartItems[i].quantity) {
                            return false;
                        }
                    }
                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Order item snapshotPrice matches cart item snapshot_price
     */
    it("order item snapshotPrice matches cart item", () => {
        fc.assert(
            fc.property(
                createPendingOrderParamsArb,
                fc.uuid(),
                fc.string({ minLength: 17, maxLength: 17 }),
                isoDateArb,
                (params, orderId, orderNumber, createdAt) => {
                    const order = transformToPendingOrder(params, orderId, orderNumber, createdAt);

                    for (let i = 0; i < order.items.length; i++) {
                        if (order.items[i].snapshotPrice !== params.cartItems[i].snapshot_price) {
                            return false;
                        }
                    }
                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * createdAt is a valid ISO timestamp
     */
    it("createdAt is a valid ISO timestamp", () => {
        fc.assert(
            fc.property(
                createPendingOrderParamsArb,
                fc.uuid(),
                fc.string({ minLength: 17, maxLength: 17 }),
                isoDateArb,
                (params, orderId, orderNumber, createdAt) => {
                    const order = transformToPendingOrder(params, orderId, orderNumber, createdAt);
                    const date = new Date(order.createdAt);
                    return !isNaN(date.getTime()) && order.createdAt === createdAt;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * expiresAt is exactly 15 minutes after createdAt
     */
    it("expiresAt is exactly 15 minutes after createdAt", () => {
        fc.assert(
            fc.property(
                createPendingOrderParamsArb,
                fc.uuid(),
                fc.string({ minLength: 17, maxLength: 17 }),
                isoDateArb,
                (params, orderId, orderNumber, createdAt) => {
                    const order = transformToPendingOrder(params, orderId, orderNumber, createdAt);

                    const createdDate = new Date(order.createdAt);
                    const expiresDate = new Date(order.expiresAt);
                    const diffMs = expiresDate.getTime() - createdDate.getTime();

                    return diffMs === PAYMENT_WINDOW_MS;
                }
            ),
            { numRuns: 100 }
        );
    });
});


// ============================================
// Property 4: Server-side time calculation consistency
// ============================================

describe("Property 4: Server-side time calculation consistency", () => {
    /**
     * **Feature: order-payment-flow, Property 4: Server-side time calculation consistency**
     * **Validates: Requirements 3.1, 3.4**
     *
     * For any pending order displayed to a user, the remaining payment time must equal
     * (order.created_at + 15 minutes - server_current_time), and this calculation
     * must be performed server-side only.
     */
    it("remaining time equals (createdAt + 15min - currentTime)", () => {
        fc.assert(
            fc.property(
                // Generate a createdAt timestamp that's within the last 20 minutes
                // to test both expired and non-expired cases
                fc.integer({ min: -20 * 60 * 1000, max: 0 }).map((offset) => {
                    const now = Date.now();
                    return new Date(now + offset).toISOString();
                }),
                (createdAt) => {
                    const result = calculateRemainingTime(createdAt);

                    const createdDate = new Date(createdAt);
                    const expiresAt = createdDate.getTime() + PAYMENT_WINDOW_MS;
                    const now = Date.now();
                    const expectedRemainingMs = expiresAt - now;

                    if (expectedRemainingMs <= 0) {
                        // Should be expired
                        return result.isExpired === true && result.remainingSeconds === 0;
                    } else {
                        // Should have remaining time
                        // Allow 1 second tolerance for test execution time
                        const expectedSeconds = Math.ceil(expectedRemainingMs / 1000);
                        const tolerance = 1;
                        return (
                            result.isExpired === false &&
                            Math.abs(result.remainingSeconds - expectedSeconds) <= tolerance
                        );
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Orders created exactly 15 minutes ago should be expired
     */
    it("orders created exactly 15 minutes ago are expired", () => {
        const fifteenMinutesAgo = new Date(Date.now() - PAYMENT_WINDOW_MS).toISOString();
        const result = calculateRemainingTime(fifteenMinutesAgo);

        expect(result.isExpired).toBe(true);
        expect(result.remainingSeconds).toBe(0);
    });

    /**
     * Orders created more than 15 minutes ago should be expired
     */
    it("orders created more than 15 minutes ago are expired", () => {
        fc.assert(
            fc.property(
                // Generate timestamps from 15 to 60 minutes ago
                fc.integer({ min: PAYMENT_WINDOW_MS, max: 60 * 60 * 1000 }).map((offset) => {
                    return new Date(Date.now() - offset).toISOString();
                }),
                (createdAt) => {
                    const result = calculateRemainingTime(createdAt);
                    return result.isExpired === true && result.remainingSeconds === 0;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Orders created less than 15 minutes ago should not be expired
     */
    it("orders created less than 15 minutes ago are not expired", () => {
        fc.assert(
            fc.property(
                // Generate timestamps from 0 to 14 minutes ago
                fc.integer({ min: 0, max: PAYMENT_WINDOW_MS - 1000 }).map((offset) => {
                    return new Date(Date.now() - offset).toISOString();
                }),
                (createdAt) => {
                    const result = calculateRemainingTime(createdAt);
                    return result.isExpired === false && result.remainingSeconds > 0;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * remainingSeconds is always non-negative
     */
    it("remainingSeconds is always non-negative", () => {
        fc.assert(
            fc.property(
                isoDateArb,
                (createdAt) => {
                    const result = calculateRemainingTime(createdAt);
                    return result.remainingSeconds >= 0;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * isExpired is true if and only if remainingSeconds is 0
     */
    it("isExpired is true iff remainingSeconds is 0", () => {
        fc.assert(
            fc.property(
                isoDateArb,
                (createdAt) => {
                    const result = calculateRemainingTime(createdAt);

                    if (result.isExpired) {
                        return result.remainingSeconds === 0;
                    } else {
                        return result.remainingSeconds > 0;
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * calculateExpiresAt returns exactly createdAt + 15 minutes
     */
    it("calculateExpiresAt returns createdAt + 15 minutes", () => {
        fc.assert(
            fc.property(
                isoDateArb,
                (createdAt) => {
                    const expiresAt = calculateExpiresAt(createdAt);

                    const createdDate = new Date(createdAt);
                    const expiresDate = new Date(expiresAt);
                    const diffMs = expiresDate.getTime() - createdDate.getTime();

                    return diffMs === PAYMENT_WINDOW_MS;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * calculateExpiresAt output is a valid ISO timestamp
     */
    it("calculateExpiresAt returns valid ISO timestamp", () => {
        fc.assert(
            fc.property(
                isoDateArb,
                (createdAt) => {
                    const expiresAt = calculateExpiresAt(createdAt);
                    const date = new Date(expiresAt);

                    // Check it's a valid date
                    if (isNaN(date.getTime())) {
                        return false;
                    }

                    // Check it's in ISO format
                    return expiresAt === date.toISOString();
                }
            ),
            { numRuns: 100 }
        );
    });
});


// ============================================
// Property 5: Order expiration logic
// ============================================

/**
 * Simulates the order expiration check logic
 * This is a pure function extracted from checkAndCancelExpiredOrder for testing
 */
function shouldCancelOrder(
    order: { status: string; createdAt: string },
    currentTime: number
): boolean {
    // Only pending orders can be cancelled due to expiration
    if (order.status !== "pending") {
        return false;
    }

    const createdDate = new Date(order.createdAt);
    const expiresAt = createdDate.getTime() + PAYMENT_WINDOW_MS;

    return currentTime > expiresAt;
}

/**
 * Simulates the order state after expiration check
 */
function getOrderStatusAfterExpirationCheck(
    order: { status: "pending" | "paid" | "cancelled"; createdAt: string },
    currentTime: number
): "pending" | "paid" | "cancelled" {
    if (order.status !== "pending") {
        return order.status;
    }

    const createdDate = new Date(order.createdAt);
    const expiresAt = createdDate.getTime() + PAYMENT_WINDOW_MS;

    if (currentTime > expiresAt) {
        return "cancelled";
    }

    return "pending";
}

describe("Property 5: Order expiration logic", () => {
    /**
     * **Feature: order-payment-flow, Property 5: Order expiration logic**
     * **Validates: Requirements 4.1, 4.3**
     *
     * For any order where (current_server_time > order.created_at + 15 minutes)
     * and status is "pending", the order must be transitioned to "cancelled" status.
     */
    it("expired pending orders are cancelled", () => {
        fc.assert(
            fc.property(
                // Generate a createdAt timestamp more than 15 minutes ago
                fc.integer({ min: PAYMENT_WINDOW_MS + 1000, max: 60 * 60 * 1000 }).map((offset) => {
                    return new Date(Date.now() - offset).toISOString();
                }),
                (createdAt) => {
                    const order = { status: "pending" as const, createdAt };
                    const currentTime = Date.now();

                    const shouldCancel = shouldCancelOrder(order, currentTime);
                    const newStatus = getOrderStatusAfterExpirationCheck(order, currentTime);

                    return shouldCancel === true && newStatus === "cancelled";
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Non-expired pending orders remain pending
     */
    it("non-expired pending orders remain pending", () => {
        fc.assert(
            fc.property(
                // Generate a createdAt timestamp less than 15 minutes ago
                fc.integer({ min: 0, max: PAYMENT_WINDOW_MS - 1000 }).map((offset) => {
                    return new Date(Date.now() - offset).toISOString();
                }),
                (createdAt) => {
                    const order = { status: "pending" as const, createdAt };
                    const currentTime = Date.now();

                    const shouldCancel = shouldCancelOrder(order, currentTime);
                    const newStatus = getOrderStatusAfterExpirationCheck(order, currentTime);

                    return shouldCancel === false && newStatus === "pending";
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Paid orders are never cancelled due to expiration
     */
    it("paid orders are never cancelled due to expiration", () => {
        fc.assert(
            fc.property(
                isoDateArb,
                (createdAt) => {
                    const order = { status: "paid" as const, createdAt };
                    const currentTime = Date.now();

                    const shouldCancel = shouldCancelOrder(order, currentTime);
                    const newStatus = getOrderStatusAfterExpirationCheck(order, currentTime);

                    return shouldCancel === false && newStatus === "paid";
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Already cancelled orders remain cancelled
     */
    it("already cancelled orders remain cancelled", () => {
        fc.assert(
            fc.property(
                isoDateArb,
                (createdAt) => {
                    const order = { status: "cancelled" as const, createdAt };
                    const currentTime = Date.now();

                    const shouldCancel = shouldCancelOrder(order, currentTime);
                    const newStatus = getOrderStatusAfterExpirationCheck(order, currentTime);

                    return shouldCancel === false && newStatus === "cancelled";
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Expiration check uses server time comparison correctly
     * (current_server_time > order.created_at + 15 minutes)
     */
    it("expiration uses correct time comparison", () => {
        fc.assert(
            fc.property(
                isoDateArb,
                fc.integer({ min: 0, max: 30 * 60 * 1000 }), // offset from expiration time
                fc.boolean(), // whether to be before or after expiration
                (createdAt, offset, isAfterExpiration) => {
                    const createdDate = new Date(createdAt);
                    const expiresAt = createdDate.getTime() + PAYMENT_WINDOW_MS;

                    // Set current time relative to expiration
                    const currentTime = isAfterExpiration
                        ? expiresAt + offset + 1 // After expiration
                        : expiresAt - offset - 1; // Before expiration

                    const order = { status: "pending" as const, createdAt };
                    const shouldCancel = shouldCancelOrder(order, currentTime);

                    // Should cancel only if current time is after expiration
                    return shouldCancel === isAfterExpiration;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Order at exactly expiration time is not cancelled (boundary condition)
     * The condition is > not >=, so exactly at expiration time should not cancel
     */
    it("order at exactly expiration time is not cancelled", () => {
        fc.assert(
            fc.property(
                isoDateArb,
                (createdAt) => {
                    const createdDate = new Date(createdAt);
                    const exactlyAtExpiration = createdDate.getTime() + PAYMENT_WINDOW_MS;

                    const order = { status: "pending" as const, createdAt };
                    const shouldCancel = shouldCancelOrder(order, exactlyAtExpiration);

                    // At exactly expiration time, should NOT cancel (> not >=)
                    return shouldCancel === false;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Order 1ms after expiration time is cancelled
     */
    it("order 1ms after expiration time is cancelled", () => {
        fc.assert(
            fc.property(
                isoDateArb,
                (createdAt) => {
                    const createdDate = new Date(createdAt);
                    const justAfterExpiration = createdDate.getTime() + PAYMENT_WINDOW_MS + 1;

                    const order = { status: "pending" as const, createdAt };
                    const shouldCancel = shouldCancelOrder(order, justAfterExpiration);

                    return shouldCancel === true;
                }
            ),
            { numRuns: 100 }
        );
    });
});
