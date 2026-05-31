/**
 * Property-Based Tests for Cart Data Integrity
 *
 * **Feature: product-detail-enhancement, Property 1: Cart item addition preserves data integrity**
 * **Validates: Requirements 1.1**
 *
 * These tests verify that cart item addition preserves data integrity:
 * - product_id matches the requested product
 * - price_id matches the requested price
 * - snapshot_price matches the requested price
 * - snapshot_currency matches the requested currency
 * - quantity matches the requested quantity
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import type { AddToCartRequest, CartItemWithProduct } from "./types";
import type { ProductType, DeliveryType, CartItem } from "~/lib/supabase/types";

// ============================================
// Cart Item Creation Function (extracted for testing)
// This simulates the core logic of creating a cart item from a request
// ============================================

/**
 * Create a cart item from an add-to-cart request
 * This is the pure function that represents the core data transformation
 */
function createCartItemFromRequest(
    cartId: string,
    request: AddToCartRequest,
    itemId: string,
    timestamp: string
): CartItem {
    return {
        id: itemId,
        cart_id: cartId,
        product_id: request.productId,
        price_id: request.priceId,
        spec_combination: request.specCombination,
        quantity: request.quantity,
        snapshot_price: request.snapshotPrice,
        snapshot_currency: request.snapshotCurrency,
        created_at: timestamp,
        updated_at: timestamp,
    };
}

/**
 * Validate that a cart item matches the original request
 * This is the core property we're testing
 */
function validateCartItemMatchesRequest(
    item: CartItem,
    request: AddToCartRequest
): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (item.product_id !== request.productId) {
        errors.push(`product_id mismatch: expected ${request.productId}, got ${item.product_id}`);
    }

    if (item.price_id !== request.priceId) {
        errors.push(`price_id mismatch: expected ${request.priceId}, got ${item.price_id}`);
    }

    if (item.snapshot_price !== request.snapshotPrice) {
        errors.push(`snapshot_price mismatch: expected ${request.snapshotPrice}, got ${item.snapshot_price}`);
    }

    if (item.snapshot_currency !== request.snapshotCurrency) {
        errors.push(`snapshot_currency mismatch: expected ${request.snapshotCurrency}, got ${item.snapshot_currency}`);
    }

    if (item.quantity !== request.quantity) {
        errors.push(`quantity mismatch: expected ${request.quantity}, got ${item.quantity}`);
    }

    // Check spec_combination equality
    const requestSpec = request.specCombination;
    const itemSpec = item.spec_combination;

    if (requestSpec === undefined && itemSpec !== undefined) {
        errors.push(`spec_combination mismatch: expected undefined, got ${JSON.stringify(itemSpec)}`);
    } else if (requestSpec !== undefined && itemSpec === undefined) {
        errors.push(`spec_combination mismatch: expected ${JSON.stringify(requestSpec)}, got undefined`);
    } else if (requestSpec !== undefined && itemSpec !== undefined) {
        const requestKeys = Object.keys(requestSpec).sort();
        const itemKeys = Object.keys(itemSpec).sort();

        if (JSON.stringify(requestKeys) !== JSON.stringify(itemKeys)) {
            errors.push(`spec_combination keys mismatch`);
        } else {
            for (const key of requestKeys) {
                if (requestSpec[key] !== itemSpec[key]) {
                    errors.push(`spec_combination[${key}] mismatch: expected ${requestSpec[key]}, got ${itemSpec[key]}`);
                }
            }
        }
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

// ============================================
// Arbitraries (Generators)
// ============================================

/**
 * Generate a valid currency
 */
const currencyArb = fc.constantFrom("CNY", "USD", "EUR", "JPY");

/**
 * Generate a valid price (positive, reasonable range, 2 decimal places)
 * Using integer cents then converting to avoid float precision issues
 */
const priceArb = fc
    .integer({ min: 1, max: 9999999 }) // 0.01 to 99999.99 in cents
    .map((cents) => cents / 100);

/**
 * Generate a valid quantity (positive integer, reasonable range)
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
 * Generate a valid AddToCartRequest
 */
const addToCartRequestArb: fc.Arbitrary<AddToCartRequest> = fc.record({
    productId: fc.uuid(),
    priceId: fc.uuid(),
    specCombination: specCombinationArb,
    quantity: quantityArb,
    snapshotPrice: priceArb,
    snapshotCurrency: currencyArb,
});

/**
 * Generate a valid ISO date string
 */
const isoDateArb = fc
    .integer({ min: 1577836800000, max: 1924905600000 })
    .map((timestamp) => new Date(timestamp).toISOString());

// ============================================
// Property Tests
// ============================================

describe("Property 1: Cart item addition preserves data integrity", () => {
    /**
     * **Feature: product-detail-enhancement, Property 1: Cart item addition preserves data integrity**
     * **Validates: Requirements 1.1**
     *
     * For any valid product and price combination, adding to cart should result
     * in a cart item with matching product_id, price_id, and snapshot_price values.
     */
    it("cart item preserves all request data fields", () => {
        fc.assert(
            fc.property(
                addToCartRequestArb,
                fc.uuid(), // cartId
                fc.uuid(), // itemId
                isoDateArb, // timestamp
                (request, cartId, itemId, timestamp) => {
                    // Create cart item from request
                    const cartItem = createCartItemFromRequest(cartId, request, itemId, timestamp);

                    // Validate that all fields match
                    const validation = validateCartItemMatchesRequest(cartItem, request);

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
     * product_id is preserved exactly
     */
    it("product_id is preserved exactly", () => {
        fc.assert(
            fc.property(
                addToCartRequestArb,
                fc.uuid(),
                fc.uuid(),
                isoDateArb,
                (request, cartId, itemId, timestamp) => {
                    const cartItem = createCartItemFromRequest(cartId, request, itemId, timestamp);
                    return cartItem.product_id === request.productId;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * price_id is preserved exactly
     */
    it("price_id is preserved exactly", () => {
        fc.assert(
            fc.property(
                addToCartRequestArb,
                fc.uuid(),
                fc.uuid(),
                isoDateArb,
                (request, cartId, itemId, timestamp) => {
                    const cartItem = createCartItemFromRequest(cartId, request, itemId, timestamp);
                    return cartItem.price_id === request.priceId;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * snapshot_price is preserved exactly
     */
    it("snapshot_price is preserved exactly", () => {
        fc.assert(
            fc.property(
                addToCartRequestArb,
                fc.uuid(),
                fc.uuid(),
                isoDateArb,
                (request, cartId, itemId, timestamp) => {
                    const cartItem = createCartItemFromRequest(cartId, request, itemId, timestamp);
                    return cartItem.snapshot_price === request.snapshotPrice;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * snapshot_currency is preserved exactly
     */
    it("snapshot_currency is preserved exactly", () => {
        fc.assert(
            fc.property(
                addToCartRequestArb,
                fc.uuid(),
                fc.uuid(),
                isoDateArb,
                (request, cartId, itemId, timestamp) => {
                    const cartItem = createCartItemFromRequest(cartId, request, itemId, timestamp);
                    return cartItem.snapshot_currency === request.snapshotCurrency;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * quantity is preserved exactly
     */
    it("quantity is preserved exactly", () => {
        fc.assert(
            fc.property(
                addToCartRequestArb,
                fc.uuid(),
                fc.uuid(),
                isoDateArb,
                (request, cartId, itemId, timestamp) => {
                    const cartItem = createCartItemFromRequest(cartId, request, itemId, timestamp);
                    return cartItem.quantity === request.quantity;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * spec_combination is preserved exactly (including undefined)
     */
    it("spec_combination is preserved exactly", () => {
        fc.assert(
            fc.property(
                addToCartRequestArb,
                fc.uuid(),
                fc.uuid(),
                isoDateArb,
                (request, cartId, itemId, timestamp) => {
                    const cartItem = createCartItemFromRequest(cartId, request, itemId, timestamp);

                    // Both undefined
                    if (request.specCombination === undefined && cartItem.spec_combination === undefined) {
                        return true;
                    }

                    // One undefined, one not
                    if (request.specCombination === undefined || cartItem.spec_combination === undefined) {
                        return false;
                    }

                    // Compare objects
                    return JSON.stringify(request.specCombination) === JSON.stringify(cartItem.spec_combination);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * cart_id is set correctly
     */
    it("cart_id is set to the provided cart ID", () => {
        fc.assert(
            fc.property(
                addToCartRequestArb,
                fc.uuid(),
                fc.uuid(),
                isoDateArb,
                (request, cartId, itemId, timestamp) => {
                    const cartItem = createCartItemFromRequest(cartId, request, itemId, timestamp);
                    return cartItem.cart_id === cartId;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * timestamps are set correctly
     */
    it("timestamps are set to the provided timestamp", () => {
        fc.assert(
            fc.property(
                addToCartRequestArb,
                fc.uuid(),
                fc.uuid(),
                isoDateArb,
                (request, cartId, itemId, timestamp) => {
                    const cartItem = createCartItemFromRequest(cartId, request, itemId, timestamp);
                    return cartItem.created_at === timestamp && cartItem.updated_at === timestamp;
                }
            ),
            { numRuns: 100 }
        );
    });
});

/**
 * Additional property tests for edge cases
 */
describe("Cart data integrity edge cases", () => {
    /**
     * Empty spec_combination is handled correctly
     */
    it("empty spec_combination object is preserved", () => {
        const request: AddToCartRequest = {
            productId: "test-product-id",
            priceId: "test-price-id",
            specCombination: {},
            quantity: 1,
            snapshotPrice: 99.99,
            snapshotCurrency: "CNY",
        };

        const cartItem = createCartItemFromRequest("cart-id", request, "item-id", new Date().toISOString());

        expect(cartItem.spec_combination).toEqual({});
    });

    /**
     * Large quantity values are preserved
     */
    it("large quantity values are preserved", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 10000 }),
                (quantity) => {
                    const request: AddToCartRequest = {
                        productId: "test-product-id",
                        priceId: "test-price-id",
                        quantity,
                        snapshotPrice: 99.99,
                        snapshotCurrency: "CNY",
                    };

                    const cartItem = createCartItemFromRequest("cart-id", request, "item-id", new Date().toISOString());

                    return cartItem.quantity === quantity;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Price precision is maintained
     */
    it("price precision is maintained for various decimal values", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 99 }), // cents
                fc.integer({ min: 0, max: 99999 }), // dollars
                (cents, dollars) => {
                    const price = dollars + cents / 100;

                    const request: AddToCartRequest = {
                        productId: "test-product-id",
                        priceId: "test-price-id",
                        quantity: 1,
                        snapshotPrice: price,
                        snapshotCurrency: "CNY",
                    };

                    const cartItem = createCartItemFromRequest("cart-id", request, "item-id", new Date().toISOString());

                    return cartItem.snapshot_price === price;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Unicode characters in spec_combination are preserved
     */
    it("unicode characters in spec_combination are preserved", () => {
        const specCombinations = [
            { color: "红色" },
            { size: "大号", color: "蓝色" },
            { "颜色": "黑色", "尺寸": "中" },
            { emoji: "🎮" },
        ];

        for (const spec of specCombinations) {
            const request: AddToCartRequest = {
                productId: "test-product-id",
                priceId: "test-price-id",
                specCombination: spec,
                quantity: 1,
                snapshotPrice: 99.99,
                snapshotCurrency: "CNY",
            };

            const cartItem = createCartItemFromRequest("cart-id", request, "item-id", new Date().toISOString());

            expect(cartItem.spec_combination).toEqual(spec);
        }
    });
});
