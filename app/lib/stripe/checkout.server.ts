/**
 * Stripe Checkout Utilities (Server-side only)
 * 
 * Helper functions for building checkout sessions from cart data.
 */

import type {
    CheckoutLineItem,
    CreateCheckoutSessionParams,
} from "./types";

import type { CartItem, Product } from "~/lib/supabase/types";

// ============================================
// Checkout Session Builders
// ============================================

/**
 * Convert cart items to Stripe line items
 * 
 * This creates the line_items array needed for Stripe Checkout.
 * Prices are converted from the snapshot price (stored as decimal)
 * to cents (integer) as required by Stripe.
 */
export function buildLineItemsFromCart(
    cartItems: (CartItem & { product?: Product })[]
): CheckoutLineItem[] {
    return cartItems.map((item) => {
        const productName = item.product?.name ?? "Unknown Product";
        const productDescription = item.product?.subtitle ?? undefined;

        // Get primary image if available
        const images = item.product?.images
            ?.filter((img) => img.is_primary)
            .map((img) => img.image_url) ?? [];

        // Convert price to cents (Stripe requires integer amounts)
        const unitAmountCents = Math.round(item.snapshot_price * 100);

        return {
            price_data: {
                currency: item.snapshot_currency.toLowerCase(),
                product_data: {
                    name: productName,
                    description: productDescription,
                    images: images.length > 0 ? images : undefined,
                    metadata: {
                        product_id: item.product_id,
                        price_id: item.price_id,
                        spec_combination: item.spec_combination
                            ? JSON.stringify(item.spec_combination)
                            : "",
                    },
                },
                unit_amount: unitAmountCents,
            },
            quantity: item.quantity,
        };
    });
}

/**
 * Build checkout session parameters from cart
 */
export function buildCheckoutSessionParams(options: {
    cartId: string;
    cartItems: (CartItem & { product?: Product })[];
    successUrl: string;
    cancelUrl: string;
    customerEmail?: string;
    userId?: string;
}): CreateCheckoutSessionParams {
    const lineItems = buildLineItemsFromCart(options.cartItems);

    return {
        line_items: lineItems,
        mode: "payment",
        success_url: options.successUrl,
        cancel_url: options.cancelUrl,
        customer_email: options.customerEmail,
        client_reference_id: options.cartId,
        metadata: {
            cart_id: options.cartId,
            user_id: options.userId ?? "",
        },
    };
}

/**
 * Calculate cart total in cents
 * 
 * This is used for validation before creating checkout session.
 */
export function calculateCartTotalCents(
    cartItems: CartItem[]
): number {
    return cartItems.reduce((total, item) => {
        const itemTotal = Math.round(item.snapshot_price * 100) * item.quantity;
        return total + itemTotal;
    }, 0);
}

/**
 * Validate cart items before checkout
 * 
 * Returns validation errors if any items are invalid.
 */
export function validateCartForCheckout(
    cartItems: (CartItem & { product?: Product })[]
): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (cartItems.length === 0) {
        errors.push("Cart is empty");
        return { valid: false, errors };
    }

    for (const item of cartItems) {
        // Check if product exists and is active
        if (!item.product) {
            errors.push(`Product not found for cart item ${item.id}`);
            continue;
        }

        if (!item.product.is_active) {
            errors.push(`Product "${item.product.name}" is no longer available`);
        }

        // Check inventory (if applicable)
        if (
            item.product.inventory_count !== undefined &&
            item.product.inventory_count !== null &&
            item.product.inventory_count < item.quantity
        ) {
            errors.push(
                `Insufficient inventory for "${item.product.name}". Available: ${item.product.inventory_count}, Requested: ${item.quantity}`
            );
        }

        // Validate quantity
        if (item.quantity < 1) {
            errors.push(`Invalid quantity for "${item.product.name}"`);
        }

        // Validate price snapshot
        // Allow zero price for overseas/proxy purchase products (price determined at order time)
        if (item.snapshot_price < 0) {
            errors.push(`Invalid price for "${item.product.name}"`);
        } else if (item.snapshot_price === 0 && item.product.product_type !== "overseas") {
            errors.push(`Invalid price for "${item.product.name}"`);
        }
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}
