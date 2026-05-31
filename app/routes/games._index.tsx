import type { Route } from "./+types/games._index";
import { RootLayout } from "~/components/layout";
import { ProductGrid } from "~/components/product";
import type { Product, ProductCategory, ProductType } from "~/lib/supabase/types";

// Game product types
const GAME_TYPES: ProductType[] = ["game_card", "game_cdk", "game_digital"];

type GameTypeFilter = "all" | "game_card" | "game_cdk" | "game_digital";

/**
 * Games Index Loader
 * Fetches game products via Supabase MCP
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
    const typeFilter = url.searchParams.get("type") as GameTypeFilter | null;

    try {
        // Check if MCP bridge is available
        const mcpBridge = getMCPBridge();

        if (mcpBridge) {
            // Use real MCP to fetch products (Requirements 1.1)
            const [productsResult, categoriesResult] = await Promise.all([
                getProductsBySection("games"),
                getCategories("games"),
            ]);

            let products = productsResult.data || [];
            const categories = categoriesResult.data || [];

            // Apply type filter if specified
            if (typeFilter && typeFilter !== "all") {
                products = products.filter(p => p.product_type === typeFilter);
            }

            return {
                products,
                categories,
                currentType: typeFilter,
                user,
                cartItemCount,
                sections,
            };
        }

        // Fallback to mock data when MCP is not available (development)
        const products = await fetchGameProductsMock(typeFilter);
        const categories = await fetchGameCategoriesMock();

        return {
            products,
            categories,
            currentType: typeFilter,
            user,
            cartItemCount,
            sections,
        };
    } catch (error) {
        console.error("Failed to fetch game products:", error);
        return {
            products: [],
            categories: [],
            currentType: typeFilter,
            user,
            cartItemCount,
            sections,
        };
    }
}

/**
 * Fetch game products mock for development
 */
async function fetchGameProductsMock(typeFilter: GameTypeFilter | null): Promise<Product[]> {
    const mockProducts = getMockGameProducts();

    if (typeFilter && typeFilter !== "all") {
        return mockProducts.filter(p => p.product_type === typeFilter);
    }

    return mockProducts;
}

/**
 * Fetch game categories mock for development
 */
async function fetchGameCategoriesMock(): Promise<ProductCategory[]> {
    const now = new Date().toISOString();
    return [
        { id: "cat-steam", name: "Steam", slug: "steam", store_section: "games", sort_order: 0, created_at: now },
        { id: "cat-action", name: "动作游戏", slug: "action", store_section: "games", sort_order: 1, created_at: now },
        { id: "cat-rpg", name: "角色扮演", slug: "rpg", store_section: "games", sort_order: 2, created_at: now },
        { id: "cat-strategy", name: "策略游戏", slug: "strategy", store_section: "games", sort_order: 3, created_at: now },
    ];
}

/**
 * Mock game products for development
 */
function getMockGameProducts(): Product[] {
    const now = new Date().toISOString();
    return [
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
            description: "可用于 Steam 平台购买游戏和内购",
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
            subtitle: "开放世界 RPG",
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
}

export function meta({ }: Route.MetaArgs) {
    return [
        { title: "游戏商店 - Gisyit Shop" },
        { name: "description", content: "游戏点卡、CDK、数字版游戏" },
    ];
}

/**
 * Get display name for game type
 */
function getGameTypeLabel(type: GameTypeFilter): string {
    const labels: Record<GameTypeFilter, string> = {
        all: "全部",
        game_card: "点卡",
        game_cdk: "CDK",
        game_digital: "数字版",
    };
    return labels[type];
}

/**
 * Games Index Page Component
 * Displays game products categorized by type
 * Requirements: 1.3, 4.5
 */
export default function GamesIndex({ loaderData }: Route.ComponentProps) {
    const { products, categories, currentType, user, cartItemCount, sections } = loaderData;

    return (
        <RootLayout cartItemCount={cartItemCount} user={user} sections={sections}>
            <div className="space-y-8">
                {/* Page Header */}
                <div>
                    <h1 className="text-3xl font-bold text-text-primary mb-2">游戏商店</h1>
                    <p className="text-text-secondary">游戏点卡、CDK 激活码、数字版游戏</p>
                </div>

                {/* Type Filters */}
                <div className="flex flex-wrap gap-2">
                    <GameTypeFilterButton
                        type="all"
                        currentType={currentType}
                        label="全部"
                    />
                    <GameTypeFilterButton
                        type="game_card"
                        currentType={currentType}
                        label="点卡"
                    />
                    <GameTypeFilterButton
                        type="game_cdk"
                        currentType={currentType}
                        label="CDK"
                    />
                    <GameTypeFilterButton
                        type="game_digital"
                        currentType={currentType}
                        label="数字版"
                    />
                </div>

                {/* Category Quick Links */}
                {categories.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {categories.map((category: ProductCategory) => (
                            <a
                                key={category.id}
                                href={`/games/${category.slug}`}
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
                    emptyMessage="暂无游戏商品"
                />
            </div>
        </RootLayout>
    );
}

function GameTypeFilterButton({
    type,
    currentType,
    label,
}: {
    type: GameTypeFilter;
    currentType: string | null;
    label: string;
}) {
    const isActive = type === currentType || (type === "all" && !currentType);
    const href = type === "all" ? "/games" : `?type=${type}`;

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
