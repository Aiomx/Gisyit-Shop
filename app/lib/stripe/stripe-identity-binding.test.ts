/**
 * Property-Based Tests for Stripe Session Identity Binding
 *
 * **Feature: store-integration, Property 16: Stripe session contains identity binding**
 * **Validates: Requirements 2.1, 11.1, 11.2**
 *
 * These tests verify that Stripe Checkout Sessions are properly linked to carts and users:
 * - 11.1: Session metadata contains cart_id
 * - 11.2: Session metadata contains either user_id or anonymous_session_id
 * - 2.1: Checkout session creation validates identity binding
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
    validatePaymentLinkParams,
    buildStripeMetadata,
    type CreatePaymentLinkParams,
} from "./mcp-client.server";

// ============================================
// Arbitraries (Generators)
// ============================================

/**
 * Generate a valid UUID-like string
 */
const uuidArb: fc.Arbitrary<string> = fc.uuid();

/**
 * Generate a valid Stripe price ID
 */
const priceIdArb: fc.Arbitrary<string> = fc.string({ minLength: 10, maxLength: 20 })
    .map(s => `price_${s.replace(/[^a-z0-9]/gi, 'x')}`);

/**
 * Generate a valid session ID (32 chars alphanumeric)
 */
const sessionIdArb: fc.Arbitrary<string> = fc.string({ minLength: 32, maxLength: 32 })
    .map(s => s.replace(/[^a-z0-9]/gi, 'x'));

/**
 * Generate valid payment link params with user_id
 */
const paramsWithUserIdArb: fc.Arbitrary<CreatePaymentLinkParams> = fc.record({
    priceId: priceIdArb,
    quantity: fc.integer({ min: 1, max: 100 }),
    cartId: uuidArb,
    userId: uuidArb,
    anonymousSessionId: fc.constant(undefined),
    redirectUrl: fc.option(fc.webUrl(), { nil: undefined }),
});

/**
 * Generate valid payment link params with anonymous_session_id
 */
const paramsWithAnonymousSessionArb: fc.Arbitrary<CreatePaymentLinkParams> = fc.record({
    priceId: priceIdArb,
    quantity: fc.integer({ min: 1, max: 100 }),
    cartId: uuidArb,
    userId: fc.constant(undefined),
    anonymousSessionId: sessionIdArb,
    redirectUrl: fc.option(fc.webUrl(), { nil: undefined }),
});

/**
 * Generate valid payment link params with either user_id or anonymous_session_id
 */
const validParamsArb: fc.Arbitrary<CreatePaymentLinkParams> = fc.oneof(
    paramsWithUserIdArb,
    paramsWithAnonymousSessionArb
);

/**
 * Generate invalid payment link params (missing identity)
 */
const paramsWithoutIdentityArb: fc.Arbitrary<CreatePaymentLinkParams> = fc.record({
    priceId: priceIdArb,
    quantity: fc.integer({ min: 1, max: 100 }),
    cartId: uuidArb,
    userId: fc.constant(undefined),
    anonymousSessionId: fc.constant(undefined),
    redirectUrl: fc.option(fc.webUrl(), { nil: undefined }),
});

/**
 * Generate invalid payment link params (missing price_id)
 */
const paramsWithoutPriceIdArb: fc.Arbitrary<CreatePaymentLinkParams> = fc.record({
    priceId: fc.constant(""),
    quantity: fc.integer({ min: 1, max: 100 }),
    cartId: uuidArb,
    userId: uuidArb,
    anonymousSessionId: fc.constant(undefined),
    redirectUrl: fc.option(fc.webUrl(), { nil: undefined }),
});

// ============================================
// Property Tests
// ============================================

describe("Property 16: Stripe session contains identity binding", () => {
    /**
     * **Feature: store-integration, Property 16: Stripe session contains identity binding**
     * **Validates: Requirements 2.1, 11.1, 11.2**
     *
     * Core property: For any valid params, metadata contains cart_id and identity
     */
    it("valid params with user_id produce metadata with cart_id and user_id", () => {
        fc.assert(
            fc.property(paramsWithUserIdArb, (params) => {
                const metadata = buildStripeMetadata(params);

                // Requirements 11.1: cart_id must be present
                const hasCartId = metadata.cart_id === params.cartId;

                // Requirements 11.2: user_id must be present
                const hasUserId = metadata.user_id === params.userId;

                // anonymous_session_id should not be present
                const noAnonymousId = !metadata.anonymous_session_id;

                return hasCartId && hasUserId && noAnonymousId;
            }),
            { numRuns: 100 }
        );
    });

    /**
     * **Validates: Requirements 11.1, 11.2**
     * 
     * Valid params with anonymous_session_id produce correct metadata
     */
    it("valid params with anonymous_session_id produce metadata with cart_id and anonymous_session_id", () => {
        fc.assert(
            fc.property(paramsWithAnonymousSessionArb, (params) => {
                const metadata = buildStripeMetadata(params);

                // Requirements 11.1: cart_id must be present
                const hasCartId = metadata.cart_id === params.cartId;

                // Requirements 11.2: anonymous_session_id must be present
                const hasAnonymousId = metadata.anonymous_session_id === params.anonymousSessionId;

                // user_id should not be present
                const noUserId = !metadata.user_id;

                return hasCartId && hasAnonymousId && noUserId;
            }),
            { numRuns: 100 }
        );
    });

    /**
     * **Validates: Requirements 11.1**
     * 
     * All valid params produce metadata with cart_id
     */
    it("all valid params produce metadata with cart_id (Requirements 11.1)", () => {
        fc.assert(
            fc.property(validParamsArb, (params) => {
                const metadata = buildStripeMetadata(params);
                return metadata.cart_id === params.cartId;
            }),
            { numRuns: 100 }
        );
    });

    /**
     * **Validates: Requirements 11.2**
     * 
     * All valid params produce metadata with either user_id or anonymous_session_id
     */
    it("all valid params produce metadata with identity (Requirements 11.2)", () => {
        fc.assert(
            fc.property(validParamsArb, (params) => {
                const metadata = buildStripeMetadata(params);
                const hasIdentity = !!metadata.user_id || !!metadata.anonymous_session_id;
                return hasIdentity;
            }),
            { numRuns: 100 }
        );
    });

    /**
     * **Validates: Requirements 2.1, 11.2**
     * 
     * Params without identity fail validation
     */
    it("params without identity fail validation (Requirements 11.2)", () => {
        fc.assert(
            fc.property(paramsWithoutIdentityArb, (params) => {
                const result = validatePaymentLinkParams(params);
                return !result.valid && result.error?.code === "MISSING_IDENTITY";
            }),
            { numRuns: 100 }
        );
    });

    /**
     * **Validates: Requirements 2.1**
     * 
     * Params without price_id fail validation
     */
    it("params without price_id fail validation (Requirements 2.1)", () => {
        fc.assert(
            fc.property(paramsWithoutPriceIdArb, (params) => {
                const result = validatePaymentLinkParams(params);
                return !result.valid && result.error?.code === "MISSING_PRICE_ID";
            }),
            { numRuns: 100 }
        );
    });

    /**
     * **Validates: Requirements 2.1, 11.1, 11.2**
     * 
     * Valid params pass validation
     */
    it("valid params pass validation (Requirements 2.1, 11.1, 11.2)", () => {
        fc.assert(
            fc.property(validParamsArb, (params) => {
                const result = validatePaymentLinkParams(params);
                return result.valid && !result.error;
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Metadata building is deterministic
     */
    it("metadata building is deterministic", () => {
        fc.assert(
            fc.property(validParamsArb, (params) => {
                const metadata1 = buildStripeMetadata(params);
                const metadata2 = buildStripeMetadata(params);
                return JSON.stringify(metadata1) === JSON.stringify(metadata2);
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Validation is deterministic
     */
    it("validation is deterministic", () => {
        fc.assert(
            fc.property(validParamsArb, (params) => {
                const result1 = validatePaymentLinkParams(params);
                const result2 = validatePaymentLinkParams(params);
                return result1.valid === result2.valid;
            }),
            { numRuns: 100 }
        );
    });
});

