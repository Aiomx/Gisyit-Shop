/**
 * Product Files Server Utilities
 *
 * Server-side functions for fetching product files.
 * These functions query the product_files table via Supabase.
 *
 * Requirements: 2.1
 */

import { getSupabaseClient } from "~/lib/supabase/client.server";
import type { ProductFile } from "~/lib/supabase/types";
import { getSafeFileMetadata, type SafeProductFile } from "~/components/product/product-files";

/**
 * Response type for product files queries
 */
export interface ProductFilesResponse {
    data: SafeProductFile[] | null;
    error: string | null;
}

/**
 * Fetch product files by product ID
 *
 * Returns file metadata without storage_path for security.
 * Only returns safe metadata that can be displayed to users.
 *
 * Requirements: 2.1, 2.4
 *
 * @param productId - The product ID to fetch files for
 * @returns Safe file metadata without storage paths
 */
export async function getProductFiles(
    productId: string
): Promise<ProductFilesResponse> {
    try {
        const supabase = getSupabaseClient();

        const { data, error } = await supabase
            .from("product_files")
            .select("id, product_id, filename, original_filename, file_size, mime_type, uploaded_at, updated_at")
            .eq("product_id", productId)
            .order("uploaded_at", { ascending: true });

        if (error) {
            console.error("Error fetching product files:", error);
            return { data: null, error: error.message };
        }

        // Note: We're already selecting only safe fields in the query,
        // but we cast to SafeProductFile for type safety
        return {
            data: data as SafeProductFile[],
            error: null,
        };
    } catch (err) {
        console.error("Error in getProductFiles:", err);
        return { data: null, error: String(err) };
    }
}

/**
 * Check if a product has any files
 *
 * @param productId - The product ID to check
 * @returns True if the product has files
 */
export async function productHasFiles(productId: string): Promise<boolean> {
    try {
        const supabase = getSupabaseClient();

        const { count, error } = await supabase
            .from("product_files")
            .select("id", { count: "exact", head: true })
            .eq("product_id", productId);

        if (error) {
            console.error("Error checking product files:", error);
            return false;
        }

        return (count ?? 0) > 0;
    } catch (err) {
        console.error("Error in productHasFiles:", err);
        return false;
    }
}
