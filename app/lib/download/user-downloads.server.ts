/**
 * User Downloads Query Utility (Server-side only)
 *
 * Provides functions to query user's purchased products with downloadable files.
 * Groups downloads by product and order for display on the account downloads page.
 *
 * Requirements: 4.1, 4.2, 4.4
 */

import { getSupabaseClient } from "~/lib/supabase/client.server";
import type { ProductFile } from "~/lib/supabase/types";
import type { UserDownloadItem } from "./types";
import { VALID_DOWNLOAD_ORDER_STATUSES } from "./types";

// ============================================
// Types
// ============================================

/**
 * Result of user downloads query
 */
export interface GetUserDownloadsResult {
    success: boolean;
    downloads?: UserDownloadItem[];
    error?: { code: string; message: string };
}

/**
 * Raw order item with product and files from database query
 */
interface OrderItemWithProduct {
    order_id: string;
    product_id: string;
    product_name: string;
    product_code: string;
    orders: {
        id: string;
        order_number: string;
        status: string;
        created_at: string;
    };
}

// ============================================
// Query Functions
// ============================================

/**
 * Get all downloadable products for a user
 *
 * Queries user's paid orders containing app products with files,
 * and groups them by product and order for display.
 *
 * Requirements: 4.1, 4.2, 4.4
 *
 * @param userId - User ID to fetch downloads for
 * @returns List of downloadable products grouped by order
 */
export async function getUserDownloads(userId: string): Promise<GetUserDownloadsResult> {
    try {
        const supabase = getSupabaseClient();

        // Step 1: Get all order items from paid orders for this user
        // Join with orders to get order info and filter by valid status
        const { data: orderItems, error: orderError } = await supabase
            .from("order_items")
            .select(`
                order_id,
                product_id,
                product_name,
                product_code,
                orders!inner (
                    id,
                    order_number,
                    status,
                    created_at
                )
            `)
            .eq("orders.user_id", userId)
            .in("orders.status", VALID_DOWNLOAD_ORDER_STATUSES);

        if (orderError) {
            console.error("[UserDownloads] Failed to query orders:", orderError);
            return {
                success: false,
                error: { code: "QUERY_FAILED", message: orderError.message },
            };
        }

        if (!orderItems || orderItems.length === 0) {
            return { success: true, downloads: [] };
        }

        // Step 2: Get unique product IDs
        const productIds = [...new Set(orderItems.map((item) => item.product_id))];

        // Step 3: Get product slugs
        const { data: products, error: productsError } = await supabase
            .from("products")
            .select("id, slug")
            .in("id", productIds);

        if (productsError) {
            console.error("[UserDownloads] Failed to query products:", productsError);
            // Continue without slugs - fallback to product_id
        }

        // Build slug lookup map
        const slugByProduct = new Map<string, string | undefined>();
        for (const product of products || []) {
            slugByProduct.set(product.id, product.slug);
        }

        // Step 4: Get files for all products
        const { data: productFiles, error: filesError } = await supabase
            .from("product_files")
            .select("id, product_id, filename, original_filename, file_size, mime_type, storage_path, uploaded_at, updated_at")
            .in("product_id", productIds);

        if (filesError) {
            console.error("[UserDownloads] Failed to query product files:", filesError);
            return {
                success: false,
                error: { code: "QUERY_FAILED", message: filesError.message },
            };
        }

        // Step 4: Group files by product_id
        const filesByProduct = new Map<string, ProductFile[]>();
        for (const file of productFiles || []) {
            const files = filesByProduct.get(file.product_id) || [];
            files.push(file as ProductFile);
            filesByProduct.set(file.product_id, files);
        }

        // Step 5: Build download items, only including products with files
        const downloads: UserDownloadItem[] = [];

        for (const item of orderItems) {
            const files = filesByProduct.get(item.product_id);

            // Skip products without files
            if (!files || files.length === 0) {
                continue;
            }

            const order = item.orders as unknown as {
                id: string;
                order_number: string;
                status: string;
                created_at: string;
            };

            downloads.push({
                product_id: item.product_id,
                product_name: item.product_name,
                product_code: item.product_code,
                product_slug: slugByProduct.get(item.product_id),
                order_id: order.id,
                order_number: order.order_number,
                order_date: order.created_at,
                files,
            });
        }

        // Step 6: Sort by order date (newest first)
        downloads.sort((a, b) =>
            new Date(b.order_date).getTime() - new Date(a.order_date).getTime()
        );

        return { success: true, downloads };
    } catch (error) {
        console.error("[UserDownloads] Failed to get user downloads:", error);
        return {
            success: false,
            error: {
                code: "QUERY_FAILED",
                message: error instanceof Error ? error.message : "获取下载列表失败",
            },
        };
    }
}

/**
 * Check if a user has any downloadable products
 *
 * @param userId - User ID to check
 * @returns True if user has downloadable products
 */
export async function userHasDownloads(userId: string): Promise<boolean> {
    const result = await getUserDownloads(userId);
    return result.success && (result.downloads?.length ?? 0) > 0;
}
