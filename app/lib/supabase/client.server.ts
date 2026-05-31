/**
 * Supabase Client (Server-side only)
 * 
 * Creates a Supabase client for authentication operations.
 * This client is used for user registration, login, and session management.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Environment variables for Supabase connection
const SUPABASE_URL = process.env.SUPABASE_URL || "https://api.haokir.com";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzY0Nzc3NjAwLCJleHAiOjE5MjI1NDQwMDB9.JQekgxRZBzi_pl2iLLXJw5yllgB5iKSvTOzoY6kYw3E";

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
