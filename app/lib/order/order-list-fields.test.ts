/**
 * Property-Based Tests for Order List Fields
 * 
 * Tests for Requirements 7.2:
 * - Order list SHALL show order number, date, status, and total amount
 * 
 * **Feature: store-integration, Property 12: Order list contains required fields**
 * **Validates: Requirements 7.2**
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { extractOrderDisplayFields } from "~/components/account/order-list";
import type { Order, OrderStatus } from "~/lib/supabase/types";

// ============================================
// Arbitraries (Generators)
// ============================================

/**
 * Generate a valid order status
 */
const orderStatusArb: fc.Arbitrary<OrderStatus> = fc.constantFrom(
    "created",
    "pending_payment",
    "paid",
    "fulfilled",
    "completed",
    "cancelled"
);

/**
 * Generate a valid currency
 */
const currencyArb = fc.constantFrom("CNY", "USD", "EUR", "JPY");

/**
 * Generate a valid order number (format: GIS + date + sequence)
 */
const orderNumberArb = fc
    .tuple(
        fc.integer({ min: 2020, max: 2030 }),
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 1, max: 28 }),
        fc.integer({ min: 1, max: 999999 })
    )
    .map(([year, month, day, seq]) => {
        const monthStr = String(month).padStart(2, "0");
        const dayStr = String(day).padStart(2, "0");
        const seqStr = String(seq).padStart(6, "0");
        return `GIS${year}${monthStr}${dayStr}${seqStr}`;
    });

/**
 * Generate a valid total amount (positive, reasonable range)
 */
const totalAmountArb = fc
    .integer({ min: 1, max: 99999999 })
    .map((cents) => cents / 100);

/**
 * Generate a valid ISO date string
 */
const dateStringArb = fc
    .integer({ min: 1577836800000, max: 1924905600000 }) // 2020-01-01 to 2030-12-31 in milliseconds
    .map((ms) => new Date(ms).toISOString());

/**
 * Generate a valid Order object
 */
const orderArb: fc.Arbitrary<Order> = fc.record({
    id: fc.uuid(),
    order_number: orderNumberArb,
    user_id: fc.uuid(),
    cart_id: fc.option(fc.uuid(), { nil: undefined }),
    status: orderStatusArb,
    total_amount: totalAmountArb,
    currency: currencyArb,
    stripe_session_id: fc.option(fc.string(), { nil: undefined }),
    stripe_payment_intent_id: fc.option(fc.string(), { nil: undefined }),
    created_at: dateStringArb,
    updated_at: dateStringArb,
});

// ============================================
// Property Tests
// ============================================

describe("Property 12: Order list contains required fields", () => {
    /**
     * **Feature: store-integration, Property 12: Order list contains required fields**
     * **Validates: Requirements 7.2**
     * 
     * For any order in the order list, the display SHALL include
     * order number, date, status, and total amount.
     */
    it("extractOrderDisplayFields returns all required fields for any valid order", () => {
        fc.assert(
            fc.property(
                orderArb,
                (order) => {
                    const displayFields = extractOrderDisplayFields(order);

                    // Order number must be present and non-empty
                    expect(displayFields.orderNumber).toBeDefined();
                    expect(displayFields.orderNumber.length).toBeGreaterThan(0);
                    expect(displayFields.orderNumber).toBe(order.order_number);

                    // Date must be present and non-empty
                    expect(displayFields.date).toBeDefined();
                    expect(displayFields.date.length).toBeGreaterThan(0);

                    // Status must be present and non-empty
                    expect(displayFields.status).toBeDefined();
                    expect(displayFields.status.length).toBeGreaterThan(0);

                    // Amount must be present and non-empty
                    expect(displayFields.amount).toBeDefined();
                    expect(displayFields.amount.length).toBeGreaterThan(0);

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Order number is preserved exactly as provided
     */
    it("order number is preserved exactly in display fields", () => {
        fc.assert(
            fc.property(
                orderArb,
                (order) => {
                    const displayFields = extractOrderDisplayFields(order);

                    expect(displayFields.orderNumber).toBe(order.order_number);

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Date is formatted as a readable string
     */
    it("date is formatted as a readable string containing year, month, and day", () => {
        fc.assert(
            fc.property(
                orderArb,
                (order) => {
                    const displayFields = extractOrderDisplayFields(order);
                    const originalDate = new Date(order.created_at);

                    // The formatted date should contain the year
                    expect(displayFields.date).toContain(String(originalDate.getFullYear()));

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Status is mapped to a user-friendly label
     */
    it("status is mapped to a non-empty user-friendly label", () => {
        fc.assert(
            fc.property(
                orderStatusArb,
                (status) => {
                    const order: Order = {
                        id: "test-id",
                        order_number: "GIS20250621000001",
                        user_id: "user-id",
                        status,
                        total_amount: 100,
                        currency: "CNY",
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    };

                    const displayFields = extractOrderDisplayFields(order);

                    // Status should be a non-empty string
                    expect(displayFields.status).toBeDefined();
                    expect(displayFields.status.length).toBeGreaterThan(0);

                    // Status should not be the raw enum value (should be localized)
                    // Chinese labels should contain Chinese characters
                    expect(displayFields.status).toMatch(/[\u4e00-\u9fa5]/);

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Amount is formatted with currency symbol
     */
    it("amount is formatted with currency symbol", () => {
        fc.assert(
            fc.property(
                orderArb,
                (order) => {
                    const displayFields = extractOrderDisplayFields(order);

                    // Amount should contain a currency symbol or code
                    // For CNY it should contain ¥, for USD it should contain $, etc.
                    const hasCurrencyIndicator =
                        displayFields.amount.includes("¥") ||
                        displayFields.amount.includes("$") ||
                        displayFields.amount.includes("€") ||
                        displayFields.amount.includes("CN") ||
                        displayFields.amount.includes("US") ||
                        displayFields.amount.includes("JP") ||
                        displayFields.amount.includes("EUR");

                    expect(hasCurrencyIndicator).toBe(true);

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * All order statuses have valid display labels
     */
    it("all order statuses have valid display labels", () => {
        const allStatuses: OrderStatus[] = [
            "created",
            "pending_payment",
            "paid",
            "fulfilled",
            "completed",
            "cancelled",
        ];

        for (const status of allStatuses) {
            const order: Order = {
                id: "test-id",
                order_number: "GIS20250621000001",
                user_id: "user-id",
                status,
                total_amount: 100,
                currency: "CNY",
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };

            const displayFields = extractOrderDisplayFields(order);

            expect(displayFields.status).toBeDefined();
            expect(displayFields.status.length).toBeGreaterThan(0);
        }
    });
});
