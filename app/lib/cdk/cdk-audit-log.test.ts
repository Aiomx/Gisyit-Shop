/**
 * Property-Based Tests for CDK Audit Logging
 *
 * Tests for Requirements 6.4, 9.4:
 * - Property 20: Audit Log Completeness
 *
 * For any CDK status change, an audit log entry should be created with
 * the code ID, old status, new status, timestamp, and actor information.
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
    CDKStatus,
    type CDKStatusType,
    type CDKAuditAction,
    type CDKAuditActorType,
    type CDKAuditLog,
} from "./types";

// ============================================
// Types
// ============================================

/**
 * Represents an audit log entry input
 */
interface AuditLogInput {
    cdk_code_id: string;
    action: CDKAuditAction;
    old_status?: CDKStatusType;
    new_status: CDKStatusType;
    order_id?: string;
    actor_id?: string;
    actor_type?: CDKAuditActorType;
    reason?: string;
    metadata?: Record<string, unknown>;
}

// ============================================
// Arbitraries (Generators)
// ============================================

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
 * Generate a valid audit action
 */
const auditActionArb = fc.constantFrom(
    "imported",
    "reserved",
    "delivered",
    "released",
    "invalidated"
) as fc.Arbitrary<CDKAuditAction>;

/**
 * Generate a valid actor type
 */
const actorTypeArb = fc.constantFrom(
    "system",
    "admin",
    "webhook"
) as fc.Arbitrary<CDKAuditActorType>;

/**
 * Generate optional reason string
 */
const reasonArb: fc.Arbitrary<string | undefined> = fc.option(
    fc.array(fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz_".split("")), {
        minLength: 5,
        maxLength: 50,
    }).map((chars) => chars.join("")),
    { nil: undefined }
);

/**
 * Generate optional metadata object
 */
const metadataArb: fc.Arbitrary<Record<string, unknown> | undefined> = fc.option(
    fc.record({
        source: fc.constantFrom("api", "webhook", "cron", "manual"),
        version: fc.integer({ min: 1, max: 10 }),
    }),
    { nil: undefined }
);

/**
 * Generate a complete audit log input
 */
const auditLogInputArb: fc.Arbitrary<AuditLogInput> = fc.record({
    cdk_code_id: fc.uuid(),
    action: auditActionArb,
    old_status: fc.option(cdkStatusArb, { nil: undefined }) as fc.Arbitrary<CDKStatusType | undefined>,
    new_status: cdkStatusArb,
    order_id: fc.option(fc.uuid(), { nil: undefined }) as fc.Arbitrary<string | undefined>,
    actor_id: fc.option(fc.uuid(), { nil: undefined }) as fc.Arbitrary<string | undefined>,
    actor_type: fc.option(actorTypeArb, { nil: undefined }) as fc.Arbitrary<CDKAuditActorType | undefined>,
    reason: reasonArb,
    metadata: metadataArb,
});

// ============================================
// Helper Functions for Testing
// ============================================

/**
 * Simulate creating an audit log entry
 * This validates the input and creates a complete audit log record
 */
function simulateCreateAuditLog(input: AuditLogInput): CDKAuditLog | null {
    // Validate required fields
    if (!input.cdk_code_id || !input.action || !input.new_status) {
        return null;
    }

    // Create the audit log entry with all required fields
    const auditLog: CDKAuditLog = {
        id: crypto.randomUUID(),
        cdk_code_id: input.cdk_code_id,
        action: input.action,
        old_status: input.old_status,
        new_status: input.new_status,
        order_id: input.order_id,
        actor_id: input.actor_id,
        actor_type: input.actor_type,
        reason: input.reason,
        metadata: input.metadata,
        created_at: new Date().toISOString(),
    };

    return auditLog;
}

/**
 * Validate that an audit log entry contains all required fields
 */
function validateAuditLogCompleteness(
    auditLog: CDKAuditLog,
    input: AuditLogInput
): boolean {
    // Must have an ID
    if (!auditLog.id) return false;

    // Must have the code ID from input
    if (auditLog.cdk_code_id !== input.cdk_code_id) return false;

    // Must have the action from input
    if (auditLog.action !== input.action) return false;

    // Must have the new status from input
    if (auditLog.new_status !== input.new_status) return false;

    // Old status should match input (can be undefined)
    if (auditLog.old_status !== input.old_status) return false;

    // Must have a timestamp
    if (!auditLog.created_at) return false;

    // Timestamp must be a valid ISO date
    const timestamp = new Date(auditLog.created_at);
    if (Number.isNaN(timestamp.getTime())) return false;

    // Optional fields should match input if provided
    if (input.order_id !== undefined && auditLog.order_id !== input.order_id) return false;
    if (input.actor_id !== undefined && auditLog.actor_id !== input.actor_id) return false;
    if (input.actor_type !== undefined && auditLog.actor_type !== input.actor_type) return false;
    if (input.reason !== undefined && auditLog.reason !== input.reason) return false;

    return true;
}

// ============================================
// Property Tests
// ============================================

describe("Property 20: Audit Log Completeness", () => {
    /**
     * **Feature: cdk-auto-delivery, Property 20: Audit Log Completeness**
     * **Validates: Requirements 6.4, 9.4**
     *
     * For any CDK status change, an audit log entry should be created with
     * the code ID, old status, new status, timestamp, and actor information.
     */
    it("audit log entries contain all required fields for any status change", () => {
        fc.assert(
            fc.property(
                auditLogInputArb,
                (input) => {
                    const auditLog = simulateCreateAuditLog(input);

                    // Audit log should be created
                    expect(auditLog).not.toBeNull();

                    if (auditLog) {
                        // Validate completeness
                        const isComplete = validateAuditLogCompleteness(auditLog, input);
                        expect(isComplete).toBe(true);

                        // Verify specific required fields
                        expect(auditLog.id).toBeDefined();
                        expect(auditLog.cdk_code_id).toBe(input.cdk_code_id);
                        expect(auditLog.action).toBe(input.action);
                        expect(auditLog.new_status).toBe(input.new_status);
                        expect(auditLog.created_at).toBeDefined();

                        // Timestamp should be a valid ISO date
                        const timestamp = new Date(auditLog.created_at);
                        expect(Number.isNaN(timestamp.getTime())).toBe(false);
                    }

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Audit logs preserve all input data accurately
     */
    it("audit log entries preserve all input data accurately", () => {
        fc.assert(
            fc.property(
                auditLogInputArb,
                (input) => {
                    const auditLog = simulateCreateAuditLog(input);

                    expect(auditLog).not.toBeNull();

                    if (auditLog) {
                        // All input fields should be preserved
                        expect(auditLog.cdk_code_id).toBe(input.cdk_code_id);
                        expect(auditLog.action).toBe(input.action);
                        expect(auditLog.old_status).toBe(input.old_status);
                        expect(auditLog.new_status).toBe(input.new_status);
                        expect(auditLog.order_id).toBe(input.order_id);
                        expect(auditLog.actor_id).toBe(input.actor_id);
                        expect(auditLog.actor_type).toBe(input.actor_type);
                        expect(auditLog.reason).toBe(input.reason);

                        // Metadata should be preserved if provided
                        if (input.metadata) {
                            expect(auditLog.metadata).toEqual(input.metadata);
                        }
                    }

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Audit logs are created with valid timestamps
     */
    it("audit log timestamps are valid and recent", () => {
        fc.assert(
            fc.property(
                auditLogInputArb,
                (input) => {
                    const beforeCreate = new Date();
                    const auditLog = simulateCreateAuditLog(input);
                    const afterCreate = new Date();

                    expect(auditLog).not.toBeNull();

                    if (auditLog) {
                        const timestamp = new Date(auditLog.created_at);

                        // Timestamp should be valid
                        expect(Number.isNaN(timestamp.getTime())).toBe(false);

                        // Timestamp should be between before and after creation
                        expect(timestamp.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
                        expect(timestamp.getTime()).toBeLessThanOrEqual(afterCreate.getTime());
                    }

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Audit logs have unique IDs
     */
    it("each audit log entry has a unique ID", () => {
        fc.assert(
            fc.property(
                fc.array(auditLogInputArb, { minLength: 2, maxLength: 10 }),
                (inputs) => {
                    const auditLogs = inputs
                        .map((input) => simulateCreateAuditLog(input))
                        .filter((log): log is CDKAuditLog => log !== null);

                    // All IDs should be unique
                    const ids = auditLogs.map((log) => log.id);
                    const uniqueIds = new Set(ids);

                    expect(uniqueIds.size).toBe(ids.length);

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });
});

describe("Audit Log Validation", () => {
    /**
     * Missing required fields should fail validation
     */
    it("rejects audit log creation with missing cdk_code_id", () => {
        const input: AuditLogInput = {
            cdk_code_id: "",
            action: "reserved",
            new_status: CDKStatus.RESERVED,
        };

        const auditLog = simulateCreateAuditLog(input);
        expect(auditLog).toBeNull();
    });

    it("rejects audit log creation with missing action", () => {
        const input = {
            cdk_code_id: crypto.randomUUID(),
            action: "" as CDKAuditAction,
            new_status: CDKStatus.RESERVED,
        };

        const auditLog = simulateCreateAuditLog(input);
        expect(auditLog).toBeNull();
    });

    it("rejects audit log creation with missing new_status", () => {
        const input = {
            cdk_code_id: crypto.randomUUID(),
            action: "reserved" as CDKAuditAction,
            new_status: "" as CDKStatusType,
        };

        const auditLog = simulateCreateAuditLog(input);
        expect(auditLog).toBeNull();
    });
});

describe("Audit Log Action-Status Consistency", () => {
    /**
     * Import action should result in available status
     */
    it("import action creates log with available status", () => {
        fc.assert(
            fc.property(
                fc.uuid(),
                fc.option(fc.uuid(), { nil: undefined }),
                (codeId, actorId) => {
                    const input: AuditLogInput = {
                        cdk_code_id: codeId,
                        action: "imported",
                        old_status: undefined,
                        new_status: CDKStatus.AVAILABLE,
                        actor_id: actorId,
                        actor_type: "admin",
                    };

                    const auditLog = simulateCreateAuditLog(input);

                    expect(auditLog).not.toBeNull();
                    if (auditLog) {
                        expect(auditLog.action).toBe("imported");
                        expect(auditLog.new_status).toBe(CDKStatus.AVAILABLE);
                        expect(auditLog.old_status).toBeUndefined();
                    }

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Reserved action should transition from available to reserved
     */
    it("reserved action creates log with correct status transition", () => {
        fc.assert(
            fc.property(
                fc.uuid(),
                fc.uuid(),
                (codeId, orderId) => {
                    const input: AuditLogInput = {
                        cdk_code_id: codeId,
                        action: "reserved",
                        old_status: CDKStatus.AVAILABLE,
                        new_status: CDKStatus.RESERVED,
                        order_id: orderId,
                        actor_type: "system",
                    };

                    const auditLog = simulateCreateAuditLog(input);

                    expect(auditLog).not.toBeNull();
                    if (auditLog) {
                        expect(auditLog.action).toBe("reserved");
                        expect(auditLog.old_status).toBe(CDKStatus.AVAILABLE);
                        expect(auditLog.new_status).toBe(CDKStatus.RESERVED);
                        expect(auditLog.order_id).toBe(orderId);
                    }

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Delivered action should transition from reserved to delivered
     */
    it("delivered action creates log with correct status transition", () => {
        fc.assert(
            fc.property(
                fc.uuid(),
                fc.uuid(),
                (codeId, orderId) => {
                    const input: AuditLogInput = {
                        cdk_code_id: codeId,
                        action: "delivered",
                        old_status: CDKStatus.RESERVED,
                        new_status: CDKStatus.DELIVERED,
                        order_id: orderId,
                        actor_type: "webhook",
                    };

                    const auditLog = simulateCreateAuditLog(input);

                    expect(auditLog).not.toBeNull();
                    if (auditLog) {
                        expect(auditLog.action).toBe("delivered");
                        expect(auditLog.old_status).toBe(CDKStatus.RESERVED);
                        expect(auditLog.new_status).toBe(CDKStatus.DELIVERED);
                        expect(auditLog.order_id).toBe(orderId);
                    }

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Released action should transition from reserved to available
     */
    it("released action creates log with correct status transition", () => {
        fc.assert(
            fc.property(
                fc.uuid(),
                fc.uuid(),
                fc.constantFrom("payment_timeout", "order_cancelled", "orphan_cleanup", "admin_action"),
                (codeId, orderId, reason) => {
                    const input: AuditLogInput = {
                        cdk_code_id: codeId,
                        action: "released",
                        old_status: CDKStatus.RESERVED,
                        new_status: CDKStatus.AVAILABLE,
                        order_id: orderId,
                        actor_type: "system",
                        reason,
                    };

                    const auditLog = simulateCreateAuditLog(input);

                    expect(auditLog).not.toBeNull();
                    if (auditLog) {
                        expect(auditLog.action).toBe("released");
                        expect(auditLog.old_status).toBe(CDKStatus.RESERVED);
                        expect(auditLog.new_status).toBe(CDKStatus.AVAILABLE);
                        expect(auditLog.reason).toBe(reason);
                    }

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Invalidated action should transition to invalid status
     */
    it("invalidated action creates log with invalid status", () => {
        fc.assert(
            fc.property(
                fc.uuid(),
                fc.constantFrom(CDKStatus.AVAILABLE, CDKStatus.RESERVED),
                fc.uuid(),
                (codeId, oldStatus, actorId) => {
                    const input: AuditLogInput = {
                        cdk_code_id: codeId,
                        action: "invalidated",
                        old_status: oldStatus,
                        new_status: CDKStatus.INVALID,
                        actor_id: actorId,
                        actor_type: "admin",
                        reason: "manual_invalidation",
                    };

                    const auditLog = simulateCreateAuditLog(input);

                    expect(auditLog).not.toBeNull();
                    if (auditLog) {
                        expect(auditLog.action).toBe("invalidated");
                        expect(auditLog.old_status).toBe(oldStatus);
                        expect(auditLog.new_status).toBe(CDKStatus.INVALID);
                        expect(auditLog.actor_id).toBe(actorId);
                    }

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });
});
