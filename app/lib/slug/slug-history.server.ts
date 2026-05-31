/**
 * Slug History Service (Server-side only)
 *
 * Provides slug history operations for 301 redirect support.
 * When a product's slug is changed, the old slug is stored here
 * to enable redirects from old URLs to new URLs.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */

import { getSupabaseClient } from '~/lib/supabase/client.server';
import type { SlugHistory } from '~/lib/supabase/types';

// ============================================
// Types
// ============================================

export interface SlugHistoryEntry {
    id: string;
    product_id: string;
    old_slug: string;
    created_at: string;
}

export interface HistoricalSlugLookupResult {
    productId: string;
    currentSlug: string;
}

// ============================================
// Slug History Functions
// ============================================

/**
 * Record a slug change in history
 *
 * When a product's slug is modified, this function stores the old slug
 * in the slug_history table to enable 301 redirects.
 *
 * Requirements: 5.1
 *
 * @param productId - The product ID
 * @param oldSlug - The previous slug to record
 */
export async function recordSlugChange(
    productId: string,
    oldSlug: string
): Promise<void> {
    if (!productId || !oldSlug || oldSlug.trim() === '') {
        return;
    }

    const trimmedSlug = oldSlug.trim();
    const supabase = getSupabaseClient();

    // Check if this slug is already in history (avoid duplicates)
    const { data: existing } = await supabase
        .from('slug_history')
        .select('id')
        .eq('old_slug', trimmedSlug)
        .single();

    if (existing) {
        // Slug already exists in history, update the product_id
        // This handles the case where a slug was previously used by another product
        await supabase
            .from('slug_history')
            .update({ product_id: productId, created_at: new Date().toISOString() })
            .eq('old_slug', trimmedSlug);
    } else {
        // Insert new history entry
        const { error } = await supabase.from('slug_history').insert({
            product_id: productId,
            old_slug: trimmedSlug,
        });

        if (error) {
            console.error('Error recording slug change:', error);
        }
    }
}

/**
 * Look up product by historical slug
 *
 * Searches the slug_history table for a matching old slug
 * and returns the current product information for redirect.
 *
 * Requirements: 5.2
 *
 * @param slug - The historical slug to look up
 * @returns Product ID and current slug if found, null otherwise
 */
export async function lookupByHistoricalSlug(
    slug: string
): Promise<HistoricalSlugLookupResult | null> {
    if (!slug || slug.trim() === '') {
        return null;
    }

    const trimmedSlug = slug.trim();
    const supabase = getSupabaseClient();

    // Look up the historical slug
    const { data: historyEntry, error: historyError } = await supabase
        .from('slug_history')
        .select('product_id')
        .eq('old_slug', trimmedSlug)
        .single();

    if (historyError || !historyEntry) {
        return null;
    }

    // Get the current product slug
    const { data: product, error: productError } = await supabase
        .from('products')
        .select('id, slug')
        .eq('id', historyEntry.product_id)
        .single();

    if (productError || !product || !product.slug) {
        return null;
    }

    return {
        productId: product.id,
        currentSlug: product.slug,
    };
}

/**
 * Remove a slug from history
 *
 * When a slug is reused by another product, it should be removed
 * from the history table to avoid redirect conflicts.
 *
 * Requirements: 5.3
 *
 * @param slug - The slug to remove from history
 */
export async function removeFromHistory(slug: string): Promise<void> {
    if (!slug || slug.trim() === '') {
        return;
    }

    const trimmedSlug = slug.trim();
    const supabase = getSupabaseClient();

    const { error } = await supabase
        .from('slug_history')
        .delete()
        .eq('old_slug', trimmedSlug);

    if (error) {
        console.error('Error removing slug from history:', error);
    }
}

/**
 * Get all historical slugs for a product
 *
 * Returns all previous slugs that have been used by a product,
 * ordered by creation date (most recent first).
 *
 * Requirements: 5.4
 *
 * @param productId - The product ID to get history for
 * @returns Array of slug history entries
 */
export async function getSlugHistory(
    productId: string
): Promise<SlugHistoryEntry[]> {
    if (!productId || productId.trim() === '') {
        return [];
    }

    const supabase = getSupabaseClient();

    const { data, error } = await supabase
        .from('slug_history')
        .select('*')
        .eq('product_id', productId)
        .order('created_at', { ascending: false });

    if (error || !data) {
        return [];
    }

    return data as SlugHistoryEntry[];
}

/**
 * Check if a slug exists in history
 *
 * Utility function to check if a slug is recorded in the history table.
 *
 * @param slug - The slug to check
 * @returns true if the slug exists in history
 */
export async function isSlugInHistory(slug: string): Promise<boolean> {
    if (!slug || slug.trim() === '') {
        return false;
    }

    const trimmedSlug = slug.trim();
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
        .from('slug_history')
        .select('id')
        .eq('old_slug', trimmedSlug)
        .single();

    return !error && data !== null;
}
