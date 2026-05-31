/**
 * Property-Based Tests for File Upload Metadata Creation
 *
 * Tests that file upload creates complete metadata records with all required fields.
 *
 * **Feature: app-download-unlock, Property 1: File upload creates complete metadata record**
 * **Validates: Requirements 1.2, 1.3, 6.2**
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { generateStoragePath, generateUniqueFilename } from "./utils";

// ============================================
// Types for testing metadata creation
// ============================================

/**
 * Required fields for a ProductFile metadata record
 * Based on Requirements 1.3, 6.2
 */
interface ProductFileMetadata {
    product_id: string;
    filename: string;
    original_filename: string;
    file_size: number;
    mime_type: string;
    storage_path: string;
    uploaded_at: string;
}

/**
 * Simulates the metadata creation logic from the upload API
 * This mirrors the logic in dash/src/app/api/products/[productId]/files/route.ts
 */
function createFileMetadata(
    productId: string,
    originalFilename: string,
    fileSize: number,
    mimeType: string,
    existingFilenames: string[]
): ProductFileMetadata {
    const storageFilename = generateUniqueFilename(originalFilename, existingFilenames);
    const storagePath = generateStoragePath(productId, storageFilename);

    return {
        product_id: productId,
        filename: storageFilename,
        original_filename: originalFilename,
        file_size: fileSize,
        mime_type: mimeType,
        storage_path: storagePath,
        uploaded_at: new Date().toISOString(),
    };
}

/**
 * Validates that a metadata record has all required fields
 */
function hasAllRequiredFields(metadata: ProductFileMetadata): boolean {
    return (
        typeof metadata.product_id === "string" &&
        metadata.product_id.length > 0 &&
        typeof metadata.filename === "string" &&
        metadata.filename.length > 0 &&
        typeof metadata.original_filename === "string" &&
        metadata.original_filename.length > 0 &&
        typeof metadata.file_size === "number" &&
        metadata.file_size >= 0 &&
        typeof metadata.mime_type === "string" &&
        metadata.mime_type.length > 0 &&
        typeof metadata.storage_path === "string" &&
        metadata.storage_path.length > 0 &&
        typeof metadata.uploaded_at === "string" &&
        metadata.uploaded_at.length > 0
    );
}

/**
 * Validates that uploaded_at is a valid ISO timestamp
 */
function isValidISOTimestamp(timestamp: string): boolean {
    const date = new Date(timestamp);
    return !isNaN(date.getTime()) && timestamp.includes("T");
}

// ============================================
// Arbitraries for test data generation
// ============================================

/**
 * Generate a valid filename (no path separators)
 */
const filenameArb = fc.tuple(
    fc.string({ minLength: 1, maxLength: 30 }).filter(s =>
        !s.includes("/") && !s.includes("\\") && s.trim().length > 0
    ),
    fc.constantFrom(".exe", ".dmg", ".zip", ".tar.gz", ".txt", ".pdf", ".app", "")
).map(([base, ext]) => `${base.trim()}${ext}`);

/**
 * Generate a valid MIME type
 */
const mimeTypeArb = fc.constantFrom(
    "application/octet-stream",
    "application/zip",
    "application/x-msdownload",
    "application/x-apple-diskimage",
    "application/gzip",
    "application/pdf",
    "text/plain"
);

/**
 * Generate a valid file size (0 to 100MB)
 */
const fileSizeArb = fc.integer({ min: 0, max: 100 * 1024 * 1024 });

// ============================================
// Property 1: File upload creates complete metadata record
// **Feature: app-download-unlock, Property 1: File upload creates complete metadata record**
// **Validates: Requirements 1.2, 1.3, 6.2**
// ============================================

describe("Property 1: File upload creates complete metadata record", () => {
    /**
     * **Feature: app-download-unlock, Property 1: File upload creates complete metadata record**
     * **Validates: Requirements 1.2, 1.3, 6.2**
     *
     * For any file uploaded to a product, the system SHALL create a database record
     * containing all required metadata fields (product_id, filename, original_filename,
     * file_size, mime_type, storage_path, uploaded_at).
     */
    it("creates metadata with all required fields for any valid file upload", () => {
        fc.assert(
            fc.property(
                fc.uuid(),
                filenameArb,
                fileSizeArb,
                mimeTypeArb,
                fc.array(filenameArb, { minLength: 0, maxLength: 5 }),
                (productId, originalFilename, fileSize, mimeType, existingFilenames) => {
                    const metadata = createFileMetadata(
                        productId,
                        originalFilename,
                        fileSize,
                        mimeType,
                        existingFilenames
                    );

                    return hasAllRequiredFields(metadata);
                }
            ),
            { numRuns: 100 }
        );
    });

    it("preserves original filename in metadata", () => {
        fc.assert(
            fc.property(
                fc.uuid(),
                filenameArb,
                fileSizeArb,
                mimeTypeArb,
                fc.array(filenameArb, { minLength: 0, maxLength: 5 }),
                (productId, originalFilename, fileSize, mimeType, existingFilenames) => {
                    const metadata = createFileMetadata(
                        productId,
                        originalFilename,
                        fileSize,
                        mimeType,
                        existingFilenames
                    );

                    return metadata.original_filename === originalFilename;
                }
            ),
            { numRuns: 100 }
        );
    });

    it("stores correct product_id in metadata", () => {
        fc.assert(
            fc.property(
                fc.uuid(),
                filenameArb,
                fileSizeArb,
                mimeTypeArb,
                (productId, originalFilename, fileSize, mimeType) => {
                    const metadata = createFileMetadata(
                        productId,
                        originalFilename,
                        fileSize,
                        mimeType,
                        []
                    );

                    return metadata.product_id === productId;
                }
            ),
            { numRuns: 100 }
        );
    });

    it("stores correct file_size in metadata", () => {
        fc.assert(
            fc.property(
                fc.uuid(),
                filenameArb,
                fileSizeArb,
                mimeTypeArb,
                (productId, originalFilename, fileSize, mimeType) => {
                    const metadata = createFileMetadata(
                        productId,
                        originalFilename,
                        fileSize,
                        mimeType,
                        []
                    );

                    return metadata.file_size === fileSize;
                }
            ),
            { numRuns: 100 }
        );
    });

    it("stores correct mime_type in metadata", () => {
        fc.assert(
            fc.property(
                fc.uuid(),
                filenameArb,
                fileSizeArb,
                mimeTypeArb,
                (productId, originalFilename, fileSize, mimeType) => {
                    const metadata = createFileMetadata(
                        productId,
                        originalFilename,
                        fileSize,
                        mimeType,
                        []
                    );

                    return metadata.mime_type === mimeType;
                }
            ),
            { numRuns: 100 }
        );
    });

    it("generates valid storage_path following pattern", () => {
        fc.assert(
            fc.property(
                fc.uuid(),
                filenameArb,
                fileSizeArb,
                mimeTypeArb,
                (productId, originalFilename, fileSize, mimeType) => {
                    const metadata = createFileMetadata(
                        productId,
                        originalFilename,
                        fileSize,
                        mimeType,
                        []
                    );

                    // Storage path should start with products/{productId}/
                    return metadata.storage_path.startsWith(`products/${productId}/`);
                }
            ),
            { numRuns: 100 }
        );
    });

    it("generates valid ISO timestamp for uploaded_at", () => {
        fc.assert(
            fc.property(
                fc.uuid(),
                filenameArb,
                fileSizeArb,
                mimeTypeArb,
                (productId, originalFilename, fileSize, mimeType) => {
                    const metadata = createFileMetadata(
                        productId,
                        originalFilename,
                        fileSize,
                        mimeType,
                        []
                    );

                    return isValidISOTimestamp(metadata.uploaded_at);
                }
            ),
            { numRuns: 100 }
        );
    });

    it("handles duplicate filenames by generating unique storage filename", () => {
        fc.assert(
            fc.property(
                fc.uuid(),
                filenameArb,
                fileSizeArb,
                mimeTypeArb,
                (productId, originalFilename, fileSize, mimeType) => {
                    // Create metadata with the same filename already existing
                    const existingFilenames = [originalFilename];
                    const metadata = createFileMetadata(
                        productId,
                        originalFilename,
                        fileSize,
                        mimeType,
                        existingFilenames
                    );

                    // Storage filename should be different from original
                    // but original_filename should be preserved
                    return (
                        metadata.filename !== originalFilename &&
                        metadata.original_filename === originalFilename
                    );
                }
            ),
            { numRuns: 100 }
        );
    });

    it("storage_path contains the storage filename, not original filename when different", () => {
        fc.assert(
            fc.property(
                fc.uuid(),
                filenameArb,
                fileSizeArb,
                mimeTypeArb,
                (productId, originalFilename, fileSize, mimeType) => {
                    const existingFilenames = [originalFilename];
                    const metadata = createFileMetadata(
                        productId,
                        originalFilename,
                        fileSize,
                        mimeType,
                        existingFilenames
                    );

                    // Storage path should contain the storage filename
                    return metadata.storage_path.endsWith(`/${metadata.filename}`);
                }
            ),
            { numRuns: 100 }
        );
    });
});
