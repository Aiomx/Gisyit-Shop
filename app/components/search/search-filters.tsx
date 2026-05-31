import { useNavigate } from "react-router";
import { Button } from "~/components/ui/button";
import type { ProductCategory, ProductType } from "~/lib/supabase/types";
import { cn } from "~/lib/utils";

interface SearchFiltersProps {
    categories: ProductCategory[];
    currentType: ProductType | null;
    currentCategory: string | null;
    query: string;
}

const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
    app: "应用",
    game_card: "游戏点卡",
    game_cdk: "游戏CDK",
    game_digital: "数字游戏",
    physical: "实物商品",
    overseas: "海外代购",
};

const PRODUCT_TYPES: ProductType[] = [
    "app",
    "game_card",
    "game_cdk",
    "game_digital",
    "physical",
    "overseas",
];

/**
 * SearchFilters component for filtering search results
 * Requirements: 7.4 - Support filtering by product type and category
 */
export function SearchFilters({
    categories,
    currentType,
    currentCategory,
    query,
}: SearchFiltersProps) {
    const navigate = useNavigate();

    const buildFilterUrl = (type: ProductType | null, category: string | null) => {
        const params = new URLSearchParams();
        if (query) params.set("q", query);
        if (type) params.set("type", type);
        if (category) params.set("category", category);
        return `/search?${params.toString()}`;
    };

    const handleTypeChange = (type: ProductType | null) => {
        navigate(buildFilterUrl(type, currentCategory));
    };

    const handleCategoryChange = (categoryId: string | null) => {
        navigate(buildFilterUrl(currentType, categoryId));
    };

    const clearFilters = () => {
        navigate(buildFilterUrl(null, null));
    };

    const hasFilters = currentType || currentCategory;

    return (
        <div className="space-y-4">
            {/* Product Type Filters */}
            <div className="space-y-2">
                <label className="text-sm font-medium text-text-secondary">商品类型</label>
                <div className="flex flex-wrap gap-2">
                    <FilterButton
                        active={!currentType}
                        onClick={() => handleTypeChange(null)}
                    >
                        全部
                    </FilterButton>
                    {PRODUCT_TYPES.map((type) => (
                        <FilterButton
                            key={type}
                            active={currentType === type}
                            onClick={() => handleTypeChange(type)}
                        >
                            {PRODUCT_TYPE_LABELS[type]}
                        </FilterButton>
                    ))}
                </div>
            </div>

            {/* Category Filters */}
            {categories.length > 0 && (
                <div className="space-y-2">
                    <label className="text-sm font-medium text-text-secondary">分类</label>
                    <div className="flex flex-wrap gap-2">
                        <FilterButton
                            active={!currentCategory}
                            onClick={() => handleCategoryChange(null)}
                        >
                            全部分类
                        </FilterButton>
                        {categories.map((category) => (
                            <FilterButton
                                key={category.id}
                                active={currentCategory === category.id}
                                onClick={() => handleCategoryChange(category.id)}
                            >
                                {category.name}
                            </FilterButton>
                        ))}
                    </div>
                </div>
            )}

            {/* Clear Filters */}
            {hasFilters && (
                <div className="pt-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearFilters}
                        className="text-text-muted hover:text-text-primary"
                    >
                        清除筛选条件
                    </Button>
                </div>
            )}
        </div>
    );
}

function FilterButton({
    active,
    onClick,
    children,
}: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                active
                    ? "bg-accent text-white"
                    : "bg-bg-secondary text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
            )}
        >
            {children}
        </button>
    );
}
