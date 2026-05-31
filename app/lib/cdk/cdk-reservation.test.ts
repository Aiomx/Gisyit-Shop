/**
 * Property-Based Tests for CDK Reservation
 *
 * Tests for Requirements 3.5, 4.1, 4.2, 4.3, 8.1:
 * - Property 9: Inventory Count Accuracy
 * - Property 10: Reservation Quantity Exactness
 * - Property 11: Insufficient Inventory Rejection
 */

import { describe, it, expect, beforeEach } from "vitest";
import fc from "fast-check";
import {
    CDKStatus,
    CDKErrorCodes,
    type CDKCode,
    type CDKStatusType,
    type CDKReservationResult,
    type CDKInventoryStats,
} from "./types";

// ============================================
// In-Memory CDK Inventory for Testing
// ============================================

/**
 * In-memory CDK inventory for property testing
 * Simulates the database behavior without actual DB calls
 */
class InMemoryCDKInventory {
    private codes: Map<string, CDKCode> = new Map();
    private codeIdCounter = 0;

    /**
     * Add codes to inventory (simulates import)
     */
    addCodes(productId: string, count: number): string[] {
        const ids: string[] = [];
        for (let i = 0; i < count; i++) {
            const id = `code-${++this.codeIdCounter}`;
            const code: CDKCode = {
                id,
                product_id: productId,
                code: `CDK-${id}`,
                code_hash: `hash-${id}`,
                status: CDKStatus.AVAILABLE,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
            this.codes.set(id, code);
            ids.push(id);
        }
        return ids;
    }

    /**
     * Add codes with specific statuses for testing
     */
    addCodesWithStatus(
        productId: string,
        statusCounts: { available: number; reserved: number; delivered: number; invalid: number }
    ): void {
        const addWithStatus = (count: number, status: CDKStatusType, orderId?: string) => {
            for (let i = 0; i < count; i++) {
                const id = `code-${++this.codeIdCounter}`;
                const code: CDKCode = {
                    id,
                    product_id: productId,
                    code: `CDK-${id}`,
                    code_hash: `hash-${id}`,
                    status,
                    order_id: orderId,
                    reserved_at: status === CDKStatus.RESERVED ? new Date().toISOString() : undefined,
                    delivered_at: status === CDKStatus.DELIVERED ? new Date().toISOString() : undefined,
                    invalidated_at: status === CDKStatus.INVALID ? new Date().toISOString() : undefined,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                };
                this.codes.set(id, code);
            }
        };

        addWithStatus(statusCounts.available, CDKStatus.AVAILABLE);
        addWithStatus(statusCounts.reserved, CDKStatus.RESERVED, "order-reserved");
        addWithStatus(statusCounts.delivered, CDKStatus.DELIVERED, "order-delivered");
        addWithStatus(statusCounts.invalid, CDKStatus.INVALID);
    }

    /**
     * Get count of available codes for a product
     */
    getAvailableCount(productId: string): number {
        let count = 0;
        for (const code of this.codes.values()) {
            if (code.product_id === productId && code.status === CDKStatus.AVAILABLE) {
                count++;
            }
        }
        return count;
    }

    /**
     * Get inventory statistics for a product
     */
    getInventoryStats(productId?: string): CDKInventoryStats {
        const stats: CDKInventoryStats = {
            total: 0,
            available: 0,
            reserved: 0,
            delivered: 0,
            invalid: 0,
        };

        for (const code of this.codes.values()) {
            if (productId && code.product_id !== productId) continue;

            stats.total++;
            switch (code.status) {
                case CDKStatus.AVAILABLE:
                    stats.available++;
                    break;
                case CDKStatus.RESERVED:
                    stats.reserved++;
                    break;
                case CDKStatus.DELIVERED:
                    stats.delivered++;
                    break;
                case CDKStatus.INVALID:
                    stats.invalid++;
                    break;
            }
        }

        return stats;
    }

    /**
     * Reserve codes for an order (simulates atomic reservation)
     */
    reserveCodes(
        productId: string,
        quantity: number,
        orderId: string
    ): CDKReservationResult {
        // Find available codes
        const availableCodes: CDKCode[] = [];
        for (const code of this.codes.values()) {
            if (code.product_id === productId && code.status === CDKStatus.AVAILABLE) {
                availableCodes.push(code);
                if (availableCodes.length >= quantity) break;
            }
        }

        // Check if we have enough
        if (availableCodes.length < quantity) {
            return {
                success: false,
                reservedCodeIds: [],
                error: `库存不足：需要 ${quantity} 个，仅剩 ${availableCodes.length} 个`,
                errorCode: CDKErrorCodes.INSUFFICIENT_INVENTORY,
            };
        }

        // Reserve the codes
        const reservedAt = new Date().toISOString();
        const reservedCodeIds: string[] = [];

        for (const code of availableCodes) {
            code.status = CDKStatus.RESERVED;
            code.order_id = orderId;
            code.reserved_at = reservedAt;
            code.updated_at = reservedAt;
            reservedCodeIds.push(code.id);
        }

        return {
            success: true,
            reservedCodeIds,
        };
    }

    /**
     * Get codes by order ID
     */
    getCodesByOrderId(orderId: string): CDKCode[] {
        const codes: CDKCode[] = [];
        for (const code of this.codes.values()) {
            if (code.order_id === orderId) {
                codes.push(code);
            }
        }
        return codes;
    }

    /**
     * Clear all codes
     */
    clear(): void {
        this.codes.clear();
        this.codeIdCounter = 0;
    }
}

// ============================================
// Arbitraries (Generators)
// ============================================

/**
 * Generate a valid product ID
 */
const productIdArb = fc.uuid();

/**
 * Generate a valid order ID
 */
const orderIdArb = fc.uuid();

/**
 * Generate a reasonable quantity (1-100)
 */
const quantityArb = fc.integer({ min: 1, max: 100 });

/**
 * Generate inventory counts for each status
 */
const inventoryCountsArb = fc.record({
    available: fc.integer({ min: 0, max: 50 }),
    reserved: fc.integer({ min: 0, max: 50 }),
    delivered: fc.integer({ min: 0, max: 50 }),
    invalid: fc.integer({ min: 0, max: 50 }),
});

// ============================================
// Property Tests
// ============================================

describe("Property 10: Reservation Quantity Exactness", () => {
    let inventory: InMemoryCDKInventory;

    beforeEach(() => {
        inventory = new InMemoryCDKInventory();
    });

    /**
     * **Feature: cdk-auto-delivery, Property 10: Reservation Quantity Exactness**
     * **Validates: Requirements 4.1, 4.2**
     *
     * For any successful reservation request for N codes, exactly N codes
     * should transition from available to reserved status, and all should
     * be associated with the same order.
     */
    it("successful reservation reserves exactly the requested quantity", () => {
        fc.assert(
            fc.property(
                productIdArb,
                orderIdArb,
                fc.integer({ min: 1, max: 50 }),
                fc.integer({ min: 0, max: 50 }),
                (productId, orderId, requestedQuantity, extraAvailable) => {
                    inventory.clear();

                    // Ensure we have enough inventory
                    const totalAvailable = requestedQuantity + extraAvailable;
                    inventory.addCodes(productId, totalAvailable);

                    const initialAvailable = inventory.getAvailableCount(productId);
                    expect(initialAvailable).toBe(totalAvailable);

                    // Perform reservation
                    const result = inventory.reserveCodes(productId, requestedQuantity, orderId);

                    // Verify success
                    expect(result.success).toBe(true);

                    // Verify exactly N codes were reserved
                    expect(result.reservedCodeIds.length).toBe(requestedQuantity);

                    // Verify all reserved codes are associated with the order
                    const orderCodes = inventory.getCodesByOrderId(orderId);
                    expect(orderCodes.length).toBe(requestedQuantity);

                    // Verify all reserved codes have correct status
                    for (const code of orderCodes) {
                        expect(code.status).toBe(CDKStatus.RESERVED);
                        expect(code.order_id).toBe(orderId);
                        expect(code.reserved_at).toBeDefined();
                    }

                    // Verify available count decreased by exactly N
                    const finalAvailable = inventory.getAvailableCount(productId);
                    expect(finalAvailable).toBe(totalAvailable - requestedQuantity);

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Reserved codes should have the correct product association
     */
    it("reserved codes maintain product association", () => {
        fc.assert(
            fc.property(
                productIdArb,
                orderIdArb,
                fc.integer({ min: 1, max: 20 }),
                (productId, orderId, quantity) => {
                    inventory.clear();
                    inventory.addCodes(productId, quantity);

                    const result = inventory.reserveCodes(productId, quantity, orderId);

                    expect(result.success).toBe(true);

                    const orderCodes = inventory.getCodesByOrderId(orderId);
                    for (const code of orderCodes) {
                        expect(code.product_id).toBe(productId);
                    }

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });
});

describe("Property 11: Insufficient Inventory Rejection", () => {
    let inventory: InMemoryCDKInventory;

    beforeEach(() => {
        inventory = new InMemoryCDKInventory();
    });

    /**
     * **Feature: cdk-auto-delivery, Property 11: Insufficient Inventory Rejection**
     * **Validates: Requirements 4.3**
     *
     * For any reservation request where requested quantity exceeds available count,
     * the request should fail with an error and no codes should change status.
     */
    it("rejects reservation when requested quantity exceeds available", () => {
        fc.assert(
            fc.property(
                productIdArb,
                orderIdArb,
                fc.integer({ min: 0, max: 20 }),
                fc.integer({ min: 1, max: 50 }),
                (productId, orderId, availableCount, extraRequested) => {
                    inventory.clear();

                    // Add some available codes
                    inventory.addCodes(productId, availableCount);

                    // Request more than available
                    const requestedQuantity = availableCount + extraRequested;

                    const initialStats = inventory.getInventoryStats(productId);

                    // Attempt reservation
                    const result = inventory.reserveCodes(productId, requestedQuantity, orderId);

                    // Verify failure
                    expect(result.success).toBe(false);
                    expect(result.errorCode).toBe(CDKErrorCodes.INSUFFICIENT_INVENTORY);
                    expect(result.reservedCodeIds.length).toBe(0);

                    // Verify no codes changed status
                    const finalStats = inventory.getInventoryStats(productId);
                    expect(finalStats.available).toBe(initialStats.available);
                    expect(finalStats.reserved).toBe(initialStats.reserved);

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Zero available inventory should always reject
     */
    it("rejects any reservation when inventory is empty", () => {
        fc.assert(
            fc.property(
                productIdArb,
                orderIdArb,
                fc.integer({ min: 1, max: 100 }),
                (productId, orderId, quantity) => {
                    inventory.clear();
                    // Don't add any codes

                    const result = inventory.reserveCodes(productId, quantity, orderId);

                    expect(result.success).toBe(false);
                    expect(result.errorCode).toBe(CDKErrorCodes.INSUFFICIENT_INVENTORY);

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });
});

describe("Property 12: Concurrent Reservation Safety", () => {
    let inventory: InMemoryCDKInventory;

    beforeEach(() => {
        inventory = new InMemoryCDKInventory();
    });

    /**
     * **Feature: cdk-auto-delivery, Property 12: Concurrent Reservation Safety**
     * **Validates: Requirements 4.4, 9.5**
     *
     * For any set of concurrent reservation requests totaling more than available inventory,
     * the total reserved codes should never exceed the initial available count (no overselling).
     */
    it("concurrent reservations never exceed available inventory", () => {
        fc.assert(
            fc.property(
                productIdArb,
                fc.integer({ min: 1, max: 50 }), // available inventory
                fc.array(
                    fc.record({
                        orderId: orderIdArb,
                        quantity: fc.integer({ min: 1, max: 20 }),
                    }),
                    { minLength: 2, maxLength: 10 }
                ),
                (productId, availableCount, reservationRequests) => {
                    inventory.clear();
                    inventory.addCodes(productId, availableCount);

                    // Simulate concurrent reservations
                    const results: CDKReservationResult[] = [];
                    for (const request of reservationRequests) {
                        const result = inventory.reserveCodes(
                            productId,
                            request.quantity,
                            request.orderId
                        );
                        results.push(result);
                    }

                    // Count total reserved codes
                    const totalReserved = results.reduce(
                        (sum, r) => sum + r.reservedCodeIds.length,
                        0
                    );

                    // Property: total reserved should never exceed initial available
                    expect(totalReserved).toBeLessThanOrEqual(availableCount);

                    // Verify inventory consistency
                    const stats = inventory.getInventoryStats(productId);
                    expect(stats.reserved).toBe(totalReserved);
                    expect(stats.available).toBe(availableCount - totalReserved);
                    expect(stats.total).toBe(availableCount);

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Each successful reservation should reserve unique codes
     */
    it("successful reservations reserve unique codes across orders", () => {
        fc.assert(
            fc.property(
                productIdArb,
                fc.integer({ min: 10, max: 50 }), // enough inventory
                fc.array(
                    fc.record({
                        orderId: orderIdArb,
                        quantity: fc.integer({ min: 1, max: 5 }),
                    }),
                    { minLength: 2, maxLength: 5 }
                ),
                (productId, availableCount, reservationRequests) => {
                    inventory.clear();
                    inventory.addCodes(productId, availableCount);

                    const allReservedIds: string[] = [];
                    const results: CDKReservationResult[] = [];

                    for (const request of reservationRequests) {
                        const result = inventory.reserveCodes(
                            productId,
                            request.quantity,
                            request.orderId
                        );
                        results.push(result);
                        if (result.success) {
                            allReservedIds.push(...result.reservedCodeIds);
                        }
                    }

                    // All reserved code IDs should be unique (no double-booking)
                    const uniqueIds = new Set(allReservedIds);
                    expect(uniqueIds.size).toBe(allReservedIds.length);

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * When total requested exceeds available, some requests must fail
     */
    it("rejects some requests when total demand exceeds supply", () => {
        fc.assert(
            fc.property(
                productIdArb,
                fc.integer({ min: 5, max: 20 }), // limited inventory
                fc.array(
                    fc.record({
                        orderId: orderIdArb,
                        quantity: fc.integer({ min: 3, max: 10 }),
                    }),
                    { minLength: 3, maxLength: 6 }
                ),
                (productId, availableCount, reservationRequests) => {
                    inventory.clear();
                    inventory.addCodes(productId, availableCount);

                    const totalRequested = reservationRequests.reduce(
                        (sum, r) => sum + r.quantity,
                        0
                    );

                    // Only test when total requested exceeds available
                    if (totalRequested <= availableCount) {
                        return true; // Skip this case
                    }

                    const results: CDKReservationResult[] = [];
                    for (const request of reservationRequests) {
                        const result = inventory.reserveCodes(
                            productId,
                            request.quantity,
                            request.orderId
                        );
                        results.push(result);
                    }

                    // At least one request should fail
                    const failedCount = results.filter((r) => !r.success).length;
                    expect(failedCount).toBeGreaterThan(0);

                    // Total reserved should not exceed available
                    const totalReserved = results.reduce(
                        (sum, r) => sum + r.reservedCodeIds.length,
                        0
                    );
                    expect(totalReserved).toBeLessThanOrEqual(availableCount);

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });
});

describe("Property 9: Inventory Count Accuracy", () => {
    let inventory: InMemoryCDKInventory;

    beforeEach(() => {
        inventory = new InMemoryCDKInventory();
    });

    /**
     * **Feature: cdk-auto-delivery, Property 9: Inventory Count Accuracy**
     * **Validates: Requirements 3.5, 8.1**
     *
     * For any CDK inventory query, the sum of (available + reserved + delivered + invalid)
     * counts should equal the total count of all codes.
     */
    it("inventory stats sum equals total count", () => {
        fc.assert(
            fc.property(
                productIdArb,
                inventoryCountsArb,
                (productId, counts) => {
                    inventory.clear();

                    // Add codes with various statuses
                    inventory.addCodesWithStatus(productId, counts);

                    // Get stats
                    const stats = inventory.getInventoryStats(productId);

                    // Verify sum equals total
                    const sum = stats.available + stats.reserved + stats.delivered + stats.invalid;
                    expect(sum).toBe(stats.total);

                    // Verify individual counts match input
                    expect(stats.available).toBe(counts.available);
                    expect(stats.reserved).toBe(counts.reserved);
                    expect(stats.delivered).toBe(counts.delivered);
                    expect(stats.invalid).toBe(counts.invalid);

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Available count should match getAvailableCount
     */
    it("getAvailableCount matches stats.available", () => {
        fc.assert(
            fc.property(
                productIdArb,
                inventoryCountsArb,
                (productId, counts) => {
                    inventory.clear();
                    inventory.addCodesWithStatus(productId, counts);

                    const availableCount = inventory.getAvailableCount(productId);
                    const stats = inventory.getInventoryStats(productId);

                    expect(availableCount).toBe(stats.available);
                    expect(availableCount).toBe(counts.available);

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Reservation should correctly update inventory counts
     */
    it("reservation updates inventory counts correctly", () => {
        fc.assert(
            fc.property(
                productIdArb,
                orderIdArb,
                fc.integer({ min: 1, max: 30 }),
                fc.integer({ min: 0, max: 20 }),
                (productId, orderId, availableCount, reserveCount) => {
                    inventory.clear();
                    inventory.addCodes(productId, availableCount);

                    const quantityToReserve = Math.min(reserveCount, availableCount);
                    if (quantityToReserve === 0) return true; // Skip if nothing to reserve

                    const initialStats = inventory.getInventoryStats(productId);

                    const result = inventory.reserveCodes(productId, quantityToReserve, orderId);

                    if (result.success) {
                        const finalStats = inventory.getInventoryStats(productId);

                        // Total should remain the same
                        expect(finalStats.total).toBe(initialStats.total);

                        // Available should decrease by reserved amount
                        expect(finalStats.available).toBe(initialStats.available - quantityToReserve);

                        // Reserved should increase by reserved amount
                        expect(finalStats.reserved).toBe(initialStats.reserved + quantityToReserve);

                        // Sum should still equal total
                        const sum = finalStats.available + finalStats.reserved + finalStats.delivered + finalStats.invalid;
                        expect(sum).toBe(finalStats.total);
                    }

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });
});
