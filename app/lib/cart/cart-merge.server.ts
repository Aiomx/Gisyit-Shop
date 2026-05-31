/**
 * Cart Merge Operations (Server-side only)
 * 
 * Handles merging anonymous cart into user cart when user logs in.
 * 
 * Requirements: 6.1, 6.2, 6.3
 * - 6.1: Merge anonymous cart items into user's account cart
 * - 6.2: Combine quantities for duplicate products
 * - 6.3: Delete anonymous cart after merge
 */

import type { Cart, CartItem } from "~/lib/supabase/types";
import type { CartWithProducts, CartItemWithProduct, CartOperationResult } from "./types";
import { CartErrorCodes } from "./types";
import { supabaseMCP, getMCPBridge } from "~/lib/supabase/mcp-client.server";

/**
 * Result of cart merge operation
 */
export interface CartMergeResult {
    mergedCart: CartWithProducts;
    itemsMerged: number;
    duplicatesHandled: number;
    anonymousCartDeleted: boolean;
}

/**
 * Merge item representation for internal processing
 */
export interface MergeItem {
    product_id: string;
    price_id: string;
    spec_combination?: Record<string, string>;
    quantity: number;
    snapshot_price: number;
    snapshot_currency: string;
}

/**
 * Merge anonymous cart items into user cart
 * 
 * Requirements:
 * - 6.1: All items from anonymous cart should be in merged cart
 * - 6.2: Duplicate products should have combined quantities
 * - 6.3: Anonymous cart should be deleted after merge
 * 
 * @param anonymousCartId - The ID of the anonymous cart to merge from
 * @param userCartId - The ID of the user's cart to merge into
 * @returns CartMergeResult with merged cart and statistics
 */
export async function mergeAnonymousCart(
    anonymousCartId: string,
    userCartId: string
): Promise<CartOperationResult<CartMergeResult>> {
    try {
        // Fetch both carts with their items
        const [anonymousCart, userCart] = await Promise.all([
            fetchCartById(anonymousCartId),
            fetchCartById(userCartId),
        ]);

        if (!anonymousCart) {
            return {
                success: false,
                error: {
                    code: CartErrorCodes.CART_NOT_FOUND,
                    message: "Anonymous cart not found",
                },
            };
        }

        if (!userCart) {
            return {
                success: false,
                error: {
                    code: CartErrorCodes.CART_NOT_FOUND,
                    message: "User cart not found",
                },
            };
        }

        const anonymousItems = anonymousCart.items || [];
        const userItems = userCart.items || [];

        // Merge items using pure function
        const { mergedItems, itemsMerged, duplicatesHandled } = mergeCartItems(
            anonymousItems,
            userItems
        );

        // Apply merged items to user cart in database
        await applyMergedItemsToCart(userCartId, userItems, mergedItems);

        // Delete anonymous cart (Requirements 6.3)
        await deleteCart(anonymousCartId);

        // Fetch updated user cart
        const updatedCart = await fetchCartById(userCartId);

        if (!updatedCart) {
            return {
                success: false,
                error: {
                    code: CartErrorCodes.DATABASE_ERROR,
                    message: "Failed to retrieve merged cart",
                },
            };
        }

        return {
            success: true,
            data: {
                mergedCart: updatedCart,
                itemsMerged,
                duplicatesHandled,
                anonymousCartDeleted: true,
            },
        };
    } catch (error) {
        console.error("Failed to merge carts:", error);
        return {
            success: false,
            error: {
                code: CartErrorCodes.DATABASE_ERROR,
                message: "Failed to merge carts",
            },
        };
    }
}

/**
 * Pure function to merge cart items
 * 
 * Requirements:
 * - 6.1: All unique items from both carts should be in result
 * - 6.2: Duplicate products (same product_id + price_id) should have combined quantities
 * 
 * @param anonymousItems - Items from anonymous cart
 * @param userItems - Items from user cart
 * @returns Merged items with statistics
 */
export function mergeCartItems(
    anonymousItems: MergeItem[],
    userItems: MergeItem[]
): {
    mergedItems: MergeItem[];
    itemsMerged: number;
    duplicatesHandled: number;
} {
    // Create a map of user items keyed by product_id + price_id
    const itemMap = new Map<string, MergeItem>();
    let duplicatesHandled = 0;

    // Add user items to map first
    for (const item of userItems) {
        const key = createItemKey(item.product_id, item.price_id, item.spec_combination);
        itemMap.set(key, { ...item });
    }

    // Merge anonymous items
    for (const anonItem of anonymousItems) {
        const key = createItemKey(anonItem.product_id, anonItem.price_id, anonItem.spec_combination);
        const existingItem = itemMap.get(key);

        if (existingItem) {
            // Duplicate found - combine quantities (Requirements 6.2)
            existingItem.quantity += anonItem.quantity;
            duplicatesHandled++;
        } else {
            // New item - add to map (Requirements 6.1)
            itemMap.set(key, { ...anonItem });
        }
    }

    const mergedItems = Array.from(itemMap.values());
    const itemsMerged = anonymousItems.length;

    return {
        mergedItems,
        itemsMerged,
        duplicatesHandled,
    };
}

/**
 * Create a unique key for cart item based on product, price, and spec combination
 */
export function createItemKey(
    productId: string,
    priceId: string,
    specCombination?: Record<string, string>
): string {
    const specKey = specCombination
        ? JSON.stringify(Object.entries(specCombination).sort())
        : "";
    return `${productId}:${priceId}:${specKey}`;
}

/**
 * Apply merged items to user cart in database
 */
async function applyMergedItemsToCart(
    cartId: string,
    existingItems: CartItemWithProduct[],
    mergedItems: MergeItem[]
): Promise<void> {
    const mcpBridge = getMCPBridge();

    // Create a map of existing items for quick lookup
    const existingMap = new Map<string, CartItemWithProduct>();
    for (const item of existingItems) {
        const key = createItemKey(item.product_id, item.price_id, item.spec_combination);
        existingMap.set(key, item);
    }

    for (const mergedItem of mergedItems) {
        const key = createItemKey(
            mergedItem.product_id,
            mergedItem.price_id,
            mergedItem.spec_combination
        );
        const existingItem = existingMap.get(key);

        if (existingItem) {
            // Update quantity if changed
            if (existingItem.quantity !== mergedItem.quantity) {
                if (mcpBridge) {
                    await supabaseMCP.update<CartItem>("cart_items", existingItem.id, {
                        quantity: mergedItem.quantity,
                        updated_at: new Date().toISOString(),
                    });
                }
            }
        } else {
            // Insert new item
            if (mcpBridge) {
                await supabaseMCP.insert<CartItem>("cart_items", {
                    cart_id: cartId,
                    product_id: mergedItem.product_id,
                    price_id: mergedItem.price_id,
                    spec_combination: mergedItem.spec_combination,
                    quantity: mergedItem.quantity,
                    snapshot_price: mergedItem.snapshot_price,
                    snapshot_currency: mergedItem.snapshot_currency,
                });
            }
        }
    }
}

/**
 * Fetch cart by ID with items
 */
async function fetchCartById(cartId: string): Promise<CartWithProducts | null> {
    const mcpBridge = getMCPBridge();

    if (mcpBridge) {
        const result = await supabaseMCP.select<Cart>("carts", {
            columns: "*,items:cart_items(*,product:products(id,name,product_type,delivery_type,images:product_images(image_url,is_primary)))",
            filter: { id: cartId },
            limit: 1,
        });

        if (result.error || !result.data || result.data.length === 0) {
            return null;
        }

        return result.data[0] as unknown as CartWithProducts;
    }

    // Development fallback - return null (no mock implementation needed for merge)
    return null;
}

/**
 * Delete cart and its items
 * Requirements: 6.3 - Delete anonymous cart after merge
 */
export async function deleteCart(cartId: string): Promise<boolean> {
    const mcpBridge = getMCPBridge();

    if (mcpBridge) {
        // First delete all cart items
        // Note: In production, this should be handled by CASCADE DELETE
        // or a stored procedure for atomicity
        const itemsResult = await supabaseMCP.select<CartItem>("cart_items", {
            columns: "id",
            filter: { cart_id: cartId },
        });

        if (itemsResult.data) {
            for (const item of itemsResult.data) {
                await supabaseMCP.delete("cart_items", item.id);
            }
        }

        // Then delete the cart
        const result = await supabaseMCP.delete("carts", cartId);
        return !result.error;
    }

    // Development fallback
    return true;
}

/**
 * Check if anonymous cart exists for session
 */
export async function getAnonymousCartBySessionId(
    sessionId: string
): Promise<CartWithProducts | null> {
    const mcpBridge = getMCPBridge();

    if (mcpBridge) {
        const result = await supabaseMCP.select<Cart>("carts", {
            columns: "*,items:cart_items(*,product:products(id,name,product_type,delivery_type,images:product_images(image_url,is_primary)))",
            filter: {
                session_id: sessionId,
                status: "active",
            },
            limit: 1,
        });

        if (result.error || !result.data || result.data.length === 0) {
            return null;
        }

        return result.data[0] as unknown as CartWithProducts;
    }

    return null;
}

/**
 * Get or create user cart
 */
export async function getOrCreateUserCart(userId: string): Promise<CartWithProducts | null> {
    const mcpBridge = getMCPBridge();

    if (mcpBridge) {
        // Try to find existing user cart
        const result = await supabaseMCP.select<Cart>("carts", {
            columns: "*,items:cart_items(*,product:products(id,name,product_type,delivery_type,images:product_images(image_url,is_primary)))",
            filter: {
                user_id: userId,
                status: "active",
            },
            limit: 1,
        });

        if (result.data && result.data.length > 0) {
            return result.data[0] as unknown as CartWithProducts;
        }

        // Create new cart for user
        const createResult = await supabaseMCP.insert<Cart>("carts", {
            user_id: userId,
            status: "active",
        });

        if (createResult.error || !createResult.data) {
            return null;
        }

        return {
            ...createResult.data,
            items: [],
        } as CartWithProducts;
    }

    return null;
}

/**
 * Result of cart merge on login
 */
export interface LoginCartMergeResult {
    merged: boolean;
    itemsMerged: number;
    duplicatesHandled: number;
    error?: string;
}

/**
 * Handle cart merge when user logs in
 * 
 * This function should be called after successful login to:
 * 1. Check if there's an anonymous cart for the session
 * 2. Get or create the user's cart
 * 3. Merge anonymous cart items into user cart
 * 4. Delete the anonymous cart
 * 
 * Requirements:
 * - 6.1: Merge anonymous cart items into user's account cart
 * - 6.2: Combine quantities for duplicate products
 * - 6.3: Delete anonymous cart after merge
 * 
 * @param userId - The logged-in user's ID
 * @param anonymousSessionId - The anonymous session ID from cart cookie
 * @returns LoginCartMergeResult with merge statistics
 */
export async function handleCartMergeOnLogin(
    userId: string,
    anonymousSessionId: string
): Promise<LoginCartMergeResult> {
    try {
        // Step 1: Check if anonymous cart exists
        const anonymousCart = await getAnonymousCartBySessionId(anonymousSessionId);

        if (!anonymousCart || !anonymousCart.items || anonymousCart.items.length === 0) {
            // No anonymous cart or empty cart - nothing to merge
            return {
                merged: false,
                itemsMerged: 0,
                duplicatesHandled: 0,
            };
        }

        // Step 2: Get or create user cart
        const userCart = await getOrCreateUserCart(userId);

        if (!userCart) {
            return {
                merged: false,
                itemsMerged: 0,
                duplicatesHandled: 0,
                error: "Failed to get or create user cart",
            };
        }

        // Step 3: Merge carts
        const mergeResult = await mergeAnonymousCart(anonymousCart.id, userCart.id);

        if (!mergeResult.success) {
            return {
                merged: false,
                itemsMerged: 0,
                duplicatesHandled: 0,
                error: mergeResult.error?.message || "Failed to merge carts",
            };
        }

        // Merge successful
        return {
            merged: true,
            itemsMerged: mergeResult.data!.itemsMerged,
            duplicatesHandled: mergeResult.data!.duplicatesHandled,
        };
    } catch (error) {
        console.error("Error during cart merge on login:", error);
        return {
            merged: false,
            itemsMerged: 0,
            duplicatesHandled: 0,
            error: "Unexpected error during cart merge",
        };
    }
}
