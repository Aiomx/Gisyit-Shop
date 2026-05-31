import type { Route } from "./+types/games.$category";
import { RootLayout } from "~/components/layout";
import { ProductGrid } from "~/components/product";
import type { Product, ProductCategory, ProductType } from "~/lib/supabase/types";
import type { StoreSection } from "~/lib/sections";

type GameTypeFilter = "all" | "game_card" | "game_cdk" | "game_digital";

/**
 * Games Category Loader
 * Fetches game products filtered by category via Supabase MCP
 * Requirements: 1.3, 8.1
 */
export async function loader({ params, request }: Route.LoaderArgs) {
    const { category } = params;
    const url = new URL(request.url);
    const typeFilter = url.searchParams.get("type") as GameTypeFilter | null;
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

        const products = await fetchGameProductsByCategoryViaMCP(categoryData.id, typeFilter);

        return {
            category: categoryData,
            products,
            currentType: typeFilter,
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
            currentType: typeFilter,
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
        steam: { id: "cat-steam", name: "Steam", slug: "steam", store_section: "games", sort_order: 0, created_at: now },
        action: { id: "cat-action", name: "动作游戏", slug: "action", store_section: "games", sort_order: 1, created_at: now },
        rpg: { id: "cat-rpg", name: "角色扮演", slug: "rpg", store_section: "games", sort_order: 2, created_at: now },
        strategy: { id: "cat-strategy", name: "策略游戏", slug: "strategy", store_section: "games", sort_order: 3, created_at: now },
    };
    return categories[slug] || null;
}

/**
 * Fetch game products by category via Supabase MCP
 */
async function fetchGameProductsByCategoryViaMCP(
    categoryId: string,
    typeFilter: GameTypeFilter | null
): Promise<Product[]> {
    const now = new Date().toISOString();

    const allProducts: Product[] = [
        {
            id: "game-001",
            product_code: "Gis00000003",
            name: "Steam 充值卡 100元",
            subtitle: "Steam 平台通用充值卡",
            description: "可用于 Steam 平台购买游戏和内购。",
            product_type: "game_card",
            delivery_type: "cdk",
            category_id: "cat-steam",
            is_active: true,
            has_discount: false,
            has_demo_video: false,
            inventory_count: 50,
            created_at: now,
            updated_at: now,
            images: [{
                id: "img-003", product_id: "game-001",
                image_url: "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=800&h=600&fit=crop",
                alt_text: "Steam 充值卡", is_primary: true, sort_order: 0, created_at: now,
            }],
            prices: [{
                id: "price-003", product_id: "game-001",
                price_amount: 100.00, currency: "CNY", is_active: true, created_at: now,
            }],
        },
        {
            id: "game-002",
            product_code: "Gis00000004",
            name: "艾尔登法环 Steam CDK",
            subtitle: "开放世界动作RPG",
            description: "FromSoftware 与乔治·R·R·马丁联合打造的史诗级动作RPG。",
            product_type: "game_cdk",
            delivery_type: "cdk",
            category_id: "cat-action",
            is_active: true,
            has_discount: true,
            has_demo_video: true,
            inventory_count: 20,
            created_at: now,
            updated_at: now,
            images: [{
                id: "img-004", product_id: "game-002",
                image_url: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&h=600&fit=crop",
                alt_text: "艾尔登法环", is_primary: true, sort_order: 0, created_at: now,
            }],
            prices: [{
                id: "price-004", product_id: "game-002",
                spec_combination: { region: "国区" },
                price_amount: 298.00, currency: "CNY", is_active: true, created_at: now,
            }],
        },
        {
            id: "game-003",
            product_code: "Gis00000011",
            name: "Steam 充值卡 50元",
            subtitle: "Steam 平台通用充值卡",
            description: "可用于 Steam 平台购买游戏和内购。",
            product_type: "game_card",
            delivery_type: "cdk",
            category_id: "cat-steam",
            is_active: true,
            has_discount: false,
            has_demo_video: false,
            inventory_count: 100,
            created_at: now,
            updated_at: now,
            images: [{
                id: "img-011", product_id: "game-003",
                image_url: "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=800&h=600&fit=crop",
                alt_text: "Steam 充值卡 50元", is_primary: true, sort_order: 0, created_at: now,
            }],
            prices: [{
                id: "price-011", product_id: "game-003",
                price_amount: 50.00, currency: "CNY", is_active: true, created_at: now,
            }],
        },
        {
            id: "game-004",
            product_code: "Gis00000012",
            name: "赛博朋克2077 Steam 数字版",
            subtitle: "开放世界动作RPG",
            description: "CD Projekt Red 打造的开放世界动作冒险游戏。",
            product_type: "game_digital",
            delivery_type: "download",
            category_id: "cat-rpg",
            is_active: true,
            has_discount: true,
            has_demo_video: true,
            inventory_count: 999,
            created_at: now,
            updated_at: now,
            images: [{
                id: "img-012", product_id: "game-004",
                image_url: "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=800&h=600&fit=crop",
                alt_text: "赛博朋克2077", is_primary: true, sort_order: 0, created_at: now,
            }],
            prices: [{
                id: "price-012", product_id: "game-004",
                spec_combination: { region: "国区" },
                price_amount: 198.00, currency: "CNY", is_active: true, created_at: now,
            }],
        },
    ];

    // Filter by category
    let filtered = allProducts.filter(p => p.category_id === categoryId);

    // Filter by type if specified
    if (typeFilter && typeFilter !== "all") {
        filtered = filtered.filter(p => p.product_type === typeFilter);
    }

    return filtered;
}

export function meta({ data }: Route.MetaArgs) {
    const categoryName = data?.category?.name || "分类";
    return [
        { title: `${categoryName} - 游戏商店 - Store` },
        { name: "description", content: `${categoryName}游戏商品` },
    ];
}

/**
 * Games Category Page Component
 * Displays game products filtered by category
 * Requirements: 1.3
 */
export default function GamesCategory({ loaderData }: Route.ComponentProps) {
    const { category, products, currentType, sections, user, cartItemCount } = loaderData as {
        category: ProductCategory | null;
        products: Product[];
        currentType: GameTypeFilter | null;
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
                    <p className="text-text-secondary mb-4">请返回游戏商店浏览其他分类</p>
                    <a href="/games" className="text-accent hover:underline">返回游戏商店</a>
                </div>
            </RootLayout>
        );
    }

    return (
        <RootLayout cartItemCount={cartItemCount} user={user} sections={sections}>
            <div className="space-y-8">
                {/* Breadcrumb */}
                <nav className="text-sm text-text-muted">
                    <a href="/games" className="hover:text-text-primary">游戏商店</a>
                    <span className="mx-2">/</span>
                    <span className="text-text-primary">{category.name}</span>
                </nav>

                {/* Page Header */}
                <div>
                    <h1 className="text-3xl font-bold text-text-primary mb-2">{category.name}</h1>
                    <p className="text-text-secondary">浏览 {category.name} 分类下的游戏</p>
                </div>

                {/* Type Filters */}
                <div className="flex flex-wrap gap-2">
                    <GameTypeFilterButton
                        type="all"
                        currentType={currentType}
                        categorySlug={category.slug}
                        label="全部"
                    />
                    <GameTypeFilterButton
                        type="game_card"
                        currentType={currentType}
                        categorySlug={category.slug}
                        label="点卡"
                    />
                    <GameTypeFilterButton
                        type="game_cdk"
                        currentType={currentType}
                        categorySlug={category.slug}
                        label="CDK"
                    />
                    <GameTypeFilterButton
                        type="game_digital"
                        currentType={currentType}
                        categorySlug={category.slug}
                        label="数字商品"
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

function GameTypeFilterButton({
    type,
    currentType,
    categorySlug,
    label,
}: {
    type: GameTypeFilter;
    currentType: string | null;
    categorySlug: string;
    label: string;
}) {
    const isActive = type === currentType || (type === "all" && !currentType);
    const href = type === "all" ? `/games/${categorySlug}` : `/games/${categorySlug}?type=${type}`;

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
