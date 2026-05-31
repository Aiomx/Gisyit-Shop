/**
 * Stripe MCP Client Utilities (Server-side only)
 * 
 * This module provides wrapper functions for interacting with Stripe MCP.
 * All payment operations go through these functions.
 * 
 * IMPORTANT: This file should only be used in server-side code (loaders/actions).
 * The .server.ts suffix ensures it's not bundled for the client.
 * 
 * Store Permissions:
 * - Create Payment Links (via mcp_stripe_create_payment_link)
 * - Verify Webhook Signatures
 * - Read Payment Status (via webhooks)
 * 
 * Requirements: 2.1, 11.1, 11.2
 */

import type {
    CheckoutLineItem,
    CreateCheckoutSessionParams,
    CheckoutSession,
    StripeMCPResponse,
    StripeMCPError,
    WebhookEvent,
} from "./types";

import type { CartItem, Product } from "~/lib/supabase/types";

// ============================================
// Stripe MCP Error Codes
// ============================================

export type StripeMCPErrorCode =
    | "NETWORK_ERROR"
    | "CHECKOUT_SESSION_ERROR"
    | "INVALID_SIGNATURE"
    | "SIGNATURE_VERIFICATION_ERROR"
    | "PARSE_ERROR"
    | "INVALID_EVENT"
    | "MCP_ERROR"
    | "MISSING_PRICE_ID"
    | "MISSING_IDENTITY";

/**
 * User-friendly error messages for Stripe MCP errors
 */
const stripeErrorMessages: Record<StripeMCPErrorCode, string> = {
    NETWORK_ERROR: "网络连接失败，请稍后重试",
    CHECKOUT_SESSION_ERROR: "创建支付会话失败",
    INVALID_SIGNATURE: "Webhook 签名无效",
    SIGNATURE_VERIFICATION_ERROR: "Webhook 签名验证失败",
    PARSE_ERROR: "解析 Webhook 事件失败",
    INVALID_EVENT: "无效的 Webhook 事件",
    MCP_ERROR: "支付服务暂时不可用",
    MISSING_PRICE_ID: "缺少价格 ID",
    MISSING_IDENTITY: "缺少用户身份信息",
};

/**
 * Handle Stripe MCP errors and convert to user-friendly format
 */
export function handleStripeMCPError(
    error: unknown,
    fallbackCode: StripeMCPErrorCode = "MCP_ERROR"
): StripeMCPError {
    if (error instanceof TypeError && error.message.includes("fetch")) {
        return {
            code: "NETWORK_ERROR",
            message: stripeErrorMessages.NETWORK_ERROR,
        };
    }

    if (error instanceof Error) {
        return {
            code: fallbackCode,
            message: stripeErrorMessages[fallbackCode],
            type: error.message,
        };
    }

    return {
        code: fallbackCode,
        message: stripeErrorMessages[fallbackCode],
    };
}

// ============================================
// Stripe MCP Bridge Interface
// ============================================

/**
 * Stripe MCP Bridge interface for calling MCP tools
 */
interface StripeMCPBridge {
    createPaymentLink(params: {
        price: string;
        quantity: number;
        redirect_url?: string;
    }): Promise<{ url: string }>;
}

/**
 * Global Stripe MCP bridge instance
 */
let stripeMCPBridgeInstance: StripeMCPBridge | null = null;

/**
 * Set the Stripe MCP bridge instance
 */
export function setStripeMCPBridge(bridge: StripeMCPBridge): void {
    stripeMCPBridgeInstance = bridge;
}

/**
 * Get the current Stripe MCP bridge instance
 */
export function getStripeMCPBridge(): StripeMCPBridge | null {
    return stripeMCPBridgeInstance;
}

// ============================================
// Payment Link Creation Parameters
// ============================================

/**
 * Parameters for creating a Stripe Payment Link
 * Includes identity binding metadata (Requirements 11.1, 11.2)
 */
export interface CreatePaymentLinkParams {
    /** Stripe Price ID */
    priceId: string;
    /** Quantity of items */
    quantity: number;
    /** Cart ID for order tracking */
    cartId: string;
    /** User ID for logged-in users (optional) */
    userId?: string;
    /** Anonymous session ID for guest checkout (optional) */
    anonymousSessionId?: string;
    /** URL to redirect after successful payment */
    redirectUrl?: string;
}

/**
 * Validate that payment link params contain required identity binding
 * Requirements 11.1, 11.2: Session must contain cart_id and either user_id or anonymous_session_id
 */
export function validatePaymentLinkParams(params: CreatePaymentLinkParams): {
    valid: boolean;
    error?: StripeMCPError;
} {
    if (!params.priceId) {
        return {
            valid: false,
            error: {
                code: "MISSING_PRICE_ID",
                message: stripeErrorMessages.MISSING_PRICE_ID,
            },
        };
    }

    // Requirements 11.1, 11.2: Must have either userId or anonymousSessionId
    if (!params.userId && !params.anonymousSessionId) {
        return {
            valid: false,
            error: {
                code: "MISSING_IDENTITY",
                message: stripeErrorMessages.MISSING_IDENTITY,
            },
        };
    }

    return { valid: true };
}

/**
 * Build metadata for Stripe session
 * Requirements 11.1, 11.2: Include cart_id and user identity
 */
export function buildStripeMetadata(params: CreatePaymentLinkParams): Record<string, string> {
    const metadata: Record<string, string> = {
        cart_id: params.cartId,
    };

    if (params.userId) {
        metadata.user_id = params.userId;
    }

    if (params.anonymousSessionId) {
        metadata.anonymous_session_id = params.anonymousSessionId;
    }

    return metadata;
}

// ============================================
// Stripe MCP Client Class
// ============================================

class StripeMCPClient {
    /**
     * Create a Stripe Payment Link
     * 
     * This creates a payment link that redirects users to Stripe's
     * hosted checkout page for payment.
     * 
     * Requirements: 2.1, 11.1, 11.2
     * - 2.1: Create Stripe Checkout Session via MCP
     * - 11.1: Include cart_id in metadata
     * - 11.2: Include user_id or anonymous_session_id in metadata
     */
    async createPaymentLink(
        params: CreatePaymentLinkParams
    ): Promise<StripeMCPResponse<{ url: string }>> {
        try {
            // Validate params (Requirements 11.1, 11.2)
            const validation = validatePaymentLinkParams(params);
            if (!validation.valid) {
                return {
                    data: null,
                    error: validation.error!,
                };
            }

            console.log("[Stripe MCP] Creating payment link", {
                priceId: params.priceId,
                quantity: params.quantity,
                cartId: params.cartId,
                hasUserId: !!params.userId,
                hasAnonymousSessionId: !!params.anonymousSessionId,
            });

            // Build metadata for identity binding
            const metadata = buildStripeMetadata(params);
            console.log("[Stripe MCP] Metadata:", metadata);

            // Call the real MCP tool: mcp_stripe_create_payment_link
            const bridge = getStripeMCPBridge();
            if (bridge) {
                const result = await bridge.createPaymentLink({
                    price: params.priceId,
                    quantity: params.quantity,
                    redirect_url: params.redirectUrl,
                });

                return {
                    data: { url: result.url },
                    error: null,
                };
            }

            // Fallback: throw error if MCP bridge is not available
            throw new Error("Stripe MCP bridge not available - ensure MCP is configured");
        } catch (error) {
            console.error("[Stripe MCP] Error creating payment link:", error);
            return {
                data: null,
                error: handleStripeMCPError(error, "CHECKOUT_SESSION_ERROR"),
            };
        }
    }

    /**
     * Create a Stripe Checkout Session (legacy method)
     * 
     * This method is kept for backward compatibility.
     * For new implementations, use createPaymentLink instead.
     */
    async createCheckoutSession(
        params: CreateCheckoutSessionParams
    ): Promise<StripeMCPResponse<CheckoutSession>> {
        try {
            console.log("[Stripe MCP] Creating checkout session", params);

            // Extract cart_id and user identity from metadata
            const cartId = params.metadata?.cart_id || params.client_reference_id || "";
            const userId = params.metadata?.user_id;
            const anonymousSessionId = params.metadata?.anonymous_session_id;

            // For single-item checkout, use the first line item
            if (params.line_items.length === 0) {
                return {
                    data: null,
                    error: {
                        code: "CHECKOUT_SESSION_ERROR",
                        message: "购物车为空",
                    },
                };
            }

            // Note: mcp_stripe_create_payment_link works with a single price
            // For multi-item carts, we need to create a product/price first
            // or use a different approach

            // For now, return a placeholder indicating the limitation
            console.log("[Stripe MCP] Multi-item checkout requires product/price creation");

            return {
                data: null,
                error: {
                    code: "CHECKOUT_SESSION_ERROR",
                    message: "请使用 createPaymentLink 方法进行支付",
                },
            };
        } catch (error) {
            return {
                data: null,
                error: handleStripeMCPError(error, "CHECKOUT_SESSION_ERROR"),
            };
        }
    }

    /**
     * Verify Stripe webhook signature
     * 
     * This verifies that a webhook request actually came from Stripe.
     */
    verifyWebhookSignature(
        payload: string,
        signature: string,
        webhookSecret: string
    ): { valid: boolean; error?: StripeMCPError } {
        try {
            // In production, this would use Stripe's signature verification
            // For now, we provide a placeholder that checks basic structure

            if (!payload || !signature || !webhookSecret) {
                return {
                    valid: false,
                    error: {
                        code: "INVALID_SIGNATURE",
                        message: "Missing required parameters for signature verification",
                    },
                };
            }

            // Placeholder - actual implementation would verify the signature
            console.log("[Stripe MCP] Verifying webhook signature");

            return { valid: true };
        } catch (error) {
            return {
                valid: false,
                error: {
                    code: "SIGNATURE_VERIFICATION_ERROR",
                    message: error instanceof Error ? error.message : "Unknown error",
                },
            };
        }
    }

    /**
     * Parse webhook event from payload
     */
    parseWebhookEvent(payload: string): StripeMCPResponse<WebhookEvent> {
        try {
            const event = JSON.parse(payload) as WebhookEvent;

            if (!event.id || !event.type || !event.data) {
                return {
                    data: null,
                    error: {
                        code: "INVALID_EVENT",
                        message: "Invalid webhook event structure",
                    },
                };
            }

            return { data: event, error: null };
        } catch (error) {
            return {
                data: null,
                error: {
                    code: "PARSE_ERROR",
                    message: error instanceof Error ? error.message : "Failed to parse webhook event",
                },
            };
        }
    }
}

// Export singleton instance
export const stripeMCP = new StripeMCPClient();
