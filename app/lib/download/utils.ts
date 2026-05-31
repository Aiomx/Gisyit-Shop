/**
 * Download Utility Functions
 *
 * Utility functions for file handling in the download feature.
 * Includes file size formatting, storage path generation, and unique filename generation.
 *
 * Requirements: 2.3, 6.1, 6.4
 */

// ============================================
// File Size Formatting
// Requirements: 2.3
// ============================================

/**
 * File size units in ascending order
 */
const FILE_SIZE_UNITS = ["B", "KB", "MB", "GB", "TB"] as const;

/**
 * Bytes per unit (1024)
 */
const BYTES_PER_UNIT = 1024;

/**
 * Format file size in bytes to human-readable string
 *
 * Converts a file size in bytes to a human-readable format with appropriate unit.
 * Uses binary units (1 KB = 1024 bytes).
 *
 * @param bytes - File size in bytes (must be non-negative integer)
 * @returns Human-readable file size string (e.g., "1.5 MB", "256 KB", "0 B")
 *
 * Requirements: 2.3
 *
 * @example
 * formatFileSize(0) // "0 B"
 * formatFileSize(1024) // "1 KB"
 * formatFileSize(1536) // "1.5 KB"
 * formatFileSize(1048576) // "1 MB"
 */
export function formatFileSize(bytes: number): string {
    // Handle zero case
    if (bytes === 0) {
        return "0 B";
    }

    // Handle negative values (treat as 0)
    if (bytes < 0) {
        return "0 B";
    }

    // Calculate the appropriate unit index
    const unitIndex = Math.min(
        Math.floor(Math.log(bytes) / Math.log(BYTES_PER_UNIT)),
        FILE_SIZE_UNITS.length - 1
    );

    // Calculate the value in the selected unit
    const value = bytes / Math.pow(BYTES_PER_UNIT, unitIndex);

    // Format with up to 2 decimal places, removing trailing zeros
    const formattedValue = value % 1 === 0
        ? value.toString()
        : parseFloat(value.toFixed(2)).toString();

    return `${formattedValue} ${FILE_SIZE_UNITS[unitIndex]}`;
}

// ============================================
// Storage Path Generation
// Requirements: 6.1
// ============================================

/**
 * Generate storage path for a product file
 *
 * Creates a storage path following the pattern: products/{product_id}/{filename}
 *
 * @param productId - UUID of the product
 * @param filename - Name of the file
 * @returns Storage path string
 *
 * Requirements: 6.1
 *
 * @example
 * generateStoragePath("abc-123", "app.exe") // "products/abc-123/app.exe"
 */
export function generateStoragePath(productId: string, filename: string): string {
    return `products/${productId}/${filename}`;
}

// ============================================
// Unique Filename Generation
// Requirements: 6.4
// ============================================

/**
 * Generate a unique filename to prevent overwrites
 *
 * When a file with the same name already exists, this function generates
 * a unique filename by appending a timestamp and random suffix.
 * The original filename is preserved for display purposes.
 *
 * @param originalFilename - The original filename
 * @param existingFilenames - Array of existing filenames for the product
 * @returns Unique filename (may be same as original if no conflict)
 *
 * Requirements: 6.4
 *
 * @example
 * generateUniqueFilename("app.exe", []) // "app.exe"
 * generateUniqueFilename("app.exe", ["app.exe"]) // "app_1734789600000_a1b2.exe"
 */
export function generateUniqueFilename(
    originalFilename: string,
    existingFilenames: string[]
): string {
    // If no conflict, return original filename
    if (!existingFilenames.includes(originalFilename)) {
        return originalFilename;
    }

    // Extract file extension and base name
    const lastDotIndex = originalFilename.lastIndexOf(".");
    const hasExtension = lastDotIndex > 0;
    const baseName = hasExtension
        ? originalFilename.slice(0, lastDotIndex)
        : originalFilename;
    const extension = hasExtension
        ? originalFilename.slice(lastDotIndex)
        : "";

    // Generate unique suffix with timestamp and random string
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).slice(2, 6);

    return `${baseName}_${timestamp}_${randomSuffix}${extension}`;
}

/**
 * Check if a filename already exists in the list
 *
 * @param filename - Filename to check
 * @param existingFilenames - Array of existing filenames
 * @returns True if filename exists
 */
export function filenameExists(
    filename: string,
    existingFilenames: string[]
): boolean {
    return existingFilenames.includes(filename);
}
