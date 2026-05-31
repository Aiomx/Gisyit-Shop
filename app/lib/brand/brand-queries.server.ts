/**
 * Brand Query Service (Server-side only)
 * 
 * Provides brand query operations via Supabase client.
 * Uses direct Supabase queries for data fetching.
 * 
 * Requirements: 3.1, 3.2, 3.5
 */

import { getSupabaseClient } from "~/lib/supabase/client.server";
import type { Brand, BrandGroup, Product } from "~/lib/supabase/types";

// ============================================
// Response Type
// ============================================

export interface QueryResponse<T> {
    data: T | null;
    error: string | null;
}

// ============================================
// Brand with Product Count
// ============================================

export interface BrandWithProductCount extends Brand {
    product_count: number;
}

// ============================================
// Brand Query Functions
// ============================================

/**
 * Fetch all active brands
 * Returns brands grouped by brand_group and sorted by sort_order
 * 
 * Requirements: 3.1, 3.2
 * - Only returns brands where is_active = true
 * - Groups by brand_group and sorts by sort_order within each group
 */
export async function getActiveBrands(): Promise<QueryResponse<Brand[]>> {
    try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
            .from("brands")
            .select("*")
            .eq("is_active", true)
            .order("brand_group", { ascending: true })
            .order("sort_order", { ascending: true });

        if (error) {
            console.error("Error fetching active brands:", error);
            return { data: null, error: error.message };
        }

        return { data: data as Brand[], error: null };
    } catch (err) {
        console.error("Error in getActiveBrands:", err);
        return { data: null, error: String(err) };
    }
}

/**
 * Fetch a brand by its slug
 * 
 * Requirements: 3.3
 * - Returns brand details for the brand detail page
 */
export async function getBrandBySlug(
    slug: string
): Promise<QueryResponse<Brand | null>> {
    try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
            .from("brands")
            .select("*")
            .eq("slug", slug)
            .eq("is_active", true)
            .single();

        if (error) {
            // Handle "no rows returned" as not found, not an error
            if (error.code === "PGRST116") {
                return { data: null, error: null };
            }
            console.error("Error fetching brand by slug:", error);
            return { data: null, error: error.message };
        }

        return { data: data as Brand, error: null };
    } catch (err) {
        console.error("Error in getBrandBySlug:", err);
        return { data: null, error: String(err) };
    }
}

/**
 * Fetch products associated with a brand
 * 
 * Requirements: 3.3, 3.4
 * - Returns active products associated with the brand
 * - Includes product images and prices for display
 */
export async function getBrandProducts(
    brandId: string
): Promise<QueryResponse<Product[]>> {
    try {
        const supabase = getSupabaseClient();

        // First, get product IDs from product_brands association table
        const { data: associations, error: assocError } = await supabase
            .from("product_brands")
            .select("product_id")
            .eq("brand_id", brandId);

        if (assocError) {
            console.error("Error fetching brand product associations:", assocError);
            return { data: null, error: assocError.message };
        }

        if (!associations || associations.length === 0) {
            return { data: [], error: null };
        }

        // Get the product IDs
        const productIds = associations.map(a => a.product_id);

        // Fetch the products with their relations
        const { data: products, error: productsError } = await supabase
            .from("products")
            .select("*, images:product_images(*), prices:product_prices(*)")
            .in("id", productIds)
            .eq("is_active", true)
            .order("created_at", { ascending: false });

        if (productsError) {
            console.error("Error fetching brand products:", productsError);
            return { data: null, error: productsError.message };
        }

        return { data: products as Product[], error: null };
    } catch (err) {
        console.error("Error in getBrandProducts:", err);
        return { data: null, error: String(err) };
    }
}

/**
 * Search brands by name or group
 * 
 * Requirements: 3.5
 * - Filters active brands matching the search term
 * - Searches in name and brand_group fields
 */
export async function searchBrands(
    query: string
): Promise<QueryResponse<Brand[]>> {
    try {
        const supabase = getSupabaseClient();
        const searchTerm = query.trim().toLowerCase();

        if (!searchTerm) {
            return getActiveBrands();
        }

        const { data, error } = await supabase
            .from("brands")
            .select("*")
            .eq("is_active", true)
            .or(`name.ilike.%${searchTerm}%,brand_group.ilike.%${searchTerm}%`)
            .order("brand_group", { ascending: true })
            .order("sort_order", { ascending: true });

        if (error) {
            console.error("Error searching brands:", error);
            return { data: null, error: error.message };
        }

        return { data: data as Brand[], error: null };
    } catch (err) {
        console.error("Error in searchBrands:", err);
        return { data: null, error: String(err) };
    }
}

/**
 * Get brands grouped by brand_group
 * 
 * Requirements: 3.2
 * - Returns brands organized by group for display
 */
export async function getBrandsGrouped(): Promise<QueryResponse<Record<BrandGroup, Brand[]>>> {
    const result = await getActiveBrands();

    if (result.error || !result.data) {
        return { data: null, error: result.error };
    }

    // Group brands by brand_group
    const grouped = result.data.reduce((acc, brand) => {
        const group = brand.brand_group;
        if (!acc[group]) {
            acc[group] = [];
        }
        acc[group].push(brand);
        return acc;
    }, {} as Record<BrandGroup, Brand[]>);

    return { data: grouped, error: null };
}
