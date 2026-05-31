/**
 * Download Permission Verification (Server-side only)
 *
 * Handles verification of user download permissions based on order status.
 * Users can only download files for products they have purchased with valid order status.
 *
 * Requirements: 5.1, 5.2, 5.3
 */

import { getSupabaseClient } from "~/lib/supabase/client.server";
import { getUserSession } from "~/lib/auth/session.server";
import type { DownloadPermission, DownloadDenialReason } from "./types";
import { VALID_DOWNLOAD_ORDER_STATUSES } from "./types";
import type { OrderStatus } from "~/lib/supabase/types";

// ============================================
// Permission Verification Types
// ============================================

/**
 * Parameters for checking download permission
 */
export interface CheckPermissionParams {
    request: Request;
    productId: string;
}

/**
 * Result of permission check with additional context
 */
export interface PermissionCheckResult {
    permission: DownloadPermission;
    userId?: string;
}

// ============================================
// Core Permission Logic
// ============================================

/**
 * Check if an order status grants download permission
 *
 * Valid statuses: 'paid', 'fulfilled', 'completed'
 *
 * Requirements: 5.2
 *
 * @param status - Order status to check
 * @returns True if status grants download permission
 */
export function isValidDownloadOrderStatus(status: OrderStatus | null | undefined): boolean {
    if (!status) {
        return false;
    }
    return VALID_DOWNLOAD_ORDER_STATUSES.includes(status);
}

/**
 * Create a download permission result
 *
 * @param allowed - Whether download is allowed
 * @param reason - Reason for denial (if not allowed)
 * @param orderId - Order ID (if allowed)
 * @returns DownloadPermission object
 */
export function createPermissionResult(
    allowed: boolean,
    reason?: DownloadDenialReason,
    orderId?: string
): DownloadPermission {
    if (allowed) {
        return { allowed: true, order_id: orderId };
    }
    return { allowed: false, reason };
}

/**
 * Check download permission based on user ID, product ID, and order status
 *
 * This is the core permission logic that can be used for testing.
 * It determines if a user should be allowed to download based on:
 * 1. User authentication (userId must be present)
 * 2. Order existence (hasOrder must be true)
 * 3. Order status (must be 'paid', 'fulfilled', or 'completed')
 *
 * Requirements: 5.1, 5.2, 5.3
 *
 * @param userId - User ID (null if not authenticated)
 * @param productId - Product ID to check permission for
 * @param orderStatus - Order status (null if no order exists)
 * @returns DownloadPermission result
 */
export function checkDownloadPermissionLogic(
    userId: string | null,
    productId: string,
    orderStatus: OrderStatus | null
): DownloadPermission {
    // Check authentication
    // Requirements: 5.3
    if (!userId) {
        return createPermissionResult(false, "no_auth");
    }

    // Check if order exists
    // Requirements: 5.1
    if (orderStatus === null) {
        return createPermissionResult(false, "no_purchase");
    }

    // Check order status
    // Requirements: 5.2
    if (!isValidDownloadOrderStatus(orderStatus)) {
        return createPermissionResult(false, "invalid_order_status");
    }

    // Permission granted
    return createPermissionResult(true);
}

// ============================================
// Database Query Functions
// ============================================

/**
 * Query for a valid order containing the specified product
 *
 * Searches for orders that:
 * 1. Belong to the specified user
 * 2. Contain the specified product
 * 3. Have a valid download status (paid, fulfilled, completed)
 *
 * @param userId - User ID to check orders for
 * @param productId - Product ID to find in orders
 * @returns Order ID and status if found, null otherwise
 */
export async function findValidOrderForProduct(
    userId: string,
    productId: string
): Promise<{ orderId: string; status: OrderStatus } | null> {
    const supabase = getSupabaseClient();

    // Query orders with items containing the product
    // Join orders with order_items to find matching products
    const { data: orderItems, error } = await supabase
        .from("order_items")
        .select(`
            order_id,
            orders!inner (
                id,
                user_id,
                status
            )
        `)
        .eq("product_id", productId)
        .eq("orders.user_id", userId);

    if (error) {
        console.error("[Permission] Failed to query orders:", error);
        return null;
    }

    if (!orderItems || orderItems.length === 0) {
        return null;
    }

    // Find the first order with a valid download status
    for (const item of orderItems) {
        const order = item.orders as unknown as { id: string; user_id: string; status: OrderStatus };
        if (order && isValidDownloadOrderStatus(order.status)) {
            return {
                orderId: order.id,
                status: order.status,
            };
        }
    }

    // No valid order found (orders exist but none have valid status)
    return null;
}

// ============================================
// Main Permission Check Function
// ============================================

/**
 * Check if a user has permission to download files for a product
 *
 * This is the main entry point for permission verification.
 * It handles:
 * 1. Session validation (Requirements: 5.3)
 * 2. Order lookup (Requirements: 5.1)
 * 3. Status validation (Requirements: 5.2)
 *
 * @param params - Request and product ID
 * @returns Permission check result with user context
 */
export async function checkDownloadPermission(
    params: CheckPermissionParams
): Promise<PermissionCheckResult> {
    const { request, productId } = params;

    // Step 1: Check user authentication
    // Requirements: 5.3
    const session = await getUserSession(request);

    if (!session) {
        return {
            permission: createPermissionResult(false, "no_auth"),
        };
    }

    // Get user ID from session token
    // We need to decode the JWT to get the user ID
    const userId = await getUserIdFromSession(session.access_token);

    if (!userId) {
        return {
            permission: createPermissionResult(false, "no_auth"),
        };
    }

    // Step 2: Query for valid order
    // Requirements: 5.1, 5.2
    const orderResult = await findValidOrderForProduct(userId, productId);

    if (!orderResult) {
        // Check if user has any order for this product (to distinguish no_purchase vs invalid_status)
        const hasAnyOrder = await hasOrderForProduct(userId, productId);

        if (hasAnyOrder) {
            return {
                permission: createPermissionResult(false, "invalid_order_status"),
                userId,
            };
        }

        return {
            permission: createPermissionResult(false, "no_purchase"),
            userId,
        };
    }

    // Permission granted
    return {
        permission: createPermissionResult(true, undefined, orderResult.orderId),
        userId,
    };
}

/**
 * Check if user has any order (regardless of status) for a product
 *
 * Used to distinguish between "no purchase" and "invalid order status" errors.
 *
 * @param userId - User ID
 * @param productId - Product ID
 * @returns True if any order exists
 */
async function hasOrderForProduct(
    userId: string,
    productId: string
): Promise<boolean> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
        .from("order_items")
        .select(`
            order_id,
            orders!inner (
                id,
                user_id
            )
        `)
        .eq("product_id", productId)
        .eq("orders.user_id", userId)
        .limit(1);

    if (error) {
        console.error("[Permission] Failed to check order existence:", error);
        return false;
    }

    return data !== null && data.length > 0;
}

/**
 * Extract user ID from JWT access token
 *
 * @param accessToken - JWT access token
 * @returns User ID or null if invalid
 */
async function getUserIdFromSession(accessToken: string): Promise<string | null> {
    try {
        // Decode JWT payload (base64)
        const parts = accessToken.split(".");
        if (parts.length !== 3) {
            return null;
        }

        const payload = JSON.parse(atob(parts[1]));
        return payload.sub || null;
    } catch {
        console.error("[Permission] Failed to decode access token");
        return null;
    }
}

/**
 * Verify download permission for a specific file
 *
 * Convenience function that checks permission and returns a simple boolean.
 *
 * @param request - HTTP request
 * @param productId - Product ID
 * @returns True if download is allowed
 */
export async function canDownloadFile(
    request: Request,
    productId: string
): Promise<boolean> {
    const result = await checkDownloadPermission({ request, productId });
    return result.permission.allowed;
}
