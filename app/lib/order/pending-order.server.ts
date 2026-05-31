/**
 * Pending Order Service (Server-side only)
 * 
 * Provides pending order creation and management operations.
 * Implements the 15-minute payment window for orders.
 * Integrates CDK reservation for virtual product orders.
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 4.1, 4.3
 * CDK Requirements: 4.1, 4.3 (reservation during order creation)
 */

import { getSupabaseClient } from "~/lib/supabase/client.server";
import type { Order, OrderItem, DeliveryType } from "~/lib/supabase/types";
import type { CartItemWithProduct } from "~/lib/cart/types";
import { generateOrderNumber } from "./order-operations.server";
import { reserveCodes, releaseCodes } from "~/lib/cdk/inventory.server";
import { CDKErrorCodes } from "~/lib/cdk/types";

// ============================================
// Constants
// ============================================

/** Payment validity window in minutes */
export const PAYMENT_WINDOW_MINUTES = 15;

/** Payment validity window in milliseconds */
export const PAYMENT_WINDOW_MS = PAYMENT_WINDOW_MINUTES * 60 * 1000;

// ============================================
// Types
// ============================================

export interface CreatePendingOrderParams {
    cartId: string;
    cartItems: CartItemWithProduct[];
    userId?: string;
    anonymousSessionId?: string;
    totalAmount: number;
    currency: string;
}

export interface CreatePendingOrderResult {
    success: boolean;
    order?: PendingOrder;
    error?: { code: string; message: string };
}

export interface PendingOrder {
    id: string;
    orderNumber: string;
    status: "pending" | "paid" | "cancelled";
    createdAt: string;
    expiresAt: string;
    userId?: string;
    anonymousSessionId?: string;
    totalAmount: number;
    currency: string;
    items: PendingOrderItem[];
}

export interface PendingOrderItem {
    productId: string;
    productName: string;
    specCombination?: Record<string, string>;
    quantity: number;
    snapshotPrice: number;
}

export interface GetPendingOrderResult {
    success: boolean;
    order?: PendingOrder;
    error?: { code: string; message: string };
}

export interface RemainingTimeResult {
    remainingSeconds: number;
    isExpired: boolean;
}

/**
 * CDK item info for reservation
 */
interface CDKItemInfo {
    productId: string;
    quantity: number;
}

// ============================================
// CDK Helper Functions
// ============================================

/**
 * Extract CDK items from cart items
 * Returns items that have delivery_type = 'cdk'
 * 
 * Requirements: 4.1 (identify CDK products for reservation)
 */
function extractCDKItems(cartItems: CartItemWithProduct[]): CDKItemInfo[] {
    return cartItems
        .filter((item) => item.product?.delivery_type === "cdk")
        .map((item) => ({
            productId: item.product_id,
            quantity: item.quantity,
        }));
}

/**
 * Check if cart contains any CDK products
 */
function hasCDKProducts(cartItems: CartItemWithProduct[]): boolean {
    return cartItems.some((item) => item.product?.delivery_type === "cdk");
}

// ============================================
// Core Functions
// ============================================

/**
 * Calculate the expiration timestamp for a pending order
 * @param createdAt - The order creation timestamp (ISO string)
 * @returns The expiration timestamp (ISO string)
 */
export function calculateExpiresAt(createdAt: string): string {
    const createdDate = new Date(createdAt);
    const expiresDate = new Date(createdDate.getTime() + PAYMENT_WINDOW_MS);
    return expiresDate.toISOString();
}

/**
 * Calculate remaining payment time for a pending order
 * Uses server-side time calculation only (Requirements 3.1, 3.4)
 * 
 * @param createdAt - The order creation timestamp (ISO string)
 * @returns Object with remainingSeconds and isExpired flag
 */
export function calculateRemainingTime(createdAt: string): RemainingTimeResult {
    const createdDate = new Date(createdAt);
    const expiresAt = createdDate.getTime() + PAYMENT_WINDOW_MS;
    const now = Date.now();
    const remainingMs = expiresAt - now;

    if (remainingMs <= 0) {
        return { remainingSeconds: 0, isExpired: true };
    }

    return {
        remainingSeconds: Math.ceil(remainingMs / 1000),
        isExpired: false,
    };
}

/**
 * Create a pending order from cart data
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
 * CDK Requirements: 4.1, 4.3 (reserve CDK codes during order creation)
 * 
 * @param params - Order creation parameters
 * @returns Result with created order or error
 */
export async function createPendingOrder(
    params: CreatePendingOrderParams
): Promise<CreatePendingOrderResult> {
    try {
        // Validate user identification (Requirements 2.2)
        if (!params.userId && !params.anonymousSessionId) {
            return {
                success: false,
                error: { code: "USER_NOT_IDENTIFIED", message: "无法识别用户身份" },
            };
        }

        // Validate cart items
        if (!params.cartItems || params.cartItems.length === 0) {
            return {
                success: false,
                error: { code: "CART_INVALID", message: "购物车数据无效" },
            };
        }

        const supabase = getSupabaseClient();
        const orderNumber = generateOrderNumber();
        const createdAt = new Date().toISOString();
        const expiresAt = calculateExpiresAt(createdAt);

        // Check for CDK products and extract CDK items (Requirements 4.1)
        const cdkItems = extractCDKItems(params.cartItems);
        const hasCDK = cdkItems.length > 0;

        console.log("[PendingOrder] Creating pending order:", {
            orderNumber,
            userId: params.userId,
            anonymousSessionId: params.anonymousSessionId,
            itemCount: params.cartItems.length,
            totalAmount: params.totalAmount,
            expiresAt,
            hasCDKProducts: hasCDK,
            cdkItemCount: cdkItems.length,
        });

        // Insert order with status "pending" (Requirements 2.5)
        const { data: order, error: orderError } = await supabase
            .from("orders")
            .insert({
                order_number: orderNumber,
                user_id: params.userId || null,
                anonymous_session_id: params.anonymousSessionId || null,
                cart_id: params.cartId,
                status: "pending",
                total_amount: params.totalAmount,
                currency: params.currency,
                created_at: createdAt,
                expires_at: expiresAt,
            })
            .select()
            .single();

        if (orderError) {
            console.error("[PendingOrder] Failed to create order:", orderError);
            return {
                success: false,
                error: { code: "ORDER_CREATION_FAILED", message: orderError.message },
            };
        }

        // Insert order items with product snapshots (Requirements 2.3)
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
            console.error("[PendingOrder] Failed to create order items:", itemsError);
            // Rollback: delete the order if items failed
            await supabase.from("orders").delete().eq("id", order.id);
            return {
                success: false,
                error: { code: "ORDER_CREATION_FAILED", message: itemsError.message },
            };
        }

        // Reserve CDK codes if cart contains CDK products (Requirements 4.1, 4.3)
        if (hasCDK) {
            const reservationResult = await reserveCDKForOrder(order.id, cdkItems);

            if (!reservationResult.success) {
                console.error("[PendingOrder] CDK reservation failed:", reservationResult.error);

                // Rollback: delete order items and order
                await supabase.from("order_items").delete().eq("order_id", order.id);
                await supabase.from("orders").delete().eq("id", order.id);

                return {
                    success: false,
                    error: reservationResult.error || {
                        code: "CDK_RESERVATION_FAILED",
                        message: "激活码库存不足"
                    },
                };
            }

            console.log("[PendingOrder] CDK codes reserved successfully for order:", order.id);
        }

        // Transform to PendingOrder format
        const pendingOrder: PendingOrder = {
            id: order.id,
            orderNumber: order.order_number,
            status: "pending",
            createdAt: order.created_at,
            expiresAt: order.expires_at,
            userId: order.user_id || undefined,
            anonymousSessionId: order.anonymous_session_id || undefined,
            totalAmount: order.total_amount,
            currency: order.currency,
            items: params.cartItems.map((item) => ({
                productId: item.product_id,
                productName: item.product?.name || "Unknown Product",
                specCombination: item.spec_combination,
                quantity: item.quantity,
                snapshotPrice: item.snapshot_price,
            })),
        };

        return { success: true, order: pendingOrder };
    } catch (error) {
        console.error("[PendingOrder] Failed to create pending order:", error);
        return {
            success: false,
            error: {
                code: "ORDER_CREATION_FAILED",
                message: error instanceof Error ? error.message : "创建订单失败，请重试",
            },
        };
    }
}

/**
 * Reserve CDK codes for an order
 * 
 * Reserves CDK codes for all CDK items in the order.
 * If any reservation fails, all previous reservations are rolled back.
 * 
 * Requirements: 4.1, 4.3
 * 
 * @param orderId - The order ID to reserve codes for
 * @param cdkItems - Array of CDK items with product ID and quantity
 * @returns Result with success status or error
 */
async function reserveCDKForOrder(
    orderId: string,
    cdkItems: CDKItemInfo[]
): Promise<{ success: boolean; error?: { code: string; message: string } }> {
    const reservedProducts: string[] = [];

    try {
        for (const item of cdkItems) {
            console.log(`[PendingOrder] Reserving ${item.quantity} CDK codes for product ${item.productId}`);

            const result = await reserveCodes(item.productId, item.quantity, orderId);

            if (!result.success) {
                console.error(`[PendingOrder] Failed to reserve CDK for product ${item.productId}:`, result.error);

                // Rollback all previous reservations
                for (const productId of reservedProducts) {
                    console.log(`[PendingOrder] Rolling back CDK reservation for product ${productId}`);
                    await releaseCodes(orderId, "order_cancelled");
                }

                // Return appropriate error based on error code
                if (result.errorCode === CDKErrorCodes.INSUFFICIENT_INVENTORY) {
                    return {
                        success: false,
                        error: {
                            code: "INSUFFICIENT_CDK_INVENTORY",
                            message: result.error || "激活码库存不足，无法完成订单",
                        },
                    };
                }

                return {
                    success: false,
                    error: {
                        code: "CDK_RESERVATION_FAILED",
                        message: result.error || "激活码预留失败，请稍后重试",
                    },
                };
            }

            reservedProducts.push(item.productId);
            console.log(`[PendingOrder] Reserved ${result.reservedCodeIds.length} CDK codes for product ${item.productId}`);
        }

        return { success: true };
    } catch (error) {
        console.error("[PendingOrder] Error during CDK reservation:", error);

        // Rollback all reservations on error
        if (reservedProducts.length > 0) {
            console.log("[PendingOrder] Rolling back all CDK reservations due to error");
            await releaseCodes(orderId, "order_cancelled");
        }

        return {
            success: false,
            error: {
                code: "CDK_RESERVATION_FAILED",
                message: error instanceof Error ? error.message : "激活码预留失败",
            },
        };
    }
}

/**
 * Get a pending order by ID
 * 
 * @param orderId - The order ID
 * @returns Result with order or error
 */
export async function getPendingOrderById(
    orderId: string
): Promise<GetPendingOrderResult> {
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

        // Transform to PendingOrder format
        const pendingOrder: PendingOrder = {
            id: order.id,
            orderNumber: order.order_number,
            status: order.status as "pending" | "paid" | "cancelled",
            createdAt: order.created_at,
            expiresAt: order.expires_at || calculateExpiresAt(order.created_at),
            userId: order.user_id || undefined,
            anonymousSessionId: order.anonymous_session_id || undefined,
            totalAmount: order.total_amount,
            currency: order.currency,
            items: (order.items || []).map((item: OrderItem) => ({
                productId: item.product_id,
                productName: item.product_name,
                specCombination: item.spec_combination,
                quantity: item.quantity,
                snapshotPrice: item.price,
            })),
        };

        return { success: true, order: pendingOrder };
    } catch (error) {
        console.error("[PendingOrder] Failed to get order:", error);
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
 * Check if an order is expired and cancel it if necessary
 * Implements lazy expiration check (Requirements 4.1, 4.3, 4.4)
 * Also releases CDK codes when order is cancelled (CDK Requirements 6.2, 6.3)
 * 
 * @param orderId - The order ID to check
 * @returns true if order was cancelled, false otherwise
 */
export async function checkAndCancelExpiredOrder(orderId: string): Promise<boolean> {
    try {
        const supabase = getSupabaseClient();

        // Get the order
        const { data: order, error: fetchError } = await supabase
            .from("orders")
            .select("id, status, created_at, expires_at")
            .eq("id", orderId)
            .single();

        if (fetchError || !order) {
            console.error("[PendingOrder] Order not found for expiration check:", orderId);
            return false;
        }

        // Only check pending orders
        if (order.status !== "pending") {
            return false;
        }

        // Check if expired
        const { isExpired } = calculateRemainingTime(order.created_at);

        if (!isExpired) {
            return false;
        }

        // Cancel the expired order
        const { error: updateError } = await supabase
            .from("orders")
            .update({
                status: "cancelled",
                updated_at: new Date().toISOString(),
            })
            .eq("id", orderId)
            .eq("status", "pending"); // Only update if still pending (optimistic locking)

        if (updateError) {
            console.error("[PendingOrder] Failed to cancel expired order:", updateError);
            return false;
        }

        console.log("[PendingOrder] Cancelled expired order:", orderId);

        // Release CDK codes for the cancelled order (CDK Requirements 6.2, 6.3)
        const releaseResult = await releaseCodes(orderId, "payment_timeout");

        if (releaseResult.success) {
            if (releaseResult.releasedCount > 0) {
                console.log(`[PendingOrder] Released ${releaseResult.releasedCount} CDK codes for expired order:`, orderId);
            }
        } else {
            console.error("[PendingOrder] Failed to release CDK codes for expired order:", orderId, releaseResult.error);
            // Don't fail the cancellation - CDK release can be retried via cleanup job
        }

        return true;
    } catch (error) {
        console.error("[PendingOrder] Error checking order expiration:", error);
        return false;
    }
}

/**
 * Get order with expiration check
 * Combines getPendingOrderById with automatic expiration handling
 * 
 * @param orderId - The order ID
 * @returns Result with order (possibly updated to cancelled) or error
 */
export async function getOrderWithExpirationCheck(
    orderId: string
): Promise<GetPendingOrderResult> {
    // First check and cancel if expired
    await checkAndCancelExpiredOrder(orderId);

    // Then fetch the (possibly updated) order
    return getPendingOrderById(orderId);
}
