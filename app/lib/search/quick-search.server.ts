/**
 * Quick Search Server Action
 * 
 * Provides combined search functionality for products and brands.
 * Returns results with type, id, name, image, and url for the command palette.
 * 
 * Requirements: 4.3
 */

import { getSupabaseClient } from "~/lib/supabase/client.server";
import type { SearchResult } from "~/components/search/search-results";

/**
 * Quick search response type
 */
export interface QuickSearchResponse {
    results: SearchResult[];
    error: string | null;
}

/**
 * Perform a quick search across products and brands
 * 
 * Searches for:
 * - Active products by name, subtitle, or description
 * - Active brands by name
 * 
 * Returns combined results with type, id, name, image, and url.
 * 
 * Requirements: 4.3
 * - Combined search for products and brands
 * - Returns results with type, id, name, image, url
 * - Only returns active items
 */
export async function quickSearch(query: string): Promise<QuickSearchResponse> {
    const searchTerm = query.trim();

    if (!searchTerm) {
        return { results: [], error: null };
    }

    try {
        const supabase = getSupabaseClient();

        // Search products and brands in parallel
        const [productsResult, brandsResult] = await Promise.all([
            searchProducts(supabase, searchTerm),
            searchBrands(supabase, searchTerm),
        ]);

        // Combine results
        const results: SearchResult[] = [
            ...brandsResult,
            ...productsResult,
        ];

        return { results, error: null };
    } catch (err) {
        console.error("Error in quickSearch:", err);
        return { results: [], error: String(err) };
    }
}

/**
 * Search products by name, subtitle, or description
 * Returns up to 8 active products
 */
async function searchProducts(
    supabase: ReturnType<typeof getSupabaseClient>,
    searchTerm: string
): Promise<SearchResult[]> {
    const { data, error } = await supabase
        .from("products")
        .select(`
            id,
            name,
            slug,
            subtitle,
            images:product_images(image_url, is_primary)
        `)
        .eq("is_active", true)
        .or(`name.ilike.%${searchTerm}%,subtitle.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)
        .order("created_at", { ascending: false })
        .limit(8);

    if (error) {
        console.error("Error searching products:", error);
        return [];
    }

    return (data || []).map((product) => {
        // Get primary image or first image
        const images = product.images as Array<{ image_url: string; is_primary: boolean }> | null;
        const primaryImage = images?.find(img => img.is_primary);
        const image = primaryImage?.image_url || images?.[0]?.image_url;

        return {
            type: "product" as const,
            id: product.id,
            name: product.name,
            subtitle: product.subtitle || undefined,
            image,
            // Use slug for URL if available, fallback to id for backward compatibility
            url: `/product/${product.slug || product.id}`,
        };
    });
}

/**
 * Search brands by name
 * Returns up to 5 active brands
 * 
 * Requirements: 3.5, 4.3
 * - Only returns active brands (is_active = true)
 * - Searches by name
 */
async function searchBrands(
    supabase: ReturnType<typeof getSupabaseClient>,
    searchTerm: string
): Promise<SearchResult[]> {
    const { data, error } = await supabase
        .from("brands")
        .select("id, name, slug, logo_url, brand_group")
        .eq("is_active", true)
        .ilike("name", `%${searchTerm}%`)
        .order("sort_order", { ascending: true })
        .limit(5);

    if (error) {
        console.error("Error searching brands:", error);
        return [];
    }

    return (data || []).map((brand) => ({
        type: "brand" as const,
        id: brand.id,
        name: brand.name,
        subtitle: getBrandGroupLabel(brand.brand_group),
        image: brand.logo_url || undefined,
        url: `/brands/${brand.slug}`,
    }));
}

/**
 * Get human-readable label for brand group
 */
function getBrandGroupLabel(group: string): string {
    const labels: Record<string, string> = {
        os: "操作系统",
        platform: "平台",
        store: "商店",
        other: "其他",
    };
    return labels[group] || group;
}

export default quickSearch;
