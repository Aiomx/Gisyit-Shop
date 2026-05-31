import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import { Monitor, Apple, Laptop } from "lucide-react";

export type Platform = "mac" | "windows" | "cross-platform";

interface PlatformBadgeProps {
    platform: Platform;
    className?: string;
}

const platformConfig: Record<
    Platform,
    { label: string; icon: typeof Monitor; variant: "default" | "secondary" | "outline" }
> = {
    mac: {
        label: "Mac",
        icon: Apple,
        variant: "secondary",
    },
    windows: {
        label: "Windows",
        icon: Monitor,
        variant: "secondary",
    },
    "cross-platform": {
        label: "跨平台",
        icon: Laptop,
        variant: "default",
    },
};

/**
 * Platform badge component for displaying platform compatibility
 * Requirements 2.2: Display platform compatibility (Mac / Windows / Cross-platform)
 */
export function PlatformBadge({ platform, className }: PlatformBadgeProps) {
    const config = platformConfig[platform];
    const Icon = config.icon;

    return (
        <Badge variant={config.variant} className={cn("gap-1", className)}>
            <Icon className="h-3 w-3" />
            {config.label}
        </Badge>
    );
}
