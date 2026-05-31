/**
 * Slug Migration Service (Server-side only)
 *
 * Provides migration utilities to generate slugs for existing products.
 * This module handles the data migration for products that don't have slugs.
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */

import { getSupabaseClient } from '~/lib/supabase/client.server';
import type { Product } from '~/lib/supabase/types';
import { generateSlug, validateSlug } from './slug';

// ============================================
// Types
// ============================================

export interface MigrationResult {
    success: boolean;
    totalProducts: number;
    migratedCount: number;
    skippedCount: number;
    errors: MigrationError[];
}

export interface MigrationError {
    productId: string;
    productName: string;
    error: string;
}

export interface ProductMigrationRecord {
    id: string;
    name: string;
    slug: string | null;
}

// ============================================
// Migration Functions
// ============================================

/**
 * Get all products that need slug migration (slug is null)
 *
 * Requirements: 6.1
 *
 * @returns Array of products without slugs
 */
export async function getProductsWithoutSlugs(): Promise<ProductMigrationRecord[]> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
        .from('products')
        .select('id, name, slug')
        .is('slug', null)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Error fetching products without slugs:', error);
        return [];
    }

    return (data || []) as ProductMigrationRecord[];
}

/**
 * Get all existing slugs in the database
 *
 * @returns Set of existing slugs for uniqueness checking
 */
export async function getAllExistingSlugs(): Promise<Set<string>> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
        .from('products')
        .select('slug')
        .not('slug', 'is', null);

    if (error) {
        console.error('Error fetching existing slugs:', error);
        return new Set();
    }

    const slugs = new Set<string>();
    for (const product of data || []) {
        if (product.slug) {
            slugs.add(product.slug);
        }
    }

    return slugs;
}

/**
 * Generate a unique slug for a product name, handling conflicts
 *
 * Requirements: 6.2, 6.3
 *
 * @param name - Product name to generate slug from
 * @param existingSlugs - Set of existing slugs to check against
 * @returns Unique slug string
 */
export function generateUniqueSlugSync(
    name: string,
    existingSlugs: Set<string>
): string {
    const baseSlug = generateSlug(name);

    if (!baseSlug) {
        // If base slug is empty, generate a fallback
        const fallback = `product-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
        existingSlugs.add(fallback);
        return fallback;
    }

    // Check if base slug is available
    if (!existingSlugs.has(baseSlug)) {
        const validation = validateSlug(baseSlug);
        if (validation.valid) {
            existingSlugs.add(baseSlug);
            return baseSlug;
        }
    }

    // Try appending numeric suffixes
    let suffix = 2;
    const maxAttempts = 1000;

    while (suffix <= maxAttempts) {
        const candidateSlug = `${baseSlug}-${suffix}`;

        if (!existingSlugs.has(candidateSlug)) {
            const validation = validateSlug(candidateSlug);
            if (validation.valid) {
                existingSlugs.add(candidateSlug);
                return candidateSlug;
            }
        }

        suffix++;
    }

    // Fallback: append timestamp
    const fallbackSlug = `${baseSlug}-${Date.now()}`;
    existingSlugs.add(fallbackSlug);
    return fallbackSlug;
}

/**
 * Update a product's slug in the database
 *
 * @param productId - Product ID to update
 * @param slug - New slug value
 * @returns true if update was successful
 */
export async function updateProductSlug(
    productId: string,
    slug: string
): Promise<boolean> {
    const supabase = getSupabaseClient();

    const { error } = await supabase
        .from('products')
        .update({ slug })
        .eq('id', productId);

    if (error) {
        console.error(`Error updating slug for product ${productId}:`, error);
        return false;
    }

    return true;
}

/**
 * Run the slug migration for all products without slugs
 *
 * This function:
 * 1. Fetches all products without slugs
 * 2. Generates unique slugs for each product
 * 3. Updates the database with the new slugs
 * 4. Returns a summary of the migration
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4
 *
 * @returns Migration result with statistics and errors
 */
export async function runSlugMigration(): Promise<MigrationResult> {
    const result: MigrationResult = {
        success: true,
        totalProducts: 0,
        migratedCount: 0,
        skippedCount: 0,
        errors: [],
    };

    try {
        // Get all products without slugs
        const productsToMigrate = await getProductsWithoutSlugs();
        result.totalProducts = productsToMigrate.length;

        if (productsToMigrate.length === 0) {
            console.log('No products need slug migration');
            return result;
        }

        console.log(`Found ${productsToMigrate.length} products without slugs`);

        // Get all existing slugs for uniqueness checking
        const existingSlugs = await getAllExistingSlugs();
        console.log(`Found ${existingSlugs.size} existing slugs`);

        // Process each product
        for (const product of productsToMigrate) {
            try {
                // Generate unique slug from product name
                const slug = generateUniqueSlugSync(product.name, existingSlugs);

                // Update the product in the database
                const updated = await updateProductSlug(product.id, slug);

                if (updated) {
                    result.migratedCount++;
                    console.log(`Migrated: ${product.name} -> ${slug}`);
                } else {
                    result.skippedCount++;
                    result.errors.push({
                        productId: product.id,
                        productName: product.name,
                        error: 'Failed to update database',
                    });
                }
            } catch (err) {
                result.skippedCount++;
                result.errors.push({
                    productId: product.id,
                    productName: product.name,
                    error: String(err),
                });
            }
        }

        // Check if all products were migrated successfully
        result.success = result.errors.length === 0;

        console.log(`Migration complete: ${result.migratedCount} migrated, ${result.skippedCount} skipped`);

        return result;
    } catch (err) {
        result.success = false;
        result.errors.push({
            productId: 'N/A',
            productName: 'N/A',
            error: `Migration failed: ${String(err)}`,
        });
        return result;
    }
}

/**
 * Verify that all products have slugs after migration
 *
 * Requirements: 6.4
 *
 * @returns true if all products have non-null slugs
 */
export async function verifyMigrationComplete(): Promise<boolean> {
    const productsWithoutSlugs = await getProductsWithoutSlugs();
    return productsWithoutSlugs.length === 0;
}

/**
 * Get migration statistics
 *
 * @returns Object with counts of products with and without slugs
 */
export async function getMigrationStats(): Promise<{
    totalProducts: number;
    withSlugs: number;
    withoutSlugs: number;
}> {
    const supabase = getSupabaseClient();

    // Get total count
    const { count: totalCount, error: totalError } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true });

    if (totalError) {
        console.error('Error getting total product count:', totalError);
        return { totalProducts: 0, withSlugs: 0, withoutSlugs: 0 };
    }

    // Get count without slugs
    const { count: withoutSlugCount, error: withoutError } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .is('slug', null);

    if (withoutError) {
        console.error('Error getting products without slugs count:', withoutError);
        return { totalProducts: totalCount || 0, withSlugs: 0, withoutSlugs: 0 };
    }

    const total = totalCount || 0;
    const withoutSlugs = withoutSlugCount || 0;

    return {
        totalProducts: total,
        withSlugs: total - withoutSlugs,
        withoutSlugs: withoutSlugs,
    };
}
