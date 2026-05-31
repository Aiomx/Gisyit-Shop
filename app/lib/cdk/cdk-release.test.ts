/**
 * Property-Based Tests for CDK Release Operations
 *
 * Tests for Requirements 6.1, 6.2, 6.3, 6.5, 6.6:
 * - Property 14: Timeout Release Correctness
 * - Property 15: Release State Restoration
 * - Property 16: Orphan Cleanup
 */

import { describe, it, expect, beforeEach } from "vitest";
import fc from "fast-check";
import {
    CDKStatus,
    type CDKCode,
    type CDKStatusType,
    type CDKReleaseResult,
    type CDKReleaseReason,
} from "./types";

// ============================================
// In-Memory CDK Inventory for Testing
// ============================================

/**
 * Order status type for testing
 */
type TestOrderStatus = "pending" | "paid" | "fulfilled" | "completed" | "cancelled";

/**
 * Test order entity
 */
interface TestOrder {
    id: string;
    user_id: string;
    status: TestOrderStatus;
    created_at: string;
}

/**
 * Audit log entry for testing
 */
interface TestAuditLog {
    cdk_code_id: string;
    action: string;
    old_status: CDKStatusType;
    new_status: CDKStatusType;
    order_id?: string;
    reason?: string;
    created_at: string;
}


/**
 * In-memory CDK inventory for property testing release operations
 * Simulates the database behavior without actual DB calls
 */
class InMemoryCDKReleaseInventory {
    private codes: Map<string, CDKCode> = new Map();
    private orders: Map<string, TestOrder> = new Map();
    private auditLogs: TestAuditLog[] = [];
    private codeIdCounter = 0;

    /**
     * Add an order
     */
    addOrder(orderId: string, userId: string, status: TestOrderStatus): void {
        this.orders.set(orderId, {
            id: orderId,
            user_id: userId,
            status,
            created_at: new Date().toISOString(),
        });
    }

    /**
     * Get order by ID
     */
    getOrder(orderId: string): TestOrder | undefined {
        return this.orders.get(orderId);
    }

    /**
     * Update order status
     */
    updateOrderStatus(orderId: string, status: TestOrderStatus): void {
        const order = this.orders.get(orderId);
        if (order) {
            order.status = status;
        }
    }

    /**
     * Delete an order (for orphan testing)
     */
    deleteOrder(orderId: string): void {
        this.orders.delete(orderId);
    }

    /**
     * Add codes with reserved status for an order
     */
    addReservedCodes(
        productId: string,
        orderId: string,
        count: number,
        reservedAt?: Date
    ): string[] {
        const ids: string[] = [];
        const reservedTime = (reservedAt || new Date()).toISOString();
        for (let i = 0; i < count; i++) {
            const id = `code-${++this.codeIdCounter}`;
            const code: CDKCode = {
                id,
                product_id: productId,
                code: `CDK-${id}-${Math.random().toString(36).substring(7)}`,
                code_hash: `hash-${id}`,
                status: CDKStatus.RESERVED,
                order_id: orderId,
                reserved_at: reservedTime,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
            this.codes.set(id, code);
            ids.push(id);
        }
        return ids;
    }


    /**
     * Add codes with available status
     */
    addAvailableCodes(productId: string, count: number): string[] {
        const ids: string[] = [];
        for (let i = 0; i < count; i++) {
            const id = `code-${++this.codeIdCounter}`;
            const code: CDKCode = {
                id,
                product_id: productId,
                code: `CDK-${id}-${Math.random().toString(36).substring(7)}`,
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
     * Release codes for an order (simulates releaseCodes server action)
     * Requirements: 6.2, 6.3, 6.4
     */
    releaseCodes(orderId: string, reason: CDKReleaseReason): CDKReleaseResult {
        if (!orderId) {
            return {
                success: false,
                releasedCount: 0,
                error: "Invalid order ID",
            };
        }

        const releasedAt = new Date().toISOString();

        // Find reserved codes for this order
        const reservedCodes: CDKCode[] = [];
        for (const code of this.codes.values()) {
            if (code.order_id === orderId && code.status === CDKStatus.RESERVED) {
                reservedCodes.push(code);
            }
        }

        // No reserved codes found - idempotent success
        if (reservedCodes.length === 0) {
            return {
                success: true,
                releasedCount: 0,
            };
        }

        // Release codes (Requirements 6.2, 6.3)
        for (const code of reservedCodes) {
            // Create audit log entry (Requirement 6.4)
            this.auditLogs.push({
                cdk_code_id: code.id,
                action: "released",
                old_status: CDKStatus.RESERVED,
                new_status: CDKStatus.AVAILABLE,
                order_id: orderId,
                reason,
                created_at: releasedAt,
            });

            // Update code status
            code.status = CDKStatus.AVAILABLE;
            code.order_id = undefined;
            code.reserved_at = undefined;
            code.updated_at = releasedAt;
        }

        return {
            success: true,
            releasedCount: reservedCodes.length,
        };
    }


    /**
     * Release timeout reservations (simulates releaseTimeoutReservations)
     * Requirements: 6.1, 6.5
     */
    releaseTimeoutReservations(timeoutMinutes: number = 15): {
        releasedCount: number;
        cancelledOrders: string[];
    } {
        const now = new Date();
        const timeoutThreshold = new Date(now.getTime() - timeoutMinutes * 60 * 1000);

        const result = {
            releasedCount: 0,
            cancelledOrders: [] as string[],
        };

        // Find timed out codes grouped by order
        const orderCodeMap = new Map<string, CDKCode[]>();
        for (const code of this.codes.values()) {
            if (
                code.status === CDKStatus.RESERVED &&
                code.reserved_at &&
                code.order_id
            ) {
                const reservedAt = new Date(code.reserved_at);
                if (reservedAt < timeoutThreshold) {
                    const existing = orderCodeMap.get(code.order_id) || [];
                    existing.push(code);
                    orderCodeMap.set(code.order_id, existing);
                }
            }
        }

        // Release codes for each timed out order
        for (const [orderId, codes] of orderCodeMap) {
            const releaseResult = this.releaseCodes(orderId, "payment_timeout");
            if (releaseResult.success) {
                result.releasedCount += releaseResult.releasedCount;

                // Cancel the order if it's pending
                const order = this.orders.get(orderId);
                if (order && order.status === "pending") {
                    order.status = "cancelled";
                    result.cancelledOrders.push(orderId);
                }
            }
        }

        return result;
    }

    /**
     * Cleanup orphan reservations (simulates cleanupOrphanReservations)
     * Requirements: 6.6
     */
    cleanupOrphanReservations(): { releasedCount: number } {
        const releasedAt = new Date().toISOString();
        let releasedCount = 0;

        // Find reserved codes with invalid order associations
        for (const code of this.codes.values()) {
            if (code.status === CDKStatus.RESERVED && code.order_id) {
                const order = this.orders.get(code.order_id);
                // Orphan if order doesn't exist or is in terminal state
                const isOrphan =
                    !order ||
                    order.status === "cancelled" ||
                    order.status === "completed" ||
                    order.status === "fulfilled";

                if (isOrphan) {
                    // Create audit log
                    this.auditLogs.push({
                        cdk_code_id: code.id,
                        action: "released",
                        old_status: CDKStatus.RESERVED,
                        new_status: CDKStatus.AVAILABLE,
                        order_id: code.order_id,
                        reason: "orphan_cleanup",
                        created_at: releasedAt,
                    });

                    // Release the code
                    code.status = CDKStatus.AVAILABLE;
                    code.order_id = undefined;
                    code.reserved_at = undefined;
                    code.updated_at = releasedAt;
                    releasedCount++;
                }
            }
        }

        return { releasedCount };
    }


    /**
     * Get code by ID
     */
    getCode(codeId: string): CDKCode | undefined {
        return this.codes.get(codeId);
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
     * Get all codes with a specific status
     */
    getCodesByStatus(status: CDKStatusType): CDKCode[] {
        const codes: CDKCode[] = [];
        for (const code of this.codes.values()) {
            if (code.status === status) {
                codes.push(code);
            }
        }
        return codes;
    }

    /**
     * Get audit logs for a code
     */
    getAuditLogsForCode(codeId: string): TestAuditLog[] {
        return this.auditLogs.filter((log) => log.cdk_code_id === codeId);
    }

    /**
     * Get all audit logs
     */
    getAllAuditLogs(): TestAuditLog[] {
        return [...this.auditLogs];
    }

    /**
     * Clear all data
     */
    clear(): void {
        this.codes.clear();
        this.orders.clear();
        this.auditLogs = [];
        this.codeIdCounter = 0;
    }
}

// ============================================
// Arbitraries (Generators)
// ============================================

const productIdArb = fc.uuid();
const orderIdArb = fc.uuid();
const userIdArb = fc.uuid();
const codeCountArb = fc.integer({ min: 1, max: 20 });

const releaseReasonArb = fc.constantFrom<CDKReleaseReason>(
    "payment_timeout",
    "order_cancelled",
    "orphan_cleanup",
    "admin_action"
);


// ============================================
// Property Tests
// ============================================

describe("Property 15: Release State Restoration", () => {
    let inventory: InMemoryCDKReleaseInventory;

    beforeEach(() => {
        inventory = new InMemoryCDKReleaseInventory();
    });

    /**
     * **Feature: cdk-auto-delivery, Property 15: Release State Restoration**
     * **Validates: Requirements 6.2, 6.3**
     *
     * For any released CDK code (due to timeout or cancellation), its status
     * should change from 'reserved' to 'available', and the order_id should be cleared.
     */
    it("released codes transition from reserved to available with cleared order_id", () => {
        fc.assert(
            fc.property(
                productIdArb,
                orderIdArb,
                userIdArb,
                codeCountArb,
                releaseReasonArb,
                (productId, orderId, userId, codeCount, reason) => {
                    inventory.clear();

                    // Setup: Add order and reserved codes
                    inventory.addOrder(orderId, userId, "pending");
                    const codeIds = inventory.addReservedCodes(productId, orderId, codeCount);

                    // Verify initial state
                    for (const codeId of codeIds) {
                        const code = inventory.getCode(codeId);
                        expect(code?.status).toBe(CDKStatus.RESERVED);
                        expect(code?.order_id).toBe(orderId);
                        expect(code?.reserved_at).toBeDefined();
                    }

                    // Release codes
                    const result = inventory.releaseCodes(orderId, reason);

                    // Verify release success
                    expect(result.success).toBe(true);
                    expect(result.releasedCount).toBe(codeCount);

                    // Verify state restoration (Requirements 6.2, 6.3)
                    for (const codeId of codeIds) {
                        const code = inventory.getCode(codeId);
                        expect(code?.status).toBe(CDKStatus.AVAILABLE);
                        expect(code?.order_id).toBeUndefined();
                        expect(code?.reserved_at).toBeUndefined();
                    }

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Release is idempotent - releasing already released codes succeeds with 0 count
     */
    it("release is idempotent", () => {
        fc.assert(
            fc.property(
                productIdArb,
                orderIdArb,
                userIdArb,
                codeCountArb,
                releaseReasonArb,
                (productId, orderId, userId, codeCount, reason) => {
                    inventory.clear();

                    // Setup: Add order and reserved codes
                    inventory.addOrder(orderId, userId, "pending");
                    inventory.addReservedCodes(productId, orderId, codeCount);

                    // First release
                    const firstResult = inventory.releaseCodes(orderId, reason);
                    expect(firstResult.success).toBe(true);
                    expect(firstResult.releasedCount).toBe(codeCount);

                    // Second release (should be idempotent)
                    const secondResult = inventory.releaseCodes(orderId, reason);
                    expect(secondResult.success).toBe(true);
                    expect(secondResult.releasedCount).toBe(0);

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Release creates audit log entries for each code
     */
    it("release creates audit log entries", () => {
        fc.assert(
            fc.property(
                productIdArb,
                orderIdArb,
                userIdArb,
                codeCountArb,
                releaseReasonArb,
                (productId, orderId, userId, codeCount, reason) => {
                    inventory.clear();

                    // Setup
                    inventory.addOrder(orderId, userId, "pending");
                    const codeIds = inventory.addReservedCodes(productId, orderId, codeCount);

                    // Release
                    inventory.releaseCodes(orderId, reason);

                    // Verify audit logs
                    for (const codeId of codeIds) {
                        const logs = inventory.getAuditLogsForCode(codeId);
                        expect(logs.length).toBeGreaterThanOrEqual(1);

                        const releaseLog = logs.find((l) => l.action === "released");
                        expect(releaseLog).toBeDefined();
                        expect(releaseLog?.old_status).toBe(CDKStatus.RESERVED);
                        expect(releaseLog?.new_status).toBe(CDKStatus.AVAILABLE);
                        expect(releaseLog?.reason).toBe(reason);
                    }

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });
});


describe("Property 14: Timeout Release Correctness", () => {
    let inventory: InMemoryCDKReleaseInventory;

    beforeEach(() => {
        inventory = new InMemoryCDKReleaseInventory();
    });

    /**
     * **Feature: cdk-auto-delivery, Property 14: Timeout Release Correctness**
     * **Validates: Requirements 6.1, 6.5**
     *
     * For any order that has been pending for more than 15 minutes, all its
     * reserved codes should be released back to available status.
     */
    it("codes reserved longer than timeout are released", () => {
        fc.assert(
            fc.property(
                productIdArb,
                orderIdArb,
                userIdArb,
                codeCountArb,
                fc.integer({ min: 16, max: 120 }), // minutes past timeout
                (productId, orderId, userId, codeCount, minutesPast) => {
                    inventory.clear();

                    // Setup: Add order and codes reserved in the past
                    inventory.addOrder(orderId, userId, "pending");
                    const pastTime = new Date(Date.now() - minutesPast * 60 * 1000);
                    const codeIds = inventory.addReservedCodes(
                        productId,
                        orderId,
                        codeCount,
                        pastTime
                    );

                    // Verify initial state
                    expect(inventory.getCodesByStatus(CDKStatus.RESERVED).length).toBe(codeCount);

                    // Run timeout cleanup
                    const result = inventory.releaseTimeoutReservations(15);

                    // Verify all codes were released
                    expect(result.releasedCount).toBe(codeCount);
                    expect(result.cancelledOrders).toContain(orderId);

                    // Verify codes are now available
                    for (const codeId of codeIds) {
                        const code = inventory.getCode(codeId);
                        expect(code?.status).toBe(CDKStatus.AVAILABLE);
                        expect(code?.order_id).toBeUndefined();
                    }

                    // Verify order was cancelled
                    const order = inventory.getOrder(orderId);
                    expect(order?.status).toBe("cancelled");

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Codes reserved within timeout period are not released
     */
    it("codes reserved within timeout period are not released", () => {
        fc.assert(
            fc.property(
                productIdArb,
                orderIdArb,
                userIdArb,
                codeCountArb,
                fc.integer({ min: 1, max: 14 }), // minutes within timeout
                (productId, orderId, userId, codeCount, minutesAgo) => {
                    inventory.clear();

                    // Setup: Add order and codes reserved recently
                    inventory.addOrder(orderId, userId, "pending");
                    const recentTime = new Date(Date.now() - minutesAgo * 60 * 1000);
                    const codeIds = inventory.addReservedCodes(
                        productId,
                        orderId,
                        codeCount,
                        recentTime
                    );

                    // Run timeout cleanup
                    const result = inventory.releaseTimeoutReservations(15);

                    // Verify no codes were released
                    expect(result.releasedCount).toBe(0);
                    expect(result.cancelledOrders.length).toBe(0);

                    // Verify codes are still reserved
                    for (const codeId of codeIds) {
                        const code = inventory.getCode(codeId);
                        expect(code?.status).toBe(CDKStatus.RESERVED);
                        expect(code?.order_id).toBe(orderId);
                    }

                    // Verify order is still pending
                    const order = inventory.getOrder(orderId);
                    expect(order?.status).toBe("pending");

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Mixed timeout scenario - only timed out codes are released
     */
    it("only timed out codes are released in mixed scenario", () => {
        fc.assert(
            fc.property(
                productIdArb,
                fc.array(orderIdArb, { minLength: 2, maxLength: 5 }),
                userIdArb,
                codeCountArb,
                (productId, orderIds, userId, codeCount) => {
                    inventory.clear();

                    // Ensure unique order IDs
                    const uniqueOrderIds = [...new Set(orderIds)];
                    if (uniqueOrderIds.length < 2) return true;

                    // Setup: Half orders timed out, half recent
                    const timedOutOrders: string[] = [];
                    const recentOrders: string[] = [];

                    uniqueOrderIds.forEach((orderId, index) => {
                        inventory.addOrder(orderId, userId, "pending");
                        if (index % 2 === 0) {
                            // Timed out (20 minutes ago)
                            const pastTime = new Date(Date.now() - 20 * 60 * 1000);
                            inventory.addReservedCodes(productId, orderId, codeCount, pastTime);
                            timedOutOrders.push(orderId);
                        } else {
                            // Recent (5 minutes ago)
                            const recentTime = new Date(Date.now() - 5 * 60 * 1000);
                            inventory.addReservedCodes(productId, orderId, codeCount, recentTime);
                            recentOrders.push(orderId);
                        }
                    });

                    // Run timeout cleanup
                    const result = inventory.releaseTimeoutReservations(15);

                    // Verify only timed out codes were released
                    expect(result.releasedCount).toBe(timedOutOrders.length * codeCount);

                    // Verify timed out orders were cancelled
                    for (const orderId of timedOutOrders) {
                        expect(result.cancelledOrders).toContain(orderId);
                        const order = inventory.getOrder(orderId);
                        expect(order?.status).toBe("cancelled");
                    }

                    // Verify recent orders are still pending
                    for (const orderId of recentOrders) {
                        expect(result.cancelledOrders).not.toContain(orderId);
                        const order = inventory.getOrder(orderId);
                        expect(order?.status).toBe("pending");
                    }

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });
});


describe("Property 16: Orphan Cleanup", () => {
    let inventory: InMemoryCDKReleaseInventory;

    beforeEach(() => {
        inventory = new InMemoryCDKReleaseInventory();
    });

    /**
     * **Feature: cdk-auto-delivery, Property 16: Orphan Cleanup**
     * **Validates: Requirements 6.6**
     *
     * For any CDK code in reserved status with no valid associated order,
     * the cleanup process should release it back to available status.
     */
    it("codes with deleted orders are released", () => {
        fc.assert(
            fc.property(
                productIdArb,
                orderIdArb,
                userIdArb,
                codeCountArb,
                (productId, orderId, userId, codeCount) => {
                    inventory.clear();

                    // Setup: Add order and reserved codes
                    inventory.addOrder(orderId, userId, "pending");
                    const codeIds = inventory.addReservedCodes(productId, orderId, codeCount);

                    // Delete the order (simulating orphan scenario)
                    inventory.deleteOrder(orderId);

                    // Verify codes are still reserved
                    expect(inventory.getCodesByStatus(CDKStatus.RESERVED).length).toBe(codeCount);

                    // Run orphan cleanup
                    const result = inventory.cleanupOrphanReservations();

                    // Verify all codes were released
                    expect(result.releasedCount).toBe(codeCount);

                    // Verify codes are now available
                    for (const codeId of codeIds) {
                        const code = inventory.getCode(codeId);
                        expect(code?.status).toBe(CDKStatus.AVAILABLE);
                        expect(code?.order_id).toBeUndefined();
                    }

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Codes with cancelled orders are released
     */
    it("codes with cancelled orders are released", () => {
        fc.assert(
            fc.property(
                productIdArb,
                orderIdArb,
                userIdArb,
                codeCountArb,
                (productId, orderId, userId, codeCount) => {
                    inventory.clear();

                    // Setup: Add cancelled order and reserved codes
                    inventory.addOrder(orderId, userId, "cancelled");
                    const codeIds = inventory.addReservedCodes(productId, orderId, codeCount);

                    // Run orphan cleanup
                    const result = inventory.cleanupOrphanReservations();

                    // Verify all codes were released
                    expect(result.releasedCount).toBe(codeCount);

                    // Verify codes are now available
                    for (const codeId of codeIds) {
                        const code = inventory.getCode(codeId);
                        expect(code?.status).toBe(CDKStatus.AVAILABLE);
                    }

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Codes with valid pending orders are not released
     */
    it("codes with valid pending orders are not released", () => {
        fc.assert(
            fc.property(
                productIdArb,
                orderIdArb,
                userIdArb,
                codeCountArb,
                (productId, orderId, userId, codeCount) => {
                    inventory.clear();

                    // Setup: Add pending order and reserved codes
                    inventory.addOrder(orderId, userId, "pending");
                    const codeIds = inventory.addReservedCodes(productId, orderId, codeCount);

                    // Run orphan cleanup
                    const result = inventory.cleanupOrphanReservations();

                    // Verify no codes were released
                    expect(result.releasedCount).toBe(0);

                    // Verify codes are still reserved
                    for (const codeId of codeIds) {
                        const code = inventory.getCode(codeId);
                        expect(code?.status).toBe(CDKStatus.RESERVED);
                        expect(code?.order_id).toBe(orderId);
                    }

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Codes with valid paid orders are not released
     */
    it("codes with valid paid orders are not released", () => {
        fc.assert(
            fc.property(
                productIdArb,
                orderIdArb,
                userIdArb,
                codeCountArb,
                (productId, orderId, userId, codeCount) => {
                    inventory.clear();

                    // Setup: Add paid order and reserved codes
                    inventory.addOrder(orderId, userId, "paid");
                    const codeIds = inventory.addReservedCodes(productId, orderId, codeCount);

                    // Run orphan cleanup
                    const result = inventory.cleanupOrphanReservations();

                    // Verify no codes were released
                    expect(result.releasedCount).toBe(0);

                    // Verify codes are still reserved
                    for (const codeId of codeIds) {
                        const code = inventory.getCode(codeId);
                        expect(code?.status).toBe(CDKStatus.RESERVED);
                        expect(code?.order_id).toBe(orderId);
                    }

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Mixed scenario - only orphan codes are released
     */
    it("only orphan codes are released in mixed scenario", () => {
        fc.assert(
            fc.property(
                productIdArb,
                orderIdArb,
                orderIdArb,
                userIdArb,
                codeCountArb,
                (productId, validOrderId, orphanOrderId, userId, codeCount) => {
                    // Skip if same order ID
                    if (validOrderId === orphanOrderId) return true;

                    inventory.clear();

                    // Setup: Add valid order with codes
                    inventory.addOrder(validOrderId, userId, "pending");
                    const validCodeIds = inventory.addReservedCodes(
                        productId,
                        validOrderId,
                        codeCount
                    );

                    // Setup: Add orphan codes (order will be deleted)
                    inventory.addOrder(orphanOrderId, userId, "pending");
                    const orphanCodeIds = inventory.addReservedCodes(
                        productId,
                        orphanOrderId,
                        codeCount
                    );
                    inventory.deleteOrder(orphanOrderId);

                    // Run orphan cleanup
                    const result = inventory.cleanupOrphanReservations();

                    // Verify only orphan codes were released
                    expect(result.releasedCount).toBe(codeCount);

                    // Verify valid codes are still reserved
                    for (const codeId of validCodeIds) {
                        const code = inventory.getCode(codeId);
                        expect(code?.status).toBe(CDKStatus.RESERVED);
                        expect(code?.order_id).toBe(validOrderId);
                    }

                    // Verify orphan codes are now available
                    for (const codeId of orphanCodeIds) {
                        const code = inventory.getCode(codeId);
                        expect(code?.status).toBe(CDKStatus.AVAILABLE);
                        expect(code?.order_id).toBeUndefined();
                    }

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });
});
