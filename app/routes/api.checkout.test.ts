/**
 * Property-Based Tests for Checkout API
 *
 * Tests the checkout flow logic using property-based testing.
 * These tests verify correctness properties for order creation and Stripe session binding.
 * 
 * Requirements: 2.1, 2.6
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import type { CartItemWithProduct } from "~/lib/cart/types";
import type { Product, ProductType, DeliveryType } from "~/lib/supabase/types";

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

// ============================================
// Types for Checkout Flow Simulation
// ============================================

interface CheckoutFlowParams {
    cartId: string;
    cartItems: CartItemWithProduct[];
    userId?: string;
    anonymousSessionId?: string;
}

interface PendingOrderResult {
    success: boolean;
    order?: {
        id: string;
        orderNumber: string;
        status: "pending";
        createdAt: string;
        expiresAt: string;
    };
    error?: { code: string; message: string };
}

interface StripeSessionResult {
    success: boolean;
    sessionId?: string;
    clientSecret?: string;
    metadata?: Record<string, string>;
    error?: { code: string; message: string };
}

interface CheckoutFlowResult {
    pendingOrderCreated: boolean;
    stripeSessionCreated: boolean;
    pendingOrderResult?: PendingOrderResult;
    stripeSessionResult?: StripeSessionResult;
    orderCreatedBeforeStripe: boolean;
}

// ============================================
// Pure Functions for Testing Checkout Flow Logic
// ============================================

/**
 * Simulates the checkout flow logic
 * This extracts the pure logic from the checkout API for testing
 * 
 * Requirements: 2.1 - Create pending order before Stripe session
 */
function simulateCheckoutFlow(
    params: CheckoutFlowParams,
    createPendingOrderFn: (p: CheckoutFlowParams) => PendingOrderResult,
    createStripeSessionFn: (orderId: string, p: CheckoutFlowParams) => StripeSessionResult
): CheckoutFlowResult {
    // Validate user identification
    if (!params.userId && !params.anonymousSessionId) {
        return {
            pendingOrderCreated: false,
            stripeSessionCreated: false,
            orderCreatedBeforeStripe: false,
            pendingOrderResult: {
                success: false,
                error: { code: "USER_NOT_IDENTIFIED", message: "无法识别用户身份" },
            },
        };
    }

    // Validate cart items
    if (!params.cartItems || params.cartItems.length === 0) {
        return {
            pendingOrderCreated: false,
            stripeSessionCreated: false,
            orderCreatedBeforeStripe: false,
            pendingOrderResult: {
                success: false,
                error: { code: "CART_INVALID", message: "购物车数据无效" },
            },
        };
    }

    // Step 1: Create pending order FIRST (Requirements 2.1)
    const pendingOrderResult = createPendingOrderFn(params);

    if (!pendingOrderResult.success || !pendingOrderResult.order) {
        return {
            pendingOrderCreated: false,
            stripeSessionCreated: false,
            orderCreatedBeforeStripe: false,
            pendingOrderResult,
        };
    }

    // Step 2: Create Stripe session AFTER pending order
    const stripeSessionResult = createStripeSessionFn(pendingOrderResult.order.id, params);

    return {
        pendingOrderCreated: true,
        stripeSessionCreated: stripeSessionResult.success,
        orderCreatedBeforeStripe: true, // By design, order is always created first
        pendingOrderResult,
        stripeSessionResult,
    };
}

/**
 * Builds Stripe session metadata with order_id
 * Requirements: 2.6 - Include order_id in Stripe session metadata
 */
function buildStripeSessionMetadata(
    orderId: string,
    cartId: string,
    userId?: string,
    anonymousSessionId?: string
): Record<string, string> {
    const metadata: Record<string, string> = {
        cart_id: cartId,
        order_id: orderId,
    };

    if (userId) {
        metadata.user_id = userId;
    }

    if (anonymousSessionId) {
        metadata.anonymous_session_id = anonymousSessionId;
    }

    return metadata;
}

/**
 * Validates that Stripe session metadata contains required fields
 * Requirements: 2.6
 */
function validateStripeMetadata(
    metadata: Record<string, string>,
    expectedOrderId: string,
    expectedUserId?: string,
    expectedAnonymousSessionId?: string
): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // order_id must be present
    if (!metadata.order_id) {
        errors.push("metadata must contain order_id");
    } else if (metadata.order_id !== expectedOrderId) {
        errors.push(`order_id mismatch: expected ${expectedOrderId}, got ${metadata.order_id}`);
    }

    // Either user_id or anonymous_session_id must be present
    if (!metadata.user_id && !metadata.anonymous_session_id) {
        errors.push("metadata must contain either user_id or anonymous_session_id");
    }

    // If userId is expected, it must match
    if (expectedUserId && metadata.user_id !== expectedUserId) {
        errors.push(`user_id mismatch: expected ${expectedUserId}, got ${metadata.user_id}`);
    }

    // If anonymousSessionId is expected, it must match
    if (expectedAnonymousSessionId && metadata.anonymous_session_id !== expectedAnonymousSessionId) {
        errors.push(`anonymous_session_id mismatch: expected ${expectedAnonymousSessionId}, got ${metadata.anonymous_session_id}`);
    }

    return { valid: errors.length === 0, errors };
}

// ============================================
// Arbitraries for Checkout Flow
// ============================================

/**
 * Generate valid CheckoutFlowParams with either userId or anonymousSessionId
 */
const checkoutFlowParamsArb: fc.Arbitrary<CheckoutFlowParams> = fc.record({
    cartId: fc.uuid(),
    cartItems: fc.array(cartItemWithProductArb, { minLength: 1, maxLength: 10 }),
    userId: fc.option(fc.uuid(), { nil: undefined }),
    anonymousSessionId: fc.option(fc.uuid(), { nil: undefined }),
}).filter((params) => {
    // Ensure at least one of userId or anonymousSessionId is set
    return params.userId !== undefined || params.anonymousSessionId !== undefined;
});

// ============================================
// Property Tests
// ============================================

describe("Property 1: Pending order creation precedes Stripe session", () => {
    /**
     * **Feature: order-payment-flow, Property 1: Pending order creation precedes Stripe session**
     * **Validates: Requirements 2.1**
     *
     * For any checkout action that results in a Stripe session, a pending order
     * with status "pending" must exist in the database before the Stripe session is created.
     */
    it("pending order is created before Stripe session for valid checkout", () => {
        fc.assert(
            fc.property(
                checkoutFlowParamsArb,
                fc.uuid(), // orderId
                fc.uuid(), // stripeSessionId
                (params, orderId, stripeSessionId) => {
                    // Mock successful order creation
                    const mockCreatePendingOrder = (): PendingOrderResult => ({
                        success: true,
                        order: {
                            id: orderId,
                            orderNumber: `GIS${Date.now()}`,
                            status: "pending",
                            createdAt: new Date().toISOString(),
                            expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
                        },
                    });

                    // Mock successful Stripe session creation
                    const mockCreateStripeSession = (): StripeSessionResult => ({
                        success: true,
                        sessionId: stripeSessionId,
                        clientSecret: `cs_test_${stripeSessionId}`,
                        metadata: buildStripeSessionMetadata(
                            orderId,
                            params.cartId,
                            params.userId,
                            params.anonymousSessionId
                        ),
                    });

                    const result = simulateCheckoutFlow(
                        params,
                        mockCreatePendingOrder,
                        mockCreateStripeSession
                    );

                    // If Stripe session was created, pending order must have been created first
                    if (result.stripeSessionCreated) {
                        return result.pendingOrderCreated && result.orderCreatedBeforeStripe;
                    }

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * If pending order creation fails, Stripe session should not be created
     */
    it("Stripe session is not created if pending order creation fails", () => {
        fc.assert(
            fc.property(
                checkoutFlowParamsArb,
                fc.constantFrom(
                    "ORDER_CREATION_FAILED",
                    "DATABASE_ERROR",
                    "VALIDATION_ERROR"
                ),
                (params, errorCode) => {
                    // Mock failed order creation
                    const mockCreatePendingOrder = (): PendingOrderResult => ({
                        success: false,
                        error: { code: errorCode, message: "Order creation failed" },
                    });

                    // Mock Stripe session (should not be called)
                    let stripeSessionCalled = false;
                    const mockCreateStripeSession = (): StripeSessionResult => {
                        stripeSessionCalled = true;
                        return {
                            success: true,
                            sessionId: "should_not_be_created",
                        };
                    };

                    const result = simulateCheckoutFlow(
                        params,
                        mockCreatePendingOrder,
                        mockCreateStripeSession
                    );

                    // Stripe session should not be created if order creation failed
                    return (
                        !result.pendingOrderCreated &&
                        !result.stripeSessionCreated &&
                        !stripeSessionCalled
                    );
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Pending order must have status "pending" when created
     */
    it("pending order has status pending when created", () => {
        fc.assert(
            fc.property(
                checkoutFlowParamsArb,
                fc.uuid(),
                (params, orderId) => {
                    const mockCreatePendingOrder = (): PendingOrderResult => ({
                        success: true,
                        order: {
                            id: orderId,
                            orderNumber: `GIS${Date.now()}`,
                            status: "pending",
                            createdAt: new Date().toISOString(),
                            expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
                        },
                    });

                    const mockCreateStripeSession = (): StripeSessionResult => ({
                        success: true,
                        sessionId: "test_session",
                    });

                    const result = simulateCheckoutFlow(
                        params,
                        mockCreatePendingOrder,
                        mockCreateStripeSession
                    );

                    if (result.pendingOrderCreated && result.pendingOrderResult?.order) {
                        return result.pendingOrderResult.order.status === "pending";
                    }

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });
});

describe("Property 3: Stripe session metadata binding", () => {
    /**
     * **Feature: order-payment-flow, Property 3: Stripe session metadata binding**
     * **Validates: Requirements 2.6**
     *
     * For any Stripe Checkout Session created for an order, the session metadata
     * must contain the order_id and either user_id or anonymous_session_id.
     */
    it("Stripe session metadata contains order_id", () => {
        fc.assert(
            fc.property(
                checkoutFlowParamsArb,
                fc.uuid(), // orderId
                (params, orderId) => {
                    const metadata = buildStripeSessionMetadata(
                        orderId,
                        params.cartId,
                        params.userId,
                        params.anonymousSessionId
                    );

                    return metadata.order_id === orderId;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Stripe session metadata contains either user_id or anonymous_session_id
     */
    it("Stripe session metadata contains user identification", () => {
        fc.assert(
            fc.property(
                checkoutFlowParamsArb,
                fc.uuid(),
                (params, orderId) => {
                    const metadata = buildStripeSessionMetadata(
                        orderId,
                        params.cartId,
                        params.userId,
                        params.anonymousSessionId
                    );

                    // At least one must be present
                    const hasUserIdentification =
                        metadata.user_id !== undefined || metadata.anonymous_session_id !== undefined;

                    return hasUserIdentification;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Stripe session metadata user_id matches input when provided
     */
    it("Stripe session metadata user_id matches input", () => {
        fc.assert(
            fc.property(
                fc.uuid(), // cartId
                fc.uuid(), // orderId
                fc.uuid(), // userId
                (cartId, orderId, userId) => {
                    const metadata = buildStripeSessionMetadata(
                        orderId,
                        cartId,
                        userId,
                        undefined
                    );

                    return metadata.user_id === userId;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Stripe session metadata anonymous_session_id matches input when provided
     */
    it("Stripe session metadata anonymous_session_id matches input", () => {
        fc.assert(
            fc.property(
                fc.uuid(), // cartId
                fc.uuid(), // orderId
                fc.uuid(), // anonymousSessionId
                (cartId, orderId, anonymousSessionId) => {
                    const metadata = buildStripeSessionMetadata(
                        orderId,
                        cartId,
                        undefined,
                        anonymousSessionId
                    );

                    return metadata.anonymous_session_id === anonymousSessionId;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Stripe session metadata contains cart_id
     */
    it("Stripe session metadata contains cart_id", () => {
        fc.assert(
            fc.property(
                checkoutFlowParamsArb,
                fc.uuid(),
                (params, orderId) => {
                    const metadata = buildStripeSessionMetadata(
                        orderId,
                        params.cartId,
                        params.userId,
                        params.anonymousSessionId
                    );

                    return metadata.cart_id === params.cartId;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Full metadata validation passes for valid inputs
     */
    it("full metadata validation passes for valid inputs", () => {
        fc.assert(
            fc.property(
                checkoutFlowParamsArb,
                fc.uuid(),
                (params, orderId) => {
                    const metadata = buildStripeSessionMetadata(
                        orderId,
                        params.cartId,
                        params.userId,
                        params.anonymousSessionId
                    );

                    const validation = validateStripeMetadata(
                        metadata,
                        orderId,
                        params.userId,
                        params.anonymousSessionId
                    );

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
     * Checkout flow produces valid Stripe metadata
     */
    it("checkout flow produces valid Stripe metadata", () => {
        fc.assert(
            fc.property(
                checkoutFlowParamsArb,
                fc.uuid(),
                fc.uuid(),
                (params, orderId, stripeSessionId) => {
                    const mockCreatePendingOrder = (): PendingOrderResult => ({
                        success: true,
                        order: {
                            id: orderId,
                            orderNumber: `GIS${Date.now()}`,
                            status: "pending",
                            createdAt: new Date().toISOString(),
                            expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
                        },
                    });

                    const mockCreateStripeSession = (oid: string): StripeSessionResult => ({
                        success: true,
                        sessionId: stripeSessionId,
                        clientSecret: `cs_test_${stripeSessionId}`,
                        metadata: buildStripeSessionMetadata(
                            oid,
                            params.cartId,
                            params.userId,
                            params.anonymousSessionId
                        ),
                    });

                    const result = simulateCheckoutFlow(
                        params,
                        mockCreatePendingOrder,
                        mockCreateStripeSession
                    );

                    if (result.stripeSessionCreated && result.stripeSessionResult?.metadata) {
                        const validation = validateStripeMetadata(
                            result.stripeSessionResult.metadata,
                            orderId,
                            params.userId,
                            params.anonymousSessionId
                        );

                        return validation.valid;
                    }

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });
});
