/**
 * Supabase MCP Client Utilities (Server-side only)
 * 
 * This module provides type-safe wrapper functions for interacting with
 * Supabase MCP. All data operations go through these functions.
 * 
 * IMPORTANT: This file should only be used in server-side code (loaders/actions).
 * The .server.ts suffix ensures it's not bundled for the client.
 * 
 * Store Permissions:
 * - READ: products, product_categories, product_images, product_specs,
 *         product_spec_options, product_prices, product_videos, orders, order_items
 * - WRITE: carts, cart_items (limited)
 */

// ============================================
// MCP Response Types
// ============================================

export interface MCPResponse<T> {
    data: T | null;
    error: MCPError | null;
}

export interface MCPError {
    code: MCPErrorCode;
    message: string;
    details?: unknown;
}

/**
 * MCP Error Codes
 * Used for categorizing errors from MCP operations
 */
export type MCPErrorCode =
    | "NETWORK_ERROR"
    | "UNAUTHORIZED"
    | "NOT_FOUND"
    | "VALIDATION_ERROR"
    | "SERVER_ERROR"
    | "SELECT_ERROR"
    | "INSERT_ERROR"
    | "UPDATE_ERROR"
    | "DELETE_ERROR"
    | "MCP_ERROR";

/**
 * HTTP Method type for MCP operations
 */
export type MCPMethod = "GET" | "POST" | "PATCH" | "DELETE";

/**
 * Operation type for mapping to HTTP methods
 */
export type MCPOperation = "query" | "create" | "update" | "delete";

// ============================================
// Tables that Store can READ
// ============================================

type ReadableTables =
    | "products"
    | "product_categories"
    | "product_images"
    | "product_specs"
    | "product_spec_options"
    | "product_prices"
    | "product_videos"
    | "carts"
    | "cart_items"
    | "orders"
    | "order_items"
    | "stripe_events";

// ============================================
// Tables that Store can WRITE
// ============================================

type WritableTables = "carts" | "cart_items" | "stripe_events";

// ============================================
// MCP Method Mapping
// ============================================

/**
 * Maps operation types to HTTP methods
 * This is the core mapping used for MCP requests
 * 
 * @param operation - The operation type (query, create, update, delete)
 * @returns The corresponding HTTP method
 */
export function getMCPMethod(operation: MCPOperation): MCPMethod {
    const methodMap: Record<MCPOperation, MCPMethod> = {
        query: "GET",
        create: "POST",
        update: "PATCH",
        delete: "DELETE",
    };
    return methodMap[operation];
}

// ============================================
// MCP Client Class
// ============================================

/**
 * Supabase MCP Client
 * 
 * Provides type-safe methods for interacting with Supabase MCP.
 * This wrapper calls the actual mcp_supabase_postgrestRequest tool.
 */
class SupabaseMCPClient {
    /**
     * Execute a SELECT query via MCP
     * Uses GET method as per Requirements 1.1
     */
    async select<T>(
        table: ReadableTables,
        options?: {
            columns?: string;
            filter?: Record<string, unknown>;
            order?: { column: string; ascending?: boolean };
            limit?: number;
            offset?: number;
        }
    ): Promise<MCPResponse<T[]>> {
        try {
            // Build the query path
            let path = `/${table}`;
            const params = new URLSearchParams();

            if (options?.columns) {
                params.set("select", options.columns);
            }

            if (options?.filter) {
                for (const [key, value] of Object.entries(options.filter)) {
                    if (value !== undefined && value !== null) {
                        params.set(key, `eq.${value}`);
                    }
                }
            }

            if (options?.order) {
                const direction = options.order.ascending === false ? "desc" : "asc";
                params.set("order", `${options.order.column}.${direction}`);
            }

            if (options?.limit) {
                params.set("limit", String(options.limit));
            }

            if (options?.offset) {
                params.set("offset", String(options.offset));
            }

            const queryString = params.toString();
            if (queryString) {
                path += `?${queryString}`;
            }

            // Call MCP with GET method (Requirements 1.1)
            const method = getMCPMethod("query");
            const result = await this.executePostgrestRequest<T[]>(method, path);
            return result;
        } catch (error) {
            return {
                data: null,
                error: handleMCPError(error, "SELECT_ERROR"),
            };
        }
    }

    /**
     * Execute an INSERT operation via MCP (only for writable tables)
     * Uses POST method as per Requirements 1.2
     */
    async insert<T>(
        table: WritableTables,
        data: Partial<T>
    ): Promise<MCPResponse<T>> {
        try {
            const path = `/${table}`;
            // Call MCP with POST method (Requirements 1.2)
            const method = getMCPMethod("create");
            const result = await this.executePostgrestRequest<T[]>(method, path, data);

            return {
                data: result.data?.[0] ?? null,
                error: result.error,
            };
        } catch (error) {
            return {
                data: null,
                error: handleMCPError(error, "INSERT_ERROR"),
            };
        }
    }

    /**
     * Execute an UPDATE operation via MCP (only for writable tables)
     * Uses PATCH method as per Requirements 1.3
     */
    async update<T>(
        table: WritableTables,
        id: string,
        data: Partial<T>
    ): Promise<MCPResponse<T>> {
        try {
            const path = `/${table}?id=eq.${id}`;
            // Call MCP with PATCH method (Requirements 1.3)
            const method = getMCPMethod("update");
            const result = await this.executePostgrestRequest<T[]>(method, path, data);

            return {
                data: result.data?.[0] ?? null,
                error: result.error,
            };
        } catch (error) {
            return {
                data: null,
                error: handleMCPError(error, "UPDATE_ERROR"),
            };
        }
    }

    /**
     * Execute a DELETE operation via MCP (only for writable tables)
     * Uses DELETE method as per Requirements 1.4
     */
    async delete(
        table: WritableTables,
        id: string
    ): Promise<MCPResponse<null>> {
        try {
            const path = `/${table}?id=eq.${id}`;
            // Call MCP with DELETE method (Requirements 1.4)
            const method = getMCPMethod("delete");
            await this.executePostgrestRequest(method, path);

            return { data: null, error: null };
        } catch (error) {
            return {
                data: null,
                error: handleMCPError(error, "DELETE_ERROR"),
            };
        }
    }

    /**
     * Internal method to execute PostgREST requests via MCP
     * Calls the real mcp_supabase_postgrestRequest tool
     */
    private async executePostgrestRequest<T>(
        method: MCPMethod,
        path: string,
        body?: unknown
    ): Promise<MCPResponse<T>> {
        try {
            // Call the real MCP tool: mcp_supabase_postgrestRequest
            // The MCP tool is available in the server environment
            const mcpRequest: {
                method: MCPMethod;
                path: string;
                body?: Record<string, unknown>;
            } = {
                method,
                path,
            };

            if (body) {
                mcpRequest.body = body as Record<string, unknown>;
            }

            // Log for debugging (can be removed in production)
            console.log(`[MCP] ${method} ${path}`, body ? JSON.stringify(body) : "");

            // The actual MCP call will be made by the MCP runtime
            // This function prepares the request structure
            // In the Kiro environment, MCP tools are called directly

            // For now, we return a structure that indicates the MCP call should be made
            // The actual integration happens when this code runs in the MCP-enabled environment
            const response = await this.callMCPTool(mcpRequest);

            return {
                data: response as T,
                error: null,
            };
        } catch (error) {
            return {
                data: null,
                error: handleMCPError(error, "MCP_ERROR"),
            };
        }
    }

    /**
     * Call the MCP tool directly
     * This method interfaces with the MCP runtime
     */
    private async callMCPTool(request: {
        method: MCPMethod;
        path: string;
        body?: Record<string, unknown>;
    }): Promise<unknown> {
        // In the MCP environment, this would call mcp_supabase_postgrestRequest
        // The MCP tool handles the actual HTTP request to Supabase PostgREST

        // For server-side execution, we need to use the MCP bridge
        // This is typically injected by the MCP runtime or configured via environment

        const mcpBridge = getMCPBridge();
        if (mcpBridge) {
            return mcpBridge.postgrestRequest(request);
        }

        // Fallback: throw error if MCP bridge is not available
        throw new Error("MCP bridge not available - ensure MCP is configured");
    }
}

// ============================================
// Error Handling (Requirements 1.5)
// ============================================

/**
 * User-friendly error messages for MCP errors
 * Maps error codes to localized messages
 */
const errorMessages: Record<MCPErrorCode, string> = {
    NETWORK_ERROR: "网络连接失败，请稍后重试",
    UNAUTHORIZED: "请先登录",
    NOT_FOUND: "资源不存在",
    VALIDATION_ERROR: "数据验证失败",
    SERVER_ERROR: "服务器错误，请稍后重试",
    SELECT_ERROR: "查询数据失败",
    INSERT_ERROR: "创建数据失败",
    UPDATE_ERROR: "更新数据失败",
    DELETE_ERROR: "删除数据失败",
    MCP_ERROR: "数据服务暂时不可用",
};

/**
 * Handle MCP errors and convert to user-friendly format
 * Implements Requirements 1.5: graceful error handling
 * 
 * @param error - The error from MCP operation
 * @param fallbackCode - Default error code if type cannot be determined
 * @returns Structured MCPError with user-friendly message
 */
export function handleMCPError(
    error: unknown,
    fallbackCode: MCPErrorCode = "SERVER_ERROR"
): MCPError {
    // Network errors
    if (error instanceof TypeError && error.message.includes("fetch")) {
        return {
            code: "NETWORK_ERROR",
            message: errorMessages.NETWORK_ERROR,
            details: error.message,
        };
    }

    // Enhanced error with status property (from our MCP bridge)
    if (error instanceof Error && "status" in error) {
        const enhancedError = error as Error & { status: number; code?: string; details?: string };
        const code = mapHttpStatusToErrorCode(enhancedError.status);
        return {
            code,
            message: enhancedError.message || errorMessages[code],
            details: {
                status: enhancedError.status,
                code: enhancedError.code,
                details: enhancedError.details,
            },
        };
    }

    // HTTP Response errors
    if (error instanceof Response || (error && typeof error === "object" && "status" in error)) {
        const status = (error as { status: number }).status;
        const code = mapHttpStatusToErrorCode(status);
        return {
            code,
            message: errorMessages[code],
            details: { status },
        };
    }

    // Error with message
    if (error instanceof Error) {
        return {
            code: fallbackCode,
            message: errorMessages[fallbackCode],
            details: error.message,
        };
    }

    // Unknown error
    return {
        code: fallbackCode,
        message: errorMessages[fallbackCode],
        details: error,
    };
}

/**
 * Map HTTP status codes to error codes
 */
function mapHttpStatusToErrorCode(status: number): MCPErrorCode {
    switch (status) {
        case 401:
            return "UNAUTHORIZED";
        case 404:
            return "NOT_FOUND";
        case 422:
            return "VALIDATION_ERROR";
        default:
            return "SERVER_ERROR";
    }
}

/**
 * Get user-friendly error message from error code
 */
export function getErrorMessage(code: MCPErrorCode): string {
    return errorMessages[code] || errorMessages.SERVER_ERROR;
}

// ============================================
// MCP Bridge Interface
// ============================================

/**
 * MCP Bridge interface for calling MCP tools
 */
interface MCPBridge {
    postgrestRequest(request: {
        method: MCPMethod;
        path: string;
        body?: Record<string, unknown>;
    }): Promise<unknown>;
}

/**
 * Global MCP bridge instance
 * Set by the MCP runtime or test environment
 */
let mcpBridgeInstance: MCPBridge | null = null;

/**
 * Set the MCP bridge instance
 * Called by the MCP runtime during initialization
 */
export function setMCPBridge(bridge: MCPBridge): void {
    mcpBridgeInstance = bridge;
}

/**
 * Get the current MCP bridge instance
 * Auto-initializes with Supabase PostgREST bridge if not set
 */
export function getMCPBridge(): MCPBridge | null {
    if (!mcpBridgeInstance) {
        // Auto-initialize with Supabase PostgREST bridge
        mcpBridgeInstance = createSupabasePostgRESTBridge();
    }
    return mcpBridgeInstance;
}

/**
 * Create a Supabase PostgREST bridge implementation
 * This bridge uses the Supabase REST API directly
 * 
 * Requirements 1.1: Ensure POST requests correctly return inserted data
 */
function createSupabasePostgRESTBridge(): MCPBridge {
    const SUPABASE_URL = process.env.SUPABASE_URL || "https://hydb.haokir.com";
    const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ||
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlhdCI6MTc3OTI1NjMzOCwiZXhwIjoxOTM3MDQ0MzM4fQ.-nUuLQkkZWwBiLfi5H77unYierIrll0eO4wpH5ObBX0";

    return {
        async postgrestRequest(request: {
            method: MCPMethod;
            path: string;
            body?: Record<string, unknown>;
        }): Promise<unknown> {
            const url = `${SUPABASE_URL}/rest/v1${request.path}`;

            // Build headers with proper Prefer header for each operation type
            // Requirements 1.1: POST must return inserted data
            const headers: Record<string, string> = {
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
                "Content-Type": "application/json",
            };

            // Set appropriate Prefer header based on method
            // POST/PATCH: return=representation to get inserted/updated data back
            // DELETE: return=minimal for efficiency
            if (request.method === "POST" || request.method === "PATCH") {
                headers["Prefer"] = "return=representation";
            } else if (request.method === "DELETE") {
                headers["Prefer"] = "return=minimal";
            }

            const fetchOptions: RequestInit = {
                method: request.method,
                headers,
            };

            if (request.body && (request.method === "POST" || request.method === "PATCH")) {
                fetchOptions.body = JSON.stringify(request.body);
            }

            console.log(`[MCP Bridge] ${request.method} ${url}`);
            if (request.body) {
                console.log(`[MCP Bridge] Body: ${JSON.stringify(request.body)}`);
            }

            const response = await fetch(url, fetchOptions);

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[MCP Bridge] Error: ${response.status} ${errorText}`);

                // Parse PostgREST error for better error messages
                let errorDetails: { message?: string; code?: string; details?: string } = {};
                try {
                    errorDetails = JSON.parse(errorText);
                } catch {
                    errorDetails = { message: errorText };
                }

                const error = new Error(
                    errorDetails.message || `PostgREST error: ${response.status}`
                ) as Error & { status: number; code?: string; details?: string };
                error.status = response.status;
                error.code = errorDetails.code;
                error.details = errorDetails.details;
                throw error;
            }

            // Handle empty responses (e.g., DELETE with return=minimal)
            const text = await response.text();
            if (!text) {
                return null;
            }

            const data = JSON.parse(text);

            // Log successful response for debugging
            console.log(`[MCP Bridge] Response: ${Array.isArray(data) ? `${data.length} items` : 'object'}`);

            return data;
        },
    };
}

// Export singleton instance
export const supabaseMCP = new SupabaseMCPClient();
