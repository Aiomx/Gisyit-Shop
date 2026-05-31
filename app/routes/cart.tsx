/**
 * Cart Page Route
 *
 * Full cart page with items list and summary.
 * Handles quantity update and item removal actions.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 8.2
 */

import type { Route } from "./+types/cart";
import { useFetcher } from "react-router";
import { RootLayout } from "~/components/layout";
import { CartPage } from "~/components/cart";
import type { CartWithProducts } from "~/lib/cart/types";
import type { StoreSection } from "~/lib/sections";

/**
 * Cart Loader - Load cart items with product details
 * Requirements: 4.1, 4.5, 8.2
 */
export async function loader({ request }: Route.LoaderArgs) {
    const { getCart } = await import("~/lib/cart/cart-operations.server");
    const { getUserForHeader } = await import("~/lib/auth/index.server");
    const { getSections } = await import("~/lib/sections/index.server");

    // Get user info for header display (Requirements 4.5)
    const user = await getUserForHeader(request);

    // Get sections for navigation
    const sections = await getSections();

    const result = await getCart(request);

    if (!result.success) {
        console.error("Failed to load cart:", result.error);
        return {
            cart: null,
            itemCount: 0,
            error: result.error,
            user,
            sections,
        };
    }

    const headers = new Headers();
    if (result.data?.setCookie) {
        headers.set("Set-Cookie", result.data.setCookie);
    }

    const cart = result.data?.cart;
    const itemCount = cart?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;

    return Response.json(
        {
            cart,
            itemCount,
            error: null,
            user,
            sections,
        },
        { headers }
    );
}

/**
 * Cart Action - Handle quantity update and item removal
 * Requirements: 4.3, 4.4, 8.2
 */
export async function action({ request }: Route.ActionArgs) {
    const { updateCartItemQuantity, removeCartItem } = await import("~/lib/cart/cart-operations.server");

    const formData = await request.formData();
    const intent = formData.get("intent") as string;

    switch (intent) {
        case "update": {
            const cartItemId = formData.get("cartItemId") as string;
            const quantity = parseInt(formData.get("quantity") as string, 10);

            if (!cartItemId || isNaN(quantity)) {
                return Response.json(
                    {
                        success: false,
                        error: {
                            code: "INVALID_REQUEST",
                            message: "Missing required fields: cartItemId, quantity",
                        },
                    },
                    { status: 400 }
                );
            }

            const result = await updateCartItemQuantity(request, cartItemId, quantity);

            if (!result.success) {
                return Response.json(
                    { success: false, error: result.error },
                    { status: 400 }
                );
            }

            return Response.json({
                success: true,
                cart: result.data,
                itemCount: result.data?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0,
            });
        }

        case "remove": {
            const cartItemId = formData.get("cartItemId") as string;

            if (!cartItemId) {
                return Response.json(
                    {
                        success: false,
                        error: {
                            code: "INVALID_REQUEST",
                            message: "Missing required field: cartItemId",
                        },
                    },
                    { status: 400 }
                );
            }

            const result = await removeCartItem(request, cartItemId);

            if (!result.success) {
                return Response.json(
                    { success: false, error: result.error },
                    { status: 400 }
                );
            }

            return Response.json({
                success: true,
                cart: result.data,
                itemCount: result.data?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0,
            });
        }

        default: {
            return Response.json(
                {
                    success: false,
                    error: { code: "INVALID_INTENT", message: "Invalid action intent" },
                },
                { status: 400 }
            );
        }
    }
}

export function meta() {
    return [
        { title: "购物车 - Store" },
        { name: "description", content: "查看和管理您的购物车" },
    ];
}


/**
 * Cart Page Component
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */
export default function CartRoute({ loaderData }: Route.ComponentProps) {
    const { cart, itemCount, error, user, sections } = loaderData as {
        cart: CartWithProducts | null;
        itemCount: number;
        error: { code: string; message: string } | null;
        user: { email?: string; isLoggedIn: boolean };
        sections: StoreSection[];
    };
    const fetcher = useFetcher();

    // Get the latest cart data from fetcher or loader
    const currentCart = (fetcher.data?.cart as CartWithProducts) ?? cart;
    const currentItemCount = fetcher.data?.itemCount ?? itemCount;
    const items = currentCart?.items ?? [];

    // Handle quantity change
    const handleQuantityChange = (cartItemId: string, quantity: number) => {
        fetcher.submit(
            {
                intent: "update",
                cartItemId,
                quantity: String(quantity),
            },
            { method: "POST" }
        );
    };

    // Handle item removal
    const handleRemove = (cartItemId: string) => {
        fetcher.submit(
            {
                intent: "remove",
                cartItemId,
            },
            { method: "POST" }
        );
    };

    // Handle checkout navigation
    const handleCheckout = () => {
        window.location.href = "/checkout";
    };

    const isLoading = fetcher.state === "submitting";

    // Show error state
    if (error) {
        return (
            <RootLayout cartItemCount={currentItemCount} user={user} sections={sections}>
                <div className="max-w-4xl mx-auto">
                    <h1 className="text-2xl font-bold text-text-primary mb-6">购物车</h1>
                    <div className="p-4 bg-destructive/10 text-destructive rounded-lg">
                        加载购物车失败：{error.message}
                    </div>
                </div>
            </RootLayout>
        );
    }

    return (
        <RootLayout cartItemCount={currentItemCount} user={user} sections={sections}>
            <CartPage
                items={items}
                itemCount={currentItemCount}
                onQuantityChange={handleQuantityChange}
                onRemove={handleRemove}
                onCheckout={handleCheckout}
                isLoading={isLoading}
                error={fetcher.data?.error}
            />
        </RootLayout>
    );
}
