import { Minus, Plus } from "lucide-react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

interface QuantityControlProps {
    value: number;
    onChange: (value: number) => void;
    min?: number;
    max?: number;
    disabled?: boolean;
    className?: string;
}

/**
 * QuantityControl component for modifying item quantity
 * Requirements 4.3: +/- buttons for quantity modification
 */
export function QuantityControl({
    value,
    onChange,
    min = 1,
    max = 99,
    disabled = false,
    className,
}: QuantityControlProps) {
    const handleDecrement = () => {
        if (value > min) {
            onChange(value - 1);
        }
    };

    const handleIncrement = () => {
        if (value < max) {
            onChange(value + 1);
        }
    };

    const isDecrementDisabled = disabled || value <= min;
    const isIncrementDisabled = disabled || value >= max;

    return (
        <div
            className={cn(
                "inline-flex items-center rounded-md border border-border",
                className
            )}
        >
            <Button
                variant="ghost"
                size="icon"
                onClick={handleDecrement}
                disabled={isDecrementDisabled}
                className="h-8 w-8 rounded-r-none border-r border-border"
                aria-label="减少数量"
            >
                <Minus className="h-3 w-3" />
            </Button>
            <span
                className="flex h-8 w-10 items-center justify-center text-sm font-medium text-text-primary"
                aria-label={`数量: ${value}`}
            >
                {value}
            </span>
            <Button
                variant="ghost"
                size="icon"
                onClick={handleIncrement}
                disabled={isIncrementDisabled}
                className="h-8 w-8 rounded-l-none border-l border-border"
                aria-label="增加数量"
            >
                <Plus className="h-3 w-3" />
            </Button>
        </div>
    );
}
