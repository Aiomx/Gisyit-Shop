/**
 * Download API Route
 *
 * Handles file download requests by verifying permission and generating signed URLs.
 * Only users with valid paid orders can download files.
 *
 * GET /api/download/:fileId
 *
 * Requirements: 3.1, 3.2, 3.5
 */

import { getSupabaseClient } from "~/lib/supabase/client.server";
import { checkDownloadPermission } from "~/lib/download/permission.server";
import { generateSignedUrl } from "~/lib/download/signed-url.server";
import {
    DownloadErrorCodes,
    type DownloadApiResponse,
    type DownloadErrorCode,
} from "~/lib/download/types";
import type { ProductFile } from "~/lib/supabase/types";

type LoaderArgs = {
    request: Request;
    params: { fileId: string };
};

/**
 * Create error response with appropriate status code
 */
function createErrorResponse(
    errorCode: DownloadErrorCode,
    message: string,
    status: number
): Response {
    const response: DownloadApiResponse = {
        success: false,
        error: message,
        error_code: errorCode,
    };
    return Response.json(response, { status });
}

/**
 * Get file information from database
 */
async function getFileInfo(fileId: string): Promise<ProductFile | null> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
        .from("product_files")
        .select("*")
        .eq("id", fileId)
        .single();

    if (error || !data) {
        console.error("[Download API] File not found:", fileId, error);
        return null;
    }

    return data as ProductFile;
}

/**
 * Download API Loader
 *
 * Handles GET requests for file downloads.
 * Verifies user permission and generates a signed URL.
 *
 * Requirements: 3.1, 3.2, 3.5
 */
export async function loader({ request, params }: LoaderArgs): Promise<Response> {
    const { fileId } = params;

    // Validate fileId parameter
    if (!fileId) {
        return createErrorResponse(
            DownloadErrorCodes.FILE_NOT_FOUND,
            "File ID is required",
            400
        );
    }

    // Step 1: Get file information
    const file = await getFileInfo(fileId);

    if (!file) {
        return createErrorResponse(
            DownloadErrorCodes.FILE_NOT_FOUND,
            "File not found",
            404
        );
    }

    // Step 2: Check download permission
    // Requirements: 5.1, 5.2, 5.3
    const permissionResult = await checkDownloadPermission({
        request,
        productId: file.product_id,
    });

    if (!permissionResult.permission.allowed) {
        const { reason } = permissionResult.permission;

        switch (reason) {
            case "no_auth":
                return createErrorResponse(
                    DownloadErrorCodes.UNAUTHORIZED,
                    "Authentication required to download files",
                    401
                );
            case "no_purchase":
                return createErrorResponse(
                    DownloadErrorCodes.NO_PURCHASE,
                    "You must purchase this product to download files",
                    403
                );
            case "invalid_order_status":
                return createErrorResponse(
                    DownloadErrorCodes.INVALID_ORDER_STATUS,
                    "Your order is not in a valid status for downloads",
                    403
                );
            default:
                return createErrorResponse(
                    DownloadErrorCodes.UNAUTHORIZED,
                    "Download not permitted",
                    403
                );
        }
    }

    // Step 3: Generate signed URL
    // Requirements: 3.2, 3.3, 3.5
    const signedUrlResult = await generateSignedUrl({
        storagePath: file.storage_path,
        originalFilename: file.original_filename,
    });

    if (!signedUrlResult.success || !signedUrlResult.data) {
        console.error("[Download API] Failed to generate signed URL:", signedUrlResult.error);
        return createErrorResponse(
            DownloadErrorCodes.SIGNED_URL_FAILED,
            signedUrlResult.error || "Failed to generate download URL",
            500
        );
    }

    // Step 4: Return signed URL response
    // Requirements: 3.1, 3.5
    const response: DownloadApiResponse = {
        success: true,
        url: signedUrlResult.data.url,
        filename: signedUrlResult.data.filename, // Original filename for download
    };

    return Response.json(response);
}
