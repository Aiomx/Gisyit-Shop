import type { Route } from "./+types/brands.$slug";
import { RootLayout } from "~/components/layout";
import { ProductGrid } from "~/components/product";
import { Link } from "react-router";
import type { Brand, Product } from "~/lib/supabase/types";

/**
 * Brand Detail Loader
 * Fetches brand info and associated products
 * Requirements: 3.3, 3.4
 */
export async function loader({ request, params }: Route.LoaderArgs) {
    const { getBrandBySlug, getBrandProducts } = await import("~/lib/brand/brand-queries.server");
    const { getUserForHeader } = await import("~/lib/auth/index.server");
    const { getCart } = await import("~/lib/cart/cart-operations.server");
    const { getSections } = await import("~/lib/sections/index.server");

    const { slug } = params;

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

    if (!slug) {
        return {
            brand: null,
            products: [],
            error: "品牌标识不能为空",
            user,
            cartItemCount,
            sections,
        };
    }

    try {
        // Fetch brand by slug (Requirements 3.3)
        const brandResult = await getBrandBySlug(slug);

        if (brandResult.error) {
            return {
                brand: null,
                products: [],
                error: brandResult.error,
                user,
                cartItemCount,
                sections,
            };
        }

        if (!brandResult.data) {
            return {
                brand: null,
                products: [],
                error: "品牌不存在",
                user,
                cartItemCount,
                sections,
            };
        }

        const brand = brandResult.data;

        // Fetch products associated with the brand (Requirements 3.3, 3.4)
        const productsResult = await getBrandProducts(brand.id);

        return {
            brand,
            products: productsResult.data || [],
            error: productsResult.error,
            user,
            cartItemCount,
            sections,
        };
    } catch (error) {
        console.error("Failed to fetch brand:", error);
        return {
            brand: null,
            products: [],
            error: String(error),
            user,
            cartItemCount,
            sections,
        };
    }
}

export function meta({ data }: Route.MetaArgs) {
    const brand = data?.brand as Brand | null;
    if (brand) {
        return [
            { title: `${brand.name} - 品牌专栏 - Store` },
            { name: "description", content: brand.description || `浏览 ${brand.name} 相关商品` },
        ];
    }
    return [
        { title: "品牌不存在 - Store" },
        { name: "description", content: "找不到该品牌" },
    ];
}

/**
 * Brand Detail Page Component
 * Displays brand info and associated products
 * Requirements: 3.3, 3.4
 */
export default function BrandDetail({ loaderData }: Route.ComponentProps) {
    const { brand, products, error, user, cartItemCount, sections } = loaderData;

    // Brand not found
    if (!brand) {
        return (
            <RootLayout cartItemCount={cartItemCount} user={user} sections={sections}>
                <div className="flex flex-col items-center justify-center py-16">
                    <span className="text-6xl mb-4">🏷️</span>
                    <h1 className="text-2xl font-bold text-text-primary mb-2">品牌不存在</h1>
                    <p className="text-text-muted mb-6">{error || "找不到该品牌"}</p>
                    <Link
                        to="/brands"
                        className="px-6 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors"
                    >
                        返回品牌专栏
                    </Link>
                </div>
            </RootLayout>
        );
    }

    return (
        <RootLayout cartItemCount={cartItemCount} user={user} sections={sections}>
            <div className="space-y-8">
                {/* Breadcrumb */}
                <nav className="flex items-center gap-2 text-sm text-text-muted">
                    <Link to="/brands" className="hover:text-text-primary transition-colors">
                        品牌专栏
                    </Link>
                    <span>/</span>
                    <span className="text-text-primary">{brand.name}</span>
                </nav>

                {/* Brand Header */}
                <div className="flex items-center gap-6">
                    {/* Brand Logo */}
                    <div className="w-24 h-24 rounded-xl bg-bg-secondary flex items-center justify-center overflow-hidden">
                        {brand.logo_url ? (
                            <img
                                src={brand.logo_url}
                                alt={brand.name}
                                className="w-full h-full object-contain p-2"
                            />
                        ) : (
                            <span className="text-4xl font-bold text-text-tertiary">
                                {brand.name.charAt(0).toUpperCase()}
                            </span>
                        )}
                    </div>

                    {/* Brand Info */}
                    <div>
                        <h1 className="text-3xl font-bold text-text-primary mb-1">{brand.name}</h1>
                        {brand.description && (
                            <p className="text-text-secondary">{brand.description}</p>
                        )}
                        <p className="text-sm text-text-muted mt-2">
                            {products.length} 个商品
                        </p>
                    </div>
                </div>

                {/* Error State */}
                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
                        <p>加载商品失败: {error}</p>
                    </div>
                )}

                {/* Products Grid */}
                <div>
                    <h2 className="text-xl font-semibold text-text-primary mb-4">相关商品</h2>
                    <ProductGrid
                        products={products}
                        emptyMessage="该品牌暂无商品"
                    />
                </div>
            </div>
        </RootLayout>
    );
}
