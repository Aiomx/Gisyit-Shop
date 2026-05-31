import type { Route } from "./+types/ai._index";
import { RootLayout } from "~/components/layout";
import { ProductGrid } from "~/components/product";
import type { Product, ProductCategory } from "~/lib/supabase/types";

/**
 * AI Index Loader
 * Fetches AI products via Supabase MCP
 */
export async function loader({ request }: Route.LoaderArgs) {
    const { getProductsBySection, getCategories } = await import("~/lib/product/index.server");
    const { getMCPBridge } = await import("~/lib/supabase/mcp-client.server");
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
        // Check if MCP bridge is available
        const mcpBridge = getMCPBridge();

        if (mcpBridge) {
            // Use real MCP to fetch products
            const [productsResult, categoriesResult] = await Promise.all([
                getProductsBySection("ai"),
                getCategories("ai"),
            ]);

            const products = productsResult.data || [];
            const categories = categoriesResult.data || [];

            return {
                products,
                categories,
                user,
                cartItemCount,
                sections,
            };
        }

        // Fallback to empty data when MCP is not available
        return {
            products: [],
            categories: [],
            user,
            cartItemCount,
            sections,
        };
    } catch (error) {
        console.error("Failed to fetch AI products:", error);
        return {
            products: [],
            categories: [],
            user,
            cartItemCount,
            sections,
        };
    }
}

export function meta({ }: Route.MetaArgs) {
    return [
        { title: "人工智能 - Gisyit Shop" },
        { name: "description", content: "AI 工具与服务" },
    ];
}

/**
 * AI Index Page Component
 * Displays AI products
 */
export default function AIIndex({ loaderData }: Route.ComponentProps) {
    const { products, categories, user, cartItemCount, sections } = loaderData;

    return (
        <RootLayout cartItemCount={cartItemCount} user={user} sections={sections}>
            <div className="space-y-8">
                {/* Page Header */}
                <div>
                    <h1 className="text-3xl font-bold text-text-primary mb-2">人工智能</h1>
                    <p className="text-text-secondary">发现优质 AI 工具与服务</p>
                </div>

                {/* Category Quick Links */}
                {categories.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {categories.map((category: ProductCategory) => (
                            <a
                                key={category.id}
                                href={`/ai/${category.slug}`}
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
                    emptyMessage="暂无 AI 商品"
                />
            </div>
        </RootLayout>
    );
}
