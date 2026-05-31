/**
 * Cart Type Definitions
 * 
 * Types specific to cart operations and session management.
 */

import type { Cart, CartItem, Product, ProductImage } from "~/lib/supabase/types";

/**
 * Cart item with product details for display
 */
export interface CartItemWithProduct extends CartItem {
    product: Product & {
        images?: ProductImage[];
    };
}

/**
 * Cart with items including product details
 */
export interface CartWithProducts extends Cart {
    items: CartItemWithProduct[];
}

/**
 * Session cart data stored in cookie
 * Used for anonymous users (Requirements 3.2)
 */
export interface SessionCartData {
    cartId: string | null;
    sessionId: string;
    createdAt: string;
}

/**
 * Add to cart request data
 */
export interface AddToCartRequest {
    productId: string;
    priceId: string;
    specCombination?: Record<string, string>;
    quantity: number;
    snapshotPrice: number;
    snapshotCurrency: string;
}

/**
 * Cart operation result
 */
export interface CartOperationResult<T = unknown> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
    };
}

/**
 * Error codes for cart operations
 */
export const CartErrorCodes = {
    CART_NOT_FOUND: "CART_NOT_FOUND",
    CART_ITEM_NOT_FOUND: "CART_ITEM_NOT_FOUND",
    INSUFFICIENT_INVENTORY: "INSUFFICIENT_INVENTORY",
    PRODUCT_UNAVAILABLE: "PRODUCT_UNAVAILABLE",
    INVALID_QUANTITY: "INVALID_QUANTITY",
    SESSION_ERROR: "SESSION_ERROR",
    DATABASE_ERROR: "DATABASE_ERROR",
    NETWORK_ERROR: "NETWORK_ERROR",
    VALIDATION_ERROR: "VALIDATION_ERROR",
} as const;

export type CartErrorCode = typeof CartErrorCodes[keyof typeof CartErrorCodes];

/**
 * User-friendly error messages for cart operations
 * Requirements 1.2: Display user-friendly error messages
 */
export const CartErrorMessages: Record<CartErrorCode, string> = {
    CART_NOT_FOUND: "购物车不存在，请刷新页面重试",
    CART_ITEM_NOT_FOUND: "购物车商品不存在，可能已被删除",
    INSUFFICIENT_INVENTORY: "库存不足，请减少购买数量",
    PRODUCT_UNAVAILABLE: "商品已下架或不可购买",
    INVALID_QUANTITY: "购买数量无效，请输入有效数量",
    SESSION_ERROR: "会话已过期，请刷新页面",
    DATABASE_ERROR: "数据库操作失败，请稍后重试",
    NETWORK_ERROR: "网络连接失败，请检查网络后重试",
    VALIDATION_ERROR: "请求数据无效，请检查输入",
};
