/**
 * Property-Based Tests for Signed URL Generation
 *
 * Tests for signed URL expiration and filename handling.
 *
 * Requirements: 3.2, 3.3, 3.5
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
    calculateExpirationTime,
    isValidExpiration,
    createSignedUrlResponse,
} from "./signed-url.server";
import { SIGNED_URL_EXPIRATION_SECONDS } from "./types";

// ============================================
// Property 7: Signed URL generation includes correct expiration
// **Feature: app-download-unlock, Property 7: Signed URL generation includes correct expiration**
// **Validates: Requirements 3.2, 3.3**
// ============================================

describe("Property 7: Signed URL generation includes correct expiration", () => {
    /**
     * **Feature: app-download-unlock, Property 7: Signed URL generation includes correct expiration**
     * **Validates: Requirements 3.2, 3.3**
     *
     * For any authorized download request, the generated signed URL SHALL have
     * an expiration time of exactly 1 hour from generation.
     */
    it("expiration constant is exactly 1 hour (3600 seconds)", () => {
        expect(SIGNED_URL_EXPIRATION_SECONDS).toBe(3600);
    });

    it("calculateExpirationTime produces valid ISO timestamp", () => {
        fc.assert(
            fc.property(
                fc.constant(null), // No input needed, just run multiple times
                () => {
                    const expiresAt = calculateExpirationTime();
                    // Should be a valid ISO timestamp
                    const parsed = new Date(expiresAt);
                    return !isNaN(parsed.getTime());
                }
            ),
            { numRuns: 100 }
        );
    });

    it("calculateExpirationTime produces expiration approximately 1 hour from now", () => {
        fc.assert(
            fc.property(
                fc.constant(null),
                () => {
                    const before = Date.now();
                    const expiresAt = calculateExpirationTime();
                    const after = Date.now();

                    const expirationTime = new Date(expiresAt).getTime();
                    const expectedMin = before + SIGNED_URL_EXPIRATION_SECONDS * 1000;
                    const expectedMax = after + SIGNED_URL_EXPIRATION_SECONDS * 1000;

                    // Expiration should be within the expected range
                    return expirationTime >= expectedMin && expirationTime <= expectedMax;
                }
            ),
            { numRuns: 100 }
        );
    });

    it("isValidExpiration returns true for correctly calculated expiration", () => {
        fc.assert(
            fc.property(
                fc.constant(null),
                () => {
                    const expiresAt = calculateExpirationTime();
                    return isValidExpiration(expiresAt);
                }
            ),
            { numRuns: 100 }
        );
    });

    it("isValidExpiration returns false for expiration too far in future", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 7200, max: 86400 }), // 2 hours to 24 hours
                (extraSeconds) => {
                    const wrongExpiration = new Date(
                        Date.now() + (SIGNED_URL_EXPIRATION_SECONDS + extraSeconds) * 1000
                    ).toISOString();
                    return !isValidExpiration(wrongExpiration);
                }
            ),
            { numRuns: 100 }
        );
    });

    it("isValidExpiration returns false for expiration too soon", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 60, max: 3500 }), // 1 minute to ~58 minutes
                (seconds) => {
                    const wrongExpiration = new Date(
                        Date.now() + seconds * 1000
                    ).toISOString();
                    return !isValidExpiration(wrongExpiration);
                }
            ),
            { numRuns: 100 }
        );
    });

    it("createSignedUrlResponse includes correct expiration", () => {
        fc.assert(
            fc.property(
                fc.webUrl(),
                fc.string({ minLength: 1, maxLength: 100 }),
                (url, filename) => {
                    const response = createSignedUrlResponse(url, filename);
                    // Should have valid expiration
                    return isValidExpiration(response.expires_at);
                }
            ),
            { numRuns: 100 }
        );
    });
});

// ============================================
// Property 8: Download uses original filename
// **Feature: app-download-unlock, Property 8: Download uses original filename**
// **Validates: Requirements 3.5**
// ============================================

/**
 * Generate a valid filename (no path separators, reasonable length)
 */
const filenameArb = fc.string({ minLength: 1, maxLength: 100 })
    .filter(s => !s.includes("/") && !s.includes("\\") && s.trim().length > 0)
    .map(s => s.trim());

/**
 * Generate a filename with extension
 */
const filenameWithExtArb = fc.tuple(
    fc.string({ minLength: 1, maxLength: 30 }).filter(s =>
        !s.includes("/") && !s.includes("\\") && !s.includes(".") && s.trim().length > 0
    ),
    fc.constantFrom(".exe", ".dmg", ".zip", ".tar.gz", ".txt", ".pdf", ".app")
).map(([base, ext]) => `${base.trim()}${ext}`);

/**
 * Generate a storage filename with unique suffix (simulating duplicate handling)
 * Format: {base}_{timestamp}{ext}
 */
const storageFilenameArb = fc.tuple(
    fc.string({ minLength: 1, maxLength: 20 }).filter(s =>
        !s.includes("/") && !s.includes("\\") && !s.includes(".") && s.trim().length > 0
    ),
    fc.constantFrom(".exe", ".dmg", ".zip", ".txt", ".pdf"),
    fc.integer({ min: 1000000000000, max: 9999999999999 }) // timestamp-like suffix
).map(([base, ext, suffix]) => `${base.trim()}_${suffix}${ext}`);

describe("Property 8: Download uses original filename", () => {
    /**
     * **Feature: app-download-unlock, Property 8: Download uses original filename**
     * **Validates: Requirements 3.5**
     *
     * For any file download, the response SHALL use the original_filename
     * (not the storage filename) for the downloaded file.
     */
    it("createSignedUrlResponse preserves original filename", () => {
        fc.assert(
            fc.property(
                fc.webUrl(),
                filenameArb,
                (url, originalFilename) => {
                    const response = createSignedUrlResponse(url, originalFilename);
                    return response.filename === originalFilename;
                }
            ),
            { numRuns: 100 }
        );
    });

    it("createSignedUrlResponse includes filename in response", () => {
        fc.assert(
            fc.property(
                fc.webUrl(),
                filenameArb,
                (url, filename) => {
                    const response = createSignedUrlResponse(url, filename);
                    return (
                        typeof response.filename === "string" &&
                        response.filename.length > 0
                    );
                }
            ),
            { numRuns: 100 }
        );
    });

    it("response contains all required fields", () => {
        fc.assert(
            fc.property(
                fc.webUrl(),
                filenameArb,
                (url, filename) => {
                    const response = createSignedUrlResponse(url, filename);
                    return (
                        "url" in response &&
                        "filename" in response &&
                        "expires_at" in response &&
                        response.url === url &&
                        response.filename === filename
                    );
                }
            ),
            { numRuns: 100 }
        );
    });

    it("custom expiration is preserved when provided", () => {
        fc.assert(
            fc.property(
                fc.webUrl(),
                filenameArb,
                fc.integer({ min: 1000, max: 86400000 }), // 1 second to 24 hours in ms
                (url, filename, offsetMs) => {
                    const expirationDate = new Date(Date.now() + offsetMs);
                    const customExpiration = expirationDate.toISOString();
                    const response = createSignedUrlResponse(url, filename, customExpiration);
                    return response.expires_at === customExpiration;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Test that when storage filename differs from original filename,
     * the response uses the original filename (not the storage filename).
     *
     * This validates the core requirement that users download files with
     * their original names, not the internal storage names which may
     * include unique suffixes to prevent overwrites.
     */
    it("uses original filename even when storage filename differs", () => {
        fc.assert(
            fc.property(
                fc.webUrl(),
                filenameWithExtArb,  // Original filename (e.g., "app.exe")
                storageFilenameArb,  // Storage filename (e.g., "app_1234567890123.exe")
                (url, originalFilename, _storageFilename) => {
                    // The signed URL response should use original filename
                    // regardless of what the storage filename is
                    const response = createSignedUrlResponse(url, originalFilename);

                    // Response filename must match original, not storage
                    return response.filename === originalFilename;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Test that the filename in response preserves the original file extension.
     * This ensures users receive files with correct extensions for their OS.
     */
    it("preserves original file extension in response", () => {
        fc.assert(
            fc.property(
                fc.webUrl(),
                filenameWithExtArb,
                (url, originalFilename) => {
                    const response = createSignedUrlResponse(url, originalFilename);

                    // Extract extension from original filename
                    const lastDotIndex = originalFilename.lastIndexOf(".");
                    if (lastDotIndex === -1) return true; // No extension to check

                    const originalExt = originalFilename.substring(lastDotIndex);
                    return response.filename.endsWith(originalExt);
                }
            ),
            { numRuns: 100 }
        );
    });
});
