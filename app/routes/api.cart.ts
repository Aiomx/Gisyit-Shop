/**
 * Cart API Route
 * 
 * Handles cart operations via Remix actions.
 * All operations are server-side only.
 * 
 * Requirements: 3.1, 3.4, 3.6, 8.2
 */

import {
    addToCart,
    updateCartItemQuantity,
    removeCartItem,
    getCart,
} from "~/lib/cart/cart-operations.server";
import type { AddToCartRequest } from "~/lib/cart/types";

type LoaderArgs = { request: Request };
type ActionArgs = { request: Request };

/**
 * Cart Loader - Get current cart state
 * Requirements: 3.5
 */
export async function loader({ request }: LoaderArgs) {
    const result = await getCart(request);

    if (!result.success) {
        return Response.json(
            { error: result.error },
            { status: 500 }
        );
    }

    const headers = new Headers();
    if (result.data?.setCookie) {
        headers.set("Set-Cookie", result.data.setCookie);
    }

    return Response.json(
        {
            cart: result.data?.cart,
            itemCount: result.data?.cart?.items.length ?? 0,
        },
        { headers }
    );
}

/**
 * Cart Action - Handle cart modifications
 * Requirements: 3.1, 3.4, 3.6, 8.2
 */
export async function action({ request }: ActionArgs) {
    const formData = await request.formData();
    const intent = formData.get("intent") as string;

    switch (intent) {
        case "add": {
            return handleAddToCart(request, formData);
        }
        case "update": {
            return handleUpdateQuantity(request, formData);
        }
        case "remove": {
            return handleRemoveItem(request, formData);
        }
        default: {
            return Response.json(
                { error: { code: "INVALID_INTENT", message: "Invalid action intent" } },
                { status: 400 }
            );
        }
    }
}

/**
 * Handle add to cart action
 * Requirements: 3.1, 3.4, 3.6
 */
async function handleAddToCart(request: Request, formData: FormData) {
    const productId = formData.get("productId") as string;
    const priceId = formData.get("priceId") as string;
    const specCombinationStr = formData.get("specCombination") as string | null;
    const quantity = parseInt(formData.get("quantity") as string, 10) || 1;
    const snapshotPrice = parseFloat(formData.get("snapshotPrice") as string);
    const snapshotCurrency = (formData.get("snapshotCurrency") as string) || "CNY";

    // Validate required fields
    if (!productId || !priceId || isNaN(snapshotPrice)) {
        return Response.json(
            {
                error: {
                    code: "INVALID_REQUEST",
                    message: "Missing required fields: productId, priceId, snapshotPrice",
                },
            },
            { status: 400 }
        );
    }

    // Parse spec combination if provided
    let specCombination: Record<string, string> | undefined;
    if (specCombinationStr) {
        try {
            specCombination = JSON.parse(specCombinationStr);
        } catch {
            return Response.json(
                {
                    error: {
                        code: "INVALID_REQUEST",
                        message: "Invalid specCombination format",
                    },
                },
                { status: 400 }
            );
        }
    }

    const addRequest: AddToCartRequest = {
        productId,
        priceId,
        specCombination,
        quantity,
        snapshotPrice,
        snapshotCurrency,
    };

    const result = await addToCart(request, addRequest);

    if (!result.success) {
        return Response.json(
            { error: result.error },
            { status: 400 }
        );
    }

    const headers = new Headers();
    if (result.data?.setCookie) {
        headers.set("Set-Cookie", result.data.setCookie);
    }

    return Response.json(
        {
            success: true,
            cart: result.data?.cart,
            itemCount: result.data?.cart?.items.length ?? 0,
        },
        { headers }
    );
}

/**
 * Handle update quantity action
 */
async function handleUpdateQuantity(request: Request, formData: FormData) {
    const cartItemId = formData.get("cartItemId") as string;
    const quantity = parseInt(formData.get("quantity") as string, 10);

    if (!cartItemId || isNaN(quantity)) {
        return Response.json(
            {
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
            { error: result.error },
            { status: 400 }
        );
    }

    return Response.json({
        success: true,
        cart: result.data,
        itemCount: result.data?.items.length ?? 0,
    });
}

/**
 * Handle remove item action
 */
async function handleRemoveItem(request: Request, formData: FormData) {
    const cartItemId = formData.get("cartItemId") as string;

    if (!cartItemId) {
        return Response.json(
            {
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
            { error: result.error },
            { status: 400 }
        );
    }

    return Response.json({
        success: true,
        cart: result.data,
        itemCount: result.data?.items.length ?? 0,
    });
}
