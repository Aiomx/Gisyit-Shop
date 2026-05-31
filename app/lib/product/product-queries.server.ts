/**
 * Product Query Service (Server-side only)
 * 
 * Provides product query operations via Supabase client.
 * Uses direct Supabase queries for data fetching.
 * 支持服务端缓存以提升性能
 */

import { getSupabaseClient } from "~/lib/supabase/client.server";
import { withCache, cacheKey } from "~/lib/cache";
import type {
    Product,
    ProductCategory,
    ProductType,
    StoreSection,
} from "~/lib/supabase/types";
import type { ProductWithRelations } from "~/lib/supabase/queries.server";

// ============================================
// Response Type
// ============================================

export interface QueryResponse<T> {
    data: T | null;
    error: string | null;
}

// ============================================
// Product Query Options
// ============================================

export interface ProductQueryOptions {
    type?: ProductType;
    types?: ProductType[];
    category_id?: string;
    is_active?: boolean;
    limit?: number;
    offset?: number;
    search?: string;
}

// ============================================
// Product Query Functions
// ============================================

/**
 * Fetch all products with optional filters (带缓存)
 */
export async function getProducts(
    options: ProductQueryOptions = {}
): Promise<QueryResponse<Product[]>> {
    const {
        type,
        types,
        category_id,
        is_active = true,
        limit = 50,
        offset = 0,
    } = options;

    // 生成缓存 key
    const key = cacheKey('products', type, types?.join(','), category_id, String(is_active), String(limit), String(offset));

    return withCache(key, async () => {
        try {
            const supabase = getSupabaseClient();
            let query = supabase
                .from("products")
                .select("*, images:product_images(*), prices:product_prices(*)")
                .eq("is_active", is_active)
                .order("created_at", { ascending: false });

            if (type) {
                query = query.eq("product_type", type);
            }

            if (types && types.length > 0) {
                query = query.in("product_type", types);
            }

            if (category_id) {
                query = query.eq("category_id", category_id);
            }

            if (limit) {
                query = query.limit(limit);
            }

            if (offset) {
                query = query.range(offset, offset + (limit || 50) - 1);
            }

            const { data, error } = await query;

            if (error) {
                console.error("Error fetching products:", error);
                return { data: null, error: error.message };
            }

            return { data: data as Product[], error: null };
        } catch (err) {
            console.error("Error in getProducts:", err);
            return { data: null, error: String(err) };
        }
    });
}

/**
 * Fetch products by store section
 * Maps store sections to product types
 */
export async function getProductsBySection(
    section: string,
    options: Omit<ProductQueryOptions, "type" | "types"> = {}
): Promise<QueryResponse<Product[]>> {
    // Map store sections to product types
    const sectionToTypes: Record<string, ProductType[]> = {
        apps: ["app"],
        games: ["game_card", "game_cdk", "game_digital"],
        store: ["physical"],
        overseas: ["overseas"],
        ai: ["ai"],
    };

    const types = sectionToTypes[section];

    // If section not found in mapping, try to fetch by product_type directly
    if (!types) {
        return getProducts({
            ...options,
            type: section as ProductType,
        });
    }

    return getProducts({
        ...options,
        types,
    });
}

/**
 * Fetch products by category ID
 */
export async function getProductsByCategory(
    categoryId: string,
    options: Omit<ProductQueryOptions, "category_id"> = {}
): Promise<QueryResponse<Product[]>> {
    return getProducts({
        ...options,
        category_id: categoryId,
    });
}

/**
 * Fetch a category by slug (带缓存)
 */
export async function getCategoryBySlug(
    slug: string
): Promise<QueryResponse<ProductCategory | null>> {
    const key = cacheKey('categories', 'slug', slug);

    return withCache(key, async () => {
        try {
            const supabase = getSupabaseClient();
            const { data, error } = await supabase
                .from("product_categories")
                .select("*")
                .eq("slug", slug)
                .single();

            if (error) {
                console.error("Error fetching category:", error);
                return { data: null, error: error.message };
            }

            return { data: data as ProductCategory, error: null };
        } catch (err) {
            console.error("Error in getCategoryBySlug:", err);
            return { data: null, error: String(err) };
        }
    });
}

/**
 * Fetch a single product by ID with all relations
 */
export async function getProductById(
    productId: string
): Promise<QueryResponse<ProductWithRelations | null>> {
    try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
            .from("products")
            .select(`
                *,
                images:product_images(*),
                prices:product_prices(*),
                specs:product_specs(*, options:product_spec_options(*)),
                videos:product_videos(*),
                category:product_categories(*)
            `)
            .eq("id", productId)
            .single();

        if (error) {
            console.error("Error fetching product:", error);
            return { data: null, error: error.message };
        }

        return { data: data as ProductWithRelations, error: null };
    } catch (err) {
        console.error("Error in getProductById:", err);
        return { data: null, error: String(err) };
    }
}

/**
 * Search products by name or description
 */
export async function searchProducts(
    searchTerm: string,
    options: Omit<ProductQueryOptions, "search"> = {}
): Promise<QueryResponse<Product[]>> {
    try {
        const supabase = getSupabaseClient();
        const { is_active = true, limit = 20 } = options;

        const { data, error } = await supabase
            .from("products")
            .select("*, images:product_images(*), prices:product_prices(*)")
            .eq("is_active", is_active)
            .or(`name.ilike.%${searchTerm}%,subtitle.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)
            .order("created_at", { ascending: false })
            .limit(limit);

        if (error) {
            console.error("Error searching products:", error);
            return { data: null, error: error.message };
        }

        return { data: data as Product[], error: null };
    } catch (err) {
        console.error("Error in searchProducts:", err);
        return { data: null, error: String(err) };
    }
}

/**
 * Fetch product categories (带缓存)
 */
export async function getCategories(
    section?: StoreSection
): Promise<QueryResponse<ProductCategory[]>> {
    const key = cacheKey('categories', section || 'all');

    return withCache(key, async () => {
        try {
            const supabase = getSupabaseClient();
            let query = supabase
                .from("product_categories")
                .select("*")
                .order("sort_order", { ascending: true });

            if (section) {
                query = query.eq("store_section", section);
            }

            const { data, error } = await query;

            if (error) {
                console.error("Error fetching categories:", error);
                return { data: null, error: error.message };
            }

            return { data: data as ProductCategory[], error: null };
        } catch (err) {
            console.error("Error in getCategories:", err);
            return { data: null, error: String(err) };
        }
    });
}

/**
 * Fetch featured products for homepage (带缓存)
 * Returns products organized by section
 */
export async function getFeaturedProducts(): Promise<{
    featuredProduct: Product | undefined;
    todayProducts: Product[];
    shelves: Array<{
        title: string;
        products: Product[];
        viewAllLink: string;
        section: StoreSection;
    }>;
}> {
    const key = cacheKey('featuredProducts');

    return withCache(key, async () => {
        // Fetch all active products
        const result = await getProducts({ limit: 50 });

        if (result.error || !result.data) {
            return {
                featuredProduct: undefined,
                todayProducts: [],
                shelves: [],
            };
        }

        const products = result.data;

        // Organize products
        const featuredProduct = products.find(p => p.has_discount) || products[0];
        const todayProducts = products.slice(0, 6);

        // Group by section
        const appProducts = products.filter(p => p.product_type === "app");
        const gameProducts = products.filter(p =>
            ["game_card", "game_cdk", "game_digital"].includes(p.product_type)
        );
        const physicalProducts = products.filter(p => p.product_type === "physical");
        const overseasProducts = products.filter(p => p.product_type === "overseas");

        const shelves = [
            { title: "热门应用", products: appProducts, viewAllLink: "/apps", section: "apps" as StoreSection },
            { title: "精选游戏", products: gameProducts, viewAllLink: "/games", section: "games" as StoreSection },
            { title: "实物商品", products: physicalProducts, viewAllLink: "/store", section: "store" as StoreSection },
            { title: "海外代购", products: overseasProducts, viewAllLink: "/overseas", section: "overseas" as StoreSection },
        ].filter(shelf => shelf.products.length > 0);

        return {
            featuredProduct,
            todayProducts,
            shelves,
        };
    });
}
