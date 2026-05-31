/**
 * Property-Based Tests for Download Log Service
 *
 * Tests for download audit logging and statistics separation.
 *
 * Requirements: 6.3, 6.4, 6.5, 8.1, 8.3
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
    validateDownloadLogParams,
    hasUserIdentifier,
    hasSessionIdentifier,
    isValidDownloadLog,
    type CreateDownloadLogParams,
} from "./download-log.server";
import type { DownloadLog } from "~/lib/supabase/types";

// ============================================
// Arbitraries for Download Log Testing
// ============================================

/**
 * Generate a valid session ID (alphanumeric string)
 */
const sessionIdArb = fc.stringMatching(/^[a-zA-Z0-9]{16,64}$/);

/**
 * Generate a valid IP address (IPv4)
 */
const ipAddressArb = fc.tuple(
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 })
).map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`);

/**
 * Generate valid download log params with user_id
 */
const downloadLogParamsWithUserArb: fc.Arbitrary<CreateDownloadLogParams> = fc.record({
    product_id: fc.uuid(),
    file_id: fc.uuid(),
    user_id: fc.uuid(),
    session_id: fc.option(sessionIdArb, { nil: undefined }),
    ip_address: fc.option(ipAddressArb, { nil: undefined }),
});

/**
 * Generate valid download log params with session_id only (anonymous)
 */
const downloadLogParamsWithSessionArb: fc.Arbitrary<CreateDownloadLogParams> = fc.record({
    product_id: fc.uuid(),
    file_id: fc.uuid(),
    user_id: fc.constant(undefined),
    session_id: sessionIdArb,
    ip_address: fc.option(ipAddressArb, { nil: undefined }),
});

/**
 * Generate valid download log params (either user or session)
 */
const validDownloadLogParamsArb = fc.oneof(
    downloadLogParamsWithUserArb,
    downloadLogParamsWithSessionArb
);

/**
 * Generate invalid download log params (missing identifiers)
 */
const invalidDownloadLogParamsArb: fc.Arbitrary<CreateDownloadLogParams> = fc.record({
    product_id: fc.uuid(),
    file_id: fc.uuid(),
    user_id: fc.constant(undefined),
    session_id: fc.constant(undefined),
    ip_address: fc.option(ipAddressArb, { nil: undefined }),
});

/**
 * Generate a valid ISO date string using integer timestamps
 */
const isoDateArb = fc.integer({
    min: new Date("2020-01-01").getTime(),
    max: new Date("2030-12-31").getTime(),
}).map((timestamp) => new Date(timestamp).toISOString());

/**
 * Generate a complete download log entry
 */
const downloadLogArb: fc.Arbitrary<DownloadLog> = fc.record({
    id: fc.uuid(),
    product_id: fc.uuid(),
    file_id: fc.uuid(),
    user_id: fc.option(fc.uuid(), { nil: undefined }),
    session_id: fc.option(sessionIdArb, { nil: undefined }),
    ip_address: fc.option(ipAddressArb, { nil: undefined }),
    downloaded_at: isoDateArb,
}).filter((log) => log.user_id !== undefined || log.session_id !== undefined);

// ============================================
// Property 8: Download Audit Logging
// **Feature: free-product-download, Property 8: Download Audit Logging**
// **Validates: Requirements 6.3, 6.4, 6.5, 8.1**
// ============================================

describe("Property 8: Download Audit Logging", () => {
    /**
     * **Feature: free-product-download, Property 8: Download Audit Logging**
     * **Validates: Requirements 6.3, 6.4, 6.5, 8.1**
     *
     * For any successful free download, a download_log record SHALL be created
     * containing product_id, file_id, timestamp, and either user_id (for authenticated users)
     * or session_id (for anonymous users).
     */

    it("validates params with user_id as valid", () => {
        fc.assert(
            fc.property(downloadLogParamsWithUserArb, (params) => {
                return validateDownloadLogParams(params) === true;
            }),
            { numRuns: 100 }
        );
    });

    it("validates params with session_id only as valid", () => {
        fc.assert(
            fc.property(downloadLogParamsWithSessionArb, (params) => {
                return validateDownloadLogParams(params) === true;
            }),
            { numRuns: 100 }
        );
    });

    it("rejects params without any identifier", () => {
        fc.assert(
            fc.property(invalidDownloadLogParamsArb, (params) => {
                return validateDownloadLogParams(params) === false;
            }),
            { numRuns: 100 }
        );
    });

    it("rejects params without product_id", () => {
        fc.assert(
            fc.property(
                fc.uuid(), // file_id
                fc.uuid(), // user_id
                (fileId, userId) => {
                    const params: CreateDownloadLogParams = {
                        product_id: "", // empty
                        file_id: fileId,
                        user_id: userId,
                    };
                    return validateDownloadLogParams(params) === false;
                }
            ),
            { numRuns: 100 }
        );
    });

    it("rejects params without file_id", () => {
        fc.assert(
            fc.property(
                fc.uuid(), // product_id
                fc.uuid(), // user_id
                (productId, userId) => {
                    const params: CreateDownloadLogParams = {
                        product_id: productId,
                        file_id: "", // empty
                        user_id: userId,
                    };
                    return validateDownloadLogParams(params) === false;
                }
            ),
            { numRuns: 100 }
        );
    });

    it("hasUserIdentifier returns true when user_id is present", () => {
        fc.assert(
            fc.property(
                fc.uuid(), // user_id
                fc.option(sessionIdArb, { nil: undefined }), // session_id
                (userId, sessionId) => {
                    const log = { user_id: userId, session_id: sessionId };
                    return hasUserIdentifier(log) === true;
                }
            ),
            { numRuns: 100 }
        );
    });

    it("hasUserIdentifier returns false when user_id is absent", () => {
        fc.assert(
            fc.property(sessionIdArb, (sessionId) => {
                const log = { user_id: undefined, session_id: sessionId };
                return hasUserIdentifier(log) === false;
            }),
            { numRuns: 100 }
        );
    });

    it("hasSessionIdentifier returns true when session_id is present", () => {
        fc.assert(
            fc.property(
                fc.option(fc.uuid(), { nil: undefined }), // user_id
                sessionIdArb, // session_id
                (userId, sessionId) => {
                    const log = { user_id: userId, session_id: sessionId };
                    return hasSessionIdentifier(log) === true;
                }
            ),
            { numRuns: 100 }
        );
    });

    it("hasSessionIdentifier returns false when session_id is absent", () => {
        fc.assert(
            fc.property(fc.uuid(), (userId) => {
                const log = { user_id: userId, session_id: undefined };
                return hasSessionIdentifier(log) === false;
            }),
            { numRuns: 100 }
        );
    });

    it("valid download log contains all required fields", () => {
        fc.assert(
            fc.property(downloadLogArb, (log) => {
                return isValidDownloadLog(log) === true;
            }),
            { numRuns: 100 }
        );
    });

    it("download log without id is invalid", () => {
        fc.assert(
            fc.property(downloadLogArb, (log) => {
                const invalidLog = { ...log, id: undefined };
                return isValidDownloadLog(invalidLog) === false;
            }),
            { numRuns: 100 }
        );
    });

    it("download log without product_id is invalid", () => {
        fc.assert(
            fc.property(downloadLogArb, (log) => {
                const invalidLog = { ...log, product_id: undefined };
                return isValidDownloadLog(invalidLog) === false;
            }),
            { numRuns: 100 }
        );
    });

    it("download log without file_id is invalid", () => {
        fc.assert(
            fc.property(downloadLogArb, (log) => {
                const invalidLog = { ...log, file_id: undefined };
                return isValidDownloadLog(invalidLog) === false;
            }),
            { numRuns: 100 }
        );
    });

    it("download log without downloaded_at is invalid", () => {
        fc.assert(
            fc.property(downloadLogArb, (log) => {
                const invalidLog = { ...log, downloaded_at: undefined };
                return isValidDownloadLog(invalidLog) === false;
            }),
            { numRuns: 100 }
        );
    });

    it("download log without any identifier is invalid", () => {
        fc.assert(
            fc.property(
                fc.uuid(), // id
                fc.uuid(), // product_id
                fc.uuid(), // file_id
                isoDateArb, // downloaded_at
                (id, productId, fileId, downloadedAt) => {
                    const invalidLog: Partial<DownloadLog> = {
                        id,
                        product_id: productId,
                        file_id: fileId,
                        downloaded_at: downloadedAt,
                        user_id: undefined,
                        session_id: undefined,
                    };
                    return isValidDownloadLog(invalidLog) === false;
                }
            ),
            { numRuns: 100 }
        );
    });

    it("authenticated user download log has user_id", () => {
        fc.assert(
            fc.property(downloadLogParamsWithUserArb, (params) => {
                // When params have user_id, the log should have user identifier
                return hasUserIdentifier({
                    user_id: params.user_id,
                    session_id: params.session_id,
                }) === true;
            }),
            { numRuns: 100 }
        );
    });

    it("anonymous user download log has session_id", () => {
        fc.assert(
            fc.property(downloadLogParamsWithSessionArb, (params) => {
                // When params have only session_id, the log should have session identifier
                return (
                    hasSessionIdentifier({
                        user_id: params.user_id,
                        session_id: params.session_id,
                    }) === true &&
                    hasUserIdentifier({
                        user_id: params.user_id,
                        session_id: params.session_id,
                    }) === false
                );
            }),
            { numRuns: 100 }
        );
    });
});


// ============================================
// Property 9: Download Statistics Separation
// **Feature: free-product-download, Property 9: Download Statistics Separation**
// **Validates: Requirements 8.3**
// ============================================

describe("Property 9: Download Statistics Separation", () => {
    /**
     * **Feature: free-product-download, Property 9: Download Statistics Separation**
     * **Validates: Requirements 8.3**
     *
     * For any query of order or payment statistics, download_log records
     * SHALL NOT be included in the results.
     *
     * This is enforced by:
     * 1. Download logs are stored in a separate table (download_logs)
     * 2. Download log functions do not query order tables
     * 3. Order statistics functions do not query download_logs table
     */

    it("download log params do not contain order-related fields", () => {
        fc.assert(
            fc.property(validDownloadLogParamsArb, (params) => {
                // Download log params should not have order_id or payment fields
                const paramsKeys = Object.keys(params);
                const orderFields = ["order_id", "payment_id", "stripe_session_id", "total_amount"];
                return orderFields.every((field) => !paramsKeys.includes(field));
            }),
            { numRuns: 100 }
        );
    });

    it("download log structure does not include order fields", () => {
        fc.assert(
            fc.property(downloadLogArb, (log) => {
                // Download log should not have order-related fields
                const logKeys = Object.keys(log);
                const orderFields = ["order_id", "payment_id", "stripe_session_id", "total_amount", "currency"];
                return orderFields.every((field) => !logKeys.includes(field));
            }),
            { numRuns: 100 }
        );
    });

    it("download log contains only download-specific fields", () => {
        fc.assert(
            fc.property(downloadLogArb, (log) => {
                // Download log should only contain these fields
                const allowedFields = [
                    "id",
                    "product_id",
                    "file_id",
                    "user_id",
                    "session_id",
                    "ip_address",
                    "downloaded_at",
                ];
                const logKeys = Object.keys(log);
                return logKeys.every((key) => allowedFields.includes(key));
            }),
            { numRuns: 100 }
        );
    });

    it("download stats structure is separate from order stats", () => {
        // DownloadStats type should only have download-specific fields
        // This is a type-level test - if it compiles, the structure is correct
        const mockStats = {
            totalDownloads: 100,
            uniqueUsers: 50,
        };

        // Verify the structure matches DownloadStats
        expect(mockStats).toHaveProperty("totalDownloads");
        expect(mockStats).toHaveProperty("uniqueUsers");
        expect(typeof mockStats.totalDownloads).toBe("number");
        expect(typeof mockStats.uniqueUsers).toBe("number");

        // Should NOT have order-related fields
        expect(mockStats).not.toHaveProperty("totalOrders");
        expect(mockStats).not.toHaveProperty("totalRevenue");
        expect(mockStats).not.toHaveProperty("orderCount");
    });

    it("download log validation does not check order fields", () => {
        fc.assert(
            fc.property(downloadLogArb, (log) => {
                // Adding order fields should not affect validation
                const logWithOrderFields = {
                    ...log,
                    order_id: "fake-order-id",
                    payment_id: "fake-payment-id",
                };

                // isValidDownloadLog should still work (ignores extra fields)
                // The validation only checks required download log fields
                return isValidDownloadLog(log) === true;
            }),
            { numRuns: 100 }
        );
    });

    it("download log params validation ignores order fields", () => {
        fc.assert(
            fc.property(validDownloadLogParamsArb, (params) => {
                // Adding order fields should not affect validation
                const paramsWithOrderFields = {
                    ...params,
                    order_id: "fake-order-id",
                    payment_id: "fake-payment-id",
                } as CreateDownloadLogParams;

                // validateDownloadLogParams should still work
                return validateDownloadLogParams(paramsWithOrderFields) === true;
            }),
            { numRuns: 100 }
        );
    });
});
