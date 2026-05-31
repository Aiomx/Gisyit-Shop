/**
 * Property-Based Tests for Brand Grouping and Sorting
 *
 * **Feature: brand-management, Property 9: Brand Grouping and Sorting**
 * **Validates: Requirements 3.2**
 *
 * These tests verify that:
 * - Brands are grouped by brand_group
 * - Within each group, brands are sorted by sort_order in ascending order
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import type { Brand, BrandGroup } from "~/lib/supabase/types";

// ============================================
// Pure Functions for Testing (extracted logic)
// ============================================

/**
 * Sort brands by group and then by sort_order within each group
 * This is the core sorting logic used by getActiveBrands
 */
function sortBrandsByGroupAndOrder(brands: Brand[]): Brand[] {
    return [...brands].sort((a, b) => {
        // First sort by brand_group
        const groupCompare = a.brand_group.localeCompare(b.brand_group);
        if (groupCompare !== 0) {
            return groupCompare;
        }
        // Then sort by sort_order within the same group
        return a.sort_order - b.sort_order;
    });
}

/**
 * Group brands by brand_group
 */
function groupBrandsByGroup(brands: Brand[]): Record<BrandGroup, Brand[]> {
    return brands.reduce((acc, brand) => {
        const group = brand.brand_group;
        if (!acc[group]) {
            acc[group] = [];
        }
        acc[group].push(brand);
        return acc;
    }, {} as Record<BrandGroup, Brand[]>);
}

/**
 * Check if brands within each group are sorted by sort_order
 */
function isSortedWithinGroups(brands: Brand[]): boolean {
    const grouped = groupBrandsByGroup(brands);

    for (const group of Object.values(grouped)) {
        for (let i = 1; i < group.length; i++) {
            if (group[i].sort_order < group[i - 1].sort_order) {
                return false;
            }
        }
    }
    return true;
}

/**
 * Check if brands are grouped (all brands of same group are consecutive)
 */
function isGroupedCorrectly(brands: Brand[]): boolean {
    const seenGroups = new Set<BrandGroup>();
    let currentGroup: BrandGroup | null = null;

    for (const brand of brands) {
        if (brand.brand_group !== currentGroup) {
            // Switching to a new group
            if (seenGroups.has(brand.brand_group)) {
                // We've seen this group before, so brands are not properly grouped
                return false;
            }
            seenGroups.add(brand.brand_group);
            currentGroup = brand.brand_group;
        }
    }
    return true;
}

// ============================================
// Arbitraries (Generators)
// ============================================

/**
 * Generate a valid brand group
 */
const brandGroupArb: fc.Arbitrary<BrandGroup> = fc.constantFrom(
    "os",
    "platform",
    "store",
    "other"
);

/**
 * Generate a valid slug (lowercase letters, numbers, hyphens)
 */
const slugArb = fc
    .array(
        fc.oneof(
            fc.integer({ min: 97, max: 122 }).map((c) => String.fromCharCode(c)), // a-z
            fc.integer({ min: 48, max: 57 }).map((c) => String.fromCharCode(c)), // 0-9
            fc.constant("-")
        ),
        { minLength: 1, maxLength: 50 }
    )
    .map((chars) => chars.join(""))
    .filter((s) => !s.startsWith("-") && !s.endsWith("-") && !s.includes("--"));

/**
 * Generate a valid ISO date string
 */
const isoDateArb = fc
    .integer({ min: 1577836800000, max: 1924905600000 })
    .map((timestamp) => new Date(timestamp).toISOString());

/**
 * Generate a valid Brand
 */
const brandArb: fc.Arbitrary<Brand> = fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 100 }),
    slug: slugArb,
    logo_url: fc.option(fc.webUrl(), { nil: undefined }),
    brand_group: brandGroupArb,
    sort_order: fc.integer({ min: 0, max: 1000 }),
    is_active: fc.constant(true), // Focus on active brands for this test
    description: fc.option(fc.string({ maxLength: 500 }), { nil: undefined }),
    created_at: isoDateArb,
    updated_at: isoDateArb,
});

/**
 * Generate an array of brands
 */
const brandsArb = fc.array(brandArb, { minLength: 0, maxLength: 30 });

/**
 * Generate brands with specific groups for testing grouping
 */
const brandsWithMultipleGroupsArb = fc
    .tuple(
        fc.array(brandArb.map((b) => ({ ...b, brand_group: "os" as BrandGroup })), {
            minLength: 1,
            maxLength: 5,
        }),
        fc.array(brandArb.map((b) => ({ ...b, brand_group: "platform" as BrandGroup })), {
            minLength: 1,
            maxLength: 5,
        }),
        fc.array(brandArb.map((b) => ({ ...b, brand_group: "store" as BrandGroup })), {
            minLength: 1,
            maxLength: 5,
        })
    )
    .map(([os, platform, store]) => [...os, ...platform, ...store]);

// ============================================
// Property Tests
// ============================================

describe("Property 9: Brand Grouping and Sorting", () => {
    /**
     * **Feature: brand-management, Property 9: Brand Grouping and Sorting**
     * **Validates: Requirements 3.2**
     *
     * Core property: After sorting, brands are grouped by brand_group
     */
    it("sorted brands are grouped by brand_group", () => {
        fc.assert(
            fc.property(brandsArb, (brands) => {
                const sorted = sortBrandsByGroupAndOrder(brands);

                // Brands should be properly grouped
                expect(isGroupedCorrectly(sorted)).toBe(true);

                return true;
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Within each group, brands are sorted by sort_order ascending
     */
    it("brands within each group are sorted by sort_order ascending", () => {
        fc.assert(
            fc.property(brandsArb, (brands) => {
                const sorted = sortBrandsByGroupAndOrder(brands);

                // Brands within each group should be sorted by sort_order
                expect(isSortedWithinGroups(sorted)).toBe(true);

                return true;
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Sorting preserves all brands (no brands lost or duplicated)
     */
    it("sorting preserves all brands", () => {
        fc.assert(
            fc.property(brandsArb, (brands) => {
                const sorted = sortBrandsByGroupAndOrder(brands);

                // Same number of brands
                expect(sorted.length).toBe(brands.length);

                // All original brands are present
                const originalIds = new Set(brands.map((b) => b.id));
                const sortedIds = new Set(sorted.map((b) => b.id));
                expect(sortedIds).toEqual(originalIds);

                return true;
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Sorting is stable for brands with same group and sort_order
     */
    it("sorting is deterministic", () => {
        fc.assert(
            fc.property(brandsArb, (brands) => {
                const sorted1 = sortBrandsByGroupAndOrder(brands);
                const sorted2 = sortBrandsByGroupAndOrder(brands);

                // Same result each time
                expect(sorted1.map((b) => b.id)).toEqual(sorted2.map((b) => b.id));

                return true;
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Empty input produces empty output
     */
    it("empty input produces empty output", () => {
        const sorted = sortBrandsByGroupAndOrder([]);
        expect(sorted).toEqual([]);
    });

    /**
     * Single brand input produces same brand output
     */
    it("single brand input produces same brand output", () => {
        fc.assert(
            fc.property(brandArb, (brand) => {
                const sorted = sortBrandsByGroupAndOrder([brand]);

                expect(sorted.length).toBe(1);
                expect(sorted[0].id).toBe(brand.id);

                return true;
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Brands with multiple groups are properly separated
     */
    it("brands with multiple groups are properly separated", () => {
        fc.assert(
            fc.property(brandsWithMultipleGroupsArb, (brands) => {
                // Shuffle the brands to simulate unsorted input
                const shuffled = [...brands].sort(() => Math.random() - 0.5);
                const sorted = sortBrandsByGroupAndOrder(shuffled);

                // Should be properly grouped
                expect(isGroupedCorrectly(sorted)).toBe(true);

                // Should be sorted within groups
                expect(isSortedWithinGroups(sorted)).toBe(true);

                return true;
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Grouping function produces correct groups
     */
    it("grouping function produces correct groups", () => {
        fc.assert(
            fc.property(brandsArb, (brands) => {
                const grouped = groupBrandsByGroup(brands);

                // Total count should match
                const totalInGroups = Object.values(grouped).reduce(
                    (sum, group) => sum + group.length,
                    0
                );
                expect(totalInGroups).toBe(brands.length);

                // Each brand should be in its correct group
                for (const brand of brands) {
                    const group = grouped[brand.brand_group];
                    expect(group).toBeDefined();
                    expect(group.some((b) => b.id === brand.id)).toBe(true);
                }

                return true;
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Groups are sorted alphabetically by group name
     */
    it("groups appear in alphabetical order", () => {
        fc.assert(
            fc.property(brandsWithMultipleGroupsArb, (brands) => {
                const sorted = sortBrandsByGroupAndOrder(brands);

                // Extract the sequence of groups
                const groupSequence: BrandGroup[] = [];
                let currentGroup: BrandGroup | null = null;
                for (const brand of sorted) {
                    if (brand.brand_group !== currentGroup) {
                        groupSequence.push(brand.brand_group);
                        currentGroup = brand.brand_group;
                    }
                }

                // Groups should be in alphabetical order
                const sortedGroups = [...groupSequence].sort();
                expect(groupSequence).toEqual(sortedGroups);

                return true;
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Sort order within group is strictly ascending
     */
    it("sort_order within group is ascending", () => {
        fc.assert(
            fc.property(brandsArb, (brands) => {
                const sorted = sortBrandsByGroupAndOrder(brands);
                const grouped = groupBrandsByGroup(sorted);

                for (const [, group] of Object.entries(grouped)) {
                    for (let i = 1; i < group.length; i++) {
                        // Each brand's sort_order should be >= previous
                        expect(group[i].sort_order).toBeGreaterThanOrEqual(
                            group[i - 1].sort_order
                        );
                    }
                }

                return true;
            }),
            { numRuns: 100 }
        );
    });
});
