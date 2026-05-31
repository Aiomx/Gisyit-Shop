/**
 * Checkout Type Definitions
 * 
 * Types specific to checkout operations and validation.
 */

import type { CartItemWithProduct } from "~/lib/cart/types";

/**
 * Inventory validation result for a single item
 */
export interface InventoryValidationItem {
    cartItemId: string;
    productId: string;
    productName: string;
    requestedQuantity: number;
    availableQuantity: number | null;
    isAvailable: boolean;
    errorMessage?: string;
}

/**
 * Overall inventory validation result
 */
export interface InventoryValidationResult {
    valid: boolean;
    items: InventoryValidationItem[];
    errors: string[];
}

/**
 * Checkout validation result
 */
export interface CheckoutValidationResult {
    valid: boolean;
    inventoryValidation: InventoryValidationResult;
    cartTotal: number;
    currency: string;
    errors: string[];
}

/**
 * Checkout session creation result
 */
export interface CheckoutSessionResult {
    success: boolean;
    sessionId?: string;
    sessionUrl?: string;
    error?: {
        code: string;
        message: string;
    };
}

/**
 * Checkout error codes
 */
export const CheckoutErrorCodes = {
    CART_EMPTY: "CART_EMPTY",
    CART_NOT_FOUND: "CART_NOT_FOUND",
    INVENTORY_VALIDATION_FAILED: "INVENTORY_VALIDATION_FAILED",
    PRODUCT_UNAVAILABLE: "PRODUCT_UNAVAILABLE",
    INSUFFICIENT_INVENTORY: "INSUFFICIENT_INVENTORY",
    STRIPE_SESSION_FAILED: "STRIPE_SESSION_FAILED",
    VALIDATION_ERROR: "VALIDATION_ERROR",
} as const;

export type CheckoutErrorCode = typeof CheckoutErrorCodes[keyof typeof CheckoutErrorCodes];

/**
 * User info for header display
 */
export interface UserMenuInfo {
    email?: string;
    isLoggedIn: boolean;
}

/**
 * Pending order info for checkout page
 * Requirements: 3.1, 3.4, 4.1
 */
export interface PendingOrderInfo {
    id: string;
    orderNumber: string;
    createdAt: string;
    expiresAt: string;
    remainingSeconds: number;
}

/**
 * Checkout page loader data
 */
export interface CheckoutLoaderData {
    cart: {
        id: string;
        items: CartItemWithProduct[];
    } | null;
    validation: CheckoutValidationResult | null;
    itemCount: number;
    error: {
        code: string;
        message: string;
    } | null;
    user?: UserMenuInfo;
    pendingOrder?: PendingOrderInfo;
}

/**
 * Checkout action result
 */
export interface CheckoutActionResult {
    success: boolean;
    redirectUrl?: string;
    error?: {
        code: string;
        message: string;
        details?: InventoryValidationItem[];
    };
    validationDetails?: InventoryValidationItem[];
}
