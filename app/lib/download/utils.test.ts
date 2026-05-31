/**
 * Property-Based Tests for Download Utilities
 *
 * Tests for file size formatting, storage path generation, and unique filename generation.
 *
 * Requirements: 2.3, 6.1, 6.4
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
    formatFileSize,
    generateStoragePath,
    generateUniqueFilename,
    filenameExists,
} from "./utils";

// ============================================
// Property 5: File size formatting produces human-readable output
// **Feature: app-download-unlock, Property 5: File size formatting produces human-readable output**
// **Validates: Requirements 2.3**
// ============================================

describe("Property 5: File size formatting produces human-readable output", () => {
    /**
     * **Feature: app-download-unlock, Property 5: File size formatting produces human-readable output**
     * **Validates: Requirements 2.3**
     *
     * For any file size in bytes, the formatting function SHALL produce
     * a human-readable string with appropriate unit (B, KB, MB, GB, TB).
     */
    it("produces valid human-readable format for any non-negative integer", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER }),
                (bytes) => {
                    const formatted = formatFileSize(bytes);

                    // Result should match pattern: number + space + unit
                    const pattern = /^\d+(\.\d+)?\s(B|KB|MB|GB|TB)$/;
                    return pattern.test(formatted);
                }
            ),
            { numRuns: 100 }
        );
    });

    it("zero bytes formats to '0 B'", () => {
        expect(formatFileSize(0)).toBe("0 B");
    });

    it("formats bytes correctly (< 1024)", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 1023 }),
                (bytes) => {
                    const formatted = formatFileSize(bytes);
                    return formatted.endsWith(" B") && !formatted.includes("KB");
                }
            ),
            { numRuns: 100 }
        );
    });

    it("formats kilobytes correctly (1024 - 1048575)", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1024, max: 1048575 }),
                (bytes) => {
                    const formatted = formatFileSize(bytes);
                    return formatted.endsWith(" KB");
                }
            ),
            { numRuns: 100 }
        );
    });

    it("formats megabytes correctly (1MB - 1GB)", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1048576, max: 1073741823 }),
                (bytes) => {
                    const formatted = formatFileSize(bytes);
                    return formatted.endsWith(" MB");
                }
            ),
            { numRuns: 100 }
        );
    });

    it("formats gigabytes correctly (1GB - 1TB)", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1073741824, max: 1099511627775 }),
                (bytes) => {
                    const formatted = formatFileSize(bytes);
                    return formatted.endsWith(" GB");
                }
            ),
            { numRuns: 100 }
        );
    });

    it("exact unit boundaries format correctly", () => {
        expect(formatFileSize(1024)).toBe("1 KB");
        expect(formatFileSize(1048576)).toBe("1 MB");
        expect(formatFileSize(1073741824)).toBe("1 GB");
        expect(formatFileSize(1099511627776)).toBe("1 TB");
    });

    it("handles negative values gracefully", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: -Number.MAX_SAFE_INTEGER, max: -1 }),
                (bytes) => {
                    const formatted = formatFileSize(bytes);
                    return formatted === "0 B";
                }
            ),
            { numRuns: 100 }
        );
    });
});


// ============================================
// Property 2: File storage path follows pattern
// **Feature: app-download-unlock, Property 2: File storage path follows pattern**
// **Validates: Requirements 6.1**
// ============================================

describe("Property 2: File storage path follows pattern", () => {
    /**
     * **Feature: app-download-unlock, Property 2: File storage path follows pattern**
     * **Validates: Requirements 6.1**
     *
     * For any product file upload, the storage path SHALL follow
     * the pattern `products/{product_id}/{filename}`.
     */
    it("generates path following products/{product_id}/{filename} pattern", () => {
        fc.assert(
            fc.property(
                fc.uuid(),
                fc.string({ minLength: 1, maxLength: 100 }).filter(s => !s.includes("/")),
                (productId, filename) => {
                    const path = generateStoragePath(productId, filename);
                    return path === `products/${productId}/${filename}`;
                }
            ),
            { numRuns: 100 }
        );
    });

    it("path starts with 'products/' prefix", () => {
        fc.assert(
            fc.property(
                fc.uuid(),
                fc.string({ minLength: 1, maxLength: 100 }).filter(s => !s.includes("/")),
                (productId, filename) => {
                    const path = generateStoragePath(productId, filename);
                    return path.startsWith("products/");
                }
            ),
            { numRuns: 100 }
        );
    });

    it("path contains product ID as second segment", () => {
        fc.assert(
            fc.property(
                fc.uuid(),
                fc.string({ minLength: 1, maxLength: 100 }).filter(s => !s.includes("/")),
                (productId, filename) => {
                    const path = generateStoragePath(productId, filename);
                    const segments = path.split("/");
                    return segments[1] === productId;
                }
            ),
            { numRuns: 100 }
        );
    });

    it("path contains filename as third segment", () => {
        fc.assert(
            fc.property(
                fc.uuid(),
                fc.string({ minLength: 1, maxLength: 100 }).filter(s => !s.includes("/")),
                (productId, filename) => {
                    const path = generateStoragePath(productId, filename);
                    const segments = path.split("/");
                    return segments[2] === filename;
                }
            ),
            { numRuns: 100 }
        );
    });

    it("path has exactly 3 segments", () => {
        fc.assert(
            fc.property(
                fc.uuid(),
                fc.string({ minLength: 1, maxLength: 100 }).filter(s => !s.includes("/")),
                (productId, filename) => {
                    const path = generateStoragePath(productId, filename);
                    const segments = path.split("/");
                    return segments.length === 3;
                }
            ),
            { numRuns: 100 }
        );
    });
});


// ============================================
// Property 3: Duplicate filename generates unique storage name
// **Feature: app-download-unlock, Property 3: Duplicate filename generates unique storage name**
// **Validates: Requirements 6.4**
// ============================================

/**
 * Generate a valid filename (no path separators, reasonable length)
 */
const filenameArb = fc.string({ minLength: 1, maxLength: 50 })
    .filter(s => !s.includes("/") && !s.includes("\\") && s.trim().length > 0)
    .map(s => s.trim());

/**
 * Generate a filename with extension
 */
const filenameWithExtArb = fc.tuple(
    fc.string({ minLength: 1, maxLength: 30 }).filter(s => !s.includes("/") && !s.includes("\\") && !s.includes(".") && s.trim().length > 0),
    fc.constantFrom(".exe", ".dmg", ".zip", ".tar.gz", ".txt", ".pdf", "")
).map(([base, ext]) => `${base.trim()}${ext}`);

describe("Property 3: Duplicate filename generates unique storage name", () => {
    /**
     * **Feature: app-download-unlock, Property 3: Duplicate filename generates unique storage name**
     * **Validates: Requirements 6.4**
     *
     * For any file upload where a file with the same name already exists,
     * the system SHALL generate a unique filename to prevent overwrites.
     */
    it("returns original filename when no conflict exists", () => {
        fc.assert(
            fc.property(
                filenameWithExtArb,
                fc.array(filenameWithExtArb, { minLength: 0, maxLength: 10 }),
                (filename, existingFilenames) => {
                    // Filter out the filename from existing to ensure no conflict
                    const filteredExisting = existingFilenames.filter(f => f !== filename);
                    const result = generateUniqueFilename(filename, filteredExisting);
                    return result === filename;
                }
            ),
            { numRuns: 100 }
        );
    });

    it("generates different filename when conflict exists", () => {
        fc.assert(
            fc.property(
                filenameWithExtArb,
                (filename) => {
                    const existingFilenames = [filename];
                    const result = generateUniqueFilename(filename, existingFilenames);
                    return result !== filename;
                }
            ),
            { numRuns: 100 }
        );
    });

    it("generated unique filename does not exist in existing list", () => {
        fc.assert(
            fc.property(
                filenameWithExtArb,
                fc.array(filenameWithExtArb, { minLength: 1, maxLength: 10 }),
                (filename, existingFilenames) => {
                    // Ensure filename is in existing list to force unique generation
                    const existing = [...existingFilenames, filename];
                    const result = generateUniqueFilename(filename, existing);
                    return !existing.includes(result) || result === filename;
                }
            ),
            { numRuns: 100 }
        );
    });

    it("preserves file extension in unique filename", () => {
        fc.assert(
            fc.property(
                fc.string({ minLength: 1, maxLength: 30 }).filter(s => !s.includes("/") && !s.includes("\\") && !s.includes(".") && s.trim().length > 0),
                fc.constantFrom(".exe", ".dmg", ".zip", ".txt", ".pdf"),
                (baseName, extension) => {
                    const filename = `${baseName.trim()}${extension}`;
                    const existingFilenames = [filename];
                    const result = generateUniqueFilename(filename, existingFilenames);
                    return result.endsWith(extension);
                }
            ),
            { numRuns: 100 }
        );
    });

    it("handles files without extension", () => {
        fc.assert(
            fc.property(
                fc.string({ minLength: 1, maxLength: 30 }).filter(s => !s.includes("/") && !s.includes("\\") && !s.includes(".") && s.trim().length > 0),
                (filename) => {
                    const trimmed = filename.trim();
                    const existingFilenames = [trimmed];
                    const result = generateUniqueFilename(trimmed, existingFilenames);
                    // Result should be different and not have an extension added
                    return result !== trimmed && !result.includes(".");
                }
            ),
            { numRuns: 100 }
        );
    });

    it("filenameExists correctly identifies existing files", () => {
        fc.assert(
            fc.property(
                filenameWithExtArb,
                fc.array(filenameWithExtArb, { minLength: 0, maxLength: 10 }),
                fc.boolean(),
                (filename, otherFilenames, includeFilename) => {
                    const existingFilenames = includeFilename
                        ? [...otherFilenames, filename]
                        : otherFilenames.filter(f => f !== filename);
                    const result = filenameExists(filename, existingFilenames);
                    return result === existingFilenames.includes(filename);
                }
            ),
            { numRuns: 100 }
        );
    });
});
