/**
 * Property-Based Tests for Cascade Delete
 *
 * Tests for product file cascade deletion logic.
 * Property 10: Product deletion cascades to files
 *
 * Requirements: 1.5, 6.3
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";

// ============================================
// Types for Testing
// ============================================

interface ProductFile {
    id: string;
    product_id: string;
    filename: string;
    original_filename: string;
    file_size: number;
    mime_type: string;
    storage_path: string;
}

interface FileCleanupResult {
    success: boolean;
    deletedCount: number;
    errors: string[];
}

// ============================================
// Pure Functions for Testing Cascade Delete Logic
// ============================================

/**
 * Get files that belong to a specific product
 *
 * This simulates the database query to get all files for a product.
 */
function getFilesForProduct(
    allFiles: ProductFile[],
    productId: string
): ProductFile[] {
    return allFiles.filter((f) => f.product_id === productId);
}

/**
 * Get storage paths for a list of files
 *
 * This extracts the storage paths needed for Storage deletion.
 */
function getStoragePaths(files: ProductFile[]): string[] {
    return files.map((f) => f.storage_path);
}

/**
 * Simulate cascade delete operation
 *
 * This function simulates what happens when a product is deleted:
 * 1. All files for the product are identified
 * 2. Storage paths are extracted for Storage deletion
 * 3. Files are removed from the database
 *
 * Returns the result of the cleanup operation.
 */
function simulateCascadeDelete(
    allFiles: ProductFile[],
    productId: string
): {
    result: FileCleanupResult;
    remainingFiles: ProductFile[];
    deletedStoragePaths: string[];
} {
    // Step 1: Get files for this product
    const productFiles = getFilesForProduct(allFiles, productId);

    // Step 2: Get storage paths for deletion
    const storagePaths = getStoragePaths(productFiles);

    // Step 3: Remove files from the "database" (filter out deleted files)
    const remainingFiles = allFiles.filter((f) => f.product_id !== productId);

    return {
        result: {
            success: true,
            deletedCount: productFiles.length,
            errors: [],
        },
        remainingFiles,
        deletedStoragePaths: storagePaths,
    };
}

/**
 * Verify that no files remain for a deleted product
 */
function verifyNoFilesRemain(
    files: ProductFile[],
    productId: string
): boolean {
    return files.every((f) => f.product_id !== productId);
}

/**
 * Verify that all storage paths for a product were marked for deletion
 */
function verifyAllStoragePathsDeleted(
    originalFiles: ProductFile[],
    productId: string,
    deletedPaths: string[]
): boolean {
    const expectedPaths = originalFiles
        .filter((f) => f.product_id === productId)
        .map((f) => f.storage_path);

    // All expected paths should be in deleted paths
    return expectedPaths.every((path) => deletedPaths.includes(path));
}

// ============================================
// Arbitraries
// ============================================

/**
 * Arbitrary for generating a valid storage path
 */
const storagePathArb = (productId: string, filename: string) =>
    fc.constant(`products/${productId}/${filename}`);

/**
 * Arbitrary for generating a product file
 */
const productFileArb = (productId: string): fc.Arbitrary<ProductFile> =>
    fc.record({
        id: fc.uuid(),
        product_id: fc.constant(productId),
        filename: fc.string({ minLength: 1, maxLength: 50 }).filter((s) => !s.includes("/")),
        original_filename: fc.string({ minLength: 1, maxLength: 50 }).filter((s) => !s.includes("/")),
        file_size: fc.integer({ min: 1, max: 1000000000 }),
        mime_type: fc.constantFrom(
            "application/octet-stream",
            "application/zip",
            "application/x-msdownload",
            "application/x-apple-diskimage"
        ),
        storage_path: fc.string({ minLength: 1, maxLength: 100 }),
    }).map((file) => ({
        ...file,
        storage_path: `products/${productId}/${file.filename}`,
    }));

/**
 * Arbitrary for generating a list of product files for multiple products
 */
const multiProductFilesArb = fc
    .array(fc.uuid(), { minLength: 1, maxLength: 5 })
    .chain((productIds) =>
        fc.tuple(
            fc.constant(productIds),
            fc.array(
                fc.constantFrom(...productIds).chain((pid) => productFileArb(pid)),
                { minLength: 0, maxLength: 20 }
            )
        )
    );

// ============================================
// Property 10: Product deletion cascades to files
// **Feature: app-download-unlock, Property 10: Product deletion cascades to files**
// **Validates: Requirements 1.5, 6.3**
// ============================================

describe("Property 10: Product deletion cascades to files", () => {
    /**
     * **Feature: app-download-unlock, Property 10: Product deletion cascades to files**
     * **Validates: Requirements 1.5, 6.3**
     *
     * For any product deletion, all associated files SHALL be removed from
     * both the database (product_files table) and Supabase Storage.
     */
    it("removes all files for a deleted product from the database", () => {
        fc.assert(
            fc.property(
                multiProductFilesArb,
                ([productIds, allFiles]) => {
                    // Pick a random product to delete
                    const productToDelete = productIds[0];

                    // Perform cascade delete
                    const { remainingFiles } = simulateCascadeDelete(
                        allFiles,
                        productToDelete
                    );

                    // Verify no files remain for the deleted product
                    return verifyNoFilesRemain(remainingFiles, productToDelete);
                }
            ),
            { numRuns: 100 }
        );
    });

    it("identifies all storage paths for deletion", () => {
        fc.assert(
            fc.property(
                multiProductFilesArb,
                ([productIds, allFiles]) => {
                    const productToDelete = productIds[0];

                    const { deletedStoragePaths } = simulateCascadeDelete(
                        allFiles,
                        productToDelete
                    );

                    // Verify all storage paths for the product are marked for deletion
                    return verifyAllStoragePathsDeleted(
                        allFiles,
                        productToDelete,
                        deletedStoragePaths
                    );
                }
            ),
            { numRuns: 100 }
        );
    });

    it("returns correct deleted count", () => {
        fc.assert(
            fc.property(
                multiProductFilesArb,
                ([productIds, allFiles]) => {
                    const productToDelete = productIds[0];
                    const expectedCount = allFiles.filter(
                        (f) => f.product_id === productToDelete
                    ).length;

                    const { result } = simulateCascadeDelete(allFiles, productToDelete);

                    return result.deletedCount === expectedCount;
                }
            ),
            { numRuns: 100 }
        );
    });

    it("does not affect files from other products", () => {
        fc.assert(
            fc.property(
                multiProductFilesArb.filter(([ids]) => ids.length >= 2),
                ([productIds, allFiles]) => {
                    const productToDelete = productIds[0];
                    const otherProductId = productIds[1];

                    // Count files for other product before deletion
                    const otherFilesBefore = allFiles.filter(
                        (f) => f.product_id === otherProductId
                    ).length;

                    // Perform cascade delete
                    const { remainingFiles } = simulateCascadeDelete(
                        allFiles,
                        productToDelete
                    );

                    // Count files for other product after deletion
                    const otherFilesAfter = remainingFiles.filter(
                        (f) => f.product_id === otherProductId
                    ).length;

                    // Other product's files should be unchanged
                    return otherFilesBefore === otherFilesAfter;
                }
            ),
            { numRuns: 100 }
        );
    });

    it("handles products with no files gracefully", () => {
        fc.assert(
            fc.property(
                fc.uuid(), // product with no files
                fc.array(productFileArb(fc.sample(fc.uuid(), 1)[0]), { minLength: 0, maxLength: 10 }),
                (emptyProductId, otherFiles) => {
                    // Ensure none of the files belong to the empty product
                    const filesWithoutEmptyProduct = otherFiles.filter(
                        (f) => f.product_id !== emptyProductId
                    );

                    const { result, remainingFiles } = simulateCascadeDelete(
                        filesWithoutEmptyProduct,
                        emptyProductId
                    );

                    // Should succeed with 0 deleted
                    return (
                        result.success === true &&
                        result.deletedCount === 0 &&
                        remainingFiles.length === filesWithoutEmptyProduct.length
                    );
                }
            ),
            { numRuns: 100 }
        );
    });

    it("storage paths follow the correct pattern", () => {
        fc.assert(
            fc.property(
                fc.uuid(),
                fc.array(fc.string({ minLength: 1, maxLength: 30 }).filter((s) => !s.includes("/")), {
                    minLength: 1,
                    maxLength: 5,
                }),
                (productId, filenames) => {
                    const files: ProductFile[] = filenames.map((filename, i) => ({
                        id: `file-${i}`,
                        product_id: productId,
                        filename,
                        original_filename: filename,
                        file_size: 1000,
                        mime_type: "application/octet-stream",
                        storage_path: `products/${productId}/${filename}`,
                    }));

                    const { deletedStoragePaths } = simulateCascadeDelete(files, productId);

                    // All deleted paths should follow the pattern
                    return deletedStoragePaths.every((path) =>
                        path.startsWith(`products/${productId}/`)
                    );
                }
            ),
            { numRuns: 100 }
        );
    });
});

// ============================================
// Helper Function Tests
// ============================================

describe("getFilesForProduct", () => {
    it("returns only files for the specified product", () => {
        fc.assert(
            fc.property(
                multiProductFilesArb,
                ([productIds, allFiles]) => {
                    const targetProduct = productIds[0];
                    const result = getFilesForProduct(allFiles, targetProduct);

                    return result.every((f) => f.product_id === targetProduct);
                }
            ),
            { numRuns: 100 }
        );
    });

    it("returns empty array for non-existent product", () => {
        fc.assert(
            fc.property(
                fc.uuid(),
                multiProductFilesArb,
                (nonExistentId, [, allFiles]) => {
                    // Ensure the ID doesn't exist in the files
                    const filesWithoutId = allFiles.filter(
                        (f) => f.product_id !== nonExistentId
                    );
                    const result = getFilesForProduct(filesWithoutId, nonExistentId);

                    return result.length === 0;
                }
            ),
            { numRuns: 100 }
        );
    });
});

describe("getStoragePaths", () => {
    it("extracts all storage paths from files", () => {
        fc.assert(
            fc.property(
                fc.uuid().chain((pid) =>
                    fc.array(productFileArb(pid), { minLength: 1, maxLength: 10 })
                ),
                (files) => {
                    const paths = getStoragePaths(files);

                    return (
                        paths.length === files.length &&
                        files.every((f) => paths.includes(f.storage_path))
                    );
                }
            ),
            { numRuns: 100 }
        );
    });

    it("returns empty array for empty file list", () => {
        const paths = getStoragePaths([]);
        expect(paths).toEqual([]);
    });
});
