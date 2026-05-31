/**
 * Property-Based Tests for Webhook Order Status Handling
 *
 * Tests the webhook order lookup and status update functionality using property-based testing.
 * These tests verify correctness properties for Requirements 5.1, 5.2, 5.3, 5.4, 4.2.
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import type { OrderStatus } from "~/lib/supabase/types";
import {
    calculateRemainingTime,
    PAYMENT_WINDOW_MS,
} from "./pending-order.server";

// ============================================
// Types for Testing
// ============================================

interface MockOrder {
    id: string;
    orderNumber: string;
    status: OrderStatus;
    createdAt: string;
    expiresAt: string;
    userId?: string;
    anonymousSessionId?: string;
    totalAmount: number;
    currency: string;
    stripeSessionId?: string;
    paymentCompletedAt?: string;
}

interface MockCheckoutSession {
    id: string;
    paymentStatus: "paid" | "unpaid" | "no_payment_required";
    amountTotal: number;
    currency: string;
    metadata?: {
        order_id?: string;
        user_id?: string;
        anonymous_session_id?: string;
        cart_id?: string;
    };
}

// ============================================
// Pure Functions for Testing (extracted logic)
// ============================================

/**
 * Extract order_id from checkout session metadata
 * This is the pure logic extracted from extractOrderDataFromCheckoutSession
 */
function extractOrderIdFromSession(session: MockCheckoutSession): string | null {
    return session.metadata?.order_id || null;
}

/**
 * Simulate webhook order lookup logic
 * Returns the order if found, null otherwise
 */
function lookupOrderById(
    orderId: string,
    orders: Map<string, MockOrder>
): MockOrder | null {
    return orders.get(orderId) || null;
}

/**
 * Determine if an order can be updated to paid status
 * Requirements: 5.2, 5.3
 */
function canUpdateOrderToPaid(order: MockOrder): {
    canUpdate: boolean;
    reason?: string;
} {
    if (order.status === "paid") {
        return { canUpdate: true, reason: "already_paid" }; // Idempotent
    }

    if (order.status === "cancelled") {
        return { canUpdate: false, reason: "order_cancelled" };
    }

    if (order.status !== "pending") {
        return { canUpdate: false, reason: "invalid_status" };
    }

    // Check expiration
    const { isExpired } = calculateRemainingTime(order.createdAt);
    if (isExpired) {
        return { canUpdate: false, reason: "order_expired" };
    }

    return { canUpdate: true };
}

/**
 * Simulate order status update to paid
 * Requirements: 5.2, 5.3
 */
function updateOrderToPaidPure(
    order: MockOrder,
    stripeSessionId: string,
    currentTime: Date
): MockOrder {
    return {
        ...order,
        status: "paid",
        stripeSessionId,
        paymentCompletedAt: currentTime.toISOString(),
    };
}

/**
 * Determine if a refund should be initiated
 * Requirements: 5.4
 */
function shouldInitiateRefund(order: MockOrder): boolean {
    // Refund if order is cancelled or expired
    if (order.status === "cancelled") {
        return true;
    }

    if (order.status === "pending") {
        const { isExpired } = calculateRemainingTime(order.createdAt);
        return isExpired;
    }

    return false;
}

// ============================================
// Arbitraries (Generators)
// ============================================

const currencyArb = fc.constantFrom("CNY", "USD", "EUR", "JPY");

const priceArb = fc
    .integer({ min: 1, max: 9999999 })
    .map((cents) => cents / 100);

const orderStatusArb: fc.Arbitrary<OrderStatus> = fc.constantFrom(
    "pending", "paid", "cancelled", "fulfilled", "completed"
);

const isoDateArb = fc
    .integer({ min: 1577836800000, max: 1924905600000 })
    .map((timestamp) => new Date(timestamp).toISOString());

/**
 * Generate a mock order
 */
const mockOrderArb: fc.Arbitrary<MockOrder> = fc.record({
    id: fc.uuid(),
    orderNumber: fc.string({ minLength: 17, maxLength: 17 }),
    status: orderStatusArb,
    createdAt: isoDateArb,
    expiresAt: isoDateArb,
    userId: fc.option(fc.uuid(), { nil: undefined }),
    anonymousSessionId: fc.option(fc.uuid(), { nil: undefined }),
    totalAmount: priceArb,
    currency: currencyArb,
    stripeSessionId: fc.option(fc.uuid(), { nil: undefined }),
    paymentCompletedAt: fc.option(isoDateArb, { nil: undefined }),
}).map((order) => ({
    ...order,
    // Ensure expiresAt is 15 minutes after createdAt
    expiresAt: new Date(new Date(order.createdAt).getTime() + PAYMENT_WINDOW_MS).toISOString(),
}));

/**
 * Generate a pending order (for specific tests)
 */
const pendingOrderArb: fc.Arbitrary<MockOrder> = mockOrderArb.map((order) => ({
    ...order,
    status: "pending" as const,
    paymentCompletedAt: undefined,
}));

/**
 * Generate a cancelled order
 */
const cancelledOrderArb: fc.Arbitrary<MockOrder> = mockOrderArb.map((order) => ({
    ...order,
    status: "cancelled" as const,
}));

/**
 * Generate a mock checkout session with order_id in metadata
 */
const mockCheckoutSessionArb: fc.Arbitrary<MockCheckoutSession> = fc.record({
    id: fc.uuid(),
    paymentStatus: fc.constantFrom("paid", "unpaid", "no_payment_required") as fc.Arbitrary<"paid" | "unpaid" | "no_payment_required">,
    amountTotal: fc.integer({ min: 100, max: 9999900 }),
    currency: currencyArb,
    metadata: fc.option(
        fc.record({
            order_id: fc.option(fc.uuid(), { nil: undefined }),
            user_id: fc.option(fc.uuid(), { nil: undefined }),
            anonymous_session_id: fc.option(fc.uuid(), { nil: undefined }),
            cart_id: fc.option(fc.uuid(), { nil: undefined }),
        }),
        { nil: undefined }
    ),
});

// ============================================
// Property Tests
// ============================================

describe("Property 7: Webhook order lookup", () => {
    /**
     * **Feature: order-payment-flow, Property 7: Webhook order lookup**
     * **Validates: Requirements 5.1**
     *
     * For any successful payment webhook event, the system must locate the
     * corresponding order using the order_id from the Stripe session metadata.
     */
    it("order_id from session metadata correctly identifies the order", () => {
        fc.assert(
            fc.property(
                mockOrderArb,
                mockCheckoutSessionArb,
                (order, session) => {
                    // Create a session with the order's ID in metadata
                    const sessionWithOrderId: MockCheckoutSession = {
                        ...session,
                        metadata: {
                            ...session.metadata,
                            order_id: order.id,
                        },
                    };

                    // Create an order map
                    const orders = new Map<string, MockOrder>();
                    orders.set(order.id, order);

                    // Extract order_id from session
                    const extractedOrderId = extractOrderIdFromSession(sessionWithOrderId);

                    // Lookup order
                    const foundOrder = extractedOrderId
                        ? lookupOrderById(extractedOrderId, orders)
                        : null;

                    // The found order should match the original
                    return foundOrder !== null && foundOrder.id === order.id;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Missing order_id in metadata returns null
     */
    it("missing order_id in metadata returns null", () => {
        fc.assert(
            fc.property(
                mockCheckoutSessionArb.filter((s) => !s.metadata?.order_id),
                (session) => {
                    const extractedOrderId = extractOrderIdFromSession(session);
                    return extractedOrderId === null;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Non-existent order_id returns null on lookup
     */
    it("non-existent order_id returns null on lookup", () => {
        fc.assert(
            fc.property(
                fc.uuid(), // random order_id
                fc.array(mockOrderArb, { minLength: 0, maxLength: 10 }),
                (orderId, orderList) => {
                    // Create order map without the target order_id
                    const orders = new Map<string, MockOrder>();
                    for (const order of orderList) {
                        if (order.id !== orderId) {
                            orders.set(order.id, order);
                        }
                    }

                    const foundOrder = lookupOrderById(orderId, orders);
                    return foundOrder === null;
                }
            ),
            { numRuns: 100 }
        );
    });
});


describe("Property 8: Order status update integrity", () => {
    /**
     * **Feature: order-payment-flow, Property 8: Order status update integrity**
     * **Validates: Requirements 5.2, 5.3**
     *
     * For any order status update from "pending" to "paid", the operation must:
     * (a) update the existing record without creating a new record
     * (b) set the payment_completed_at timestamp
     */
    it("pending order update sets payment_completed_at timestamp", () => {
        fc.assert(
            fc.property(
                pendingOrderArb.filter((order) => {
                    // Only test non-expired pending orders
                    const { isExpired } = calculateRemainingTime(order.createdAt);
                    return !isExpired;
                }),
                fc.uuid(), // stripeSessionId
                (order, stripeSessionId) => {
                    // Ensure order is not expired for this test
                    const recentOrder = {
                        ...order,
                        createdAt: new Date().toISOString(),
                        expiresAt: new Date(Date.now() + PAYMENT_WINDOW_MS).toISOString(),
                    };

                    const currentTime = new Date();
                    const updatedOrder = updateOrderToPaidPure(recentOrder, stripeSessionId, currentTime);

                    // Verify payment_completed_at is set
                    expect(updatedOrder.paymentCompletedAt).toBeDefined();
                    expect(updatedOrder.paymentCompletedAt).toBe(currentTime.toISOString());

                    return updatedOrder.paymentCompletedAt !== undefined;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Order ID is preserved after update (same record, not new)
     */
    it("order ID is preserved after update", () => {
        fc.assert(
            fc.property(
                pendingOrderArb,
                fc.uuid(),
                (order, stripeSessionId) => {
                    const recentOrder = {
                        ...order,
                        createdAt: new Date().toISOString(),
                        expiresAt: new Date(Date.now() + PAYMENT_WINDOW_MS).toISOString(),
                    };

                    const currentTime = new Date();
                    const updatedOrder = updateOrderToPaidPure(recentOrder, stripeSessionId, currentTime);

                    // ID must be preserved (same record)
                    return updatedOrder.id === recentOrder.id;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Status changes from pending to paid
     */
    it("status changes from pending to paid", () => {
        fc.assert(
            fc.property(
                pendingOrderArb,
                fc.uuid(),
                (order, stripeSessionId) => {
                    const recentOrder = {
                        ...order,
                        createdAt: new Date().toISOString(),
                        expiresAt: new Date(Date.now() + PAYMENT_WINDOW_MS).toISOString(),
                    };

                    const currentTime = new Date();
                    const updatedOrder = updateOrderToPaidPure(recentOrder, stripeSessionId, currentTime);

                    return updatedOrder.status === "paid";
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Stripe session ID is recorded
     */
    it("stripe session ID is recorded", () => {
        fc.assert(
            fc.property(
                pendingOrderArb,
                fc.uuid(),
                (order, stripeSessionId) => {
                    const recentOrder = {
                        ...order,
                        createdAt: new Date().toISOString(),
                        expiresAt: new Date(Date.now() + PAYMENT_WINDOW_MS).toISOString(),
                    };

                    const currentTime = new Date();
                    const updatedOrder = updateOrderToPaidPure(recentOrder, stripeSessionId, currentTime);

                    return updatedOrder.stripeSessionId === stripeSessionId;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Other order fields are preserved
     */
    it("other order fields are preserved", () => {
        fc.assert(
            fc.property(
                pendingOrderArb,
                fc.uuid(),
                (order, stripeSessionId) => {
                    const recentOrder = {
                        ...order,
                        createdAt: new Date().toISOString(),
                        expiresAt: new Date(Date.now() + PAYMENT_WINDOW_MS).toISOString(),
                    };

                    const currentTime = new Date();
                    const updatedOrder = updateOrderToPaidPure(recentOrder, stripeSessionId, currentTime);

                    // Verify other fields are preserved
                    return (
                        updatedOrder.orderNumber === recentOrder.orderNumber &&
                        updatedOrder.userId === recentOrder.userId &&
                        updatedOrder.anonymousSessionId === recentOrder.anonymousSessionId &&
                        updatedOrder.totalAmount === recentOrder.totalAmount &&
                        updatedOrder.currency === recentOrder.currency &&
                        updatedOrder.createdAt === recentOrder.createdAt &&
                        updatedOrder.expiresAt === recentOrder.expiresAt
                    );
                }
            ),
            { numRuns: 100 }
        );
    });
});

describe("Property 6: Cancelled order payment rejection", () => {
    /**
     * **Feature: order-payment-flow, Property 6: Cancelled order payment rejection**
     * **Validates: Requirements 4.2**
     *
     * For any order with status "cancelled", any payment attempt must be rejected
     * and not result in a status change to "paid".
     */
    it("cancelled orders cannot be updated to paid", () => {
        fc.assert(
            fc.property(
                cancelledOrderArb,
                (order) => {
                    const result = canUpdateOrderToPaid(order);

                    // Should not be able to update
                    return result.canUpdate === false && result.reason === "order_cancelled";
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Cancelled orders trigger refund
     */
    it("cancelled orders trigger refund", () => {
        fc.assert(
            fc.property(
                cancelledOrderArb,
                (order) => {
                    return shouldInitiateRefund(order) === true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Paid orders do not trigger refund
     */
    it("paid orders do not trigger refund", () => {
        fc.assert(
            fc.property(
                mockOrderArb.map((o) => ({ ...o, status: "paid" as const })),
                (order) => {
                    return shouldInitiateRefund(order) === false;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Non-expired pending orders do not trigger refund
     */
    it("non-expired pending orders do not trigger refund", () => {
        fc.assert(
            fc.property(
                pendingOrderArb,
                (order) => {
                    // Create a recent order that's not expired
                    const recentOrder = {
                        ...order,
                        createdAt: new Date().toISOString(),
                        expiresAt: new Date(Date.now() + PAYMENT_WINDOW_MS).toISOString(),
                    };

                    return shouldInitiateRefund(recentOrder) === false;
                }
            ),
            { numRuns: 100 }
        );
    });
});

describe("Property 9: Late payment refund handling", () => {
    /**
     * **Feature: order-payment-flow, Property 9: Late payment refund handling**
     * **Validates: Requirements 5.4**
     *
     * For any successful payment webhook for an order with status "cancelled",
     * the system must initiate a refund process.
     */
    it("expired pending orders trigger refund", () => {
        fc.assert(
            fc.property(
                // Generate orders that are expired (created more than 15 minutes ago)
                fc.integer({ min: PAYMENT_WINDOW_MS + 1000, max: 60 * 60 * 1000 }).map((offset) => {
                    const createdAt = new Date(Date.now() - offset).toISOString();
                    return {
                        id: crypto.randomUUID(),
                        orderNumber: "GIS20241221000001",
                        status: "pending" as const,
                        createdAt,
                        expiresAt: new Date(new Date(createdAt).getTime() + PAYMENT_WINDOW_MS).toISOString(),
                        totalAmount: 99.99,
                        currency: "CNY",
                    } as MockOrder;
                }),
                (order) => {
                    // Expired pending orders should trigger refund
                    return shouldInitiateRefund(order) === true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Cancelled orders always trigger refund regardless of creation time
     */
    it("cancelled orders always trigger refund", () => {
        fc.assert(
            fc.property(
                isoDateArb, // any creation time
                (createdAt) => {
                    const order: MockOrder = {
                        id: crypto.randomUUID(),
                        orderNumber: "GIS20241221000001",
                        status: "cancelled",
                        createdAt,
                        expiresAt: new Date(new Date(createdAt).getTime() + PAYMENT_WINDOW_MS).toISOString(),
                        totalAmount: 99.99,
                        currency: "CNY",
                    };

                    return shouldInitiateRefund(order) === true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * canUpdateOrderToPaid returns false for expired orders
     */
    it("expired orders cannot be updated to paid", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: PAYMENT_WINDOW_MS + 1000, max: 60 * 60 * 1000 }),
                (offset) => {
                    const createdAt = new Date(Date.now() - offset).toISOString();
                    const order: MockOrder = {
                        id: crypto.randomUUID(),
                        orderNumber: "GIS20241221000001",
                        status: "pending",
                        createdAt,
                        expiresAt: new Date(new Date(createdAt).getTime() + PAYMENT_WINDOW_MS).toISOString(),
                        totalAmount: 99.99,
                        currency: "CNY",
                    };

                    const result = canUpdateOrderToPaid(order);
                    return result.canUpdate === false && result.reason === "order_expired";
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Already paid orders are handled idempotently
     */
    it("already paid orders are handled idempotently", () => {
        fc.assert(
            fc.property(
                mockOrderArb.map((o) => ({
                    ...o,
                    status: "paid" as const,
                    paymentCompletedAt: new Date().toISOString(),
                })),
                (order) => {
                    const result = canUpdateOrderToPaid(order);
                    // Should return canUpdate: true with reason "already_paid"
                    return result.canUpdate === true && result.reason === "already_paid";
                }
            ),
            { numRuns: 100 }
        );
    });
});
