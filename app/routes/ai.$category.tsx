import type { Route } from "./+types/ai.$category";
import { RootLayout } from "~/components/layout";
import { ProductGrid } from "~/components/product";
import type { Product, ProductCategory } from "~/lib/supabase/types";

/**
 * AI Category Loader
 * Fetches AI products filtered by category via Supabase MCP
 */
export async function loader({ params, request }: Route.LoaderArgs) {
    const { category } = params;
    const { getSections } = await import("~/lib/sections/index.server");
    const { getUserForHeader } = await import("~/lib/auth/index.server");
    const { getCart } = await import("~/lib/cart/cart-operations.server");
    const { getProductsByCategory, getCategoryBySlug } = await import("~/lib/product/index.server");

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
        const categoryResult = await getCategoryBySlug(category);
        if (!categoryResult.data) {
            throw new Response("Category not found", { status: 404 });
        }

        const productsResult = await getProductsByCategory(categoryResult.data.id);

        return {
            category: categoryResult.data,
            products: productsResult.data || [],
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
            sections,
            user,
            cartItemCount,
        };
    }
}

export function meta({ data }: Route.MetaArgs) {
    const categoryName = data?.category?.name || "分类";
    return [
        { title: `${categoryName} - 人工智能 - Store` },
        { name: "description", content: `${categoryName} AI 工具与服务` },
    ];
}

/**
 * AI Category Page Component
 * Displays AI products filtered by category
 */
export default function AICategory({ loaderData }: Route.ComponentProps) {
    const { category, products, sections, user, cartItemCount } = loaderData;

    if (!category) {
        return (
            <RootLayout cartItemCount={cartItemCount} user={user} sections={sections}>
                <div className="text-center py-16">
                    <div className="text-6xl mb-4">🔍</div>
                    <h2 className="text-2xl font-bold text-text-primary mb-2">分类不存在</h2>
                    <p className="text-text-secondary mb-4">请返回人工智能板块浏览其他分类</p>
                    <a href="/ai" className="text-accent hover:underline">返回人工智能</a>
                </div>
            </RootLayout>
        );
    }

    return (
        <RootLayout cartItemCount={cartItemCount} user={user} sections={sections}>
            <div className="space-y-8">
                {/* Breadcrumb */}
                <nav className="text-sm text-text-muted">
                    <a href="/ai" className="hover:text-text-primary">人工智能</a>
                    <span className="mx-2">/</span>
                    <span className="text-text-primary">{category.name}</span>
                </nav>

                {/* Page Header */}
                <div>
                    <h1 className="text-3xl font-bold text-text-primary mb-2">{category.name}</h1>
                    <p className="text-text-secondary">浏览 {category.name} 分类下的 AI 产品</p>
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
