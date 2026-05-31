import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import { BadgeCheck } from "lucide-react";

interface VerifiedBadgeProps {
    className?: string;
}

/**
 * Verified badge component for displaying product verification status
 * Requirements 3.2: Use BadgeCheckIcon with appropriate styling
 * Requirements 3.3: Display "已验证" text
 */
export function VerifiedBadge({ className }: VerifiedBadgeProps) {
    return (
        <Badge variant="outline" className={cn("gap-1", className)}>
            <BadgeCheck className="h-3 w-3" />
            已验证
        </Badge>
    );
}
