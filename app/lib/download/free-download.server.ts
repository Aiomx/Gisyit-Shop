/**
 * Free Download Server Action (Server-side only)
 *
 * Handles free product downloads without payment or order creation.
 * Generates signed URLs and logs downloads for audit purposes.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3
 */

import { getSupabaseClient } from "~/lib/supabase/client.server";
import { getUserIdFromSession } from "~/lib/auth/index.server";
import { getOrCreateCartSession } from "~/lib/cart/session.server";
import { checkFreeProduct } from "~/lib/product/free-product";
import { generateSignedUrl } from "./signed-url.server";
import { createDownloadLog } from "./download-log.server";
import type { Product, ProductFile } from "~/lib/supabase/types";

// ============================================
// Free Download Types
// ============================================

/**
 * Parameters for processing a free download
 */
export interface FreeDownloadParams {
    productId: string;
    fileId: string;
    sessionId?: string; // For anonymous users
}

/**
 * Error codes for free download operations
 */
export type FreeDownloadErrorCode =
    | "NOT_FREE_PRODUCT"
    | "INVALID_DELIVERY_TYPE"
    | "LOGIN_REQUIRED"
    | "FILE_NOT_FOUND"
    | "PRODUCT_NOT_FOUND"
    | "SIGNED_URL_FAILED"
    | "INVALID_REQUEST";

/**
 * Result of free download operation
 */
export interface FreeDownloadResult {
    success: boolean;
    url?: string;
    filename?: string;
    error?: {
        code: FreeDownloadErrorCode;
        message: string;
    };
}

// ============================================
// Error Messages
// ============================================

const errorMessages: Record<FreeDownloadErrorCode, string> = {
    NOT_FREE_PRODUCT: "该商品不是免费商品",
    INVALID_DELIVERY_TYPE: "该商品不支持直接下载",
    LOGIN_REQUIRED: "请登录后下载",
    FILE_NOT_FOUND: "文件不存在",
    PRODUCT_NOT_FOUND: "商品不存在",
    SIGNED_URL_FAILED: "生成下载链接失败，请重试",
    INVALID_REQUEST: "无效的请求",
};

/**
 * Create a free download error result
 */
function createError(code: FreeDownloadErrorCode): FreeDownloadResult {
    return {
        success: false,
        error: {
            code,
            message: errorMessages[code],
        },
    };
}

// ============================================
// Signed URL Expiration for Free Downloads
// ============================================

/**
 * Signed URL expiration time for free downloads (5 minutes)
 * Requirements: 5.1
 */
export const FREE_DOWNLOAD_URL_EXPIRATION_SECONDS = 300;

// ============================================
// Core Free Download Logic
// ============================================

/**
 * Fetch product by ID with prices for free product check
 */
async function getProductWithPrices(productId: string): Promise<Product | null> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
        .from("products")
        .select("*, prices:product_prices(*)")
        .eq("id", productId)
        .single();

    if (error || !data) {
        console.error("[FreeDownload] Failed to fetch product:", error);
        return null;
    }

    return data as Product;
}

/**
 * Fetch product file by ID with storage_path
 */
async function getProductFile(fileId: string, productId: string): Promise<ProductFile | null> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
        .from("product_files")
        .select("*")
        .eq("id", fileId)
        .eq("product_id", productId)
        .single();

    if (error || !data) {
        console.error("[FreeDownload] Failed to fetch product file:", error);
        return null;
    }

    return data as ProductFile;
}

/**
 * Get client IP address from request
 */
function getClientIp(request: Request): string | undefined {
    // Try common headers for proxied requests
    const forwardedFor = request.headers.get("x-forwarded-for");
    if (forwardedFor) {
        // x-forwarded-for can contain multiple IPs, take the first one
        return forwardedFor.split(",")[0].trim();
    }

    const realIp = request.headers.get("x-real-ip");
    if (realIp) {
        return realIp;
    }

    return undefined;
}

/**
 * Process a free product download
 *
 * This function:
 * 1. Validates the product is free
 * 2. Validates delivery_type is 'download'
 * 3. Checks login requirement if configured
 * 4. Generates a signed URL (5 minute expiration)
 * 5. Logs the download for audit
 *
 * IMPORTANT: This function does NOT:
 * - Create any order record (Requirements: 4.2)
 * - Create any Stripe session (Requirements: 4.3)
 * - Modify any cart (Requirements: 4.4)
 * - Invoke CDK delivery logic (Requirements: 11.3)
 * - Invoke payment processing logic (Requirements: 11.4)
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 6.1, 6.2, 6.3, 6.4, 6.5
 *
 * @param request - The incoming request (for auth and session)
 * @param params - Download parameters (productId, fileId)
 * @returns FreeDownloadResult with signed URL or error
 */
export async function processFreeDownload(
    request: Request,
    params: FreeDownloadParams
): Promise<FreeDownloadResult> {
    const { productId, fileId } = params;

    // Validate required parameters
    if (!productId || !fileId) {
        return createError("INVALID_REQUEST");
    }

    // Step 1: Fetch product with prices
    const product = await getProductWithPrices(productId);
    if (!product) {
        return createError("PRODUCT_NOT_FOUND");
    }

    // Step 2: Check if product is free
    const freeCheck = checkFreeProduct(product);

    if (!freeCheck.isFree) {
        return createError("NOT_FREE_PRODUCT");
    }

    // Step 3: Validate delivery_type is 'download'
    // Requirements: 1.3, 11.5
    if (!freeCheck.isValid || freeCheck.deliveryType !== "download") {
        return createError("INVALID_DELIVERY_TYPE");
    }

    // Step 4: Check login requirement
    // Requirements: 6.1, 6.2
    const userId = await getUserIdFromSession(request);

    if (freeCheck.requireLogin && !userId) {
        return createError("LOGIN_REQUIRED");
    }

    // Step 5: Fetch product file with storage_path
    const productFile = await getProductFile(fileId, productId);
    if (!productFile) {
        return createError("FILE_NOT_FOUND");
    }

    // Step 6: Generate signed URL (5 minute expiration)
    // Requirements: 4.1, 5.1, 5.3
    const signedUrlResult = await generateSignedUrl({
        storagePath: productFile.storage_path,
        originalFilename: productFile.original_filename,
    });

    if (!signedUrlResult.success || !signedUrlResult.data) {
        console.error("[FreeDownload] Failed to generate signed URL:", signedUrlResult.error);
        return createError("SIGNED_URL_FAILED");
    }

    // Step 7: Get session ID for anonymous users
    // Requirements: 6.4
    let sessionId: string | undefined;
    if (!userId) {
        const { session } = getOrCreateCartSession(request);
        sessionId = session.sessionId;
    }

    // Step 8: Log the download for audit
    // Requirements: 6.3, 6.4, 6.5, 8.1
    const ipAddress = getClientIp(request);

    await createDownloadLog({
        product_id: productId,
        file_id: fileId,
        user_id: userId ?? undefined,
        session_id: sessionId,
        ip_address: ipAddress,
    });

    // Return success with signed URL
    return {
        success: true,
        url: signedUrlResult.data.url,
        filename: signedUrlResult.data.filename,
    };
}

/**
 * Validate that a request is a valid server action request
 *
 * This function checks that the request originates from a valid
 * form submission or fetch call, not from direct URL construction.
 *
 * Requirements: 11.2
 *
 * @param request - The incoming request
 * @returns true if request is valid, false otherwise
 */
export function isValidServerActionRequest(request: Request): boolean {
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

/**
 * Check if a product can be downloaded for free
 *
 * Utility function to check if a product is eligible for free download
 * without actually processing the download.
 *
 * @param product - The product to check
 * @returns true if product can be downloaded for free
 */
export function canDownloadFree(product: Product): boolean {
    const freeCheck = checkFreeProduct(product);
    return freeCheck.isFree && freeCheck.isValid;
}
