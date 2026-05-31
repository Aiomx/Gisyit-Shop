/**
 * Free Product Identification Utilities
 *
 * This module provides functions for identifying free products and
 * determining appropriate UI actions based on product type.
 *
 * Requirements: 1.1, 1.2, 1.3, 2.1, 2.2
 */

import type { Product, DeliveryType } from "~/lib/supabase/types";

/**
 * Result of checking if a product is free
 *
 * @property isFree - Whether the product is identified as free
 * @property requireLogin - Whether login is required to download
 * @property deliveryType - The product's delivery type
 * @property isValid - Whether the free product configuration is valid
 *                     (true if free product has delivery_type = 'download')
 */
export interface FreeProductCheck {
    isFree: boolean;
    requireLogin: boolean;
    deliveryType: DeliveryType;
    isValid: boolean;
}

/**
 * Action text configuration for product buttons
 *
 * @property primaryAction - Main action button text ('下载' for free, '立即购买' for paid)
 * @property secondaryAction - Secondary action button text ('加入购物车' for paid, null for free)
 */
export interface ProductActionText {
    primaryAction: "下载" | "立即购买";
    secondaryAction: "加入购物车" | null;
}

/**
 * Check if a product is free
 *
 * A product is identified as free if:
 * 1. is_free = true, OR
 * 2. All active prices have price_amount = 0
 *
 * A free product is valid only if delivery_type = 'download'
 *
 * @param product - The product to check
 * @returns FreeProductCheck result with isFree, requireLogin, deliveryType, and isValid
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4
 */
export function checkFreeProduct(product: Product): FreeProductCheck {
    // Check if explicitly marked as free
    const isExplicitlyFree = product.is_free === true;

    // Check if all active prices are zero
    const activePrices = product.prices?.filter((p) => p.is_active) ?? [];
    const allPricesZero =
        activePrices.length > 0 &&
        activePrices.every((p) => p.price_amount === 0);

    // Product is free if explicitly marked OR all active prices are zero
    const isFree = isExplicitlyFree || allPricesZero;

    // Get require_login setting (default to false if not set)
    const requireLogin = product.require_login ?? false;

    // Get delivery type
    const deliveryType = product.delivery_type;

    // Free product is valid only if delivery_type is 'download'
    const isValid = !isFree || deliveryType === "download";

    return {
        isFree,
        requireLogin,
        deliveryType,
        isValid,
    };
}

/**
 * Get button text based on product type
 *
 * - Free products: primaryAction = '下载', secondaryAction = null
 * - Paid products: primaryAction = '立即购买', secondaryAction = '加入购物车'
 *
 * @param product - The product to get action text for
 * @returns ProductActionText with primaryAction and secondaryAction
 *
 * Requirements: 2.1, 2.2
 */
export function getProductActionText(product: Product): ProductActionText {
    const { isFree } = checkFreeProduct(product);

    if (isFree) {
        return {
            primaryAction: "下载",
            secondaryAction: null,
        };
    }

    return {
        primaryAction: "立即购买",
        secondaryAction: "加入购物车",
    };
}

/**
 * Check if a product can be downloaded directly (free and valid)
 *
 * @param product - The product to check
 * @returns true if the product is free and has valid delivery_type
 */
export function canDownloadDirectly(product: Product): boolean {
    const { isFree, isValid } = checkFreeProduct(product);
    return isFree && isValid;
}

/**
 * Check if a product should show price display
 *
 * Free products should hide price display
 *
 * @param product - The product to check
 * @returns true if price should be displayed
 */
export function shouldShowPrice(product: Product): boolean {
    const { isFree } = checkFreeProduct(product);
    return !isFree;
}

/**
 * Check if a product should show cart/checkout options
 *
 * Free products should hide cart/checkout entry points
 *
 * @param product - The product to check
 * @returns true if cart/checkout options should be displayed
 */
export function shouldShowCartOptions(product: Product): boolean {
    const { isFree } = checkFreeProduct(product);
    return !isFree;
}
