/**
 * Download Type Definitions
 *
 * Types for the app download unlock feature.
 * These types define the data structures for download permissions,
 * signed URL generation, and user downloads.
 *
 * Requirements: 1.3, 3.1
 */

import type { OrderStatus, ProductFile } from "~/lib/supabase/types";

// Re-export ProductFile for convenience
export type { ProductFile } from "~/lib/supabase/types";

// ============================================
// Download Permission Types
// ============================================

/**
 * Reasons for download permission denial
 */
export type DownloadDenialReason =
    | "no_auth"              // User not authenticated
    | "no_purchase"          // User has no order for this product
    | "invalid_order_status"; // Order exists but status is not valid

/**
 * Valid order statuses that grant download permission
 *
 * Requirements: 5.2
 */
export const VALID_DOWNLOAD_ORDER_STATUSES: OrderStatus[] = [
    "paid",
    "fulfilled",
    "completed",
];

/**
 * Download permission check result
 *
 * Indicates whether a user is allowed to download a file
 * and provides the reason if denied.
 *
 * Requirements: 5.1, 5.2, 5.3
 */
export interface DownloadPermission {
    allowed: boolean;
    reason?: DownloadDenialReason;
    order_id?: string;  // Present when allowed, for audit purposes
}

// ============================================
// Signed URL Types
// ============================================

/**
 * Signed URL expiration time in seconds (1 hour)
 *
 * Requirements: 3.3
 */
export const SIGNED_URL_EXPIRATION_SECONDS = 3600;

/**
 * Signed URL response from the download API
 *
 * Contains the temporary download URL and metadata.
 *
 * Requirements: 3.2, 3.3, 3.5
 */
export interface SignedUrlResponse {
    url: string;          // Signed URL for download
    expires_at: string;   // ISO timestamp when URL expires
    filename: string;     // Original filename for download
}

// ============================================
// User Downloads Types
// ============================================

/**
 * User download item for the account downloads page
 *
 * Represents a purchased product with its downloadable files,
 * grouped by order for display purposes.
 *
 * Requirements: 4.1, 4.2, 4.4
 */
export interface UserDownloadItem {
    product_id: string;
    product_name: string;
    product_code: string;
    /** URL-friendly slug for the product */
    product_slug?: string;
    order_id: string;
    order_number: string;
    order_date: string;   // ISO timestamp
    files: ProductFile[];
}

// ============================================
// Download API Types
// ============================================

/**
 * Download API response
 *
 * Requirements: 3.1, 3.2
 */
export interface DownloadApiResponse {
    success: boolean;
    url?: string;           // Signed URL (present on success)
    filename?: string;      // Original filename (present on success)
    error?: string;         // Error message (present on failure)
    error_code?: DownloadErrorCode;
}

/**
 * Error codes for download operations
 */
export const DownloadErrorCodes = {
    // Authentication errors
    UNAUTHORIZED: "UNAUTHORIZED",

    // Permission errors
    NO_PURCHASE: "NO_PURCHASE",
    INVALID_ORDER_STATUS: "INVALID_ORDER_STATUS",

    // Resource errors
    FILE_NOT_FOUND: "FILE_NOT_FOUND",
    PRODUCT_NOT_FOUND: "PRODUCT_NOT_FOUND",

    // Storage errors
    STORAGE_ERROR: "STORAGE_ERROR",
    SIGNED_URL_FAILED: "SIGNED_URL_FAILED",
} as const;

export type DownloadErrorCode = typeof DownloadErrorCodes[keyof typeof DownloadErrorCodes];
