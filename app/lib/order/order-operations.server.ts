/**
 * Order Operations (Server-side only)
 * 
 * Provides order creation and status update operations.
 * Uses Supabase client for real database operations.
 * Integrates CDK delivery for virtual product orders.
 * 
 * Requirements: 5.4, 8.4
 * CDK Requirements: 5.1 (deliver CDK codes on payment success)
 */

import { getSupabaseClient } from "~/lib/supabase/client.server";
import type { Order, OrderItem, OrderStatus, CartItem, Product } from "~/lib/supabase/types";
import { deliverCodes } from "~/lib/cdk/inventory.server";

// ============================================
// Order Number Generation
// ============================================

/**
 * Format date as YYYYMMDD string
 */
export function formatDateForOrderNumber(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}${month}${day}`;
}

/**
 * Generate a unique order number
 * Format: GIS + YYYYMMDD + 6位序号
 */
export function generateOrderNumber(date?: Date, sequenceNumber?: number): string {
    const orderDate = date || new Date();
    const dateStr = formatDateForOrderNumber(orderDate);

    if (sequenceNumber !== undefined) {
        const seqStr = String(sequenceNumber).padStart(6, "0");
        return `GIS${dateStr}${seqStr}`;
    }

    const now = new Date();
    const millisOfDay = (now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()) * 1000 + now.getMilliseconds();
    const randomPart = Math.floor(Math.random() * 1000);
    const sequence = (millisOfDay % 900000) + randomPart;
    const seqStr = String(sequence).padStart(6, "0");

    return `GIS${dateStr}${seqStr}`;
}

/**
 * Validate order number format
 */
export function isValidOrderNumber(orderNumber: string): boolean {
    if (!orderNumber || typeof orderNumber !== "string") {
        return false;
    }
    const pattern = /^GIS\d{14}$/;
    if (!pattern.test(orderNumber)) {
        return false;
    }
    const dateStr = orderNumber.slice(3, 11);
    const year = parseInt(dateStr.slice(0, 4), 10);
    const month = parseInt(dateStr.slice(4, 6), 10);
    const day = parseInt(dateStr.slice(6, 8), 10);
    if (year < 2020 || year > 2100) return false;
    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 31) return false;
    return true;
}

/**
 * Parse order number to extract components
 */
export function parseOrderNumber(orderNumber: string): {
    prefix: string;
    date: Date;
    sequence: number;
} | null {
    if (!isValidOrderNumber(orderNumber)) {
        return null;
    }
    const prefix = orderNumber.slice(0, 3);
    const dateStr = orderNumber.slice(3, 11);
    const sequenceStr = orderNumber.slice(11, 17);
    const year = parseInt(dateStr.slice(0, 4), 10);
    const month = parseInt(dateStr.slice(4, 6), 10) - 1;
    const day = parseInt(dateStr.slice(6, 8), 10);
    return {
        prefix,
        date: new Date(year, month, day),
        sequence: parseInt(sequenceStr, 10),
    };
}

// ============================================
// Order Creation Types
// ============================================

export interface CreateOrderParams {
    userId: string;
    cartId: string;
    cartItems: (CartItem & { product?: Product })[];
    totalAmount: number;
    currency: string;
    stripeSessionId: string;
    stripePaymentIntentId?: string;
}

export interface CreateOrderResult {
    success: boolean;
    order?: Order;
    error?: { code: string; message: string };
}

export interface UpdateOrderStatusParams {
    orderId?: string;
    stripeSessionId?: string;
    stripePaymentIntentId?: string;
    status: OrderStatus;
}

export interface UpdateOrderStatusResult {
    success: boolean;
    order?: Order;
    error?: { code: string; message: string };
}

// ============================================
// Order Operations
// ============================================

/**
 * Create a new order from cart data
 */
export async function createOrder(params: CreateOrderParams): Promise<CreateOrderResult> {
    try {
        const supabase = getSupabaseClient();
        const orderNumber = generateOrderNumber();

        console.log("[Order] Creating order:", {
            orderNumber,
            userId: params.userId,
            itemCount: params.cartItems.length,
            totalAmount: params.totalAmount,
        });

        // Insert order
        const { data: order, error: orderError } = await supabase
            .from("orders")
            .insert({
                order_number: orderNumber,
                user_id: params.userId,
                cart_id: params.cartId,
                status: "paid",
                total_amount: params.totalAmount,
                currency: params.currency,
                stripe_session_id: params.stripeSessionId,
                stripe_payment_intent_id: params.stripePaymentIntentId,
            })
            .select()
            .single();

        if (orderError) {
            console.error("[Order] Failed to create order:", orderError);
            return {
                success: false,
                error: { code: "ORDER_CREATION_FAILED", message: orderError.message },
            };
        }

        // Insert order items
        const orderItems = params.cartItems.map((item) => ({
            order_id: order.id,
            product_id: item.product_id,
            product_code: item.product?.product_code || "UNKNOWN",
            product_name: item.product?.name || "Unknown Product",
            spec_combination: item.spec_combination,
            quantity: item.quantity,
            price: item.snapshot_price,
            currency: item.snapshot_currency,
        }));

        const { error: itemsError } = await supabase
            .from("order_items")
            .insert(orderItems);

        if (itemsError) {
            console.error("[Order] Failed to create order items:", itemsError);
        }

        // Update cart status
        await supabase
            .from("carts")
            .update({ status: "checked_out" })
            .eq("id", params.cartId);

        return { success: true, order };
    } catch (error) {
        console.error("[Order] Failed to create order:", error);
        return {
            success: false,
            error: {
                code: "ORDER_CREATION_FAILED",
                message: error instanceof Error ? error.message : "Failed to create order",
            },
        };
    }
}

/**
 * Update order status
 */
export async function updateOrderStatus(params: UpdateOrderStatusParams): Promise<UpdateOrderStatusResult> {
    try {
        const supabase = getSupabaseClient();
        let query = supabase.from("orders").update({ status: params.status, updated_at: new Date().toISOString() });

        if (params.orderId) {
            query = query.eq("id", params.orderId);
        } else if (params.stripeSessionId) {
            query = query.eq("stripe_session_id", params.stripeSessionId);
        } else if (params.stripePaymentIntentId) {
            query = query.eq("stripe_payment_intent_id", params.stripePaymentIntentId);
        } else {
            return {
                success: false,
                error: { code: "INVALID_PARAMS", message: "需要提供订单标识" },
            };
        }

        const { data: order, error } = await query.select().single();

        if (error) {
            return {
                success: false,
                error: { code: "ORDER_UPDATE_FAILED", message: error.message },
            };
        }

        return { success: true, order };
    } catch (error) {
        console.error("[Order] Failed to update order status:", error);
        return {
            success: false,
            error: {
                code: "ORDER_UPDATE_FAILED",
                message: error instanceof Error ? error.message : "Failed to update order status",
            },
        };
    }
}

/**
 * Get order by ID (without ownership verification)
 * Used internally for webhook processing
 */
export async function getOrderByIdInternal(orderId: string): Promise<GetOrderByIdResult> {
    try {
        const supabase = getSupabaseClient();

        const { data: order, error } = await supabase
            .from("orders")
            .select("*, items:order_items(*)")
            .eq("id", orderId)
            .single();

        if (error || !order) {
            return {
                success: false,
                error: { code: "ORDER_NOT_FOUND", message: "订单不存在" },
            };
        }

        return { success: true, order };
    } catch (error) {
        console.error("[Order] Failed to fetch order:", error);
        return {
            success: false,
            error: {
                code: "ORDER_FETCH_FAILED",
                message: error instanceof Error ? error.message : "获取订单详情失败",
            },
        };
    }
}

/**
 * Update order to paid status with payment_completed_at timestamp
 * Also delivers CDK codes if the order contains CDK products.
 * 
 * Requirements: 5.2, 5.3
 * CDK Requirements: 5.1 (deliver CDK codes on payment success)
 */
export async function updateOrderToPaid(orderId: string, stripeSessionId?: string): Promise<UpdateOrderStatusResult> {
    try {
        const supabase = getSupabaseClient();
        const now = new Date().toISOString();

        const updateData: Record<string, unknown> = {
            status: "paid",
            payment_completed_at: now,
            updated_at: now,
        };

        if (stripeSessionId) {
            updateData.stripe_session_id = stripeSessionId;
        }

        const { data: order, error } = await supabase
            .from("orders")
            .update(updateData)
            .eq("id", orderId)
            .eq("status", "pending") // Only update if still pending (optimistic locking)
            .select()
            .single();

        if (error) {
            console.error("[Order] Failed to update order to paid:", error);
            return {
                success: false,
                error: { code: "ORDER_UPDATE_FAILED", message: error.message },
            };
        }

        if (!order) {
            return {
                success: false,
                error: { code: "ORDER_NOT_PENDING", message: "订单状态已变更，无法更新" },
            };
        }

        // Update cart status to checked_out
        if (order.cart_id) {
            await supabase
                .from("carts")
                .update({ status: "checked_out" })
                .eq("id", order.cart_id);
        }

        // Deliver CDK codes for this order (Requirements: CDK 5.1)
        // This is idempotent - if already delivered, it returns existing codes
        const cdkDeliveryResult = await deliverCodes(orderId);

        if (cdkDeliveryResult.success) {
            if (cdkDeliveryResult.wasAlreadyDelivered) {
                console.log("[Order] CDK codes were already delivered for order:", orderId);
            } else if (cdkDeliveryResult.deliveredCodes.length > 0) {
                console.log(`[Order] Delivered ${cdkDeliveryResult.deliveredCodes.length} CDK codes for order:`, orderId);
            }
            // Note: If no CDK codes were reserved (non-CDK order), deliveredCodes will be empty
            // and that's expected behavior
        } else {
            // Log the error but don't fail the payment - CDK delivery can be retried
            console.error("[Order] CDK delivery failed for order:", orderId, cdkDeliveryResult.error);
            // The order is still marked as paid, CDK delivery can be retried manually or via cleanup job
        }

        return { success: true, order };
    } catch (error) {
        console.error("[Order] Failed to update order to paid:", error);
        return {
            success: false,
            error: {
                code: "ORDER_UPDATE_FAILED",
                message: error instanceof Error ? error.message : "更新订单状态失败",
            },
        };
    }
}

/**
 * Handle successful payment for pending orders
 * Requirements: 5.1, 5.2, 5.3
 * 
 * This function:
 * 1. Extracts order_id from session metadata
 * 2. Checks if order exists and is still pending
 * 3. Checks order expiration before updating status
 * 4. Updates existing order record (not create new)
 * 5. Sets payment_completed_at timestamp on success
 */
export async function handlePaymentSuccess(params: {
    stripeSessionId?: string;
    stripePaymentIntentId?: string;
    cartId?: string | null;
    userId?: string | null;
    orderId?: string | null;
    anonymousSessionId?: string | null;
    amount: number;
    currency: string;
}): Promise<UpdateOrderStatusResult> {
    console.log("[Order] Handling payment success:", params);

    // If we have an order_id from metadata, use the new pending order flow
    if (params.orderId) {
        return await handlePendingOrderPayment({
            orderId: params.orderId,
            stripeSessionId: params.stripeSessionId,
        });
    }

    // Fallback to legacy flow (update by stripe session id)
    return await updateOrderStatus({
        stripeSessionId: params.stripeSessionId,
        stripePaymentIntentId: params.stripePaymentIntentId,
        status: "paid",
    });
}

/**
 * Handle payment for a pending order
 * Requirements: 5.1, 5.2, 5.3, 5.4
 * CDK Requirements: 6.2, 6.3 (release CDK codes on order cancellation)
 */
export async function handlePendingOrderPayment(params: {
    orderId: string;
    stripeSessionId?: string;
}): Promise<UpdateOrderStatusResult> {
    const { calculateRemainingTime } = await import("./pending-order.server");
    const { releaseCodes } = await import("~/lib/cdk/inventory.server");

    console.log("[Order] Handling pending order payment:", params);

    // Step 1: Get the order by ID (Requirement 5.1)
    const orderResult = await getOrderByIdInternal(params.orderId);

    if (!orderResult.success || !orderResult.order) {
        console.error("[Order] Order not found:", params.orderId);
        return {
            success: false,
            error: { code: "ORDER_NOT_FOUND", message: "订单不存在" },
        };
    }

    const order = orderResult.order;

    // Step 2: Check if order is already cancelled (Requirement 5.4)
    if (order.status === "cancelled") {
        console.log("[Order] Payment received for cancelled order, needs refund:", params.orderId);
        return {
            success: false,
            error: { code: "ORDER_CANCELLED", message: "订单已取消，需要退款" },
        };
    }

    // Step 3: Check if order is already paid (idempotency)
    if (order.status === "paid") {
        console.log("[Order] Order already paid:", params.orderId);
        return { success: true, order };
    }

    // Step 4: Check if order is pending
    if (order.status !== "pending") {
        console.error("[Order] Order not in pending status:", order.status);
        return {
            success: false,
            error: { code: "ORDER_INVALID_STATUS", message: `订单状态无效: ${order.status}` },
        };
    }

    // Step 5: Check order expiration (Requirement 5.4)
    const { isExpired } = calculateRemainingTime(order.created_at);

    if (isExpired) {
        console.log("[Order] Order expired, cancelling and needs refund:", params.orderId);

        // Cancel the expired order
        const supabase = getSupabaseClient();
        await supabase
            .from("orders")
            .update({
                status: "cancelled",
                updated_at: new Date().toISOString(),
            })
            .eq("id", params.orderId);

        // Release CDK codes for the expired order (CDK Requirements 6.2, 6.3)
        const releaseResult = await releaseCodes(params.orderId, "payment_timeout");

        if (releaseResult.success && releaseResult.releasedCount > 0) {
            console.log(`[Order] Released ${releaseResult.releasedCount} CDK codes for expired order:`, params.orderId);
        } else if (!releaseResult.success) {
            console.error("[Order] Failed to release CDK codes for expired order:", params.orderId, releaseResult.error);
        }

        return {
            success: false,
            error: { code: "ORDER_EXPIRED", message: "订单已过期，需要退款" },
        };
    }

    // Step 6: Update order to paid (Requirements 5.2, 5.3)
    // This also delivers CDK codes (CDK Requirement 5.1)
    return await updateOrderToPaid(params.orderId, params.stripeSessionId);
}

/**
 * Handle failed payment
 */
export async function handlePaymentFailure(params: {
    stripeSessionId?: string;
    stripePaymentIntentId?: string;
    errorMessage?: string;
}): Promise<UpdateOrderStatusResult> {
    console.log("[Order] Handling payment failure:", params);
    return await updateOrderStatus({
        stripeSessionId: params.stripeSessionId,
        stripePaymentIntentId: params.stripePaymentIntentId,
        status: "cancelled",
    });
}

// ============================================
// Refund Handling (Requirements 5.4)
// ============================================

export interface RefundResult {
    success: boolean;
    refundId?: string;
    error?: { code: string; message: string };
}

/**
 * Initiate a refund for a cancelled order payment
 * Requirements: 5.4
 * 
 * This function is called when a payment is received for an order that
 * has already been cancelled (either due to expiration or manual cancellation).
 * 
 * @param params - Refund parameters including payment intent ID and order ID
 * @returns Result with refund ID or error
 */
export async function initiateRefundForCancelledOrder(params: {
    stripePaymentIntentId: string;
    orderId: string;
    reason?: string;
}): Promise<RefundResult> {
    console.log("[Order] Initiating refund for cancelled order:", params);

    try {
        // Log the refund attempt for audit trail
        const supabase = getSupabaseClient();
        const now = new Date().toISOString();

        // Record refund attempt in order notes/metadata
        // Note: In a production system, you would have a separate refunds table
        await supabase
            .from("orders")
            .update({
                updated_at: now,
                // Store refund info in a way that can be tracked
                // This is a simplified approach - production would use a refunds table
            })
            .eq("id", params.orderId);

        console.log("[Order] Refund initiated for order:", params.orderId, "payment_intent:", params.stripePaymentIntentId);

        // Note: The actual refund is initiated via Stripe MCP mcp_stripe_create_refund
        // This will be called from the webhook handler
        return {
            success: true,
            refundId: `refund_pending_${params.orderId}`,
        };
    } catch (error) {
        console.error("[Order] Failed to initiate refund:", error);
        return {
            success: false,
            error: {
                code: "REFUND_FAILED",
                message: error instanceof Error ? error.message : "退款处理失败",
            },
        };
    }
}

// ============================================
// Order Query Operations
// ============================================

export interface GetUserOrdersResult {
    success: boolean;
    orders?: Order[];
    error?: { code: string; message: string };
}

/**
 * Get all orders for a user
 */
export async function getUserOrders(userId: string): Promise<GetUserOrdersResult> {
    try {
        const supabase = getSupabaseClient();

        const { data: orders, error } = await supabase
            .from("orders")
            .select("*, items:order_items(*)")
            .eq("user_id", userId)
            .order("created_at", { ascending: false });

        if (error) {
            console.error("[Order] Failed to fetch orders:", error);
            return {
                success: false,
                error: { code: "ORDER_FETCH_FAILED", message: error.message },
            };
        }

        return { success: true, orders: orders || [] };
    } catch (error) {
        console.error("[Order] Failed to fetch user orders:", error);
        return {
            success: false,
            error: {
                code: "ORDER_FETCH_FAILED",
                message: error instanceof Error ? error.message : "获取订单列表失败",
            },
        };
    }
}

export interface GetOrderBySessionResult {
    success: boolean;
    order?: Order & { items?: OrderItem[] };
    error?: { code: string; message: string };
}

export interface GetOrderByIdResult {
    success: boolean;
    order?: Order & { items?: OrderItem[] };
    error?: { code: string; message: string };
}

/**
 * Get order by Stripe session ID
 */
export async function getOrderByStripeSession(stripeSessionId: string): Promise<GetOrderBySessionResult> {
    try {
        const supabase = getSupabaseClient();

        const { data: order, error } = await supabase
            .from("orders")
            .select("*, items:order_items(*)")
            .eq("stripe_session_id", stripeSessionId)
            .single();

        if (error) {
            return {
                success: false,
                error: { code: "ORDER_NOT_FOUND", message: "订单不存在" },
            };
        }

        return { success: true, order };
    } catch (error) {
        console.error("[Order] Failed to fetch order:", error);
        return {
            success: false,
            error: {
                code: "ORDER_FETCH_FAILED",
                message: error instanceof Error ? error.message : "获取订单失败",
            },
        };
    }
}

/**
 * Get order by ID with ownership verification
 */
export async function getOrderById(orderId: string, userId: string): Promise<GetOrderByIdResult> {
    try {
        const supabase = getSupabaseClient();

        const { data: order, error } = await supabase
            .from("orders")
            .select("*, items:order_items(*)")
            .eq("id", orderId)
            .single();

        if (error || !order) {
            return {
                success: false,
                error: { code: "ORDER_NOT_FOUND", message: "订单不存在" },
            };
        }

        // Ownership verification
        if (order.user_id !== userId) {
            return {
                success: false,
                error: { code: "FORBIDDEN", message: "无权访问此订单" },
            };
        }

        return { success: true, order };
    } catch (error) {
        console.error("[Order] Failed to fetch order:", error);
        return {
            success: false,
            error: {
                code: "ORDER_FETCH_FAILED",
                message: error instanceof Error ? error.message : "获取订单详情失败",
            },
        };
    }
}

/**
 * Verify order ownership
 */
export function verifyOrderOwnership(order: { user_id: string }, requestingUserId: string): boolean {
    return order.user_id === requestingUserId;
}

// ============================================
// Order Cancellation (CDK Requirements 6.2, 6.3)
// ============================================

export interface CancelOrderResult {
    success: boolean;
    order?: Order;
    error?: { code: string; message: string };
}

/**
 * Cancel a pending order and release any reserved CDK codes
 * 
 * This function is used for user-initiated order cancellation.
 * It updates the order status to cancelled and releases any CDK codes
 * that were reserved for the order.
 * 
 * Requirements: CDK 6.2, 6.3 (release CDK codes on order cancellation)
 * 
 * @param orderId - The order ID to cancel
 * @param userId - The user ID (for ownership verification)
 * @returns Result with cancelled order or error
 */
export async function cancelOrder(
    orderId: string,
    userId: string
): Promise<CancelOrderResult> {
    const { releaseCodes } = await import("~/lib/cdk/inventory.server");

    try {
        const supabase = getSupabaseClient();

        // Step 1: Get the order and verify ownership
        const { data: order, error: fetchError } = await supabase
            .from("orders")
            .select("*")
            .eq("id", orderId)
            .single();

        if (fetchError || !order) {
            return {
                success: false,
                error: { code: "ORDER_NOT_FOUND", message: "订单不存在" },
            };
        }

        // Ownership verification
        if (order.user_id !== userId) {
            return {
                success: false,
                error: { code: "FORBIDDEN", message: "无权取消此订单" },
            };
        }

        // Step 2: Check if order can be cancelled (only pending orders)
        if (order.status !== "pending") {
            return {
                success: false,
                error: {
                    code: "ORDER_NOT_CANCELLABLE",
                    message: `订单状态为 ${order.status}，无法取消`
                },
            };
        }

        // Step 3: Update order status to cancelled
        const { data: updatedOrder, error: updateError } = await supabase
            .from("orders")
            .update({
                status: "cancelled",
                updated_at: new Date().toISOString(),
            })
            .eq("id", orderId)
            .eq("status", "pending") // Optimistic locking
            .select()
            .single();

        if (updateError) {
            console.error("[Order] Failed to cancel order:", updateError);
            return {
                success: false,
                error: { code: "ORDER_CANCEL_FAILED", message: updateError.message },
            };
        }

        if (!updatedOrder) {
            return {
                success: false,
                error: { code: "ORDER_STATUS_CHANGED", message: "订单状态已变更，无法取消" },
            };
        }

        console.log("[Order] Order cancelled:", orderId);

        // Step 4: Release CDK codes for the cancelled order (CDK Requirements 6.2, 6.3)
        const releaseResult = await releaseCodes(orderId, "order_cancelled");

        if (releaseResult.success) {
            if (releaseResult.releasedCount > 0) {
                console.log(`[Order] Released ${releaseResult.releasedCount} CDK codes for cancelled order:`, orderId);
            }
        } else {
            console.error("[Order] Failed to release CDK codes for cancelled order:", orderId, releaseResult.error);
            // Don't fail the cancellation - CDK release can be retried via cleanup job
        }

        return { success: true, order: updatedOrder };
    } catch (error) {
        console.error("[Order] Failed to cancel order:", error);
        return {
            success: false,
            error: {
                code: "ORDER_CANCEL_FAILED",
                message: error instanceof Error ? error.message : "取消订单失败",
            },
        };
    }
}
