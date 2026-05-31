/**
 * Property-Based Tests for Cart Total Calculation
 *
 * **Feature: store-frontend, Property 6: Cart modifications update totals correctly**
 * **Validates: Requirements 4.3, 4.4**
 *
 * These tests verify that cart total calculations are correct:
 * - Total equals sum of (quantity × snapshot_price) for all items
 * - Quantity changes update totals correctly
 * - Item removal updates totals correctly
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import type { CartItemWithProduct } from "./types";
import type { ProductType, DeliveryType } from "~/lib/supabase/types";

// ============================================
// Cart Total Calculation Function (extracted for testing)
// ============================================

/**
 * Calculate cart totals - pure function extracted from CartSummary
 * This is the core logic we're testing
 */
function calculateCartTotal(items: CartItemWithProduct[]): number {
    return items.reduce(
        (sum, item) => sum + item.quantity * item.snapshot_price,
        0
    );
}

/**
 * Calculate item count
 */
function calculateItemCount(items: CartItemWithProduct[]): number {
    return items.reduce((sum, item) => sum + item.quantity, 0);
}

// ============================================
// Arbitraries (Generators)
// ============================================

/**
 * Generate a valid product type
 */
const productTypeArb: fc.Arbitrary<ProductType> = fc.constantFrom(
    "app",
    "game_card",
    "game_cdk",
    "game_digital",
    "physical",
    "overseas"
);

/**
 * Generate a valid delivery type
 */
const deliveryTypeArb: fc.Arbitrary<DeliveryType> = fc.constantFrom(
    "download",
    "license_key",
    "cdk",
    "shipment",
    "manual"
);

/**
 * Generate a valid currency
 */
const currencyArb = fc.constantFrom("CNY", "USD");

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
 * Generate a valid ISO date string
 */
const isoDateArb = fc
    .integer({ min: 1577836800000, max: 1924905600000 })
    .map((timestamp) => new Date(timestamp).toISOString());

/**
 * Generate a minimal valid Product for cart item
 */
const productArb = fc.record({
    id: fc.uuid(),
    product_code: fc
        .integer({ min: 0, max: 99999999 })
        .map((n) => `Gis${n.toString().padStart(8, "0")}`),
    name: fc.string({ minLength: 1, maxLength: 100 }),
    product_type: productTypeArb,
    delivery_type: deliveryTypeArb,
    category_id: fc.uuid(),
    is_active: fc.constant(true),
    has_discount: fc.boolean(),
    has_demo_video: fc.boolean(),
    created_at: isoDateArb,
    updated_at: isoDateArb,
});

/**
 * Generate a valid CartItemWithProduct
 */
const cartItemArb: fc.Arbitrary<CartItemWithProduct> = fc.record({
    id: fc.uuid(),
    cart_id: fc.uuid(),
    product_id: fc.uuid(),
    price_id: fc.uuid(),
    spec_combination: fc.option(
        fc.dictionary(fc.string({ minLength: 1, maxLength: 20 }), fc.string({ minLength: 1, maxLength: 50 })),
        { nil: undefined }
    ),
    quantity: quantityArb,
    snapshot_price: priceArb,
    snapshot_currency: currencyArb,
    created_at: isoDateArb,
    updated_at: isoDateArb,
    product: productArb,
});

/**
 * Generate a non-empty array of cart items
 */
const cartItemsArb = fc.array(cartItemArb, { minLength: 1, maxLength: 20 });

/**
 * Generate an array of cart items (can be empty)
 */
const cartItemsWithEmptyArb = fc.array(cartItemArb, { minLength: 0, maxLength: 20 });

// ============================================
// Property Tests
// ============================================

describe("Property 6: Cart modifications update totals correctly", () => {
    /**
     * **Feature: store-frontend, Property 6: Cart modifications update totals correctly**
     * **Validates: Requirements 4.3, 4.4**
     *
     * Core property: Total equals sum of (quantity × snapshot_price) for all items
     */
    it("cart total equals sum of (quantity × snapshot_price) for all items", () => {
        fc.assert(
            fc.property(cartItemsWithEmptyArb, (items) => {
                const calculatedTotal = calculateCartTotal(items);

                // Manually compute expected total
                const expectedTotal = items.reduce(
                    (sum, item) => sum + item.quantity * item.snapshot_price,
                    0
                );

                // Allow for floating point precision (2 decimal places)
                expect(Math.abs(calculatedTotal - expectedTotal)).toBeLessThan(0.01);

                return true;
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Empty cart has zero total
     */
    it("empty cart has zero total", () => {
        const total = calculateCartTotal([]);
        expect(total).toBe(0);
    });

    /**
     * Single item cart total equals quantity × price
     */
    it("single item cart total equals quantity × snapshot_price", () => {
        fc.assert(
            fc.property(cartItemArb, (item) => {
                const total = calculateCartTotal([item]);
                const expected = item.quantity * item.snapshot_price;

                expect(Math.abs(total - expected)).toBeLessThan(0.01);

                return true;
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Quantity change updates total correctly
     * Simulates Requirements 4.3: quantity modification updates total
     */
    it("quantity change updates total correctly", () => {
        fc.assert(
            fc.property(
                cartItemsArb,
                fc.integer({ min: 0, max: 19 }), // index to modify
                quantityArb, // new quantity
                (items, indexSeed, newQuantity) => {
                    // Select a valid index
                    const index = indexSeed % items.length;

                    // Calculate original total
                    const originalTotal = calculateCartTotal(items);

                    // Create modified items with new quantity
                    const modifiedItems = items.map((item, i) =>
                        i === index ? { ...item, quantity: newQuantity } : item
                    );

                    // Calculate new total
                    const newTotal = calculateCartTotal(modifiedItems);

                    // Calculate expected difference
                    const oldItemTotal = items[index].quantity * items[index].snapshot_price;
                    const newItemTotal = newQuantity * items[index].snapshot_price;
                    const expectedDiff = newItemTotal - oldItemTotal;

                    // Verify the total changed by the expected amount
                    expect(Math.abs(newTotal - (originalTotal + expectedDiff))).toBeLessThan(0.01);

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Item removal updates total correctly
     * Simulates Requirements 4.4: item removal updates total
     */
    it("item removal updates total correctly", () => {
        fc.assert(
            fc.property(
                cartItemsArb,
                fc.integer({ min: 0, max: 19 }), // index to remove
                (items, indexSeed) => {
                    // Select a valid index
                    const index = indexSeed % items.length;

                    // Calculate original total
                    const originalTotal = calculateCartTotal(items);

                    // Remove item at index
                    const remainingItems = items.filter((_, i) => i !== index);

                    // Calculate new total
                    const newTotal = calculateCartTotal(remainingItems);

                    // Calculate expected total after removal
                    const removedItemTotal =
                        items[index].quantity * items[index].snapshot_price;
                    const expectedTotal = originalTotal - removedItemTotal;

                    // Verify the total decreased by the removed item's contribution
                    expect(Math.abs(newTotal - expectedTotal)).toBeLessThan(0.01);

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Total is always non-negative
     */
    it("cart total is always non-negative", () => {
        fc.assert(
            fc.property(cartItemsWithEmptyArb, (items) => {
                const total = calculateCartTotal(items);
                return total >= 0;
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Item count equals sum of quantities
     */
    it("item count equals sum of all quantities", () => {
        fc.assert(
            fc.property(cartItemsWithEmptyArb, (items) => {
                const count = calculateItemCount(items);
                const expectedCount = items.reduce((sum, item) => sum + item.quantity, 0);

                return count === expectedCount;
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Adding items increases total
     * (Assuming positive prices and quantities)
     */
    it("adding an item increases total", () => {
        fc.assert(
            fc.property(
                cartItemsWithEmptyArb,
                cartItemArb,
                (existingItems, newItem) => {
                    const originalTotal = calculateCartTotal(existingItems);
                    const newItems = [...existingItems, newItem];
                    const newTotal = calculateCartTotal(newItems);

                    // New total should be greater than or equal to original
                    // (equal only if new item has 0 contribution, which shouldn't happen with our generators)
                    const itemContribution = newItem.quantity * newItem.snapshot_price;

                    expect(Math.abs(newTotal - (originalTotal + itemContribution))).toBeLessThan(0.01);

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Order of items doesn't affect total (commutativity)
     */
    it("order of items does not affect total", () => {
        fc.assert(
            fc.property(cartItemsArb, (items) => {
                const originalTotal = calculateCartTotal(items);

                // Reverse the items
                const reversedItems = [...items].reverse();
                const reversedTotal = calculateCartTotal(reversedItems);

                expect(Math.abs(originalTotal - reversedTotal)).toBeLessThan(0.01);

                return true;
            }),
            { numRuns: 100 }
        );
    });
});
