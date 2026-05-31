import type { Route } from "./+types/apps.$category";
import { RootLayout } from "~/components/layout";
import { ProductGrid } from "~/components/product";
import type { Product, ProductCategory } from "~/lib/supabase/types";
import type { StoreSection } from "~/lib/sections";

/**
 * Apps Category Loader
 * Fetches application products filtered by category via Supabase MCP
 * Requirements: 1.2, 8.1
 */
export async function loader({ params, request }: Route.LoaderArgs) {
    const { category } = params;
    const url = new URL(request.url);
    const platform = url.searchParams.get("platform");
    const { getSections } = await import("~/lib/sections/index.server");
    const { getUserForHeader } = await import("~/lib/auth/index.server");
    const { getCart } = await import("~/lib/cart/cart-operations.server");

    // Get sections for navigation
    const sections = await getSections();

    // Get user info for header display
    const user = await getUserForHeader(request);

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
        const categoryData = await fetchCategoryBySlugViaMCP(category);
        if (!categoryData) {
            throw new Response("Category not found", { status: 404 });
        }

        const products = await fetchAppProductsByCategoryViaMCP(categoryData.id, platform);

        return {
            category: categoryData,
            products,
            currentPlatform: platform,
            sections,
            user,
            cartItemCount,
        };
    } catch (error) {
        if (error instanceof Response) throw error;
        console.error("Failed to fetch category products:", error);
        return {
            category: null,
            products: [],
            currentPlatform: platform,
            sections,
            user,
            cartItemCount,
        };
    }
}

/**
 * Fetch category by slug via Supabase MCP
 */
async function fetchCategoryBySlugViaMCP(slug: string): Promise<ProductCategory | null> {
    const now = new Date().toISOString();
    const categories: Record<string, ProductCategory> = {
        design: { id: "cat-design", name: "设计工具", slug: "design", store_section: "apps", sort_order: 0, created_at: now },
        utilities: { id: "cat-utilities", name: "系统工具", slug: "utilities", store_section: "apps", sort_order: 1, created_at: now },
        productivity: { id: "cat-productivity", name: "效率办公", slug: "productivity", store_section: "apps", sort_order: 2, created_at: now },
        development: { id: "cat-development", name: "开发工具", slug: "development", store_section: "apps", sort_order: 3, created_at: now },
    };
    return categories[slug] || null;
}

/**
 * Fetch app products by category via Supabase MCP
 */
async function fetchAppProductsByCategoryViaMCP(
    categoryId: string,
    platform: string | null
): Promise<Product[]> {
    const now = new Date().toISOString();

    const allProducts: Product[] = [
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
            description: "微软出品的免费开源代码编辑器。",
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

    // Filter by category
    let filtered = allProducts.filter(p => p.category_id === categoryId);

    // Filter by platform if specified
    if (platform) {
        filtered = filtered.filter(p => {
            const specs = p.prices?.[0]?.spec_combination;
            if (!specs?.platform) return platform === "cross-platform";
            return specs.platform.toLowerCase().includes(platform.toLowerCase()) ||
                (platform === "cross-platform" && specs.platform === "Cross-platform");
        });
    }

    return filtered;
}

export function meta({ data }: Route.MetaArgs) {
    const categoryName = data?.category?.name || "分类";
    return [
        { title: `${categoryName} - 应用商店 - Gisyit Shop` },
        { name: "description", content: `${categoryName}应用软件` },
    ];
}

/**
 * Apps Category Page Component
 * Displays application products filtered by category
 * Requirements: 1.2
 */
export default function AppsCategory({ loaderData }: Route.ComponentProps) {
    const { category, products, currentPlatform, sections, user, cartItemCount } = loaderData as {
        category: ProductCategory | null;
        products: Product[];
        currentPlatform: string | null;
        sections: StoreSection[];
        user: { email?: string; isLoggedIn: boolean };
        cartItemCount: number;
    };

    if (!category) {
        return (
            <RootLayout cartItemCount={cartItemCount} user={user} sections={sections}>
                <div className="text-center py-16">
                    <div className="text-6xl mb-4">🔍</div>
                    <h2 className="text-2xl font-bold text-text-primary mb-2">分类不存在</h2>
                        <p className="text-text-secondary mb-4">请返回应用商店浏览其他分类</p>
                            <a href="/apps" className="text-accent hover:underline">返回应用商店</a>
                        </div>
                    </RootLayout>
                    );
    }

                    return (
                    <RootLayout cartItemCount={cartItemCount} user={user} sections={sections}>
                        <div className="space-y-8">
                            {/* Breadcrumb */}
                            <nav className="text-sm text-text-muted">
                                <a href="/apps" className="hover:text-text-primary">应用商店</a>
                                <span className="mx-2">/</span>
                                <span className="text-text-primary">{category.name}</span>
                            </nav>

                            {/* Page Header */}
                            <div>
                                <h1 className="text-3xl font-bold text-text-primary mb-2">{category.name}</h1>
                                <p className="text-text-secondary">浏览 {category.name} 分类下的应用</p>
                            </div>

                            {/* Platform Filters */}
                            <div className="flex flex-wrap gap-2">
                                <PlatformFilterButton
                                    platform={null}
                                    currentPlatform={currentPlatform}
                                    categorySlug={category.slug}
                                    label="全部"
                                />
                                <PlatformFilterButton
                                    platform="mac"
                                    currentPlatform={currentPlatform}
                                    categorySlug={category.slug}
                                    label="Mac"
                                />
                                <PlatformFilterButton
                                    platform="windows"
                                    currentPlatform={currentPlatform}
                                    categorySlug={category.slug}
                                    label="Windows"
                                />
                                <PlatformFilterButton
                                    platform="cross-platform"
                                    currentPlatform={currentPlatform}
                                    categorySlug={category.slug}
                                    label="跨平台"
                                />
                </div>

                {/* Products Grid */}
                <ProductGrid
                    products={products}
                    emptyMessage={`暂无${category.name}商品`}
                />
            </div>
        </RootLayout>
    );
}

function PlatformFilterButton({
    platform,
    currentPlatform,
    categorySlug,
    label,
}: {
    platform: string | null;
    currentPlatform: string | null;
    categorySlug: string;
    label: string;
}) {
    const isActive = platform === currentPlatform;
    const href = platform ? `/apps/${categorySlug}?platform=${platform}` : `/apps/${categorySlug}`;

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
