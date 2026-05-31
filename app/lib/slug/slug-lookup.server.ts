/**
 * Slug Lookup Service (Server-side only)
 *
 * Provides slug lookup operations for product routing.
 * Supports lookup by slug, UUID, and historical slugs.
 *
 * Requirements: 2.1, 7.1, 7.2, 1.3
 */

import { getSupabaseClient } from '~/lib/supabase/client.server';
import type { Product } from '~/lib/supabase/types';
import { generateSlug, validateSlug } from './slug';

// ============================================
// Types
// ============================================

export interface SlugLookupResult {
    found: boolean;
    product?: Product;
    /** If UUID or historical slug, redirect to this slug */
    redirectTo?: string;
    /** Whether the lookup was via historical slug */
    isHistorical?: boolean;
}

export interface QueryResponse<T> {
    data: T | null;
    error: string | null;
}

// ============================================
// UUID Detection
// ============================================

/**
 * Check if a string is a valid UUID v4 format
 */
export function isUUID(str: string): boolean {
    const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
}

// ============================================
// Slug Lookup Functions
// ============================================

/**
 * Full product select query with all relations
 * Includes images, prices, specs, videos, and category
 */
const FULL_PRODUCT_SELECT = `
    *,
    images:product_images(*),
    prices:product_prices(*),
    specs:product_specs(*, options:product_spec_options(*)),
    videos:product_videos(*),
    category:product_categories(*)
`;

/**
 * Look up a product by slug or UUID
 *
 * - If slug found: return product with full relations
 * - If UUID found: return product with redirectTo slug
 * - If historical slug found: return redirectTo current slug
 * - If not found: return found=false
 *
 * Requirements: 2.1, 7.1, 7.2
 *
 * @param identifier - Slug or UUID to look up
 * @returns Lookup result with product and redirect info
 */
export async function lookupBySlugOrId(
    identifier: string
): Promise<SlugLookupResult> {
    if (!identifier || identifier.trim() === '') {
        return { found: false };
    }

    const trimmedIdentifier = identifier.trim();
    const supabase = getSupabaseClient();

    // Check if identifier is a UUID
    if (isUUID(trimmedIdentifier)) {
        // Look up by UUID - only need basic info for redirect
        const { data: product, error } = await supabase
            .from('products')
            .select('id, slug')
            .eq('id', trimmedIdentifier)
            .single();

        if (error || !product) {
            return { found: false };
        }

        // If product has a slug, redirect to it (don't need full data for redirect)
        if (product.slug) {
            return {
                found: true,
                redirectTo: product.slug,
            };
        }

        // Product found but no slug - fetch full data
        const { data: fullProduct, error: fullError } = await supabase
            .from('products')
            .select(FULL_PRODUCT_SELECT)
            .eq('id', trimmedIdentifier)
            .single();

        if (fullError || !fullProduct) {
            return { found: false };
        }

        return {
            found: true,
            product: fullProduct as Product,
        };
    }

    // Look up by slug - fetch full product data with relations
    const { data: productBySlug, error: slugError } = await supabase
        .from('products')
        .select(FULL_PRODUCT_SELECT)
        .eq('slug', trimmedIdentifier)
        .single();

    if (!slugError && productBySlug) {
        return {
            found: true,
            product: productBySlug as Product,
        };
    }

    // Look up in slug history
    const { data: historyEntry, error: historyError } = await supabase
        .from('slug_history')
        .select('product_id, old_slug')
        .eq('old_slug', trimmedIdentifier)
        .single();

    if (!historyError && historyEntry) {
        // Found in history, get current product slug for redirect
        const { data: historicalProduct, error: productError } = await supabase
            .from('products')
            .select('id, slug')
            .eq('id', historyEntry.product_id)
            .single();

        if (!productError && historicalProduct && historicalProduct.slug) {
            return {
                found: true,
                redirectTo: historicalProduct.slug,
                isHistorical: true,
            };
        }
    }

    // Not found
    return { found: false };
}

/**
 * Check if a slug is available (not used by any product)
 *
 * Requirements: 1.3
 *
 * @param slug - The slug to check
 * @param excludeProductId - Optional product ID to exclude (for updates)
 * @returns true if slug is available
 */
export async function isSlugAvailable(
    slug: string,
    excludeProductId?: string
): Promise<boolean> {
    if (!slug || slug.trim() === '') {
        return false;
    }

    const trimmedSlug = slug.trim();

    // Validate slug format first
    const validation = validateSlug(trimmedSlug);
    if (!validation.valid) {
        return false;
    }

    const supabase = getSupabaseClient();

    // Check if slug exists in products table
    let query = supabase
        .from('products')
        .select('id')
        .eq('slug', trimmedSlug);

    if (excludeProductId) {
        query = query.neq('id', excludeProductId);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error checking slug availability:', error);
        return false;
    }

    // Slug is available if no products found with this slug
    return !data || data.length === 0;
}

/**
 * Generate a unique slug by appending numeric suffix if needed
 *
 * Requirements: 1.3
 *
 * @param baseName - The base name to generate slug from
 * @param excludeProductId - Optional product ID to exclude (for updates)
 * @returns A unique slug
 */
export async function generateUniqueSlug(
    baseName: string,
    excludeProductId?: string
): Promise<string> {
    const baseSlug = generateSlug(baseName);

    if (!baseSlug) {
        // If base slug is empty, generate a random one
        return `product-${Date.now()}`;
    }

    // Check if base slug is available
    const isAvailable = await isSlugAvailable(baseSlug, excludeProductId);
    if (isAvailable) {
        return baseSlug;
    }

    // Try appending numeric suffixes
    let suffix = 2;
    const maxAttempts = 100;

    while (suffix <= maxAttempts) {
        const candidateSlug = `${baseSlug}-${suffix}`;
        const candidateAvailable = await isSlugAvailable(
            candidateSlug,
            excludeProductId
        );

        if (candidateAvailable) {
            return candidateSlug;
        }

        suffix++;
    }

    // Fallback: append timestamp
    return `${baseSlug}-${Date.now()}`;
}

/**
 * Get a product by slug only (no UUID or history lookup)
 *
 * @param slug - The slug to look up
 * @returns Query response with product or error
 */
export async function getProductBySlug(
    slug: string
): Promise<QueryResponse<Product | null>> {
    if (!slug || slug.trim() === '') {
        return { data: null, error: 'Slug cannot be empty' };
    }

    try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('slug', slug.trim())
            .single();

        if (error) {
            return { data: null, error: error.message };
        }

        return { data: data as Product, error: null };
    } catch (err) {
        return { data: null, error: String(err) };
    }
}

/**
 * Get all existing slugs (for uniqueness checking)
 *
 * @param excludeProductId - Optional product ID to exclude
 * @returns Array of existing slugs
 */
export async function getAllSlugs(
    excludeProductId?: string
): Promise<string[]> {
    try {
        const supabase = getSupabaseClient();
        let query = supabase
            .from('products')
            .select('slug')
            .not('slug', 'is', null);

        if (excludeProductId) {
            query = query.neq('id', excludeProductId);
        }

        const { data, error } = await query;

        if (error || !data) {
            return [];
        }

        return data
            .map((p) => p.slug)
            .filter((slug): slug is string => slug !== null);
    } catch {
        return [];
    }
}
