import type { Route } from "./+types/brands._index";
import { RootLayout } from "~/components/layout";
import { BrandGrid } from "~/components/brand";
import type { Brand } from "~/lib/supabase/types";

/**
 * Brands Index Loader
 * Fetches active brands via Supabase, grouped by brand_group and sorted by sort_order
 * Requirements: 3.1, 3.2
 */
export async function loader({ request }: Route.LoaderArgs) {
    const { getActiveBrands } = await import("~/lib/brand/brand-queries.server");
    const { getUserForHeader } = await import("~/lib/auth/index.server");
    const { getCart } = await import("~/lib/cart/cart-operations.server");
    const { getSections } = await import("~/lib/sections/index.server");

    // Get user info for header display
    const user = await getUserForHeader(request);

    // Get sections for navigation
    const sections = await getSections();

    // Get cart item count
    let cartItemCount = 0;
    try {
        const cartResult = await getCart(request);
        if (cartResult.success && cartResult.data?.cart) {
            cartItemCount = cartResult.data.cart.items.reduce((sum, item) => sum + item.quantity, 0);
        }
    } catch (error) {
        console.error("Failed to get cart:", error);
    }

    try {
        // Fetch active brands (Requirements 3.1, 3.2)
        const brandsResult = await getActiveBrands();

        return {
            brands: brandsResult.data || [],
            error: brandsResult.error,
            user,
            cartItemCount,
            sections,
        };
    } catch (error) {
        console.error("Failed to fetch brands:", error);
        return {
            brands: [],
            error: String(error),
            user,
            cartItemCount,
            sections,
        };
    }
}

export function meta({ }: Route.MetaArgs) {
    return [
        { title: "品牌专栏 - Gisyit Shop" },
        { name: "description", content: "浏览所有品牌和平台" },
    ];
}

/**
 * Brands Index Page Component
 * Displays brands grouped by brand_group and sorted by sort_order
 * Requirements: 3.1, 3.2
 */
export default function BrandsIndex({ loaderData }: Route.ComponentProps) {
    const { brands, error, user, cartItemCount, sections } = loaderData;

    return (
        <RootLayout cartItemCount={cartItemCount} user={user} sections={sections}>
            <div className="space-y-8">
                {/* Page Header */}
                <div>
                    <h1 className="text-3xl font-bold text-text-primary mb-2">品牌专栏</h1>
                    <p className="text-text-secondary">按品牌和平台浏览商品</p>
                </div>

                {/* Error State */}
                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
                        <p>加载品牌失败: {error}</p>
                    </div>
                )}

                {/* Brands Grid - grouped by brand_group */}
                <BrandGrid
                    brands={brands}
                    grouped={true}
                    emptyMessage="暂无品牌"
                />
            </div>
        </RootLayout>
    );
}
