import { cn } from "~/lib/utils";
import type { ProductSpec } from "~/lib/supabase/types";
import { Label } from "~/components/ui/label";

interface ProductSpecsProps {
    specs: ProductSpec[];
    selectedSpecs: Record<string, string>;
    onSpecChange: (specName: string, optionValue: string) => void;
    className?: string;
}

/**
 * Get sorted specs by sort_order
 */
function getSortedSpecs(specs: ProductSpec[]): ProductSpec[] {
    return [...specs].sort((a, b) => a.sort_order - b.sort_order);
}

/**
 * Get sorted options by sort_order
 */
function getSortedOptions(spec: ProductSpec) {
    if (!spec.options) return [];
    return [...spec.options].sort((a, b) => a.sort_order - b.sort_order);
}

/**
 * ProductSpecs component for spec selection UI
 * Requirements 2.2, 2.3: Spec selection UI (platform, version, region, etc.)
 */
export function ProductSpecs({
    specs,
    selectedSpecs,
    onSpecChange,
    className,
}: ProductSpecsProps) {
    const sortedSpecs = getSortedSpecs(specs);

    if (sortedSpecs.length === 0) {
        return null;
    }

    return (
        <div className={cn("space-y-4", className)}>
            {sortedSpecs.map((spec) => {
                const options = getSortedOptions(spec);
                const selectedValue = selectedSpecs[spec.spec_name];

                if (options.length === 0) {
                    return null;
                }

                return (
                    <div key={spec.id} className="space-y-2">
                        <Label className="text-sm font-medium text-text-primary">
                            {spec.spec_name}
                        </Label>
                        <div className="flex flex-wrap gap-2">
                            {options.map((option) => {
                                const isSelected = selectedValue === option.option_value;
                                return (
                                    <button
                                        key={option.id}
                                        type="button"
                                        onClick={() =>
                                            onSpecChange(spec.spec_name, option.option_value)
                                        }
                                        className={cn(
                                            "px-4 py-2 rounded-lg border text-sm font-medium transition-all",
                                            isSelected
                                                ? "border-accent bg-accent/10 text-accent"
                                                : "border-border bg-bg-secondary text-text-primary hover:border-border-hover hover:bg-bg-tertiary"
                                        )}
                                        aria-pressed={isSelected}
                                    >
                                        {option.option_value}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

/**
 * Helper to get initial spec selection (first option of each spec)
 */
export function getInitialSpecSelection(
    specs: ProductSpec[] | undefined
): Record<string, string> {
    if (!specs || specs.length === 0) {
        return {};
    }

    const selection: Record<string, string> = {};

    for (const spec of specs) {
        const options = getSortedOptions(spec);
        if (options.length > 0) {
            selection[spec.spec_name] = options[0].option_value;
        }
    }

    return selection;
}

/**
 * Format spec combination for display
 */
export function formatSpecCombination(
    specCombination: Record<string, string> | undefined
): string {
    if (!specCombination || Object.keys(specCombination).length === 0) {
        return "";
    }

    return Object.entries(specCombination)
        .map(([key, value]) => `${key}: ${value}`)
        .join(" / ");
}
