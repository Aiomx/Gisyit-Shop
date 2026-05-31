/**
 * Buy Now Server Action (Server-side only)
 *
 * Handles direct checkout for a single product without adding to cart.
 * Creates a Stripe checkout session and redirects to payment.
 *
 * Requirements: 10.1, 10.2, 10.3, 10.4
 */

import { getSupabaseClient } from "~/lib/supabase/client.server";
import { getUserIdFromSession } from "~/lib/auth/index.server";
import { getOrCreateCartSession } from "~/lib/cart/session.server";
import { checkFreeProduct } from "~/lib/product/free-product";
import { stripeMCP, validatePaymentLinkParams, buildStripeMetadata } from "~/lib/stripe/mcp-client.server";
import type { Product, ProductPrice } from "~/lib/supabase/types";

// ============================================
// Buy Now Types
// ============================================

/**
 * Parameters for processing a buy now request
 *
 * Requirements: 10.1, 10.2
 */
export interface BuyNowParams {
    /** Product ID to purchase */
    productId: string;
    /** Price ID for the selected spec combination */
    priceId: string;
    /** Selected spec combination (e.g., { "颜色": "红色", "尺寸": "M" }) */
    specCombination: Record<string, string>;
    /** Quantity to purchase (default: 1) */
    quantity: number;
}

/**
 * Error codes for buy now operations
 */
export type BuyNowErrorCode =
    | "PRODUCT_NOT_FOUND"
    | "PRODUCT_UNAVAILABLE"
    | "PRODUCT_IS_FREE"
    | "PRICE_NOT_FOUND"
    | "INSUFFICIENT_INVENTORY"
    | "INVALID_QUANTITY"
    | "STRIPE_SESSION_FAILED"
    | "MISSING_IDENTITY"
    | "INVALID_REQUEST";

/**
 * Result of buy now operation
 *
 * Requirements: 10.3
 */
export interface BuyNowResult {
    success: boolean;
    /** Stripe checkout session URL for redirect */
    sessionUrl?: string;
    /** Session ID for tracking */
    sessionId?: string;
    error?: {
        code: BuyNowErrorCode;
        message: string;
    };
}

// ============================================
// Error Messages
// ============================================

const errorMessages: Record<BuyNowErrorCode, string> = {
    PRODUCT_NOT_FOUND: "商品不存在",
    PRODUCT_UNAVAILABLE: "商品已下架",
    PRODUCT_IS_FREE: "免费商品请直接下载",
    PRICE_NOT_FOUND: "价格信息不存在",
    INSUFFICIENT_INVENTORY: "库存不足",
    INVALID_QUANTITY: "购买数量无效",
    STRIPE_SESSION_FAILED: "创建支付会话失败",
    MISSING_IDENTITY: "缺少用户身份信息",
    INVALID_REQUEST: "无效的请求",
};

/**
 * Create a buy now error result
 */
function createError(code: BuyNowErrorCode): BuyNowResult {
    return {
        success: false,
        error: {
            code,
            message: errorMessages[code],
        },
    };
}

// ============================================
// Core Buy Now Logic
// ============================================

/**
 * Fetch product by ID with prices
 */
async function getProductWithPrices(productId: string): Promise<Product | null> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
        .from("products")
        .select("*, prices:product_prices(*)")
        .eq("id", productId)
        .single();

    if (error || !data) {
        console.error("[BuyNow] Failed to fetch product:", error);
        return null;
    }

    return data as Product;
}

/**
 * Find the price matching the given price ID
 */
function findPrice(product: Product, priceId: string): ProductPrice | null {
    if (!product.prices || product.prices.length === 0) {
        return null;
    }

    return product.prices.find((p) => p.id === priceId && p.is_active) ?? null;
}

/**
 * Validate inventory for the requested quantity
 */
function validateInventory(product: Product, quantity: number): boolean {
    // If inventory_count is null or undefined, assume unlimited inventory
    if (product.inventory_count === null || product.inventory_count === undefined) {
        return true;
    }

    return product.inventory_count >= quantity;
}

/**
 * Process a buy now request
 *
 * This function:
 * 1. Validates the product exists and is active
 * 2. Validates the product is NOT free (free products should use download)
 * 3. Validates the price exists and is active
 * 4. Validates inventory is sufficient
 * 5. Creates a Stripe checkout session
 * 6. Returns the session URL for redirect
 *
 * Requirements: 10.1, 10.2, 10.3, 10.4
 *
 * @param request - The incoming request (for auth and session)
 * @param params - Buy now parameters
 * @param options - Additional options (success/cancel URLs)
 * @returns BuyNowResult with session URL or error
 */
export async function processBuyNow(
    request: Request,
    params: BuyNowParams,
    options: {
        successUrl: string;
        cancelUrl: string;
    }
): Promise<BuyNowResult> {
    const { productId, priceId, specCombination, quantity } = params;

    // Validate required parameters
    if (!productId || !priceId) {
        return createError("INVALID_REQUEST");
    }

    // Validate quantity
    if (!quantity || quantity < 1) {
        return createError("INVALID_QUANTITY");
    }

    // Step 1: Fetch product with prices
    const product = await getProductWithPrices(productId);
    if (!product) {
        return createError("PRODUCT_NOT_FOUND");
    }

    // Step 2: Check if product is active
    if (!product.is_active) {
        return createError("PRODUCT_UNAVAILABLE");
    }

    // Step 3: Check if product is free
    // Requirements: 10.5 - Free products should not show "立即购买" button
    const freeCheck = checkFreeProduct(product);
    if (freeCheck.isFree) {
        return createError("PRODUCT_IS_FREE");
    }

    // Step 4: Find and validate price
    const price = findPrice(product, priceId);
    if (!price) {
        return createError("PRICE_NOT_FOUND");
    }

    // Step 5: Validate inventory
    if (!validateInventory(product, quantity)) {
        return createError("INSUFFICIENT_INVENTORY");
    }

    // Step 6: Get user identity
    const userId = await getUserIdFromSession(request);
    let anonymousSessionId: string | undefined;

    if (!userId) {
        const { session } = getOrCreateCartSession(request);
        anonymousSessionId = session.sessionId;
    }

    // Validate identity binding
    if (!userId && !anonymousSessionId) {
        return createError("MISSING_IDENTITY");
    }

    // Step 7: Create Stripe checkout session
    // Requirements: 10.1, 10.2, 10.3
    try {
        console.log("[BuyNow] Creating Stripe session with params:", {
            productId,
            priceId,
            quantity,
            specCombination,
            hasUserId: !!userId,
            hasAnonymousSessionId: !!anonymousSessionId,
        });

        // Generate a unique cart ID for this buy-now transaction
        // This is used for tracking and order creation
        const buyNowCartId = `buynow_${Date.now()}_${Math.random().toString(36).substring(7)}`;

        const result = await stripeMCP.createPaymentLink({
            priceId,
            quantity,
            cartId: buyNowCartId,
            userId: userId ?? undefined,
            anonymousSessionId,
            redirectUrl: options.successUrl,
        });

        if (result.error) {
            console.error("[BuyNow] Stripe MCP error:", result.error);
            return createError("STRIPE_SESSION_FAILED");
        }

        if (!result.data?.url) {
            return createError("STRIPE_SESSION_FAILED");
        }

        // Generate a session ID for tracking
        const sessionId = `bs_${Date.now()}_${Math.random().toString(36).substring(7)}`;

        return {
            success: true,
            sessionId,
            sessionUrl: result.data.url,
        };
    } catch (error) {
        console.error("[BuyNow] Failed to create Stripe session:", error);
        return createError("STRIPE_SESSION_FAILED");
    }
}

/**
 * Validate buy now request parameters
 *
 * Utility function to validate parameters before processing.
 *
 * @param params - Buy now parameters to validate
 * @returns Validation result with errors if any
 */
export function validateBuyNowParams(params: Partial<BuyNowParams>): {
    valid: boolean;
    errors: string[];
} {
    const errors: string[] = [];

    if (!params.productId) {
        errors.push("商品ID不能为空");
    }

    if (!params.priceId) {
        errors.push("价格ID不能为空");
    }

    if (!params.quantity || params.quantity < 1) {
        errors.push("购买数量必须大于0");
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

/**
 * Check if a product can use buy now
 *
 * Buy now is only available for paid products that are active.
 *
 * @param product - The product to check
 * @returns true if buy now is available
 */
export function canUseBuyNow(product: Product): boolean {
    // Must be active
    if (!product.is_active) {
        return false;
    }

    // Must not be free
    const freeCheck = checkFreeProduct(product);
    if (freeCheck.isFree) {
        return false;
    }

    // Must have at least one active price
    const hasActivePrice = product.prices?.some((p) => p.is_active) ?? false;

    return hasActivePrice;
}

/**
 * Validate that a request is a valid server action request
 *
 * This function checks that the request originates from a valid
 * form submission or fetch call, not from direct URL construction.
 *
 * @param request - The incoming request
 * @returns true if request is valid, false otherwise
 */
export function isValidBuyNowRequest(request: Request): boolean {
    // Check request method - must be POST for server actions
    if (request.method !== "POST") {
        return false;
    }

    // Check for valid content type
    const contentType = request.headers.get("content-type") || "";
    const validContentTypes = [
        "application/x-www-form-urlencoded",
        "multipart/form-data",
        "application/json",
    ];

    const hasValidContentType = validContentTypes.some((type) =>
        contentType.includes(type)
    );

    if (!hasValidContentType) {
        return false;
    }

    return true;
}
