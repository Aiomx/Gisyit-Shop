import { cn } from "~/lib/utils";
import type { Brand, BrandGroup } from "~/lib/supabase/types";
import { BrandCard } from "./brand-card";

interface BrandGridProps {
    brands: Brand[];
    productCounts?: Record<string, number>;
    className?: string;
    emptyMessage?: string;
    grouped?: boolean;
}

/**
 * Brand group display names
 */
const brandGroupLabels: Record<BrandGroup, string> = {
    os: "操作系统",
    platform: "平台",
    store: "商店",
    other: "其他",
};

/**
 * Brand group sort order
 */
const brandGroupOrder: BrandGroup[] = ["os", "platform", "store", "other"];

/**
 * Group brands by brand_group
 */
function groupBrands(brands: Brand[]): Record<BrandGroup, Brand[]> {
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
 * BrandGrid component for displaying brands in a responsive grid layout
 * Requirements: 3.2
 * - Display brands in responsive grid layout
 * - Group by brand_group with section headers
 */
export function BrandGrid({
    brands,
    productCounts,
    className,
    emptyMessage = "暂无品牌",
    grouped = true,
}: BrandGridProps) {
    if (brands.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-text-muted">
                <span className="text-4xl mb-4">🏷️</span>
                <p className="text-lg">{emptyMessage}</p>
            </div>
        );
    }

    // If not grouped, render flat grid
    if (!grouped) {
        return (
            <div
                className={cn(
                    "grid gap-4 sm:gap-6",
                    "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6",
                    className
                )}
            >
                {brands.map((brand) => (
                    <BrandCard
                        key={brand.id}
                        brand={brand}
                        productCount={productCounts?.[brand.id]}
                    />
                ))}
            </div>
        );
    }

    // Group brands by brand_group
    const groupedBrands = groupBrands(brands);

    return (
        <div className={cn("space-y-10", className)}>
            {brandGroupOrder.map((group) => {
                const groupBrands = groupedBrands[group];
                if (!groupBrands || groupBrands.length === 0) {
                    return null;
                }

                return (
                    <section key={group}>
                        {/* Group Header */}
                        <h2 className="text-xl font-semibold text-text-primary mb-4">
                            {brandGroupLabels[group]}
                        </h2>

                        {/* Brand Cards Grid */}
                        <div
                            className={cn(
                                "grid gap-4 sm:gap-6",
                                "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6"
                            )}
                        >
                            {groupBrands.map((brand) => (
                                <BrandCard
                                    key={brand.id}
                                    brand={brand}
                                    productCount={productCounts?.[brand.id]}
                                />
                            ))}
                        </div>
                    </section>
                );
            })}
        </div>
    );
}
