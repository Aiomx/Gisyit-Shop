/**
 * Stripe Server-side Client
 * 
 * Uses Stripe Node.js SDK for server-side operations.
 * Supports Embedded Checkout with CNY currency.
 */

import Stripe from "stripe";

// Initialize Stripe client
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
    console.warn("[Stripe] STRIPE_SECRET_KEY not configured");
}

export const stripe = stripeSecretKey
    ? new Stripe(stripeSecretKey)
    : null;

/**
 * Get Stripe instance (throws if not configured)
 */
export function getStripe(): Stripe {
    if (!stripe) {
        throw new Error("Stripe is not configured. Please set STRIPE_SECRET_KEY.");
    }
    return stripe;
}

/**
 * Create Embedded Checkout Session
 * 
 * Creates a Checkout Session for embedded checkout (ui_mode: 'embedded').
 * Returns client_secret for client-side initialization.
 */
export interface CreateEmbeddedCheckoutParams {
    lineItems: Array<{
        name: string;
        description?: string;
        unitAmount: number; // in cents
        currency: string;
        quantity: number;
        images?: string[];
        metadata?: Record<string, string>;
    }>;
    cartId: string;
    orderId?: string; // Order ID for tracking (Requirements 2.6)
    userId?: string;
    anonymousSessionId?: string;
    returnUrl: string;
}

export interface EmbeddedCheckoutResult {
    success: boolean;
    clientSecret?: string;
    sessionId?: string;
    error?: {
        code: string;
        message: string;
    };
}

export async function createEmbeddedCheckoutSession(
    params: CreateEmbeddedCheckoutParams
): Promise<EmbeddedCheckoutResult> {
    try {
        const stripeClient = getStripe();

        console.log("[Stripe] Creating embedded checkout session:", {
            itemCount: params.lineItems.length,
            cartId: params.cartId,
            hasUserId: !!params.userId,
        });

        // Build line items for Stripe
        const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = params.lineItems.map(
            (item) => ({
                price_data: {
                    currency: item.currency.toLowerCase(),
                    product_data: {
                        name: item.name,
                        description: item.description,
                        images: item.images,
                        metadata: item.metadata,
                    },
                    unit_amount: item.unitAmount,
                },
                quantity: item.quantity,
            })
        );

        // Build metadata for order tracking (Requirements 2.6)
        const metadata: Record<string, string> = {
            cart_id: params.cartId,
        };
        if (params.orderId) {
            metadata.order_id = params.orderId;
        }
        if (params.userId) {
            metadata.user_id = params.userId;
        }
        if (params.anonymousSessionId) {
            metadata.anonymous_session_id = params.anonymousSessionId;
        }

        // Create Checkout Session with embedded mode
        const session = await stripeClient.checkout.sessions.create({
            ui_mode: "embedded",
            mode: "payment",
            line_items: lineItems,
            return_url: params.returnUrl,
            metadata,
            // Optional: collect billing address
            // billing_address_collection: "required",
        });

        if (!session.client_secret) {
            return {
                success: false,
                error: {
                    code: "SESSION_CREATION_FAILED",
                    message: "Failed to get client secret from Stripe",
                },
            };
        }

        console.log("[Stripe] Embedded checkout session created:", session.id);

        return {
            success: true,
            clientSecret: session.client_secret,
            sessionId: session.id,
        };
    } catch (error) {
        console.error("[Stripe] Error creating embedded checkout session:", error);

        if (error instanceof Stripe.errors.StripeError) {
            return {
                success: false,
                error: {
                    code: error.code || "STRIPE_ERROR",
                    message: error.message,
                },
            };
        }

        return {
            success: false,
            error: {
                code: "UNKNOWN_ERROR",
                message: error instanceof Error ? error.message : "Unknown error",
            },
        };
    }
}

/**
 * Retrieve Checkout Session status
 */
export async function getCheckoutSessionStatus(
    sessionId: string
): Promise<{
    status: string;
    paymentStatus: string;
    customerEmail?: string;
} | null> {
    try {
        const stripeClient = getStripe();
        const session = await stripeClient.checkout.sessions.retrieve(sessionId);

        return {
            status: session.status || "unknown",
            paymentStatus: session.payment_status,
            customerEmail: session.customer_details?.email || undefined,
        };
    } catch (error) {
        console.error("[Stripe] Error retrieving session:", error);
        return null;
    }
}
