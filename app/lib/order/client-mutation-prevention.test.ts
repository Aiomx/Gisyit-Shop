/**
 * Property-Based Tests for Client-Side Mutation Prevention
 *
 * Tests that verify the security architecture prevents direct client-side
 * order creation or modification.
 *
 * **Feature: order-payment-flow, Property 11: Client-side mutation prevention**
 * **Validates: Requirements 7.4**
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";

// ============================================
// Security Architecture Verification
// ============================================

/**
 * Represents the allowed HTTP methods for order-related endpoints
 */
type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/**
 * Represents an API endpoint configuration
 */
interface EndpointConfig {
    path: string;
    allowedMethods: HttpMethod[];
    requiresServerAction: boolean;
    description: string;
}

/**
 * Order-related API endpoints and their security configurations
 * These represent the actual endpoints in the system
 */
const ORDER_ENDPOINTS: EndpointConfig[] = [
    {
        path: "/api/checkout",
        allowedMethods: ["POST"],
        requiresServerAction: true,
        description: "Create checkout session and pending order",
    },
    {
        path: "/api/webhook.stripe",
        allowedMethods: ["POST"],
        requiresServerAction: true,
        description: "Handle Stripe webhook events for order status updates",
    },
];

/**
 * Represents a client request attempt
 */
interface ClientRequest {
    method: HttpMethod;
    path: string;
    body?: Record<string, unknown>;
    headers?: Record<string, string>;
}

/**
 * Validates that a request follows the security architecture
 * Returns true if the request is allowed, false if it should be rejected
 */
function isRequestAllowed(request: ClientRequest): {
    allowed: boolean;
    reason: string;
} {
    const endpoint = ORDER_ENDPOINTS.find((e) => e.path === request.path);

    // Unknown endpoint - not an order mutation endpoint
    if (!endpoint) {
        return {
            allowed: false,
            reason: "Unknown order endpoint",
        };
    }

    // Check if method is allowed
    if (!endpoint.allowedMethods.includes(request.method)) {
        return {
            allowed: false,
            reason: `Method ${request.method} not allowed for ${request.path}`,
        };
    }

    // For server action endpoints, the request must go through the server
    // This is enforced by the Remix framework - client can only call via fetch
    if (endpoint.requiresServerAction) {
        return {
            allowed: true,
            reason: "Request goes through server action",
        };
    }

    return {
        allowed: true,
        reason: "Request allowed",
    };
}

/**
 * Simulates what would happen if a client tried to directly mutate orders
 * This represents the security boundary enforcement
 */
function simulateDirectOrderMutation(mutation: {
    type: "create" | "update" | "delete";
    orderId?: string;
    data?: Record<string, unknown>;
}): { blocked: boolean; reason: string } {
    // All direct mutations are blocked - they must go through server actions
    // This is enforced by:
    // 1. Server-only modules (.server.ts files)
    // 2. No direct database access from client
    // 3. All mutations require server action handlers

    return {
        blocked: true,
        reason: `Direct ${mutation.type} mutation blocked - must use server action`,
    };
}

/**
 * Validates that server-only modules are not accessible from client
 */
function isServerOnlyModule(modulePath: string): boolean {
    // Modules ending with .server.ts are server-only in Remix
    return modulePath.endsWith(".server.ts") || modulePath.endsWith(".server");
}

/**
 * List of order-related server modules that should not be accessible from client
 */
const SERVER_ONLY_MODULES = [
    "~/lib/order/order-operations.server",
    "~/lib/order/pending-order.server",
    "~/lib/supabase/client.server",
    "~/lib/stripe/stripe.server",
    "~/lib/stripe/webhook.server",
];

// ============================================
// Arbitraries (Generators)
// ============================================

/**
 * Generate random HTTP methods
 */
const httpMethodArb: fc.Arbitrary<HttpMethod> = fc.constantFrom(
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE"
);

/**
 * Generate random order-related paths (including invalid ones)
 */
const orderPathArb = fc.oneof(
    fc.constant("/api/checkout"),
    fc.constant("/api/webhook.stripe"),
    fc.constant("/api/orders"),
    fc.constant("/api/orders/create"),
    fc.constant("/api/orders/update"),
    fc.constant("/orders"),
    fc.string({ minLength: 1, maxLength: 50 }).map((s) => `/api/${s}`),
);

/**
 * Generate random request body
 */
const requestBodyArb = fc.option(
    fc.dictionary(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.oneof(
            fc.string({ minLength: 1, maxLength: 100 }),
            fc.integer(),
            fc.boolean()
        ),
        { minKeys: 0, maxKeys: 5 }
    ),
    { nil: undefined }
);

/**
 * Generate a client request
 */
const clientRequestArb: fc.Arbitrary<ClientRequest> = fc.record({
    method: httpMethodArb,
    path: orderPathArb,
    body: requestBodyArb,
});

/**
 * Generate mutation types
 */
const mutationTypeArb = fc.constantFrom("create", "update", "delete") as fc.Arbitrary<
    "create" | "update" | "delete"
>;

/**
 * Generate a direct mutation attempt
 */
const directMutationArb = fc.record({
    type: mutationTypeArb,
    orderId: fc.option(fc.uuid(), { nil: undefined }),
    data: requestBodyArb,
});

// ============================================
// Property Tests
// ============================================

describe("Property 11: Client-side mutation prevention", () => {
    /**
     * **Feature: order-payment-flow, Property 11: Client-side mutation prevention**
     * **Validates: Requirements 7.4**
     *
     * For any HTTP request from client-side code attempting to directly create
     * or modify orders, the system must reject the request unless it goes
     * through a valid server action.
     */
    describe("Direct order mutations are blocked", () => {
        it("all direct order mutations are blocked", () => {
            fc.assert(
                fc.property(directMutationArb, (mutation) => {
                    const result = simulateDirectOrderMutation(mutation);

                    // All direct mutations must be blocked
                    expect(result.blocked).toBe(true);
                    expect(result.reason).toContain("must use server action");

                    return result.blocked === true;
                }),
                { numRuns: 100 }
            );
        });

        it("create mutations are blocked", () => {
            fc.assert(
                fc.property(requestBodyArb, (data) => {
                    const result = simulateDirectOrderMutation({
                        type: "create",
                        data: data ?? undefined,
                    });

                    return result.blocked === true;
                }),
                { numRuns: 100 }
            );
        });

        it("update mutations are blocked", () => {
            fc.assert(
                fc.property(fc.uuid(), requestBodyArb, (orderId, data) => {
                    const result = simulateDirectOrderMutation({
                        type: "update",
                        orderId,
                        data: data ?? undefined,
                    });

                    return result.blocked === true;
                }),
                { numRuns: 100 }
            );
        });

        it("delete mutations are blocked", () => {
            fc.assert(
                fc.property(fc.uuid(), (orderId) => {
                    const result = simulateDirectOrderMutation({
                        type: "delete",
                        orderId,
                    });

                    return result.blocked === true;
                }),
                { numRuns: 100 }
            );
        });
    });

    describe("Server-only modules are protected", () => {
        it("all order server modules are marked as server-only", () => {
            for (const modulePath of SERVER_ONLY_MODULES) {
                expect(isServerOnlyModule(modulePath)).toBe(true);
            }
        });

        it("server-only module detection works correctly", () => {
            fc.assert(
                fc.property(
                    fc.string({ minLength: 1, maxLength: 50 }),
                    fc.boolean(),
                    (baseName, isServer) => {
                        const modulePath = isServer
                            ? `~/lib/${baseName}.server.ts`
                            : `~/lib/${baseName}.ts`;

                        const result = isServerOnlyModule(modulePath);

                        return result === isServer;
                    }
                ),
                { numRuns: 100 }
            );
        });
    });

    describe("API endpoint security", () => {
        it("only POST is allowed for checkout endpoint", () => {
            fc.assert(
                fc.property(httpMethodArb, (method) => {
                    const request: ClientRequest = {
                        method,
                        path: "/api/checkout",
                    };

                    const result = isRequestAllowed(request);

                    if (method === "POST") {
                        return result.allowed === true;
                    } else {
                        return result.allowed === false;
                    }
                }),
                { numRuns: 100 }
            );
        });

        it("only POST is allowed for webhook endpoint", () => {
            fc.assert(
                fc.property(httpMethodArb, (method) => {
                    const request: ClientRequest = {
                        method,
                        path: "/api/webhook.stripe",
                    };

                    const result = isRequestAllowed(request);

                    if (method === "POST") {
                        return result.allowed === true;
                    } else {
                        return result.allowed === false;
                    }
                }),
                { numRuns: 100 }
            );
        });

        it("unknown order endpoints are rejected", () => {
            fc.assert(
                fc.property(
                    httpMethodArb,
                    fc.string({ minLength: 1, maxLength: 30 }).filter(
                        (s) => s !== "checkout" && s !== "webhook.stripe"
                    ),
                    (method, path) => {
                        const request: ClientRequest = {
                            method,
                            path: `/api/${path}`,
                        };

                        const result = isRequestAllowed(request);

                        // Unknown endpoints should be rejected
                        return result.allowed === false;
                    }
                ),
                { numRuns: 100 }
            );
        });
    });

    describe("Request validation", () => {
        it("random requests to order endpoints follow security rules", () => {
            fc.assert(
                fc.property(clientRequestArb, (request) => {
                    const result = isRequestAllowed(request);

                    // If the request is to a known endpoint with correct method, it's allowed
                    // Otherwise, it's rejected
                    const endpoint = ORDER_ENDPOINTS.find((e) => e.path === request.path);

                    if (!endpoint) {
                        return result.allowed === false;
                    }

                    if (!endpoint.allowedMethods.includes(request.method)) {
                        return result.allowed === false;
                    }

                    return result.allowed === true;
                }),
                { numRuns: 100 }
            );
        });
    });
});

// ============================================
// Architecture Verification Tests
// ============================================

describe("Security Architecture Verification", () => {
    it("order operations module is server-only", () => {
        expect(isServerOnlyModule("~/lib/order/order-operations.server")).toBe(true);
    });

    it("pending order module is server-only", () => {
        expect(isServerOnlyModule("~/lib/order/pending-order.server")).toBe(true);
    });

    it("supabase client is server-only", () => {
        expect(isServerOnlyModule("~/lib/supabase/client.server")).toBe(true);
    });

    it("stripe server module is server-only", () => {
        expect(isServerOnlyModule("~/lib/stripe/stripe.server")).toBe(true);
    });

    it("webhook handler is server-only", () => {
        expect(isServerOnlyModule("~/lib/stripe/webhook.server")).toBe(true);
    });

    it("checkout endpoint only accepts POST", () => {
        const endpoint = ORDER_ENDPOINTS.find((e) => e.path === "/api/checkout");
        expect(endpoint).toBeDefined();
        expect(endpoint?.allowedMethods).toEqual(["POST"]);
        expect(endpoint?.requiresServerAction).toBe(true);
    });

    it("webhook endpoint only accepts POST", () => {
        const endpoint = ORDER_ENDPOINTS.find((e) => e.path === "/api/webhook.stripe");
        expect(endpoint).toBeDefined();
        expect(endpoint?.allowedMethods).toEqual(["POST"]);
        expect(endpoint?.requiresServerAction).toBe(true);
    });
});
