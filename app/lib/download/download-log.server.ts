/**
 * Download Log Service (Server-side only)
 *
 * Handles logging of free product downloads for audit and analytics.
 * Download logs are separate from order/payment records.
 *
 * Requirements: 6.3, 6.4, 6.5, 8.1, 8.2, 8.3
 */

import { getSupabaseClient } from "~/lib/supabase/client.server";
import type { DownloadLog } from "~/lib/supabase/types";

// ============================================
// Download Log Types
// ============================================

/**
 * Parameters for creating a download log entry
 */
export interface CreateDownloadLogParams {
    product_id: string;
    file_id: string;
    user_id?: string;
    session_id?: string;
    ip_address?: string;
}

/**
 * Result of creating a download log
 */
export interface CreateDownloadLogResult {
    success: boolean;
    log_id?: string;
    error?: string;
}

/**
 * Download statistics for a product
 */
export interface DownloadStats {
    totalDownloads: number;
    uniqueUsers: number;
}

// ============================================
// Validation Functions
// ============================================

/**
 * Validate download log entry parameters
 *
 * Ensures at least one identifier (user_id or session_id) is present.
 *
 * @param params - Download log parameters to validate
 * @returns true if valid, false otherwise
 */
export function validateDownloadLogParams(params: CreateDownloadLogParams): boolean {
    // Must have product_id and file_id
    if (!params.product_id || !params.file_id) {
        return false;
    }

    // Must have at least one identifier (user_id or session_id)
    if (!params.user_id && !params.session_id) {
        return false;
    }

    return true;
}

/**
 * Check if a download log entry has a user identifier
 *
 * @param log - Download log entry
 * @returns true if has user_id, false if has session_id only
 */
export function hasUserIdentifier(log: Pick<DownloadLog, "user_id" | "session_id">): boolean {
    return !!log.user_id;
}

/**
 * Check if a download log entry has a session identifier
 *
 * @param log - Download log entry
 * @returns true if has session_id
 */
export function hasSessionIdentifier(log: Pick<DownloadLog, "user_id" | "session_id">): boolean {
    return !!log.session_id;
}

// ============================================
// Core Download Log Functions
// ============================================

/**
 * Create a download log entry
 *
 * Records a free product download for audit purposes.
 * Does NOT create any order or payment records.
 *
 * Requirements: 6.3, 6.4, 6.5, 8.1
 *
 * @param params - Download log parameters
 * @returns Result with success status and log_id or error
 */
export async function createDownloadLog(
    params: CreateDownloadLogParams
): Promise<CreateDownloadLogResult> {
    // Validate parameters
    if (!validateDownloadLogParams(params)) {
        return {
            success: false,
            error: "Invalid parameters: must have product_id, file_id, and at least one identifier (user_id or session_id)",
        };
    }

    try {
        const supabase = getSupabaseClient();

        const { data, error } = await supabase
            .from("download_logs")
            .insert({
                product_id: params.product_id,
                file_id: params.file_id,
                user_id: params.user_id || null,
                session_id: params.session_id || null,
                ip_address: params.ip_address || null,
            })
            .select("id")
            .single();

        if (error) {
            console.error("[DownloadLog] Failed to create log:", error);
            return {
                success: false,
                error: `Failed to create download log: ${error.message}`,
            };
        }

        return {
            success: true,
            log_id: data.id,
        };
    } catch (err) {
        console.error("[DownloadLog] Unexpected error:", err);
        return {
            success: false,
            error: `Unexpected error creating download log: ${String(err)}`,
        };
    }
}

/**
 * Get download statistics for a product
 *
 * Returns total downloads and unique user count.
 * This data is separate from order/payment statistics.
 *
 * Requirements: 8.2, 8.3
 *
 * @param productId - Product ID to get stats for
 * @returns Download statistics
 */
export async function getDownloadStats(productId: string): Promise<DownloadStats> {
    try {
        const supabase = getSupabaseClient();

        // Get total download count
        const { count: totalDownloads, error: countError } = await supabase
            .from("download_logs")
            .select("*", { count: "exact", head: true })
            .eq("product_id", productId);

        if (countError) {
            console.error("[DownloadLog] Failed to get total count:", countError);
            return { totalDownloads: 0, uniqueUsers: 0 };
        }

        // Get unique users count (users with user_id)
        const { data: uniqueUserData, error: uniqueError } = await supabase
            .from("download_logs")
            .select("user_id")
            .eq("product_id", productId)
            .not("user_id", "is", null);

        if (uniqueError) {
            console.error("[DownloadLog] Failed to get unique users:", uniqueError);
            return { totalDownloads: totalDownloads ?? 0, uniqueUsers: 0 };
        }

        // Count unique user_ids
        const uniqueUserIds = new Set(uniqueUserData?.map((d) => d.user_id) ?? []);

        return {
            totalDownloads: totalDownloads ?? 0,
            uniqueUsers: uniqueUserIds.size,
        };
    } catch (err) {
        console.error("[DownloadLog] Unexpected error getting stats:", err);
        return { totalDownloads: 0, uniqueUsers: 0 };
    }
}

/**
 * Get download logs for a specific user
 *
 * @param userId - User ID to get logs for
 * @param limit - Maximum number of logs to return (default 50)
 * @returns Array of download logs
 */
export async function getUserDownloadLogs(
    userId: string,
    limit: number = 50
): Promise<DownloadLog[]> {
    try {
        const supabase = getSupabaseClient();

        const { data, error } = await supabase
            .from("download_logs")
            .select("*")
            .eq("user_id", userId)
            .order("downloaded_at", { ascending: false })
            .limit(limit);

        if (error) {
            console.error("[DownloadLog] Failed to get user logs:", error);
            return [];
        }

        return data ?? [];
    } catch (err) {
        console.error("[DownloadLog] Unexpected error getting user logs:", err);
        return [];
    }
}

/**
 * Check if a download log entry contains required fields
 *
 * Used for validation and testing.
 *
 * @param log - Download log entry to check
 * @returns true if all required fields are present
 */
export function isValidDownloadLog(log: Partial<DownloadLog>): boolean {
    return !!(
        log.id &&
        log.product_id &&
        log.file_id &&
        log.downloaded_at &&
        (log.user_id || log.session_id)
    );
}
