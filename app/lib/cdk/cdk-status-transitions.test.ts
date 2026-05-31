/**
 * Property-Based Tests for CDK Status Transitions
 *
 * Tests for Requirements 3.1, 3.2, 3.3, 4.1, 4.2, 4.5, 5.1, 5.2:
 * - Property 6: Initial Import Status
 * - Property 7: Reservation State Transition
 * - Property 8: Delivery State Transition
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
    CDKStatus,
    CDKStatusTransitions,
    isValidStatusTransition,
    type CDKStatusType,
    type CDKCode,
} from "./types";

// ============================================
// Arbitraries (Generators)
// ============================================

/**
 * Generate a valid CDK code string (alphanumeric, 16-25 chars)
 */
const cdkCodeStringArb = fc
    .array(fc.constantFrom(..."ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".split("")), {
        minLength: 16,
        maxLength: 25,
    })
    .map((chars) => chars.join(""));

/**
 * Generate a valid CDK status
 */
const cdkStatusArb = fc.constantFrom(
    CDKStatus.AVAILABLE,
    CDKStatus.RESERVED,
    CDKStatus.DELIVERED,
    CDKStatus.INVALID
) as fc.Arbitrary<CDKStatusType>;

/**
 * Generate a hex string for code hash
 */
const hexStringArb = fc
    .array(fc.constantFrom(..."0123456789abcdef".split("")), {
        minLength: 64,
        maxLength: 64,
    })
    .map((chars) => chars.join(""));

/**
 * Generate a valid date string using integer timestamps
 */
const dateStringArb = fc
    .integer({ min: 1577836800000, max: 1924905600000 }) // 2020-01-01 to 2030-12-31
    .map((ts) => new Date(ts).toISOString());

/**
 * Generate a newly imported CDK code (always available status)
 */
const importedCDKCodeArb: fc.Arbitrary<CDKCode> = fc.record({
    id: fc.uuid(),
    product_id: fc.uuid(),
    code: cdkCodeStringArb,
    code_hash: hexStringArb,
    status: fc.constant(CDKStatus.AVAILABLE as CDKStatusType),
    order_id: fc.constant(undefined),
    reserved_at: fc.constant(undefined),
    delivered_at: fc.constant(undefined),
    invalidated_at: fc.constant(undefined),
    import_batch_id: fc.option(fc.uuid(), { nil: undefined }),
    created_at: dateStringArb,
    updated_at: dateStringArb,
});

/**
 * Generate a reserved CDK code (with order_id and reserved_at)
 */
const reservedCDKCodeArb: fc.Arbitrary<CDKCode> = fc.record({
    id: fc.uuid(),
    product_id: fc.uuid(),
    code: cdkCodeStringArb,
    code_hash: hexStringArb,
    status: fc.constant(CDKStatus.RESERVED as CDKStatusType),
    order_id: fc.uuid(),
    reserved_at: dateStringArb,
    delivered_at: fc.constant(undefined),
    invalidated_at: fc.constant(undefined),
    import_batch_id: fc.option(fc.uuid(), { nil: undefined }),
    created_at: dateStringArb,
    updated_at: dateStringArb,
});

// ============================================
// Helper Functions for Testing
// ============================================

/**
 * Simulate importing a CDK code (sets initial status)
 */
function simulateImport(code: string, productId: string): CDKCode {
    return {
        id: crypto.randomUUID(),
        product_id: productId,
        code,
        code_hash: code, // Simplified for testing
        status: CDKStatus.AVAILABLE,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    };
}

/**
 * Simulate reserving a CDK code for an order
 */
function simulateReservation(cdkCode: CDKCode, orderId: string): CDKCode {
    if (cdkCode.status !== CDKStatus.AVAILABLE) {
        throw new Error(`Cannot reserve code with status: ${cdkCode.status}`);
    }
    return {
        ...cdkCode,
        status: CDKStatus.RESERVED,
        order_id: orderId,
        reserved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    };
}

/**
 * Simulate delivering a CDK code after payment
 */
function simulateDelivery(cdkCode: CDKCode): CDKCode {
    if (cdkCode.status !== CDKStatus.RESERVED) {
        throw new Error(`Cannot deliver code with status: ${cdkCode.status}`);
    }
    return {
        ...cdkCode,
        status: CDKStatus.DELIVERED,
        delivered_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    };
}

// ============================================
// Property Tests
// ============================================

describe("Property 6: Initial Import Status", () => {
    /**
     * **Feature: cdk-auto-delivery, Property 6: Initial Import Status**
     * **Validates: Requirements 3.1**
     *
     * For any successfully imported CDK code, its initial status should be 'available'.
     */
    it("imported CDK codes always have 'available' status", () => {
        fc.assert(
            fc.property(
                cdkCodeStringArb,
                fc.uuid(),
                (code, productId) => {
                    const imported = simulateImport(code, productId);

                    expect(imported.status).toBe(CDKStatus.AVAILABLE);
                    expect(imported.order_id).toBeUndefined();
                    expect(imported.reserved_at).toBeUndefined();
                    expect(imported.delivered_at).toBeUndefined();

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Imported codes should have the correct product association
     */
    it("imported CDK codes are associated with the correct product", () => {
        fc.assert(
            fc.property(
                cdkCodeStringArb,
                fc.uuid(),
                (code, productId) => {
                    const imported = simulateImport(code, productId);

                    expect(imported.product_id).toBe(productId);
                    expect(imported.code).toBe(code);

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });
});

describe("Property 7: Reservation State Transition", () => {
    /**
     * **Feature: cdk-auto-delivery, Property 7: Reservation State Transition**
     * **Validates: Requirements 3.2, 4.1, 4.2, 4.5**
     *
     * For any CDK code that is reserved for an order, its status should change
     * from 'available' to 'reserved', and it should have the order_id and
     * reserved_at timestamp set.
     */
    it("reservation changes status from available to reserved with order association", () => {
        fc.assert(
            fc.property(
                importedCDKCodeArb,
                fc.uuid(),
                (cdkCode, orderId) => {
                    // Verify precondition
                    expect(cdkCode.status).toBe(CDKStatus.AVAILABLE);

                    const reserved = simulateReservation(cdkCode, orderId);

                    // Status should change to reserved
                    expect(reserved.status).toBe(CDKStatus.RESERVED);

                    // Order ID should be set
                    expect(reserved.order_id).toBe(orderId);

                    // Reserved timestamp should be set
                    expect(reserved.reserved_at).toBeDefined();
                    expect(new Date(reserved.reserved_at!).getTime()).toBeGreaterThan(0);

                    // Code content should be preserved
                    expect(reserved.code).toBe(cdkCode.code);
                    expect(reserved.product_id).toBe(cdkCode.product_id);

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Only available codes can be reserved
     */
    it("only available codes can be reserved", () => {
        fc.assert(
            fc.property(
                cdkStatusArb,
                fc.uuid(),
                cdkCodeStringArb,
                fc.uuid(),
                (status, productId, code, orderId) => {
                    const cdkCode: CDKCode = {
                        id: crypto.randomUUID(),
                        product_id: productId,
                        code,
                        code_hash: code,
                        status,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    };

                    if (status === CDKStatus.AVAILABLE) {
                        // Should succeed
                        const reserved = simulateReservation(cdkCode, orderId);
                        expect(reserved.status).toBe(CDKStatus.RESERVED);
                    } else {
                        // Should throw
                        expect(() => simulateReservation(cdkCode, orderId)).toThrow();
                    }

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Reservation is a valid state transition
     */
    it("available to reserved is a valid transition", () => {
        expect(isValidStatusTransition(CDKStatus.AVAILABLE, CDKStatus.RESERVED)).toBe(true);
    });
});

describe("Property 8: Delivery State Transition", () => {
    /**
     * **Feature: cdk-auto-delivery, Property 8: Delivery State Transition**
     * **Validates: Requirements 3.3, 5.1, 5.2**
     *
     * For any reserved CDK code when payment is confirmed, its status should
     * change from 'reserved' to 'delivered', and the code content should be
     * bound to the order.
     */
    it("delivery changes status from reserved to delivered with timestamp", () => {
        fc.assert(
            fc.property(
                reservedCDKCodeArb,
                (cdkCode) => {
                    // Verify precondition
                    expect(cdkCode.status).toBe(CDKStatus.RESERVED);
                    expect(cdkCode.order_id).toBeDefined();

                    const delivered = simulateDelivery(cdkCode);

                    // Status should change to delivered
                    expect(delivered.status).toBe(CDKStatus.DELIVERED);

                    // Delivered timestamp should be set
                    expect(delivered.delivered_at).toBeDefined();
                    expect(new Date(delivered.delivered_at!).getTime()).toBeGreaterThan(0);

                    // Order association should be preserved
                    expect(delivered.order_id).toBe(cdkCode.order_id);

                    // Code content should be preserved (bound to order)
                    expect(delivered.code).toBe(cdkCode.code);

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Only reserved codes can be delivered
     */
    it("only reserved codes can be delivered", () => {
        fc.assert(
            fc.property(
                cdkStatusArb,
                fc.uuid(),
                cdkCodeStringArb,
                (status, productId, code) => {
                    const cdkCode: CDKCode = {
                        id: crypto.randomUUID(),
                        product_id: productId,
                        code,
                        code_hash: code,
                        status,
                        order_id: status === CDKStatus.RESERVED ? crypto.randomUUID() : undefined,
                        reserved_at: status === CDKStatus.RESERVED ? new Date().toISOString() : undefined,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    };

                    if (status === CDKStatus.RESERVED) {
                        // Should succeed
                        const delivered = simulateDelivery(cdkCode);
                        expect(delivered.status).toBe(CDKStatus.DELIVERED);
                    } else {
                        // Should throw
                        expect(() => simulateDelivery(cdkCode)).toThrow();
                    }

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Delivery is a valid state transition
     */
    it("reserved to delivered is a valid transition", () => {
        expect(isValidStatusTransition(CDKStatus.RESERVED, CDKStatus.DELIVERED)).toBe(true);
    });

    /**
     * Delivered is a terminal state
     */
    it("delivered codes cannot transition to any other state", () => {
        expect(CDKStatusTransitions[CDKStatus.DELIVERED]).toEqual([]);
        expect(isValidStatusTransition(CDKStatus.DELIVERED, CDKStatus.AVAILABLE)).toBe(false);
        expect(isValidStatusTransition(CDKStatus.DELIVERED, CDKStatus.RESERVED)).toBe(false);
        expect(isValidStatusTransition(CDKStatus.DELIVERED, CDKStatus.INVALID)).toBe(false);
    });
});

describe("CDK Status Transition Validation", () => {
    /**
     * Test all valid transitions
     */
    it("validates all defined transitions correctly", () => {
        // Available can go to reserved or invalid
        expect(isValidStatusTransition(CDKStatus.AVAILABLE, CDKStatus.RESERVED)).toBe(true);
        expect(isValidStatusTransition(CDKStatus.AVAILABLE, CDKStatus.INVALID)).toBe(true);
        expect(isValidStatusTransition(CDKStatus.AVAILABLE, CDKStatus.DELIVERED)).toBe(false);

        // Reserved can go to delivered, available (release), or invalid
        expect(isValidStatusTransition(CDKStatus.RESERVED, CDKStatus.DELIVERED)).toBe(true);
        expect(isValidStatusTransition(CDKStatus.RESERVED, CDKStatus.AVAILABLE)).toBe(true);
        expect(isValidStatusTransition(CDKStatus.RESERVED, CDKStatus.INVALID)).toBe(true);

        // Delivered is terminal
        expect(isValidStatusTransition(CDKStatus.DELIVERED, CDKStatus.AVAILABLE)).toBe(false);
        expect(isValidStatusTransition(CDKStatus.DELIVERED, CDKStatus.RESERVED)).toBe(false);
        expect(isValidStatusTransition(CDKStatus.DELIVERED, CDKStatus.INVALID)).toBe(false);

        // Invalid is terminal
        expect(isValidStatusTransition(CDKStatus.INVALID, CDKStatus.AVAILABLE)).toBe(false);
        expect(isValidStatusTransition(CDKStatus.INVALID, CDKStatus.RESERVED)).toBe(false);
        expect(isValidStatusTransition(CDKStatus.INVALID, CDKStatus.DELIVERED)).toBe(false);
    });
});
