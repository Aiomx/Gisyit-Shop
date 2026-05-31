/**
 * Property-Based Tests for MCP Method Correctness
 *
 * **Feature: store-integration, Property 1: MCP method correctness**
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
 *
 * These tests verify that the MCP client correctly maps operations to HTTP methods:
 * - query operations use GET method (Requirements 1.1)
 * - create operations use POST method (Requirements 1.2)
 * - update operations use PATCH method (Requirements 1.3)
 * - delete operations use DELETE method (Requirements 1.4)
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { getMCPMethod, type MCPOperation, type MCPMethod } from "./mcp-client.server";

// ============================================
// Arbitraries (Generators)
// ============================================

/**
 * Generate a valid MCP operation type
 */
const operationArb: fc.Arbitrary<MCPOperation> = fc.constantFrom(
    "query",
    "create",
    "update",
    "delete"
);

// ============================================
// Property Tests
// ============================================

describe("Property 1: MCP method correctness", () => {
    /**
     * **Feature: store-integration, Property 1: MCP method correctness**
     * **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
     *
     * Core property: Each operation type maps to exactly one HTTP method
     */
    it("each operation type maps to the correct HTTP method", () => {
        fc.assert(
            fc.property(operationArb, (operation) => {
                const expectedMethod: Record<MCPOperation, MCPMethod> = {
                    query: "GET",
                    create: "POST",
                    update: "PATCH",
                    delete: "DELETE",
                };

                const result = getMCPMethod(operation);
                return result === expectedMethod[operation];
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Query operations use GET method
     * **Validates: Requirements 1.1**
     */
    it("query operations use GET method (Requirements 1.1)", () => {
        const method = getMCPMethod("query");
        expect(method).toBe("GET");
    });

    /**
     * Create operations use POST method
     * **Validates: Requirements 1.2**
     */
    it("create operations use POST method (Requirements 1.2)", () => {
        const method = getMCPMethod("create");
        expect(method).toBe("POST");
    });

    /**
     * Update operations use PATCH method
     * **Validates: Requirements 1.3**
     */
    it("update operations use PATCH method (Requirements 1.3)", () => {
        const method = getMCPMethod("update");
        expect(method).toBe("PATCH");
    });

    /**
     * Delete operations use DELETE method
     * **Validates: Requirements 1.4**
     */
    it("delete operations use DELETE method (Requirements 1.4)", () => {
        const method = getMCPMethod("delete");
        expect(method).toBe("DELETE");
    });

    /**
     * Method mapping is deterministic
     * For any operation, calling getMCPMethod multiple times returns the same result
     */
    it("method mapping is deterministic", () => {
        fc.assert(
            fc.property(operationArb, (operation) => {
                const result1 = getMCPMethod(operation);
                const result2 = getMCPMethod(operation);
                return result1 === result2;
            }),
            { numRuns: 100 }
        );
    });

    /**
     * All returned methods are valid HTTP methods
     */
    it("all returned methods are valid HTTP methods", () => {
        const validMethods: MCPMethod[] = ["GET", "POST", "PATCH", "DELETE"];

        fc.assert(
            fc.property(operationArb, (operation) => {
                const result = getMCPMethod(operation);
                return validMethods.includes(result);
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Method mapping covers all operations
     * Each operation type produces a unique method for its category
     */
    it("read operations use GET, write operations use POST/PATCH/DELETE", () => {
        // Read operation
        expect(getMCPMethod("query")).toBe("GET");

        // Write operations
        const writeOperations: MCPOperation[] = ["create", "update", "delete"];
        const writeMethods = writeOperations.map(getMCPMethod);

        // All write methods should be different from GET
        writeMethods.forEach((method) => {
            expect(method).not.toBe("GET");
        });
    });
});
