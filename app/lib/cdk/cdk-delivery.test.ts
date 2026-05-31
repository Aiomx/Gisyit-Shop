/**
 * Property-Based Tests for CDK Delivery
 *
 * Tests for Requirements 5.1, 5.2, 5.3, 5.5, 7.3, 7.4, 9.3:
 * - Property 13: Delivery Idempotency
 * - Property 17: Unpaid Order Content Hiding
 * - Property 18: Re-delivery Prevention
 */

import { describe, it, expect, beforeEach } from "vitest";
import fc from "fast-check";
import {
    CDKStatus,
    CDKErrorCodes,
    type CDKCode,
    type CDKStatusType,
    type CDKDeliveryResult,
    type DeliveredCode,
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
}

/**
 * In-memory CDK inventory for property testing
 * Simulates the database behavior without actual DB calls
 */
class InMemoryCDKDeliveryInventory {
    private codes: Map<string, CDKCode> = new Map();
    private orders: Map<string, TestOrder> = new Map();
    private codeIdCounter = 0;

    /**
     * Add an order
     */
    addOrder(orderId: string, userId: string, status: TestOrderStatus): void {
        this.orders.set(orderId, { id: orderId, user_id: userId, status });
    }

    /**
     * Get order by ID
     */
    getOrder(orderId: string): TestOrder | undefined {
        return this.orders.get(orderId);
    }

    /**
     * Add codes with reserved status for an order
     */
    addReservedCodes(productId: string, orderId: string, count: number): string[] {
        const ids: string[] = [];
        const reservedAt = new Date().toISOString();
        for (let i = 0; i < count; i++) {
            const id = `code-${++this.codeIdCounter}`;
            const code: CDKCode = {
                id,
                product_id: productId,
                code: `CDK-${id}-${Math.random().toString(36).substring(7)}`,
                code_hash: `hash-${id}`,
                status: CDKStatus.RESERVED,
                order_id: orderId,
                reserved_at: reservedAt,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
            this.codes.set(id, code);
            ids.push(id);
        }
        return ids;
    }

    /**
     * Add codes with delivered status for an order
     */
    addDeliveredCodes(productId: string, orderId: string, count: number): string[] {
        const ids: string[] = [];
        const deliveredAt = new Date().toISOString();
        for (let i = 0; i < count; i++) {
            const id = `code-${++this.codeIdCounter}`;
            const code: CDKCode = {
                id,
                product_id: productId,
                code: `CDK-${id}-${Math.random().toString(36).substring(7)}`,
                code_hash: `hash-${id}`,
                status: CDKStatus.DELIVERED,
                order_id: orderId,
                delivered_at: deliveredAt,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
            this.codes.set(id, code);
            ids.push(id);
        }
        return ids;
    }

    /**
     * Deliver codes for an order (simulates deliverCodes server action)
     * Requirements: 5.1, 5.2, 5.3, 5.5
     */
    deliverCodes(orderId: string): CDKDeliveryResult {
        if (!orderId) {
            return {
                success: false,
                deliveredCodes: [],
                error: "Invalid order ID",
                errorCode: CDKErrorCodes.ORDER_NOT_FOUND,
            };
        }

        const deliveredAt = new Date().toISOString();

        // Step 1: Check if codes are already delivered (idempotency - Requirement 5.5)
        const existingDelivered: DeliveredCode[] = [];
        for (const code of this.codes.values()) {
            if (code.order_id === orderId && code.status === CDKStatus.DELIVERED) {
                existingDelivered.push({ id: code.id, code: code.code });
            }
        }

        // If already delivered, return existing codes (idempotent)
        if (existingDelivered.length > 0) {
            return {
                success: true,
                deliveredCodes: existingDelivered,
                wasAlreadyDelivered: true,
            };
        }

        // Step 2: Find reserved codes for this order
        const reservedCodes: CDKCode[] = [];
        for (const code of this.codes.values()) {
            if (code.order_id === orderId && code.status === CDKStatus.RESERVED) {
                reservedCodes.push(code);
            }
        }

        // No reserved codes found
        if (reservedCodes.length === 0) {
            return {
                success: false,
                deliveredCodes: [],
                error: "没有预留的激活码",
                errorCode: CDKErrorCodes.NO_RESERVED_CODES,
            };
        }

        // Step 3: Update codes to delivered status (Requirement 5.1, 5.2)
        const deliveredCodes: DeliveredCode[] = [];
        for (const code of reservedCodes) {
            code.status = CDKStatus.DELIVERED;
            code.delivered_at = deliveredAt;
            code.updated_at = deliveredAt;
            deliveredCodes.push({ id: code.id, code: code.code });
        }

        return {
            success: true,
            deliveredCodes,
        };
    }

    /**
     * Get delivered codes for an order with ownership verification
     * Requirements: 5.3, 7.4, 9.3
     */
    getDeliveredCodes(orderId: string, userId: string): DeliveredCode[] {
        if (!orderId || !userId) {
            return [];
        }

        // Step 1: Verify order ownership and status
        const order = this.orders.get(orderId);
        if (!order) {
            return [];
        }

        // Ownership verification (Requirement 9.3)
        if (order.user_id !== userId) {
            return [];
        }

        // Check if order is paid (Requirement 7.4)
        const paidStatuses: TestOrderStatus[] = ["paid", "fulfilled", "completed"];
        if (!paidStatuses.includes(order.status)) {
            return [];
        }

        // Step 2: Get delivered codes
        const deliveredCodes: DeliveredCode[] = [];
        for (const code of this.codes.values()) {
            if (code.order_id === orderId && code.status === CDKStatus.DELIVERED) {
                deliveredCodes.push({ id: code.id, code: code.code });
            }
        }

        return deliveredCodes;
    }

    /**
     * Get codes by order ID (for testing)
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
     * Clear all data
     */
    clear(): void {
        this.codes.clear();
        this.orders.clear();
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

const paidOrderStatusArb = fc.constantFrom<TestOrderStatus>("paid", "fulfilled", "completed");
const unpaidOrderStatusArb = fc.constantFrom<TestOrderStatus>("pending", "cancelled");
const allOrderStatusArb = fc.constantFrom<TestOrderStatus>("pending", "paid", "fulfilled", "completed", "cancelled");

// ============================================
// Property Tests
// ============================================

describe("Property 13: Delivery Idempotency", () => {
    let inventory: InMemoryCDKDeliveryInventory;

    beforeEach(() => {
        inventory = new InMemoryCDKDeliveryInventory();
    });

    /**
     * **Feature: cdk-auto-delivery, Property 13: Delivery Idempotency**
     * **Validates: Requirements 5.5**
     *
     * For any order that has already been delivered, subsequent delivery requests
     * should return the same delivered codes without creating duplicates or changing state.
     */
    it("subsequent delivery requests return same codes without duplicates", () => {
        fc.assert(
            fc.property(
                productIdArb,
                orderIdArb,
                codeCountArb,
                (productId, orderId, codeCount) => {
                    inventory.clear();

                    // Setup: Add reserved codes for the order
                    inventory.addReservedCodes(productId, orderId, codeCount);

                    // First delivery
                    const firstResult = inventory.deliverCodes(orderId);
                    expect(firstResult.success).toBe(true);
                    expect(firstResult.deliveredCodes.length).toBe(codeCount);
                    expect(firstResult.wasAlreadyDelivered).toBeUndefined();

                    // Store first delivery codes for comparison
                    const firstDeliveredIds = new Set(firstResult.deliveredCodes.map(c => c.id));
                    const firstDeliveredCodes = new Map(firstResult.deliveredCodes.map(c => [c.id, c.code]));

                    // Second delivery (should be idempotent)
                    const secondResult = inventory.deliverCodes(orderId);
                    expect(secondResult.success).toBe(true);
                    expect(secondResult.wasAlreadyDelivered).toBe(true);
                    expect(secondResult.deliveredCodes.length).toBe(codeCount);

                    // Verify same codes returned
                    const secondDeliveredIds = new Set(secondResult.deliveredCodes.map(c => c.id));
                    expect(secondDeliveredIds).toEqual(firstDeliveredIds);

                    // Verify code content is the same
                    for (const code of secondResult.deliveredCodes) {
                        expect(firstDeliveredCodes.get(code.id)).toBe(code.code);
                    }

                    // Third delivery (still idempotent)
                    const thirdResult = inventory.deliverCodes(orderId);
                    expect(thirdResult.success).toBe(true);
                    expect(thirdResult.wasAlreadyDelivered).toBe(true);
                    expect(thirdResult.deliveredCodes.length).toBe(codeCount);

                    // Verify no duplicate codes in inventory
                    const allCodes = inventory.getCodesByOrderId(orderId);
                    expect(allCodes.length).toBe(codeCount);

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Already delivered codes should not change state on re-delivery
     */
    it("already delivered codes maintain delivered status", () => {
        fc.assert(
            fc.property(
                productIdArb,
                orderIdArb,
                codeCountArb,
                (productId, orderId, codeCount) => {
                    inventory.clear();

                    // Setup: Add already delivered codes
                    inventory.addDeliveredCodes(productId, orderId, codeCount);

                    // Attempt delivery on already delivered order
                    const result = inventory.deliverCodes(orderId);

                    expect(result.success).toBe(true);
                    expect(result.wasAlreadyDelivered).toBe(true);
                    expect(result.deliveredCodes.length).toBe(codeCount);

                    // Verify all codes still in delivered status
                    const codes = inventory.getCodesByOrderId(orderId);
                    for (const code of codes) {
                        expect(code.status).toBe(CDKStatus.DELIVERED);
                    }

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });
});

describe("Property 17: Unpaid Order Content Hiding", () => {
    let inventory: InMemoryCDKDeliveryInventory;

    beforeEach(() => {
        inventory = new InMemoryCDKDeliveryInventory();
    });

    /**
     * **Feature: cdk-auto-delivery, Property 17: Unpaid Order Content Hiding**
     * **Validates: Requirements 7.4, 9.3**
     *
     * For any order that is not in 'paid' or 'completed' status, querying its
     * CDK codes should return no code content (empty or masked).
     */
    it("unpaid orders return no code content", () => {
        fc.assert(
            fc.property(
                productIdArb,
                orderIdArb,
                userIdArb,
                codeCountArb,
                unpaidOrderStatusArb,
                (productId, orderId, userId, codeCount, status) => {
                    inventory.clear();

                    // Setup: Add order with unpaid status
                    inventory.addOrder(orderId, userId, status);
                    inventory.addDeliveredCodes(productId, orderId, codeCount);

                    // Query codes
                    const codes = inventory.getDeliveredCodes(orderId, userId);

                    // Should return empty for unpaid orders
                    expect(codes.length).toBe(0);

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Paid orders should return code content
     */
    it("paid orders return code content", () => {
        fc.assert(
            fc.property(
                productIdArb,
                orderIdArb,
                userIdArb,
                codeCountArb,
                paidOrderStatusArb,
                (productId, orderId, userId, codeCount, status) => {
                    inventory.clear();

                    // Setup: Add order with paid status
                    inventory.addOrder(orderId, userId, status);
                    inventory.addDeliveredCodes(productId, orderId, codeCount);

                    // Query codes
                    const codes = inventory.getDeliveredCodes(orderId, userId);

                    // Should return codes for paid orders
                    expect(codes.length).toBe(codeCount);

                    // Verify code content is present
                    for (const code of codes) {
                        expect(code.code).toBeDefined();
                        expect(code.code.length).toBeGreaterThan(0);
                    }

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Wrong user should not see codes even for paid orders
     */
    it("wrong user cannot access codes", () => {
        fc.assert(
            fc.property(
                productIdArb,
                orderIdArb,
                userIdArb,
                userIdArb,
                codeCountArb,
                paidOrderStatusArb,
                (productId, orderId, ownerId, wrongUserId, codeCount, status) => {
                    // Skip if same user
                    if (ownerId === wrongUserId) return true;

                    inventory.clear();

                    // Setup: Add order owned by ownerId
                    inventory.addOrder(orderId, ownerId, status);
                    inventory.addDeliveredCodes(productId, orderId, codeCount);

                    // Query codes with wrong user
                    const codes = inventory.getDeliveredCodes(orderId, wrongUserId);

                    // Should return empty for wrong user
                    expect(codes.length).toBe(0);

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });
});

describe("Property 18: Re-delivery Prevention", () => {
    let inventory: InMemoryCDKDeliveryInventory;

    beforeEach(() => {
        inventory = new InMemoryCDKDeliveryInventory();
    });

    /**
     * **Feature: cdk-auto-delivery, Property 18: Re-delivery Prevention**
     * **Validates: Requirements 7.3**
     *
     * For any order that has already been delivered, re-delivery requests
     * should be rejected and return the existing delivered codes.
     */
    it("re-delivery returns existing codes without creating new ones", () => {
        fc.assert(
            fc.property(
                productIdArb,
                orderIdArb,
                codeCountArb,
                fc.integer({ min: 1, max: 10 }),
                (productId, orderId, codeCount, redeliveryAttempts) => {
                    inventory.clear();

                    // Setup: Add reserved codes and deliver them
                    inventory.addReservedCodes(productId, orderId, codeCount);
                    const initialResult = inventory.deliverCodes(orderId);
                    expect(initialResult.success).toBe(true);

                    const initialCodeIds = new Set(initialResult.deliveredCodes.map(c => c.id));

                    // Attempt multiple re-deliveries
                    for (let i = 0; i < redeliveryAttempts; i++) {
                        const result = inventory.deliverCodes(orderId);

                        // Should succeed but indicate already delivered
                        expect(result.success).toBe(true);
                        expect(result.wasAlreadyDelivered).toBe(true);

                        // Should return same codes
                        expect(result.deliveredCodes.length).toBe(codeCount);
                        const resultCodeIds = new Set(result.deliveredCodes.map(c => c.id));
                        expect(resultCodeIds).toEqual(initialCodeIds);
                    }

                    // Verify total codes in inventory hasn't changed
                    const allCodes = inventory.getCodesByOrderId(orderId);
                    expect(allCodes.length).toBe(codeCount);

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Delivery of order with no reserved codes should fail gracefully
     */
    it("delivery with no reserved codes fails gracefully", () => {
        fc.assert(
            fc.property(
                orderIdArb,
                (orderId) => {
                    inventory.clear();

                    // No codes added for this order
                    const result = inventory.deliverCodes(orderId);

                    expect(result.success).toBe(false);
                    expect(result.errorCode).toBe(CDKErrorCodes.NO_RESERVED_CODES);
                    expect(result.deliveredCodes.length).toBe(0);

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });
});
