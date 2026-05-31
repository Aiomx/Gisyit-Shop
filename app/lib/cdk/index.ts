/**
 * CDK (激活码) Module
 *
 * Public exports for the CDK auto-delivery system.
 */

// Types
export * from "./types";

// Utilities
export { parseTextInput } from "./utils";
export { deduplicateCodes } from "./utils";
export { validateCode } from "./utils";

// Note: Server-side functions are exported from their respective .server.ts files
// Import them directly:
// - import { reserveCodes, getAvailableCount } from "~/lib/cdk/inventory.server";
// - import { createAuditLog, createBatchAuditLogs } from "~/lib/cdk/audit.server";
