/**
 * CDK Server Guard (Server-side only)
 *
 * Provides server-side execution guards for CDK operations.
 * Ensures all CDK mutations are executed only in server context.
 *
 * IMPORTANT: This file should only be used in server-side code (loaders/actions).
 * The .server.ts suffix ensures it's not bundled for the client.
 *
 * Requirements: 9.1, 9.2
 */

import { CDKErrorCodes, type CDKErrorCode } from "./types";

// ============================================
// Server Context Detection
// ============================================

/**
 * Check if code is running in a server context
 *
 * In Remix, server-side code runs in Node.js environment.
 * Client-side code runs in browser environment.
 *
 * Requirements: 9.1, 9.2
 */
export function isServerContext(): boolean {
    // Check for Node.js-specific globals that don't exist in browser
    return (
        typeof process !== "undefined" &&
        process.versions != null &&
        process.versions.node != null
    );
}

/**
 * Check if code is running in a browser context
 */
export function isBrowserContext(): boolean {
    return (
        typeof window !== "undefined" &&
        typeof document !== "undefined"
    );
}

// ============================================
// Server Guard Types
// ============================================

/**
 * Result of a server guard check
 */
export interface ServerGuardResult {
    allowed: boolean;
    reason: string;
    errorCode?: CDKErrorCode;
}

/**
 * CDK operation types that require server-side execution
 */
export type CDKMutationOperation =
    | "reserve"
    | "deliver"
    | "release"
    | "invalidate"
    | "import"
    | "cleanup";

// ============================================
// Server Guard Functions
// ============================================

/**
 * Assert that code is running in server context
 *
 * Throws an error if called from client-side code.
 * This is a runtime check that complements the .server.ts file convention.
 *
 * Requirements: 9.1, 9.2
 *
 * @param operation - The operation being attempted (for error messages)
 * @throws Error if not in server context
 */
export function assertServerContext(operation: string): void {
    if (!isServerContext()) {
        throw new Error(
            `[CDK Security] Operation "${operation}" must be executed on the server. ` +
            `Client-side CDK mutations are not allowed.`
        );
    }
}

/**
 * Check if a CDK mutation operation is allowed
 *
 * Returns a result object indicating whether the operation is allowed
 * and the reason if not.
 *
 * Requirements: 9.1, 9.2
 *
 * @param operation - The CDK operation being attempted
 * @returns Guard result with allowed status and reason
 */
export function checkCDKMutationAllowed(
    operation: CDKMutationOperation
): ServerGuardResult {
    // Check server context
    if (!isServerContext()) {
        return {
            allowed: false,
            reason: `CDK ${operation} operation must be executed on the server`,
            errorCode: CDKErrorCodes.UNAUTHORIZED,
        };
    }

    // All server-side CDK mutations are allowed
    return {
        allowed: true,
        reason: "Server context verified",
    };
}

// ============================================
// CDK Server Guard Class
// ============================================

/**
 * CDK Server Guard
 *
 * Provides a class-based interface for server-side guards.
 * Can be used to wrap CDK operations with authorization checks.
 *
 * Requirements: 9.1, 9.2
 */
export class CDKServerGuard {
    private static instance: CDKServerGuard;

    private constructor() {
        // Private constructor for singleton pattern
    }

    /**
     * Get the singleton instance
     */
    static getInstance(): CDKServerGuard {
        if (!CDKServerGuard.instance) {
            CDKServerGuard.instance = new CDKServerGuard();
        }
        return CDKServerGuard.instance;
    }

    /**
     * Check if running in server context
     */
    isServer(): boolean {
        return isServerContext();
    }

    /**
     * Check if running in browser context
     */
    isBrowser(): boolean {
        return isBrowserContext();
    }

    /**
     * Assert server context for an operation
     *
     * @param operation - The operation name
     * @throws Error if not in server context
     */
    assertServer(operation: string): void {
        assertServerContext(operation);
    }

    /**
     * Check if a mutation operation is allowed
     *
     * @param operation - The CDK mutation operation
     * @returns Guard result
     */
    checkMutation(operation: CDKMutationOperation): ServerGuardResult {
        return checkCDKMutationAllowed(operation);
    }

    /**
     * Execute a function only if in server context
     *
     * @param operation - The operation name
     * @param fn - The function to execute
     * @returns The function result or throws if not in server context
     */
    async executeOnServer<T>(
        operation: string,
        fn: () => Promise<T>
    ): Promise<T> {
        this.assertServer(operation);
        return fn();
    }
}

// ============================================
// Server-Only Module List
// ============================================

/**
 * List of CDK server-only modules
 *
 * These modules should only be imported in server-side code.
 * The .server.ts suffix ensures Remix doesn't bundle them for the client.
 */
export const CDK_SERVER_MODULES = [
    "~/lib/cdk/inventory.server",
    "~/lib/cdk/audit.server",
    "~/lib/cdk/server-guard.server",
] as const;

/**
 * Check if a module path is a CDK server-only module
 *
 * @param modulePath - The module path to check
 * @returns True if the module is server-only
 */
export function isCDKServerModule(modulePath: string): boolean {
    return (
        modulePath.endsWith(".server.ts") ||
        modulePath.endsWith(".server") ||
        CDK_SERVER_MODULES.some((m) => modulePath.includes(m))
    );
}

