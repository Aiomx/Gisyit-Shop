/**
 * Supabase Client (Server-side only)
 * 
 * Creates a Supabase client for authentication operations.
 * This client is used for user registration, login, and session management.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Environment variables for Supabase connection
const SUPABASE_URL = process.env.SUPABASE_URL || "https://hydb.haokir.com";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlhdCI6MTc3OTI1NjMzOCwiZXhwIjoxOTM3MDQ0MzM4fQ.-nUuLQkkZWwBiLfi5H77unYierIrll0eO4wpH5ObBX0";

// Singleton client instance
let supabaseClient: SupabaseClient | null = null;

/**
 * Get the Supabase client instance
 * Uses singleton pattern to reuse the client across requests
 */
export function getSupabaseClient(): SupabaseClient {
    if (!supabaseClient) {
        supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
                detectSessionInUrl: false,
            },
        });
    }
    return supabaseClient;
}

/**
 * Get Supabase Auth client
 */
export function getSupabaseAuth() {
    return getSupabaseClient().auth;
}
