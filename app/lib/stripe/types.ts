/**
 * Stripe MCP Type Definitions
 * 
 * These types define the data structures used when interacting with
 * Stripe MCP for payment processing.
 */

// ============================================
// Checkout Session Types
// ============================================

export interface CheckoutLineItem {
    price_data: {
        currency: string;
        product_data: {
            name: string;
            description?: string;
            images?: string[];
            metadata?: Record<string, string>;
        };
        unit_amount: number; // Amount in cents
    };
    quantity: number;
}

export interface CreateCheckoutSessionParams {
    line_items: CheckoutLineItem[];
    mode: "payment" | "subscription";
    success_url: string;
    cancel_url: string;
    metadata?: Record<string, string>;
    customer_email?: string;
    client_reference_id?: string;
}

export interface CheckoutSession {
    id: string;
    url: string;
    payment_status: "paid" | "unpaid" | "no_payment_required";
    status: "open" | "complete" | "expired";
    amount_total: number;
    currency: string;
    customer_email?: string;
    metadata?: Record<string, string>;
}

// ============================================
// Webhook Types
// ============================================

export type WebhookEventType =
    | "checkout.session.completed"
    | "checkout.session.expired"
    | "payment_intent.succeeded"
    | "payment_intent.payment_failed";

export interface WebhookEvent {
    id: string;
    type: WebhookEventType;
    data: {
        object: CheckoutSession | PaymentIntent;
    };
    created: number;
}

export interface PaymentIntent {
    id: string;
    amount: number;
    currency: string;
    status: "succeeded" | "processing" | "requires_payment_method" | "canceled";
    metadata?: Record<string, string>;
}

// ============================================
// MCP Response Types
// ============================================

export interface StripeMCPResponse<T> {
    data: T | null;
    error: StripeMCPError | null;
}

export interface StripeMCPError {
    code: string;
    message: string;
    type?: string;
}
