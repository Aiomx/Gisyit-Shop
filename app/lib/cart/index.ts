/**
 * Cart Module Exports
 * 
 * This module provides cart management functionality including:
 * - Session management for anonymous users
 * - Supabase persistence for logged-in users
 * - Cart operations (add, update, remove)
 * - Cart merge for login flow (Requirements 6.1, 6.2, 6.3)
 */

export * from "./types";
export * from "./session.server";
export * from "./cart-operations.server";
export * from "./cart-merge.server";
