/**
 * Search Utilities
 * 
 * This module provides functions for searching products by name or description.
 * 
 * Requirements: 7.1
 */

import type { Product, ProductType } from "~/lib/supabase/types";

/**
 * Search products by query string
 * 
 * Matches products where name or description contains the query string (case-insensitive).
 * 
 * @param products - Array of products to search
 * @param query - Search query string
 * @returns Filtered array of products matching the query
 * 
 * Requirements: 7.1
 */
export function searchProducts(
    products: Product[],
    query: string
): Product[] {
    const normalizedQuery = query.toLowerCase().trim();

    // Empty query returns no results
    if (!normalizedQuery) {
        return [];
    }

    return products.filter(product => {
        const nameMatch = product.name.toLowerCase().includes(normalizedQuery);
        const descMatch = product.description?.toLowerCase().includes(normalizedQuery) || false;
        return nameMatch || descMatch;
    });
}

/**
 * Check if a product matches a search query
 * 
 * @param product - The product to check
 * @param query - Search query string
 * @returns true if the product's name or description contains the query
 * 
 * Requirements: 7.1
 */
export function productMatchesQuery(
    product: Product,
    query: string
): boolean {
    const normalizedQuery = query.toLowerCase().trim();

    if (!normalizedQuery) {
        return false;
    }

    const nameMatch = product.name.toLowerCase().includes(normalizedQuery);
    const descMatch = product.description?.toLowerCase().includes(normalizedQuery) || false;
    return nameMatch || descMatch;
}

/**
 * Search products with filters
 * 
 * Combines search query with product type and category filters.
 * 
 * @param products - Array of products to search
 * @param query - Search query string
 * @param productType - Optional product type filter
 * @param categoryId - Optional category ID filter
 * @returns Filtered array of products matching query and filters
 * 
 * Requirements: 7.1, 7.4
 */
export function searchProductsWithFilters(
    products: Product[],
    query: string,
    productType?: ProductType | null,
    categoryId?: string | null
): Product[] {
    let results = searchProducts(products, query);

    // Apply product type filter
    if (productType) {
        results = results.filter(p => p.product_type === productType);
    }

    // Apply category filter
    if (categoryId) {
        results = results.filter(p => p.category_id === categoryId);
    }

    return results;
}

/**
 * Validate that all search results match the query
 * 
 * @param products - Array of products (search results)
 * @param query - The search query used
 * @returns true if all products match the query
 */
export function validateSearchResults(
    products: Product[],
    query: string
): boolean {
    return products.every(product => productMatchesQuery(product, query));
}
