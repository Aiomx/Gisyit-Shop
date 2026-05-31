/**
 * CDK Audit Logging Service (Server-side only)
 *
 * Provides audit logging for CDK status changes.
 * All audit operations are server-side only.
 *
 * IMPORTANT: This file should only be used in server-side code (loaders/actions).
 * The .server.ts suffix ensures it's not bundled for the client.
 *
 * Requirements: 6.4, 9.4, 9.1, 9.2
 */

import { getSupabaseClient } from "~/lib/supabase/client.server";
import { assertServerContext } from "./server-guard.server";
import {
    type CDKAuditAction,
    type CDKAuditActorType,
    type CDKStatusType,
    type CDKAuditLog,
} from "./types";

// ============================================
// Types
// ============================================

/**
 * Input for creating an audit log entry
 */
export interface CreateAuditLogInput {
    /** The CDK code ID being audited */
    cdk_code_id: string;
    /** The action being performed */
    action: CDKAuditAction;
    /** The previous status (optional for imports) */
    old_status?: CDKStatusType;
    /** The new status after the action */
    new_status: CDKStatusType;
    /** Associated order ID (optional) */
    order_id?: string;
    /** The actor performing the action (optional) */
    actor_id?: string;
    /** The type of actor */
    actor_type?: CDKAuditActorType;
    /** Reason for the action (optional) */
    reason?: string;
    /** Additional metadata (optional) */
    metadata?: Record<string, unknown>;
}

/**
 * Result of creating an audit log entry
 */
export interface CreateAuditLogResult {
    success: boolean;
    auditLogId?: string;
    error?: string;
}

/**
 * Result of creating multiple audit log entries
 */
export interface CreateBatchAuditLogResult {
    success: boolean;
    createdCount: number;
    error?: string;
}

// ============================================
// Audit Log Functions
// ============================================

/**
 * Create a single audit log entry for a CDK status change
 *
 * Records the code_id, action, old_status, new_status, order_id, actor, and timestamp.
 *
 * Requirements: 6.4, 9.4, 9.1, 9.2
 *
 * @param input - The audit log entry data
 * @returns Result with the created audit log ID or error
 */
export async function createAuditLog(
    input: CreateAuditLogInput
): Promise<CreateAuditLogResult> {
    // Server-side guard - reject client-side requests (Requirements: 9.1, 9.2)
    assertServerContext("createAuditLog");

    // Validate required fields
    if (!input.cdk_code_id) {
        return {
            success: false,
            error: "CDK code ID is required",
        };
    }

    if (!input.action) {
        return {
            success: false,
            error: "Action is required",
        };
    }

    if (!input.new_status) {
        return {
            success: false,
            error: "New status is required",
        };
    }

    const supabase = getSupabaseClient();
    const createdAt = new Date().toISOString();

    const auditEntry = {
        cdk_code_id: input.cdk_code_id,
        action: input.action,
        old_status: input.old_status,
        new_status: input.new_status,
        order_id: input.order_id,
        actor_id: input.actor_id,
        actor_type: input.actor_type,
        reason: input.reason,
        metadata: input.metadata,
        created_at: createdAt,
    };

    const { data, error } = await supabase
        .from("cdk_audit_logs")
        .insert(auditEntry)
        .select("id")
        .single();

    if (error) {
        console.error("[CDK Audit] Failed to create audit log:", error);
        return {
            success: false,
            error: `Failed to create audit log: ${error.message}`,
        };
    }

    console.log(
        `[CDK Audit] Created audit log for code ${input.cdk_code_id}: ${input.action} (${input.old_status || "none"} -> ${input.new_status})`
    );

    return {
        success: true,
        auditLogId: data?.id,
    };
}

/**
 * Create multiple audit log entries in a batch
 *
 * Useful for bulk operations like releasing multiple codes.
 *
 * Requirements: 6.4, 9.4, 9.1, 9.2
 *
 * @param inputs - Array of audit log entry data
 * @returns Result with count of created entries or error
 */
export async function createBatchAuditLogs(
    inputs: CreateAuditLogInput[]
): Promise<CreateBatchAuditLogResult> {
    // Server-side guard - reject client-side requests (Requirements: 9.1, 9.2)
    assertServerContext("createBatchAuditLogs");

    if (!inputs || inputs.length === 0) {
        return {
            success: true,
            createdCount: 0,
        };
    }

    // Validate all inputs
    for (const input of inputs) {
        if (!input.cdk_code_id || !input.action || !input.new_status) {
            return {
                success: false,
                createdCount: 0,
                error: "All entries must have cdk_code_id, action, and new_status",
            };
        }
    }

    const supabase = getSupabaseClient();
    const createdAt = new Date().toISOString();

    const auditEntries = inputs.map((input) => ({
        cdk_code_id: input.cdk_code_id,
        action: input.action,
        old_status: input.old_status,
        new_status: input.new_status,
        order_id: input.order_id,
        actor_id: input.actor_id,
        actor_type: input.actor_type,
        reason: input.reason,
        metadata: input.metadata,
        created_at: createdAt,
    }));

    const { data, error } = await supabase
        .from("cdk_audit_logs")
        .insert(auditEntries)
        .select("id");

    if (error) {
        console.error("[CDK Audit] Failed to create batch audit logs:", error);
        return {
            success: false,
            createdCount: 0,
            error: `Failed to create audit logs: ${error.message}`,
        };
    }

    const createdCount = data?.length || 0;
    console.log(`[CDK Audit] Created ${createdCount} audit log entries`);

    return {
        success: true,
        createdCount,
    };
}

/**
 * Get audit logs for a specific CDK code
 *
 * @param cdkCodeId - The CDK code ID to get logs for
 * @param limit - Maximum number of logs to return (default 50)
 * @returns Array of audit log entries
 */
export async function getAuditLogsForCode(
    cdkCodeId: string,
    limit = 50
): Promise<CDKAuditLog[]> {
    if (!cdkCodeId) {
        return [];
    }

    const supabase = getSupabaseClient();

    const { data, error } = await supabase
        .from("cdk_audit_logs")
        .select("*")
        .eq("cdk_code_id", cdkCodeId)
        .order("created_at", { ascending: false })
        .limit(limit);

    if (error) {
        console.error("[CDK Audit] Failed to get audit logs:", error);
        return [];
    }

    return (data as CDKAuditLog[]) || [];
}

/**
 * Get audit logs for a specific order
 *
 * @param orderId - The order ID to get logs for
 * @param limit - Maximum number of logs to return (default 100)
 * @returns Array of audit log entries
 */
export async function getAuditLogsForOrder(
    orderId: string,
    limit = 100
): Promise<CDKAuditLog[]> {
    if (!orderId) {
        return [];
    }

    const supabase = getSupabaseClient();

    const { data, error } = await supabase
        .from("cdk_audit_logs")
        .select("*")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false })
        .limit(limit);

    if (error) {
        console.error("[CDK Audit] Failed to get audit logs for order:", error);
        return [];
    }

    return (data as CDKAuditLog[]) || [];
}
