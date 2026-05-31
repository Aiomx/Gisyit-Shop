import type { Route } from "./+types/apps._index";
import { RootLayout } from "~/components/layout";
import { ProductGrid, PlatformBadge } from "~/components/product";
import { Button } from "~/components/ui/button";
import type { Product, ProductCategory } from "~/lib/supabase/types";
import { useState } from "react";

/**
 * Apps Index Loader
 * Fetches application products via Supabase MCP
 * Requirements: 1.1, 4.5 - Uses GET method via MCP to fetch product data
 */
export async function loader({ request }: Route.LoaderArgs) {
    const { getProductsBySection, getCategories } = await import("~/lib/product/index.server");
    const { getMCPBridge } = await import("~/lib/supabase/mcp-client.server");
    const { getUserForHeader } = await import("~/lib/auth/index.server");
    const { getCart } = await import("~/lib/cart/cart-operations.server");
    const { getSections } = await import("~/lib/sections/index.server");

    // Get user info for header display (Requirements 4.5)
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

    const url = new URL(request.url);
    const platform = url.searchParams.get("platform");

    try {
        // Check if MCP bridge is available
        const mcpBridge = getMCPBridge();

        if (mcpBridge) {
            // Use real MCP to fetch products (Requirements 1.1)
            const [productsResult, categoriesResult] = await Promise.all([
                getProductsBySection("apps"),
                getCategories("apps"),
            ]);

            let products = productsResult.data || [];
            const categories = categoriesResult.data || [];

            // Apply platform filter if specified
            if (platform && products.length > 0) {
                products = products.filter(p => {
                    const specs = p.prices?.[0]?.spec_combination;
                    if (!specs?.platform) return platform === "cross-platform";
                    return specs.platform.toLowerCase().includes(platform.toLowerCase()) ||
                        (platform === "cross-platform" && specs.platform === "Cross-platform");
                });
            }

            return {
                products,
                categories,
                currentPlatform: platform,
                user,
                cartItemCount,
                sections,
            };
        }

        // Fallback to mock data when MCP is not available (development)
        const products = await fetchAppProductsMock(platform);
        const categories = await fetchAppCategoriesMock();

        return {
            products,
            categories,
            currentPlatform: platform,
            user,
            cartItemCount,
            sections,
        };
    } catch (error) {
        console.error("Failed to fetch app products:", error);
        return {
            products: [],
            categories: [],
            currentPlatform: platform,
            user,
            cartItemCount,
            sections,
        };
    }
}

/**
 * Fetch app products mock for development
 */
async function fetchAppProductsMock(platform: string | null): Promise<Product[]> {
    const mockProducts = getMockAppProducts();

    if (platform) {
        return mockProducts.filter(p => {
            const specs = p.prices?.[0]?.spec_combination;
            if (!specs?.platform) return platform === "cross-platform";
            return specs.platform.toLowerCase().includes(platform.toLowerCase()) ||
                (platform === "cross-platform" && specs.platform === "Cross-platform");
        });
    }

    return mockProducts;
}

/**
 * Fetch app categories mock for development
 */
async function fetchAppCategoriesMock(): Promise<ProductCategory[]> {
    const now = new Date().toISOString();
    return [
        { id: "cat-design", name: "设计工具", slug: "design", store_section: "apps", sort_order: 0, created_at: now },
        { id: "cat-utilities", name: "系统工具", slug: "utilities", store_section: "apps", sort_order: 1, created_at: now },
        { id: "cat-productivity", name: "效率办公", slug: "productivity", store_section: "apps", sort_order: 2, created_at: now },
        { id: "cat-development", name: "开发工具", slug: "development", store_section: "apps", sort_order: 3, created_at: now },
    ];
}

/**
 * Mock app products for development
 */
function getMockAppProducts(): Product[] {
    const now = new Date().toISOString();
    return [
        {
            id: "app-001",
            product_code: "Gis00000001",
            name: "Sketch Pro",
            subtitle: "专业级矢量设计工具",
            description: "Sketch Pro 是一款专为 Mac 设计的专业矢量图形编辑器。",
            product_type: "app",
            delivery_type: "download",
            category_id: "cat-design",
            is_active: true,
            has_discount: true,
            has_demo_video: true,
            inventory_count: 999,
            created_at: now,
            updated_at: now,
            images: [{
                id: "img-001", product_id: "app-001",
                image_url: "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=800&h=600&fit=crop",
                alt_text: "Sketch Pro", is_primary: true, sort_order: 0, created_at: now,
            }],
            prices: [{
                id: "price-001", product_id: "app-001",
                spec_combination: { platform: "Mac" },
                price_amount: 299.00, currency: "CNY", is_active: true, created_at: now,
            }],
        },
        {
            id: "app-002",
            product_code: "Gis00000002",
            name: "CleanMyMac X",
            subtitle: "Mac 系统优化清理工具",
            description: "一键清理系统垃圾，优化 Mac 性能。",
            product_type: "app",
            delivery_type: "license_key",
            category_id: "cat-utilities",
            is_active: true,
            has_discount: false,
            has_demo_video: false,
            inventory_count: 999,
            created_at: now,
            updated_at: now,
            images: [{
                id: "img-002", product_id: "app-002",
                image_url: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&h=600&fit=crop",
                alt_text: "CleanMyMac X", is_primary: true, sort_order: 0, created_at: now,
            }],
            prices: [{
                id: "price-002", product_id: "app-002",
                spec_combination: { platform: "Mac" },
                price_amount: 199.00, currency: "CNY", is_active: true, created_at: now,
            }],
        },
        {
            id: "app-003",
            product_code: "Gis00000009",
            name: "Visual Studio Code",
            subtitle: "跨平台代码编辑器",
            description: "微软出品的免费开源代码编辑器，支持多种编程语言。",
            product_type: "app",
            delivery_type: "download",
            category_id: "cat-development",
            is_active: true,
            has_discount: false,
            has_demo_video: false,
            inventory_count: 999,
            created_at: now,
            updated_at: now,
            images: [{
                id: "img-009", product_id: "app-003",
                image_url: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&h=600&fit=crop",
                alt_text: "VS Code", is_primary: true, sort_order: 0, created_at: now,
            }],
            prices: [{
                id: "price-009", product_id: "app-003",
                spec_combination: { platform: "Cross-platform" },
                price_amount: 0, currency: "CNY", is_active: true, created_at: now,
            }],
        },
        {
            id: "app-004",
            product_code: "Gis00000010",
            name: "Microsoft Office 365",
            subtitle: "办公套件订阅",
            description: "包含 Word、Excel、PowerPoint 等办公软件。",
            product_type: "app",
            delivery_type: "license_key",
            category_id: "cat-productivity",
            is_active: true,
            has_discount: true,
            has_demo_video: false,
            inventory_count: 999,
            created_at: now,
            updated_at: now,
            images: [{
                id: "img-010", product_id: "app-004",
                image_url: "https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=800&h=600&fit=crop",
                alt_text: "Office 365", is_primary: true, sort_order: 0, created_at: now,
            }],
            prices: [{
                id: "price-010", product_id: "app-004",
                spec_combination: { platform: "Windows" },
                price_amount: 398.00, currency: "CNY", is_active: true, created_at: now,
            }],
        },
    ];
}

export function meta({ }: Route.MetaArgs) {
    return [
        { title: "应用商店 - Gisyit Shop" },
        { name: "description", content: "Mac、Windows 应用软件" },
    ];
}

type Platform = "mac" | "windows" | "cross-platform" | null;

/**
 * Apps Index Page Component
 * Displays application products with platform filters
 * Requirements: 1.2, 4.5
 */
export default function AppsIndex({ loaderData }: Route.ComponentProps) {
    const { products, categories, currentPlatform, user, cartItemCount, sections } = loaderData;

    return (
        <RootLayout cartItemCount={cartItemCount} user={user} sections={sections}>
            <div className="space-y-8">
                {/* Page Header */}
                <div>
                    <h1 className="text-3xl font-bold text-text-primary mb-2">应用商店</h1>
                    <p className="text-text-secondary">发现优质 Mac、Windows 应用与开源项目</p>
                </div>

                {/* Platform Filters */}
                <div className="flex flex-wrap gap-2">
                    <PlatformFilterButton
                        platform={null}
                        currentPlatform={currentPlatform}
                        label="全部"
                    />
                    <PlatformFilterButton
                        platform="mac"
                        currentPlatform={currentPlatform}
                        label="Mac"
                    />
                    <PlatformFilterButton
                        platform="windows"
                        currentPlatform={currentPlatform}
                        label="Windows"
                    />
                    <PlatformFilterButton
                        platform="cross-platform"
                        currentPlatform={currentPlatform}
                        label="跨平台"
                    />
                </div>

                {/* Category Quick Links */}
                {categories.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {categories.map((category: ProductCategory) => (
                            <a
                                key={category.id}
                                href={`/apps/${category.slug}`}
                                className="px-4 py-2 rounded-full bg-bg-secondary text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-colors text-sm"
                            >
                                {category.name}
                            </a>
                        ))}
                    </div>
                )}

                {/* Products Grid */}
                <ProductGrid
                    products={products}
                    emptyMessage="暂无应用商品"
                />
            </div>
        </RootLayout>
    );
}

function PlatformFilterButton({
    platform,
    currentPlatform,
    label,
}: {
    platform: string | null;
    currentPlatform: string | null;
    label: string;
}) {
    const isActive = platform === currentPlatform;
    const href = platform ? `?platform=${platform}` : "/apps";

    return (
        <a
            href={href}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isActive
                ? "bg-accent text-white"
                : "bg-bg-secondary text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
                }`}
        >
            {label}
        </a>
    );
}
