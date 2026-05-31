/**
 * Signed URL Generation (Server-side only)
 *
 * Handles generation of time-limited signed URLs for file downloads.
 * Uses Supabase Storage to create secure, temporary download links.
 *
 * Requirements: 3.2, 3.3
 */

import { getSupabaseClient } from "~/lib/supabase/client.server";
import { SIGNED_URL_EXPIRATION_SECONDS, type SignedUrlResponse } from "./types";

// ============================================
// Signed URL Generation Types
// ============================================

/**
 * Parameters for generating a signed URL
 */
export interface GenerateSignedUrlParams {
    storagePath: string;      // Path in Supabase Storage
    originalFilename: string; // Original filename for download
}

/**
 * Result of signed URL generation
 */
export interface SignedUrlResult {
    success: boolean;
    data?: SignedUrlResponse;
    error?: string;
}

// ============================================
// Core Signed URL Logic
// ============================================

/**
 * Calculate expiration timestamp from current time
 *
 * Requirements: 3.3
 *
 * @param expirationSeconds - Number of seconds until expiration
 * @returns ISO timestamp string of expiration time
 */
export function calculateExpirationTime(expirationSeconds: number = SIGNED_URL_EXPIRATION_SECONDS): string {
    const expiresAt = new Date(Date.now() + expirationSeconds * 1000);
    return expiresAt.toISOString();
}

/**
 * Validate that expiration time is approximately 1 hour from now
 *
 * Used for testing to verify correct expiration is set.
 *
 * @param expiresAt - ISO timestamp to validate
 * @param toleranceMs - Tolerance in milliseconds (default 5 seconds)
 * @returns True if expiration is within tolerance of 1 hour
 */
export function isValidExpiration(
    expiresAt: string,
    toleranceMs: number = 5000
): boolean {
    const expirationTime = new Date(expiresAt).getTime();
    const expectedExpiration = Date.now() + SIGNED_URL_EXPIRATION_SECONDS * 1000;
    const difference = Math.abs(expirationTime - expectedExpiration);
    return difference <= toleranceMs;
}

/**
 * Storage bucket name for product files
 */
const STORAGE_BUCKET = "product-files";

/**
 * Generate a signed URL for downloading a file
 *
 * Creates a time-limited signed URL that allows downloading the file
 * from Supabase Storage. The URL expires after 1 hour.
 *
 * Requirements: 3.2, 3.3
 *
 * @param params - Storage path and original filename
 * @returns Signed URL response or error
 */
export async function generateSignedUrl(
    params: GenerateSignedUrlParams
): Promise<SignedUrlResult> {
    const { storagePath, originalFilename } = params;

    try {
        const supabase = getSupabaseClient();

        // Generate signed URL with 1 hour expiration
        // Requirements: 3.3
        const { data, error } = await supabase.storage
            .from(STORAGE_BUCKET)
            .createSignedUrl(storagePath, SIGNED_URL_EXPIRATION_SECONDS, {
                download: originalFilename, // Sets Content-Disposition header
            });

        if (error) {
            console.error("[SignedUrl] Failed to generate signed URL:", error);
            return {
                success: false,
                error: `Failed to generate download URL: ${error.message}`,
            };
        }

        if (!data?.signedUrl) {
            return {
                success: false,
                error: "No signed URL returned from storage",
            };
        }

        // Calculate expiration time
        const expiresAt = calculateExpirationTime();

        return {
            success: true,
            data: {
                url: data.signedUrl,
                expires_at: expiresAt,
                filename: originalFilename,
            },
        };
    } catch (err) {
        console.error("[SignedUrl] Unexpected error:", err);
        return {
            success: false,
            error: `Unexpected error generating download URL: ${String(err)}`,
        };
    }
}

/**
 * Create a signed URL response object
 *
 * Helper function for creating SignedUrlResponse objects.
 * Useful for testing and mocking.
 *
 * @param url - The signed URL
 * @param filename - Original filename
 * @param expiresAt - Optional expiration time (defaults to 1 hour from now)
 * @returns SignedUrlResponse object
 */
export function createSignedUrlResponse(
    url: string,
    filename: string,
    expiresAt?: string
): SignedUrlResponse {
    return {
        url,
        filename,
        expires_at: expiresAt ?? calculateExpirationTime(),
    };
}
