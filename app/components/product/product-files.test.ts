/**
 * Property-Based Tests for ProductFiles Component
 *
 * Tests that file display shows metadata without exposing download URLs.
 *
 * Requirements: 2.1, 2.4
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { getSafeFileMetadata } from "./product-files";
import type { ProductFile } from "~/lib/supabase/types";

// ============================================
// Arbitrary generators for ProductFile
// ============================================

/**
 * Generate a valid ISO date string
 */
const isoDateArb = fc.integer({ min: 1577836800000, max: 1924991999000 })
    .map(timestamp => new Date(timestamp).toISOString());

/**
 * Generate a valid ProductFile with all required fields
 */
const productFileArb = fc.record({
    id: fc.uuid(),
    product_id: fc.uuid(),
    filename: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
    original_filename: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
    file_size: fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER }),
    mime_type: fc.constantFrom(
        "application/zip",
        "application/x-msdownload",
        "application/x-apple-diskimage",
        "application/octet-stream",
        "application/pdf",
        "text/plain"
    ),
    storage_path: fc.string({ minLength: 1, maxLength: 200 }).map(s => `products/${s}`),
    uploaded_at: isoDateArb,
    updated_at: isoDateArb,
}) as fc.Arbitrary<ProductFile>;

// ============================================
// Property 4: Product file display shows metadata without download URL
// **Feature: app-download-unlock, Property 4: Product file display shows metadata without download URL**
// **Validates: Requirements 2.1, 2.4**
// ============================================

describe("Property 4: Product file display shows metadata without download URL", () => {
    /**
     * **Feature: app-download-unlock, Property 4: Product file display shows metadata without download URL**
     * **Validates: Requirements 2.1, 2.4**
     *
     * For any product with associated files, the product detail page SHALL display
     * file information (filename, size, type) for all files, and the response
     * SHALL NOT contain direct download URLs or storage paths.
     */
    it("getSafeFileMetadata excludes storage_path from output", () => {
        fc.assert(
            fc.property(
                productFileArb,
                (file) => {
                    const safeMetadata = getSafeFileMetadata(file);

                    // storage_path should NOT be in the result
                    return !("storage_path" in safeMetadata);
                }
            ),
            { numRuns: 100 }
        );
    });

    it("getSafeFileMetadata preserves all display metadata fields", () => {
        fc.assert(
            fc.property(
                productFileArb,
                (file) => {
                    const safeMetadata = getSafeFileMetadata(file);

                    // All display fields should be preserved
                    return (
                        safeMetadata.id === file.id &&
                        safeMetadata.product_id === file.product_id &&
                        safeMetadata.filename === file.filename &&
                        safeMetadata.original_filename === file.original_filename &&
                        safeMetadata.file_size === file.file_size &&
                        safeMetadata.mime_type === file.mime_type &&
                        safeMetadata.uploaded_at === file.uploaded_at &&
                        safeMetadata.updated_at === file.updated_at
                    );
                }
            ),
            { numRuns: 100 }
        );
    });

    it("safe metadata does not contain any URL-like strings in values", () => {
        fc.assert(
            fc.property(
                productFileArb,
                (file) => {
                    const safeMetadata = getSafeFileMetadata(file);

                    // Check that no value contains URL patterns
                    const urlPatterns = [
                        /^https?:\/\//,
                        /^products\//,
                        /supabase/i,
                        /storage/i,
                    ];

                    // Only check string values that could be URLs
                    const stringValues = [
                        safeMetadata.filename,
                        safeMetadata.original_filename,
                    ];

                    // These fields should not contain URL-like patterns
                    for (const value of stringValues) {
                        for (const pattern of urlPatterns) {
                            if (pattern.test(value)) {
                                // filename and original_filename should not start with URL patterns
                                // but may contain "storage" as part of a legitimate filename
                                if (pattern.source === "^https?:\\/\\/" || pattern.source === "^products\\/") {
                                    return false;
                                }
                            }
                        }
                    }

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    it("original file storage_path is not accessible from safe metadata", () => {
        fc.assert(
            fc.property(
                productFileArb,
                (file) => {
                    const safeMetadata = getSafeFileMetadata(file);

                    // Verify the original storage_path cannot be reconstructed from safe metadata
                    const safeMetadataJson = JSON.stringify(safeMetadata);

                    // The storage_path should not appear in the serialized output
                    return !safeMetadataJson.includes(file.storage_path);
                }
            ),
            { numRuns: 100 }
        );
    });

    it("safe metadata has correct number of fields (8 fields, excluding storage_path)", () => {
        fc.assert(
            fc.property(
                productFileArb,
                (file) => {
                    const safeMetadata = getSafeFileMetadata(file);
                    const fieldCount = Object.keys(safeMetadata).length;

                    // ProductFile has 9 fields, safe metadata should have 8 (excluding storage_path)
                    return fieldCount === 8;
                }
            ),
            { numRuns: 100 }
        );
    });
});

// ============================================
// Additional unit tests for edge cases
// ============================================

describe("ProductFiles edge cases", () => {
    it("handles file with empty storage_path", () => {
        const file: ProductFile = {
            id: "test-id",
            product_id: "product-id",
            filename: "test.exe",
            original_filename: "test.exe",
            file_size: 1024,
            mime_type: "application/x-msdownload",
            storage_path: "",
            uploaded_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };

        const safeMetadata = getSafeFileMetadata(file);
        expect(safeMetadata).not.toHaveProperty("storage_path");
        expect(safeMetadata.original_filename).toBe("test.exe");
    });

    it("handles file with special characters in filename", () => {
        const file: ProductFile = {
            id: "test-id",
            product_id: "product-id",
            filename: "测试文件 (v1.0).zip",
            original_filename: "测试文件 (v1.0).zip",
            file_size: 2048,
            mime_type: "application/zip",
            storage_path: "products/product-id/测试文件 (v1.0).zip",
            uploaded_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };

        const safeMetadata = getSafeFileMetadata(file);
        expect(safeMetadata).not.toHaveProperty("storage_path");
        expect(safeMetadata.original_filename).toBe("测试文件 (v1.0).zip");
    });
});
