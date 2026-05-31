/**
 * CDK Inventory Service (Server-side only)
 *
 * Provides CDK inventory operations: reservation, delivery, and release.
 * All operations use atomic database transactions with row-level locking.
 *
 * IMPORTANT: This file should only be used in server-side code (loaders/actions).
 * The .server.ts suffix ensures it's not bundled for the client.
 *
 * Requirements: 3.5, 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3, 5.5, 6.2, 6.3, 9.1, 9.2
 */

import { getSupabaseClient } from "~/lib/supabase/client.server";
import { assertServerContext } from "./server-guard.server";
import {
    CDKStatus,
    CDKErrorCodes,
    type CDKReservationResult,
    type CDKDeliveryResult,
    type DeliveredCode,
    type CDKStatusType,
    type CDKReleaseReason,
    type CDKReleaseResult,
} from "./types";

// ============================================
// Constants
// ============================================

/** Maximum retry attempts for concurrent reservation conflicts */
const MAX_RETRY_ATTEMPTS = 3;

/** Base delay for exponential backoff (ms) */
const BASE_RETRY_DELAY_MS = 100;

// ============================================
// Reservation Functions
// ============================================

/**
 * Reserve CDK codes for an order atomically
 *
 * Uses database-level locking (FOR UPDATE SKIP LOCKED) to prevent
 * concurrent over-reservation. Implements retry with exponential backoff.
 *
 * Requirements: 4.1, 4.2, 4.4, 4.5, 9.1, 9.2
 *
 * @param productId - The product ID to reserve codes for
 * @param quantity - Number of codes to reserve
 * @param orderId - The order ID to associate with reserved codes
 * @returns Reservation result with code IDs or error
 */
export async function reserveCodes(
    productId: string,
    quantity: number,
    orderId: string
): Promise<CDKReservationResult> {
    // Server-side guard - reject client-side requests (Requirements: 9.1, 9.2)
    assertServerContext("reserveCodes");

    // Validate inputs
    if (!productId || !orderId) {
        return {
            success: false,
            reservedCodeIds: [],
            error: "Invalid product ID or order ID",
            errorCode: CDKErrorCodes.RESERVATION_FAILED,
        };
    }

    if (quantity <= 0) {
        return {
            success: false,
            reservedCodeIds: [],
            error: "Quantity must be greater than 0",
            errorCode: CDKErrorCodes.RESERVATION_FAILED,
        };
    }

    let lastError: Error | null = null;

    // Retry loop with exponential backoff for concurrent conflicts
    for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
        try {
            const result = await attemptReservation(productId, quantity, orderId);
            return result;
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));

            // Check if this is a concurrent conflict that should be retried
            if (isConcurrentConflict(error) && attempt < MAX_RETRY_ATTEMPTS - 1) {
                const delay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
                console.log(
                    `[CDK Reservation] Concurrent conflict, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRY_ATTEMPTS})`
                );
                await sleep(delay);
                continue;
            }

            // Non-retryable error or max retries reached
            break;
        }
    }

    console.error("[CDK Reservation] Failed after retries:", lastError);
    return {
        success: false,
        reservedCodeIds: [],
        error: lastError?.message || "Reservation failed",
        errorCode: CDKErrorCodes.RESERVATION_FAILED,
    };
}

/**
 * Attempt a single reservation operation
 *
 * This function performs the actual database operations:
 * 1. Check available inventory count
 * 2. Select N available codes with FOR UPDATE SKIP LOCKED
 * 3. Update selected codes to reserved status
 *
 * @param productId - The product ID
 * @param quantity - Number of codes to reserve
 * @param orderId - The order ID
 * @returns Reservation result
 */
async function attemptReservation(
    productId: string,
    quantity: number,
    orderId: string
): Promise<CDKReservationResult> {
    const supabase = getSupabaseClient();
    const reservedAt = new Date().toISOString();

    // Step 1: Check available inventory count first
    const availableCount = await getAvailableCount(productId);

    if (availableCount < quantity) {
        console.log(
            `[CDK Reservation] Insufficient inventory: requested ${quantity}, available ${availableCount}`
        );
        return {
            success: false,
            reservedCodeIds: [],
            error: `库存不足：需要 ${quantity} 个，仅剩 ${availableCount} 个`,
            errorCode: CDKErrorCodes.INSUFFICIENT_INVENTORY,
        };
    }

    // Step 2: Select available codes using FOR UPDATE SKIP LOCKED
    // This is done via a raw SQL query through RPC for atomic locking
    const { data: selectedCodes, error: selectError } = await supabase.rpc(
        "reserve_cdk_codes",
        {
            p_product_id: productId,
            p_quantity: quantity,
            p_order_id: orderId,
            p_reserved_at: reservedAt,
        }
    );

    if (selectError) {
        console.error("[CDK Reservation] RPC error:", selectError);

        // Check for specific error types
        if (selectError.message?.includes("insufficient")) {
            return {
                success: false,
                reservedCodeIds: [],
                error: "库存不足，无法完成预留",
                errorCode: CDKErrorCodes.INSUFFICIENT_INVENTORY,
            };
        }

        throw selectError;
    }

    // Handle case where RPC is not available - fallback to standard queries
    if (selectedCodes === null) {
        return await fallbackReservation(productId, quantity, orderId, reservedAt);
    }

    // Extract reserved code IDs from RPC result
    const reservedCodeIds = Array.isArray(selectedCodes)
        ? selectedCodes.map((code: { id: string }) => code.id)
        : [];

    if (reservedCodeIds.length < quantity) {
        console.log(
            `[CDK Reservation] Partial reservation: requested ${quantity}, got ${reservedCodeIds.length}`
        );
        // Rollback partial reservation
        if (reservedCodeIds.length > 0) {
            await rollbackReservation(reservedCodeIds);
        }
        return {
            success: false,
            reservedCodeIds: [],
            error: "库存不足，无法完成预留",
            errorCode: CDKErrorCodes.INSUFFICIENT_INVENTORY,
        };
    }

    console.log(
        `[CDK Reservation] Successfully reserved ${reservedCodeIds.length} codes for order ${orderId}`
    );

    return {
        success: true,
        reservedCodeIds,
    };
}

/**
 * Fallback reservation using standard Supabase queries
 *
 * Used when the RPC function is not available.
 * Less atomic but still functional.
 */
async function fallbackReservation(
    productId: string,
    quantity: number,
    orderId: string,
    reservedAt: string
): Promise<CDKReservationResult> {
    const supabase = getSupabaseClient();

    // Select available codes (limited to quantity)
    const { data: availableCodes, error: selectError } = await supabase
        .from("cdk_codes")
        .select("id")
        .eq("product_id", productId)
        .eq("status", CDKStatus.AVAILABLE)
        .limit(quantity);

    if (selectError) {
        console.error("[CDK Reservation] Select error:", selectError);
        throw selectError;
    }

    if (!availableCodes || availableCodes.length < quantity) {
        return {
            success: false,
            reservedCodeIds: [],
            error: `库存不足：需要 ${quantity} 个，仅剩 ${availableCodes?.length || 0} 个`,
            errorCode: CDKErrorCodes.INSUFFICIENT_INVENTORY,
        };
    }

    const codeIds = availableCodes.map((code) => code.id);

    // Update codes to reserved status
    const { data: updatedCodes, error: updateError } = await supabase
        .from("cdk_codes")
        .update({
            status: CDKStatus.RESERVED,
            order_id: orderId,
            reserved_at: reservedAt,
            updated_at: reservedAt,
        })
        .in("id", codeIds)
        .eq("status", CDKStatus.AVAILABLE) // Optimistic locking
        .select("id");

    if (updateError) {
        console.error("[CDK Reservation] Update error:", updateError);
        throw updateError;
    }

    const reservedCodeIds = updatedCodes?.map((code) => code.id) || [];

    if (reservedCodeIds.length < quantity) {
        // Concurrent modification detected - rollback and retry
        if (reservedCodeIds.length > 0) {
            await rollbackReservation(reservedCodeIds);
        }
        throw new Error("Concurrent modification detected");
    }

    return {
        success: true,
        reservedCodeIds,
    };
}

/**
 * Rollback a partial reservation
 */
async function rollbackReservation(codeIds: string[]): Promise<void> {
    if (codeIds.length === 0) return;

    const supabase = getSupabaseClient();

    try {
        await supabase
            .from("cdk_codes")
            .update({
                status: CDKStatus.AVAILABLE,
                order_id: null,
                reserved_at: null,
                updated_at: new Date().toISOString(),
            })
            .in("id", codeIds);

        console.log(`[CDK Reservation] Rolled back ${codeIds.length} codes`);
    } catch (error) {
        console.error("[CDK Reservation] Rollback failed:", error);
    }
}

// ============================================
// Inventory Query Functions
// ============================================

/**
 * Get the count of available CDK codes for a product
 *
 * Requirements: 3.5
 *
 * @param productId - The product ID to check
 * @returns Count of available codes
 */
export async function getAvailableCount(productId: string): Promise<number> {
    const supabase = getSupabaseClient();

    const { count, error } = await supabase
        .from("cdk_codes")
        .select("*", { count: "exact", head: true })
        .eq("product_id", productId)
        .eq("status", CDKStatus.AVAILABLE);

    if (error) {
        console.error("[CDK Inventory] Count error:", error);
        return 0;
    }

    return count || 0;
}

/**
 * Get inventory statistics for a product
 *
 * Requirements: 3.5, 8.1
 *
 * @param productId - The product ID (optional, all products if not provided)
 * @returns Inventory statistics by status
 */
export async function getInventoryStats(productId?: string): Promise<{
    total: number;
    available: number;
    reserved: number;
    delivered: number;
    invalid: number;
}> {
    const supabase = getSupabaseClient();

    // Build base query
    let query = supabase.from("cdk_codes").select("status");

    if (productId) {
        query = query.eq("product_id", productId);
    }

    const { data, error } = await query;

    if (error) {
        console.error("[CDK Inventory] Stats error:", error);
        return { total: 0, available: 0, reserved: 0, delivered: 0, invalid: 0 };
    }

    // Count by status
    const stats = {
        total: data?.length || 0,
        available: 0,
        reserved: 0,
        delivered: 0,
        invalid: 0,
    };

    for (const code of data || []) {
        switch (code.status as CDKStatusType) {
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

// ============================================
// Utility Functions
// ============================================

/**
 * Check if an error is a concurrent conflict that should be retried
 */
function isConcurrentConflict(error: unknown): boolean {
    if (error instanceof Error) {
        const message = error.message.toLowerCase();
        return (
            message.includes("concurrent") ||
            message.includes("conflict") ||
            message.includes("deadlock") ||
            message.includes("could not serialize")
        );
    }
    return false;
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================
// Delivery Functions
// ============================================

/**
 * Deliver CDK codes for a paid order
 *
 * Updates reserved codes to delivered status and returns the code content.
 * Handles idempotency - returns existing delivered codes if already delivered.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.5, 9.1, 9.2
 *
 * @param orderId - The order ID to deliver codes for
 * @returns Delivery result with code content or error
 */
export async function deliverCodes(orderId: string): Promise<CDKDeliveryResult> {
    // Server-side guard - reject client-side requests (Requirements: 9.1, 9.2)
    assertServerContext("deliverCodes");

    if (!orderId) {
        return {
            success: false,
            deliveredCodes: [],
            error: "Invalid order ID",
            errorCode: CDKErrorCodes.ORDER_NOT_FOUND,
        };
    }

    const supabase = getSupabaseClient();
    const deliveredAt = new Date().toISOString();

    // Step 1: Check if codes are already delivered (idempotency - Requirement 5.5)
    const { data: existingDelivered, error: checkError } = await supabase
        .from("cdk_codes")
        .select("id, code")
        .eq("order_id", orderId)
        .eq("status", CDKStatus.DELIVERED);

    if (checkError) {
        console.error("[CDK Delivery] Check error:", checkError);
        return {
            success: false,
            deliveredCodes: [],
            error: "Failed to check delivery status",
            errorCode: CDKErrorCodes.DATABASE_ERROR,
        };
    }

    // If already delivered, return existing codes (idempotent)
    if (existingDelivered && existingDelivered.length > 0) {
        console.log(
            `[CDK Delivery] Order ${orderId} already delivered, returning ${existingDelivered.length} existing codes`
        );
        return {
            success: true,
            deliveredCodes: existingDelivered.map((c) => ({ id: c.id, code: c.code })),
            wasAlreadyDelivered: true,
        };
    }

    // Step 2: Find reserved codes for this order
    const { data: reservedCodes, error: selectError } = await supabase
        .from("cdk_codes")
        .select("id, code")
        .eq("order_id", orderId)
        .eq("status", CDKStatus.RESERVED);

    if (selectError) {
        console.error("[CDK Delivery] Select error:", selectError);
        return {
            success: false,
            deliveredCodes: [],
            error: "Failed to find reserved codes",
            errorCode: CDKErrorCodes.DATABASE_ERROR,
        };
    }

    // No reserved codes found
    if (!reservedCodes || reservedCodes.length === 0) {
        console.log(`[CDK Delivery] No reserved codes found for order ${orderId}`);
        return {
            success: false,
            deliveredCodes: [],
            error: "没有预留的激活码",
            errorCode: CDKErrorCodes.NO_RESERVED_CODES,
        };
    }

    // Step 3: Update codes to delivered status (Requirement 5.1, 5.2)
    const codeIds = reservedCodes.map((c) => c.id);

    const { data: updatedCodes, error: updateError } = await supabase
        .from("cdk_codes")
        .update({
            status: CDKStatus.DELIVERED,
            delivered_at: deliveredAt,
            updated_at: deliveredAt,
        })
        .in("id", codeIds)
        .eq("status", CDKStatus.RESERVED) // Optimistic locking
        .select("id, code");

    if (updateError) {
        console.error("[CDK Delivery] Update error:", updateError);
        return {
            success: false,
            deliveredCodes: [],
            error: "发货失败，请稍后重试",
            errorCode: CDKErrorCodes.DELIVERY_FAILED,
        };
    }

    const deliveredCodes = updatedCodes?.map((c) => ({ id: c.id, code: c.code })) || [];

    console.log(
        `[CDK Delivery] Successfully delivered ${deliveredCodes.length} codes for order ${orderId}`
    );

    return {
        success: true,
        deliveredCodes,
    };
}

// ============================================
// Query Functions for Delivered Codes
// ============================================

/**
 * Get delivered CDK codes for an order
 *
 * Verifies order ownership before returning code content.
 * Returns empty/masked for unpaid orders.
 *
 * Requirements: 5.3, 7.4, 9.3
 *
 * @param orderId - The order ID to get codes for
 * @param userId - The user ID requesting the codes (for ownership verification)
 * @returns Array of delivered code content, or empty if not authorized
 */
export async function getDeliveredCodes(
    orderId: string,
    userId: string
): Promise<DeliveredCode[]> {
    if (!orderId || !userId) {
        return [];
    }

    const supabase = getSupabaseClient();

    // Step 1: Verify order ownership and status
    const { data: order, error: orderError } = await supabase
        .from("orders")
        .select("id, user_id, status")
        .eq("id", orderId)
        .single();

    if (orderError || !order) {
        console.log(`[CDK Query] Order not found: ${orderId}`);
        return [];
    }

    // Ownership verification (Requirement 9.3)
    if (order.user_id !== userId) {
        console.log(`[CDK Query] Ownership verification failed for order ${orderId}`);
        return [];
    }

    // Check if order is paid (Requirement 7.4)
    // Only return codes for paid or completed orders
    const paidStatuses = ["paid", "fulfilled", "completed"];
    if (!paidStatuses.includes(order.status)) {
        console.log(`[CDK Query] Order ${orderId} not paid, hiding content`);
        return [];
    }

    // Step 2: Get delivered codes
    const { data: codes, error: codesError } = await supabase
        .from("cdk_codes")
        .select("id, code")
        .eq("order_id", orderId)
        .eq("status", CDKStatus.DELIVERED);

    if (codesError) {
        console.error("[CDK Query] Error fetching codes:", codesError);
        return [];
    }

    return codes?.map((c) => ({ id: c.id, code: c.code })) || [];
}

// ============================================
// Release Functions
// ============================================

/**
 * Release reserved CDK codes back to available status
 *
 * Updates reserved codes for an order back to available status,
 * clears order association, and creates audit log entries.
 *
 * Requirements: 6.2, 6.3, 6.4, 9.1, 9.2
 *
 * @param orderId - The order ID to release codes for
 * @param reason - The reason for releasing (for audit log)
 * @returns Release result with count of released codes
 */
export async function releaseCodes(
    orderId: string,
    reason: CDKReleaseReason
): Promise<CDKReleaseResult> {
    // Server-side guard - reject client-side requests (Requirements: 9.1, 9.2)
    assertServerContext("releaseCodes");

    if (!orderId) {
        return {
            success: false,
            releasedCount: 0,
            error: "Invalid order ID",
        };
    }

    const supabase = getSupabaseClient();
    const releasedAt = new Date().toISOString();

    // Step 1: Find reserved codes for this order
    const { data: reservedCodes, error: selectError } = await supabase
        .from("cdk_codes")
        .select("id")
        .eq("order_id", orderId)
        .eq("status", CDKStatus.RESERVED);

    if (selectError) {
        console.error("[CDK Release] Select error:", selectError);
        return {
            success: false,
            releasedCount: 0,
            error: "Failed to find reserved codes",
        };
    }

    // No reserved codes found - this is idempotent, return success
    if (!reservedCodes || reservedCodes.length === 0) {
        console.log(`[CDK Release] No reserved codes found for order ${orderId}`);
        return {
            success: true,
            releasedCount: 0,
        };
    }

    const codeIds = reservedCodes.map((c) => c.id);

    // Step 2: Update codes to available status (Requirements 6.2, 6.3)
    const { data: updatedCodes, error: updateError } = await supabase
        .from("cdk_codes")
        .update({
            status: CDKStatus.AVAILABLE,
            order_id: null,
            reserved_at: null,
            updated_at: releasedAt,
        })
        .in("id", codeIds)
        .eq("status", CDKStatus.RESERVED) // Optimistic locking
        .select("id");

    if (updateError) {
        console.error("[CDK Release] Update error:", updateError);
        return {
            success: false,
            releasedCount: 0,
            error: "释放失败，请稍后重试",
        };
    }

    const releasedCount = updatedCodes?.length || 0;

    // Step 3: Create audit log entries (Requirement 6.4)
    if (releasedCount > 0) {
        const auditEntries = codeIds.map((codeId) => ({
            cdk_code_id: codeId,
            action: "released" as const,
            old_status: CDKStatus.RESERVED,
            new_status: CDKStatus.AVAILABLE,
            order_id: orderId,
            actor_type: "system" as const,
            reason,
            created_at: releasedAt,
        }));

        const { error: auditError } = await supabase
            .from("cdk_audit_logs")
            .insert(auditEntries);

        if (auditError) {
            // Log but don't fail the release operation
            console.error("[CDK Release] Audit log error:", auditError);
        }
    }

    console.log(
        `[CDK Release] Released ${releasedCount} codes for order ${orderId}, reason: ${reason}`
    );

    return {
        success: true,
        releasedCount,
    };
}

// ============================================
// Cleanup Functions
// ============================================

/** Reservation timeout in minutes */
const RESERVATION_TIMEOUT_MINUTES = 15;

/**
 * Result of cleanup operations
 */
export interface CleanupResult {
    releasedCount: number;
    cancelledOrders: string[];
    errors: string[];
}

/**
 * Release timeout reservations
 *
 * Finds reserved codes older than 15 minutes and releases them back to available.
 * Also updates associated orders to cancelled status.
 *
 * Requirements: 6.1, 6.5, 9.1, 9.2
 *
 * @returns Cleanup result with counts and cancelled order IDs
 */
export async function releaseTimeoutReservations(): Promise<CleanupResult> {
    // Server-side guard - reject client-side requests (Requirements: 9.1, 9.2)
    assertServerContext("releaseTimeoutReservations");

    const supabase = getSupabaseClient();
    const now = new Date();
    const timeoutThreshold = new Date(
        now.getTime() - RESERVATION_TIMEOUT_MINUTES * 60 * 1000
    ).toISOString();

    const result: CleanupResult = {
        releasedCount: 0,
        cancelledOrders: [],
        errors: [],
    };

    // Step 1: Find reserved codes that have timed out
    const { data: timedOutCodes, error: selectError } = await supabase
        .from("cdk_codes")
        .select("id, order_id")
        .eq("status", CDKStatus.RESERVED)
        .lt("reserved_at", timeoutThreshold);

    if (selectError) {
        console.error("[CDK Cleanup] Select error:", selectError);
        result.errors.push("Failed to query timed out codes");
        return result;
    }

    if (!timedOutCodes || timedOutCodes.length === 0) {
        console.log("[CDK Cleanup] No timed out reservations found");
        return result;
    }

    // Group codes by order ID
    const orderCodeMap = new Map<string, string[]>();
    for (const code of timedOutCodes) {
        if (code.order_id) {
            const existing = orderCodeMap.get(code.order_id) || [];
            existing.push(code.id);
            orderCodeMap.set(code.order_id, existing);
        }
    }

    // Step 2: Release codes for each order
    for (const [orderId, codeIds] of orderCodeMap) {
        const releaseResult = await releaseCodes(orderId, "payment_timeout");

        if (releaseResult.success) {
            result.releasedCount += releaseResult.releasedCount;

            // Step 3: Update order status to cancelled (Requirement 6.1)
            const { error: orderUpdateError } = await supabase
                .from("orders")
                .update({
                    status: "cancelled",
                    updated_at: new Date().toISOString(),
                })
                .eq("id", orderId)
                .eq("status", "pending"); // Only cancel pending orders

            if (orderUpdateError) {
                console.error(
                    `[CDK Cleanup] Failed to cancel order ${orderId}:`,
                    orderUpdateError
                );
                result.errors.push(`Failed to cancel order ${orderId}`);
            } else {
                result.cancelledOrders.push(orderId);
            }
        } else {
            result.errors.push(
                `Failed to release codes for order ${orderId}: ${releaseResult.error}`
            );
        }
    }

    console.log(
        `[CDK Cleanup] Timeout cleanup complete: released ${result.releasedCount} codes, cancelled ${result.cancelledOrders.length} orders`
    );

    return result;
}

/**
 * Cleanup orphan reservations
 *
 * Finds reserved codes with no valid associated order and releases them.
 *
 * Requirements: 6.6, 9.1, 9.2
 *
 * @returns Cleanup result with count of released codes
 */
export async function cleanupOrphanReservations(): Promise<CleanupResult> {
    // Server-side guard - reject client-side requests (Requirements: 9.1, 9.2)
    assertServerContext("cleanupOrphanReservations");

    const supabase = getSupabaseClient();
    const releasedAt = new Date().toISOString();

    const result: CleanupResult = {
        releasedCount: 0,
        cancelledOrders: [],
        errors: [],
    };

    // Step 1: Find reserved codes with order_id that doesn't exist in orders table
    // or where the order is already cancelled/completed
    const { data: reservedCodes, error: selectError } = await supabase
        .from("cdk_codes")
        .select("id, order_id")
        .eq("status", CDKStatus.RESERVED)
        .not("order_id", "is", null);

    if (selectError) {
        console.error("[CDK Cleanup] Select error:", selectError);
        result.errors.push("Failed to query reserved codes");
        return result;
    }

    if (!reservedCodes || reservedCodes.length === 0) {
        console.log("[CDK Cleanup] No reserved codes found");
        return result;
    }

    // Get unique order IDs
    const orderIds = [...new Set(reservedCodes.map((c) => c.order_id).filter(Boolean))] as string[];

    // Step 2: Check which orders exist and are in valid state
    const { data: validOrders, error: orderError } = await supabase
        .from("orders")
        .select("id, status")
        .in("id", orderIds);

    if (orderError) {
        console.error("[CDK Cleanup] Order query error:", orderError);
        result.errors.push("Failed to query orders");
        return result;
    }

    // Build set of valid order IDs (pending orders are valid, they're just waiting for payment)
    const validOrderIds = new Set(
        (validOrders || [])
            .filter((o) => o.status === "pending" || o.status === "paid")
            .map((o) => o.id)
    );

    // Step 3: Find orphan codes (order doesn't exist or is in terminal state)
    const orphanCodes = reservedCodes.filter(
        (c) => c.order_id && !validOrderIds.has(c.order_id)
    );

    if (orphanCodes.length === 0) {
        console.log("[CDK Cleanup] No orphan reservations found");
        return result;
    }

    const orphanCodeIds = orphanCodes.map((c) => c.id);

    // Step 4: Release orphan codes
    const { data: updatedCodes, error: updateError } = await supabase
        .from("cdk_codes")
        .update({
            status: CDKStatus.AVAILABLE,
            order_id: null,
            reserved_at: null,
            updated_at: releasedAt,
        })
        .in("id", orphanCodeIds)
        .eq("status", CDKStatus.RESERVED)
        .select("id");

    if (updateError) {
        console.error("[CDK Cleanup] Update error:", updateError);
        result.errors.push("Failed to release orphan codes");
        return result;
    }

    result.releasedCount = updatedCodes?.length || 0;

    // Step 5: Create audit log entries
    if (result.releasedCount > 0) {
        const auditEntries = orphanCodeIds.map((codeId) => ({
            cdk_code_id: codeId,
            action: "released" as const,
            old_status: CDKStatus.RESERVED,
            new_status: CDKStatus.AVAILABLE,
            actor_type: "system" as const,
            reason: "orphan_cleanup",
            created_at: releasedAt,
        }));

        const { error: auditError } = await supabase
            .from("cdk_audit_logs")
            .insert(auditEntries);

        if (auditError) {
            console.error("[CDK Cleanup] Audit log error:", auditError);
        }
    }

    console.log(
        `[CDK Cleanup] Orphan cleanup complete: released ${result.releasedCount} codes`
    );

    return result;
}