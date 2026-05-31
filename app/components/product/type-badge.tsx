import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import { Download, Package } from "lucide-react";
import type { ProductType } from "~/lib/supabase/types";

export type ProductTypeCategory = "digital" | "physical";

interface TypeBadgeProps {
    type: ProductTypeCategory;
    className?: string;
}

const typeConfig: Record<
    ProductTypeCategory,
    { label: string; icon: typeof Download; variant: "default" | "secondary" | "outline" }
> = {
    digital: {
        label: "数字商品",
        icon: Download,
        variant: "default",
    },
    physical: {
        label: "实物商品",
        icon: Package,
        variant: "secondary",
    },
};

/**
 * Type badge component for displaying product type (digital/physical)
 * Requirements 4.5: Display type indicators (数字商品/实物商品)
 */
export function TypeBadge({ type, className }: TypeBadgeProps) {
    const config = typeConfig[type];
    const Icon = config.icon;

    return (
        <Badge variant={config.variant} className={cn("gap-1", className)}>
            <Icon className="h-3 w-3" />
            {config.label}
        </Badge>
    );
}

/**
 * Helper function to determine product type category from ProductType
 */
export function getProductTypeCategory(productType: ProductType): ProductTypeCategory {
    switch (productType) {
        case "app":
        case "game_card":
        case "game_cdk":
        case "game_digital":
            return "digital";
        case "physical":
        case "overseas":
            return "physical";
        default:
            return "digital";
    }
}
