/**
 * Product Filtering Utilities (Client-safe)
 *
 * This module provides functions for filtering and categorizing products
 * based on store sections and product types.
 *
 * Requirements: 1.2, 1.3, 1.4, 1.5
 */

import type { Product, ProductType, StoreSection } from "~/lib/supabase/types";

/**
 * Maps store sections to their valid product types
 *
 * - apps: Only 'app' type products
 * - games: game_card, game_cdk, game_digital types
 * - store: Only 'physical' type products
 * - overseas: Only 'overseas' type products
 */
export const SECTION_PRODUCT_TYPES: Record<StoreSection, ProductType[]> = {
    apps: ["app"],
    games: ["game_card", "game_cdk", "game_digital"],
    store: ["physical"],
    overseas: ["overseas"],
};

/**
 * Get valid product types for a given store section
 */
export function getProductTypesForSection(section: StoreSection): ProductType[] {
    return SECTION_PRODUCT_TYPES[section];
}

/**
 * Check if a product belongs to a specific store section
 *
 * @param product - The product to check
 * @param section - The store section to check against
 * @returns true if the product's type is valid for the section
 */
export function isProductInSection(product: Product, section: StoreSection): boolean {
    const validTypes = SECTION_PRODUCT_TYPES[section];
    return validTypes.includes(product.product_type);
}

/**
 * Filter products by store section
 *
 * Returns only products whose product_type matches the section's valid types.
 *
 * @param products - Array of products to filter
 * @param section - The store section to filter by
 * @returns Filtered array of products belonging to the section
 *
 * Requirements: 1.2, 1.3, 1.4, 1.5
 */
export function filterProductsBySection(
    products: Product[],
    section: StoreSection
): Product[] {
    const validTypes = SECTION_PRODUCT_TYPES[section];
    return products.filter((product) => validTypes.includes(product.product_type));
}

/**
 * Filter products by category within a section
 *
 * @param products - Array of products to filter
 * @param section - The store section
 * @param categoryId - Optional category ID to filter by
 * @returns Filtered array of products
 */
export function filterProductsBySectionAndCategory(
    products: Product[],
    section: StoreSection,
    categoryId?: string
): Product[] {
    let filtered = filterProductsBySection(products, section);

    if (categoryId) {
        filtered = filtered.filter((product) => product.category_id === categoryId);
    }

    return filtered;
}

/**
 * Get the store section for a product type
 *
 * @param productType - The product type
 * @returns The store section the product type belongs to
 */
export function getSectionForProductType(productType: ProductType): StoreSection {
    for (const [section, types] of Object.entries(SECTION_PRODUCT_TYPES)) {
        if (types.includes(productType)) {
            return section as StoreSection;
        }
    }
    // This should never happen if all product types are mapped
    throw new Error(`Unknown product type: ${productType}`);
}

/**
 * Validate that all products in a list belong to the specified section
 *
 * @param products - Array of products to validate
 * @param section - The expected store section
 * @returns true if all products belong to the section
 */
export function validateProductsInSection(
    products: Product[],
    section: StoreSection
): boolean {
    return products.every((product) => isProductInSection(product, section));
}
