/**
 * Cart Operations (Server-side only)
 * 
 * Provides cart CRUD operations via Supabase MCP.
 * All price calculations happen server-side.
 * 
 * Requirements: 1.2, 1.3, 1.4 - Uses POST, PATCH, DELETE methods via MCP
 */

import type { Cart, CartItem, Product, ProductPrice } from "~/lib/supabase/types";
import type {
    AddToCartRequest,
    CartOperationResult,
    CartWithProducts,
    SessionCartData,
} from "./types";
import { CartErrorCodes, CartErrorMessages } from "./types";
import {
    getCartIdentifier,
    updateCartSessionCartId,
    createCartSessionCookie,
} from "./session.server";
import { supabaseMCP, getMCPBridge, handleMCPError } from "~/lib/supabase/mcp-client.server";

/**
 * Helper function to create user-friendly cart error
 * Requirements 1.2: Improved error messages
 */
function createCartError(
    code: keyof typeof CartErrorCodes,
    customMessage?: string
): { code: string; message: string } {
    return {
        code: CartErrorCodes[code],
        message: customMessage || CartErrorMessages[CartErrorCodes[code]],
    };
}

/**
 * Helper function to handle and log cart operation errors
 * Requirements 1.2: Better error capture and user feedback
 */
function handleCartOperationError(
    error: unknown,
    operation: string,
    defaultCode: keyof typeof CartErrorCodes = "DATABASE_ERROR"
): { code: string; message: string } {
    console.error(`[Cart] ${operation} failed:`, error);

    // Check for network errors
    if (error instanceof TypeError && error.message.includes("fetch")) {
        return createCartError("NETWORK_ERROR");
    }

    // Check for MCP errors with status
    if (error instanceof Error && "status" in error) {
        const enhancedError = error as Error & { status: number };
        if (enhancedError.status === 404) {
            return createCartError("CART_NOT_FOUND");
        }
        if (enhancedError.status === 422) {
            return createCartError("VALIDATION_ERROR");
        }
    }

    // Use MCP error handler for detailed error info
    if (error instanceof Error) {
        const mcpError = handleMCPError(error, "SERVER_ERROR");
        return {
            code: CartErrorCodes[defaultCode],
            message: mcpError.message || CartErrorMessages[CartErrorCodes[defaultCode]],
        };
    }

    return createCartError(defaultCode);
}

// ============================================
// Mock Data Store (Development Only)
// In production, all operations go through Supabase MCP
// ============================================

// In-memory cart storage for development
const mockCarts = new Map<string, Cart>();
const mockCartItems = new Map<string, CartItem[]>();

/**
 * Get cart by user ID or session ID
 * Requirements: 1.1 - Uses GET method via MCP
 */
export async function getCart(
    request: Request
): Promise<CartOperationResult<{ cart: CartWithProducts | null; session: SessionCartData; setCookie?: string }>> {
    try {
        const { type, id, session, isNewSession } = await getCartIdentifier(request);

        // Fetch cart from Supabase MCP
        const cart = await fetchCartFromMCP(type, id);

        // Build response with cookie if new session
        const result: { cart: CartWithProducts | null; session: SessionCartData; setCookie?: string } = {
            cart,
            session,
        };

        if (isNewSession) {
            result.setCookie = createCartSessionCookie(session);
        }

        return { success: true, data: result };
    } catch (error) {
        const cartError = handleCartOperationError(error, "getCart");
        return {
            success: false,
            error: cartError,
        };
    }
}

/**
 * Add item to cart with price snapshot
 * Requirements: 1.2 - Uses POST method via MCP
 */
export async function addToCart(
    request: Request,
    item: AddToCartRequest
): Promise<CartOperationResult<{ cart: CartWithProducts; session: SessionCartData; setCookie?: string }>> {
    try {
        const { type, id, session, isNewSession } = await getCartIdentifier(request);

        // Validate inventory before adding
        const inventoryCheck = await checkInventory(item.productId, item.quantity);
        if (!inventoryCheck.available) {
            return {
                success: false,
                error: createCartError(
                    inventoryCheck.code || "INSUFFICIENT_INVENTORY",
                    inventoryCheck.message
                ),
            };
        }

        // Get or create cart
        let cart = await fetchCartFromMCP(type, id);
        let updatedSession = session;

        if (!cart) {
            // Create new cart (Requirements 1.2 - POST)
            const newCart = await createCartInMCP(type, id);
            updatedSession = updateCartSessionCartId(session, newCart.id);
            cart = {
                ...newCart,
                items: [],
            };
        }

        // Check for existing item with same product and price
        const existingItem = cart.items.find(
            (i) => i.product_id === item.productId && i.price_id === item.priceId
        );

        if (existingItem) {
            // Increment quantity instead of creating duplicate
            const newQuantity = existingItem.quantity + item.quantity;

            // Re-validate inventory for new total quantity
            const totalInventoryCheck = await checkInventory(item.productId, newQuantity);
            if (!totalInventoryCheck.available) {
                return {
                    success: false,
                    error: createCartError(
                        "INSUFFICIENT_INVENTORY",
                        totalInventoryCheck.message || "库存不足，无法添加更多数量"
                    ),
                };
            }

            // Update quantity (Requirements 1.3 - PATCH)
            await updateCartItemQuantityInMCP(existingItem.id, newQuantity);
        } else {
            // Add new item with price snapshot (Requirements 1.2 - POST)
            await addCartItemInMCP(cart.id, {
                product_id: item.productId,
                price_id: item.priceId,
                spec_combination: item.specCombination,
                quantity: item.quantity,
                snapshot_price: item.snapshotPrice,
                snapshot_currency: item.snapshotCurrency,
            });
        }

        // Fetch updated cart
        const updatedCart = await fetchCartFromMCP(type, id);

        if (!updatedCart) {
            return {
                success: false,
                error: createCartError("DATABASE_ERROR", "添加成功但无法获取更新后的购物车"),
            };
        }

        const result: { cart: CartWithProducts; session: SessionCartData; setCookie?: string } = {
            cart: updatedCart,
            session: updatedSession,
        };

        if (isNewSession || updatedSession !== session) {
            result.setCookie = createCartSessionCookie(updatedSession);
        }

        return { success: true, data: result };
    } catch (error) {
        const cartError = handleCartOperationError(error, "addToCart");
        return {
            success: false,
            error: cartError,
        };
    }
}

/**
 * Update cart item quantity
 * Requirements: 1.3 - Uses PATCH method via MCP
 */
export async function updateCartItemQuantity(
    request: Request,
    cartItemId: string,
    quantity: number
): Promise<CartOperationResult<CartWithProducts>> {
    try {
        if (quantity < 1) {
            return {
                success: false,
                error: createCartError("INVALID_QUANTITY", "购买数量必须大于0"),
            };
        }

        const { type, id } = await getCartIdentifier(request);

        // Get cart to find the item
        const cart = await fetchCartFromMCP(type, id);
        if (!cart) {
            return {
                success: false,
                error: createCartError("CART_NOT_FOUND"),
            };
        }

        const item = cart.items.find((i) => i.id === cartItemId);
        if (!item) {
            return {
                success: false,
                error: createCartError("CART_ITEM_NOT_FOUND"),
            };
        }

        // Validate inventory
        const inventoryCheck = await checkInventory(item.product_id, quantity);
        if (!inventoryCheck.available) {
            return {
                success: false,
                error: createCartError(
                    "INSUFFICIENT_INVENTORY",
                    inventoryCheck.message
                ),
            };
        }

        // Update quantity (Requirements 1.3 - PATCH)
        await updateCartItemQuantityInMCP(cartItemId, quantity);

        const updatedCart = await fetchCartFromMCP(type, id);
        if (!updatedCart) {
            return {
                success: false,
                error: createCartError("DATABASE_ERROR", "更新成功但无法获取购物车"),
            };
        }

        return { success: true, data: updatedCart };
    } catch (error) {
        const cartError = handleCartOperationError(error, "updateCartItemQuantity");
        return {
            success: false,
            error: cartError,
        };
    }
}

/**
 * Remove item from cart
 * Requirements: 1.4 - Uses DELETE method via MCP
 */
export async function removeCartItem(
    request: Request,
    cartItemId: string
): Promise<CartOperationResult<CartWithProducts>> {
    try {
        const { type, id } = await getCartIdentifier(request);

        const cart = await fetchCartFromMCP(type, id);
        if (!cart) {
            return {
                success: false,
                error: createCartError("CART_NOT_FOUND"),
            };
        }

        // Verify item exists before deletion
        const item = cart.items.find((i) => i.id === cartItemId);
        if (!item) {
            return {
                success: false,
                error: createCartError("CART_ITEM_NOT_FOUND"),
            };
        }

        // Delete cart item (Requirements 1.4 - DELETE)
        await removeCartItemFromMCP(cartItemId);

        const updatedCart = await fetchCartFromMCP(type, id);
        if (!updatedCart) {
            // Cart might be empty now, return empty cart
            return {
                success: true,
                data: {
                    ...cart,
                    items: [],
                },
            };
        }

        return { success: true, data: updatedCart };
    } catch (error) {
        const cartError = handleCartOperationError(error, "removeCartItem");
        return {
            success: false,
            error: cartError,
        };
    }
}

/**
 * Calculate cart total from items
 * Server-side only
 */
export function calculateCartTotal(items: CartItem[]): {
    subtotal: number;
    currency: string;
    itemCount: number;
} {
    if (items.length === 0) {
        return { subtotal: 0, currency: "CNY", itemCount: 0 };
    }

    const subtotal = items.reduce(
        (sum, item) => sum + item.snapshot_price * item.quantity,
        0
    );

    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

    // Use currency from first item (assuming all items use same currency)
    const currency = items[0]?.snapshot_currency || "CNY";

    return { subtotal, currency, itemCount };
}

// ============================================
// MCP Integration Functions
// Uses real MCP when available, falls back to mock for development
// ============================================

/**
 * Fetch cart from Supabase MCP
 * Requirements: 1.1 - Uses GET method via MCP
 */
async function fetchCartFromMCP(
    identifierType: "user" | "session",
    identifierId: string
): Promise<CartWithProducts | null> {
    const mcpBridge = getMCPBridge();

    if (mcpBridge) {
        // Use real MCP (Requirements 1.1 - GET)
        const filterKey = identifierType === "user" ? "user_id" : "session_id";
        const result = await supabaseMCP.select<Cart>("carts", {
            columns: "*,items:cart_items(*,product:products(id,name,product_type,delivery_type,is_active,inventory_count,images:product_images(image_url,is_primary)))",
            filter: {
                [filterKey]: identifierId,
                status: "active",
            },
            limit: 1,
        });

        if (result.error || !result.data || result.data.length === 0) {
            return null;
        }

        return result.data[0] as unknown as CartWithProducts;
    }

    // Development mock implementation
    const cartKey = `${identifierType}:${identifierId}`;
    const cart = mockCarts.get(cartKey);

    if (!cart) {
        return null;
    }

    const items = mockCartItems.get(cart.id) || [];
    const itemsWithProducts = items.map((item) => ({
        ...item,
        product: getMockProduct(item.product_id),
    }));

    return {
        ...cart,
        items: itemsWithProducts,
    } as CartWithProducts;
}

/**
 * Create cart in Supabase MCP
 * Requirements: 1.2 - Uses POST method via MCP
 */
async function createCartInMCP(
    identifierType: "user" | "session",
    identifierId: string
): Promise<Cart> {
    const mcpBridge = getMCPBridge();

    if (mcpBridge) {
        // Use real MCP (Requirements 1.2 - POST)
        const cartData: Partial<Cart> = {
            status: "active",
        };

        if (identifierType === "user") {
            cartData.user_id = identifierId;
        } else {
            cartData.session_id = identifierId;
        }

        const result = await supabaseMCP.insert<Cart>("carts", cartData);

        if (result.error || !result.data) {
            throw new Error(result.error?.message || "Failed to create cart");
        }

        return result.data;
    }

    // Development mock implementation
    const now = new Date().toISOString();
    const cart: Cart = {
        id: `cart-${Date.now()}`,
        user_id: identifierType === "user" ? identifierId : undefined,
        session_id: identifierType === "session" ? identifierId : undefined,
        status: "active",
        created_at: now,
        updated_at: now,
    };

    const cartKey = `${identifierType}:${identifierId}`;
    mockCarts.set(cartKey, cart);
    mockCartItems.set(cart.id, []);

    return cart;
}

/**
 * Add cart item in Supabase MCP
 * Requirements: 1.2 - Uses POST method via MCP
 */
async function addCartItemInMCP(
    cartId: string,
    item: Omit<CartItem, "id" | "cart_id" | "created_at" | "updated_at">
): Promise<CartItem> {
    const mcpBridge = getMCPBridge();

    if (mcpBridge) {
        // Use real MCP (Requirements 1.2 - POST)
        const cartItemData = {
            cart_id: cartId,
            ...item,
        };

        const result = await supabaseMCP.insert<CartItem>("cart_items", cartItemData);

        if (result.error || !result.data) {
            throw new Error(result.error?.message || "Failed to add cart item");
        }

        return result.data;
    }

    // Development mock implementation
    const now = new Date().toISOString();
    const cartItem: CartItem = {
        id: `item-${Date.now()}`,
        cart_id: cartId,
        ...item,
        created_at: now,
        updated_at: now,
    };

    const items = mockCartItems.get(cartId) || [];
    items.push(cartItem);
    mockCartItems.set(cartId, items);

    return cartItem;
}

/**
 * Update cart item quantity in Supabase MCP
 * Requirements: 1.3 - Uses PATCH method via MCP
 */
async function updateCartItemQuantityInMCP(
    cartItemId: string,
    quantity: number
): Promise<void> {
    const mcpBridge = getMCPBridge();

    if (mcpBridge) {
        // Use real MCP (Requirements 1.3 - PATCH)
        const result = await supabaseMCP.update<CartItem>("cart_items", cartItemId, {
            quantity,
            updated_at: new Date().toISOString(),
        });

        if (result.error) {
            throw new Error(result.error.message || "Failed to update cart item");
        }

        return;
    }

    // Development mock implementation
    for (const [cartId, items] of mockCartItems.entries()) {
        const itemIndex = items.findIndex((i) => i.id === cartItemId);
        if (itemIndex !== -1) {
            items[itemIndex] = {
                ...items[itemIndex],
                quantity,
                updated_at: new Date().toISOString(),
            };
            mockCartItems.set(cartId, items);
            break;
        }
    }
}

/**
 * Remove cart item from Supabase MCP
 * Requirements: 1.4 - Uses DELETE method via MCP
 */
async function removeCartItemFromMCP(cartItemId: string): Promise<void> {
    const mcpBridge = getMCPBridge();

    if (mcpBridge) {
        // Use real MCP (Requirements 1.4 - DELETE)
        const result = await supabaseMCP.delete("cart_items", cartItemId);

        if (result.error) {
            throw new Error(result.error.message || "Failed to remove cart item");
        }

        return;
    }

    // Development mock implementation
    for (const [cartId, items] of mockCartItems.entries()) {
        const filteredItems = items.filter((i) => i.id !== cartItemId);
        if (filteredItems.length !== items.length) {
            mockCartItems.set(cartId, filteredItems);
            break;
        }
    }
}

/**
 * Check product inventory
 * Requirements: 1.1 - Uses GET method via MCP
 */
async function checkInventory(
    productId: string,
    requestedQuantity: number
): Promise<{ available: boolean; message?: string; code?: keyof typeof CartErrorCodes }> {
    const mcpBridge = getMCPBridge();

    if (mcpBridge) {
        // Use real MCP (Requirements 1.1 - GET)
        const result = await supabaseMCP.select<Product>("products", {
            columns: "id,inventory_count,is_active",
            filter: { id: productId },
            limit: 1,
        });

        if (result.error || !result.data || result.data.length === 0) {
            return {
                available: false,
                message: "商品不存在或已下架",
                code: "PRODUCT_UNAVAILABLE",
            };
        }

        const product = result.data[0];

        if (!product.is_active) {
            return {
                available: false,
                message: "商品已下架，无法购买",
                code: "PRODUCT_UNAVAILABLE",
            };
        }

        if (product.inventory_count !== undefined && product.inventory_count !== null) {
            if (product.inventory_count < requestedQuantity) {
                return {
                    available: false,
                    message: `库存不足，当前仅剩 ${product.inventory_count} 件`,
                    code: "INSUFFICIENT_INVENTORY",
                };
            }
        }

        return { available: true };
    }

    // Development mock implementation
    const product = getMockProduct(productId);

    if (!product) {
        return {
            available: false,
            message: "商品不存在",
            code: "PRODUCT_UNAVAILABLE",
        };
    }

    if (!product.is_active) {
        return {
            available: false,
            message: "商品已下架，无法购买",
            code: "PRODUCT_UNAVAILABLE",
        };
    }

    if (product.inventory_count !== undefined && product.inventory_count !== null) {
        if (product.inventory_count < requestedQuantity) {
            return {
                available: false,
                message: `库存不足，当前仅剩 ${product.inventory_count} 件`,
                code: "INSUFFICIENT_INVENTORY",
            };
        }
    }

    return { available: true };
}


/**
 * Get mock product for development
 */
function getMockProduct(productId: string): Product | null {
    // This would be fetched from MCP in production
    const mockProducts: Record<string, Product> = {
        "app-001": {
            id: "app-001",
            product_code: "Gis00000001",
            name: "Sketch Pro",
            subtitle: "专业级矢量设计工具",
            product_type: "app",
            delivery_type: "download",
            category_id: "cat-design",
            is_active: true,
            has_discount: true,
            has_demo_video: true,
            inventory_count: 999,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            images: [
                {
                    id: "img-001-1",
                    product_id: "app-001",
                    image_url: "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=800&h=600&fit=crop",
                    alt_text: "Sketch Pro",
                    is_primary: true,
                    sort_order: 0,
                    created_at: new Date().toISOString(),
                },
            ],
        },
        "game-001": {
            id: "game-001",
            product_code: "Gis00000003",
            name: "Steam 充值卡",
            subtitle: "Steam 平台通用充值",
            product_type: "game_card",
            delivery_type: "cdk",
            category_id: "cat-steam",
            is_active: true,
            has_discount: false,
            has_demo_video: false,
            inventory_count: 50,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            images: [
                {
                    id: "img-003-1",
                    product_id: "game-001",
                    image_url: "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=800&h=600&fit=crop",
                    alt_text: "Steam 充值卡",
                    is_primary: true,
                    sort_order: 0,
                    created_at: new Date().toISOString(),
                },
            ],
        },
        "physical-001": {
            id: "physical-001",
            product_code: "Gis00000005",
            name: "Apple Magic Keyboard",
            subtitle: "无线蓝牙键盘",
            product_type: "physical",
            delivery_type: "shipment",
            category_id: "cat-accessories",
            is_active: true,
            has_discount: false,
            has_demo_video: false,
            inventory_count: 15,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            images: [
                {
                    id: "img-005-1",
                    product_id: "physical-001",
                    image_url: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&h=600&fit=crop",
                    alt_text: "Apple Magic Keyboard",
                    is_primary: true,
                    sort_order: 0,
                    created_at: new Date().toISOString(),
                },
            ],
        },
        "overseas-001": {
            id: "overseas-001",
            product_code: "Gis00000007",
            name: "日本限定 Nintendo Switch OLED",
            subtitle: "日版限定配色",
            product_type: "overseas",
            delivery_type: "manual",
            category_id: "cat-japan",
            is_active: true,
            has_discount: false,
            has_demo_video: false,
            inventory_count: 5,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            images: [
                {
                    id: "img-007-1",
                    product_id: "overseas-001",
                    image_url: "https://images.unsplash.com/photo-1578303512597-81e6cc155b3e?w=800&h=600&fit=crop",
                    alt_text: "Nintendo Switch OLED",
                    is_primary: true,
                    sort_order: 0,
                    created_at: new Date().toISOString(),
                },
            ],
        },
    };

    return mockProducts[productId] || null;
}
