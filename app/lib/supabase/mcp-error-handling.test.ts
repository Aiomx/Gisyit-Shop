/**
 * Property-Based Tests for MCP Error Handling
 *
 * **Feature: store-integration, Property 2: MCP error handling**
 * **Validates: Requirements 1.5**
 *
 * These tests verify that MCP errors are handled gracefully:
 * - All errors return structured MCPError objects
 * - Error messages are user-friendly (not exposing internal details)
 * - Error codes are valid MCPErrorCode values
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
    handleMCPError,
    getErrorMessage,
    type MCPError,
    type MCPErrorCode,
} from "./mcp-client.server";

// ============================================
// Valid Error Codes
// ============================================

const validErrorCodes: MCPErrorCode[] = [
    "NETWORK_ERROR",
    "UNAUTHORIZED",
    "NOT_FOUND",
    "VALIDATION_ERROR",
    "SERVER_ERROR",
    "SELECT_ERROR",
    "INSERT_ERROR",
    "UPDATE_ERROR",
    "DELETE_ERROR",
    "MCP_ERROR",
];

// ============================================
// Arbitraries (Generators)
// ============================================

/**
 * Generate a valid error code
 */
const errorCodeArb: fc.Arbitrary<MCPErrorCode> = fc.constantFrom(...validErrorCodes);

/**
 * Generate a random error message
 */
const errorMessageArb = fc.string({ minLength: 1, maxLength: 200 });

/**
 * Generate a TypeError (network error simulation)
 */
const typeErrorArb = fc.constantFrom(
    new TypeError("fetch failed"),
    new TypeError("NetworkError when attempting to fetch resource"),
    new TypeError("Failed to fetch")
);

/**
 * Generate an HTTP status code
 */
const httpStatusArb = fc.constantFrom(400, 401, 403, 404, 422, 500, 502, 503);

/**
 * Generate a Response-like object with status
 */
const responseErrorArb = httpStatusArb.map((status) => ({ status }));

/**
 * Generate a generic Error
 */
const genericErrorArb = errorMessageArb.map((msg) => new Error(msg));

/**
 * Generate any type of error input
 */
const anyErrorArb = fc.oneof(
    typeErrorArb,
    responseErrorArb,
    genericErrorArb,
    fc.string(),
    fc.integer(),
    fc.constant(null),
    fc.constant(undefined)
);

// ============================================
// Property Tests
// ============================================

describe("Property 2: MCP error handling", () => {
    /**
     * **Feature: store-integration, Property 2: MCP error handling**
     * **Validates: Requirements 1.5**
     *
     * Core property: All errors return structured MCPError objects with user-friendly messages
     */
    it("all errors return structured MCPError objects", () => {
        fc.assert(
            fc.property(anyErrorArb, errorCodeArb, (error, fallbackCode) => {
                const result = handleMCPError(error, fallbackCode);

                // Result should be a valid MCPError object
                expect(result).toHaveProperty("code");
                expect(result).toHaveProperty("message");
                expect(typeof result.code).toBe("string");
                expect(typeof result.message).toBe("string");

                return true;
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Error codes are always valid MCPErrorCode values
     */
    it("error codes are always valid MCPErrorCode values", () => {
        fc.assert(
            fc.property(anyErrorArb, errorCodeArb, (error, fallbackCode) => {
                const result = handleMCPError(error, fallbackCode);
                return validErrorCodes.includes(result.code);
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Error messages are non-empty strings
     */
    it("error messages are non-empty strings", () => {
        fc.assert(
            fc.property(anyErrorArb, errorCodeArb, (error, fallbackCode) => {
                const result = handleMCPError(error, fallbackCode);
                return result.message.length > 0;
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Network errors (TypeError with fetch) return NETWORK_ERROR code
     */
    it("network errors return NETWORK_ERROR code", () => {
        fc.assert(
            fc.property(typeErrorArb, (error) => {
                const result = handleMCPError(error);
                return result.code === "NETWORK_ERROR";
            }),
            { numRuns: 100 }
        );
    });

    /**
     * HTTP 401 errors return UNAUTHORIZED code
     */
    it("HTTP 401 errors return UNAUTHORIZED code", () => {
        const error = { status: 401 };
        const result = handleMCPError(error);
        expect(result.code).toBe("UNAUTHORIZED");
    });

    /**
     * HTTP 404 errors return NOT_FOUND code
     */
    it("HTTP 404 errors return NOT_FOUND code", () => {
        const error = { status: 404 };
        const result = handleMCPError(error);
        expect(result.code).toBe("NOT_FOUND");
    });

    /**
     * HTTP 422 errors return VALIDATION_ERROR code
     */
    it("HTTP 422 errors return VALIDATION_ERROR code", () => {
        const error = { status: 422 };
        const result = handleMCPError(error);
        expect(result.code).toBe("VALIDATION_ERROR");
    });

    /**
     * Other HTTP errors return SERVER_ERROR code
     */
    it("other HTTP errors return SERVER_ERROR code", () => {
        const otherStatuses = [400, 403, 500, 502, 503];
        otherStatuses.forEach((status) => {
            const error = { status };
            const result = handleMCPError(error);
            expect(result.code).toBe("SERVER_ERROR");
        });
    });

    /**
     * Generic errors use fallback code
     */
    it("generic errors use fallback code", () => {
        fc.assert(
            fc.property(genericErrorArb, errorCodeArb, (error, fallbackCode) => {
                // Skip if error message contains "fetch" (would be treated as network error)
                if (error.message.includes("fetch")) {
                    return true;
                }
                const result = handleMCPError(error, fallbackCode);
                return result.code === fallbackCode;
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Error messages do not expose internal error details directly
     * (they use predefined user-friendly messages)
     */
    it("error messages are user-friendly (predefined messages)", () => {
        const userFriendlyMessages = [
            "网络连接失败，请稍后重试",
            "请先登录",
            "资源不存在",
            "数据验证失败",
            "服务器错误，请稍后重试",
            "查询数据失败",
            "创建数据失败",
            "更新数据失败",
            "删除数据失败",
            "数据服务暂时不可用",
        ];

        fc.assert(
            fc.property(anyErrorArb, errorCodeArb, (error, fallbackCode) => {
                const result = handleMCPError(error, fallbackCode);
                return userFriendlyMessages.includes(result.message);
            }),
            { numRuns: 100 }
        );
    });

    /**
     * getErrorMessage returns valid message for all error codes
     */
    it("getErrorMessage returns valid message for all error codes", () => {
        fc.assert(
            fc.property(errorCodeArb, (code) => {
                const message = getErrorMessage(code);
                return typeof message === "string" && message.length > 0;
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Internal error details are stored in details field, not message
     */
    it("internal error details are stored in details field", () => {
        const internalMessage = "Internal database connection failed at line 42";
        const error = new Error(internalMessage);
        const result = handleMCPError(error, "SERVER_ERROR");

        // Message should NOT contain the internal details
        expect(result.message).not.toContain(internalMessage);

        // Details should contain the internal message
        expect(result.details).toBe(internalMessage);
    });

    /**
     * Default fallback code is SERVER_ERROR
     */
    it("default fallback code is SERVER_ERROR", () => {
        const unknownError = { someRandomProperty: "value" };
        const result = handleMCPError(unknownError);
        expect(result.code).toBe("SERVER_ERROR");
    });
});
