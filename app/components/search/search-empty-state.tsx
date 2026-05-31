import { Link } from "react-router";
import { Button } from "~/components/ui/button";

interface SearchEmptyStateProps {
    query: string;
}

/**
 * SearchEmptyState component for when no results are found
 * Requirements: 7.3 - Empty state with suggestions
 */
export function SearchEmptyState({ query }: SearchEmptyStateProps) {
    const suggestions = [
        { label: "应用商店", href: "/apps" },
        { label: "游戏商店", href: "/games" },
        { label: "实物商店", href: "/store" },
        { label: "海外代购", href: "/overseas" },
    ];

    return (
        <div className="flex flex-col items-center justify-center py-16 text-center">
            <span className="text-6xl mb-6">🔍</span>
            <h2 className="text-xl font-semibold text-text-primary mb-2">
                未找到相关商品
            </h2>
            <p className="text-text-muted mb-6 max-w-md">
                没有找到与 "<span className="font-medium text-text-secondary">{query}</span>" 相关的商品。
                请尝试其他关键词或浏览以下分类。
            </p>

            {/* Search Tips */}
            <div className="bg-bg-secondary rounded-lg p-4 mb-6 max-w-md text-left">
                <h3 className="text-sm font-medium text-text-primary mb-2">搜索建议</h3>
                <ul className="text-sm text-text-muted space-y-1">
                    <li>• 检查关键词是否有拼写错误</li>
                    <li>• 尝试使用更简短或更通用的关键词</li>
                    <li>• 尝试使用商品的其他名称或描述</li>
                </ul>
            </div>

            {/* Category Suggestions */}
            <div className="space-y-3">
                <p className="text-sm text-text-muted">或者浏览以下分类：</p>
                <div className="flex flex-wrap justify-center gap-2">
                    {suggestions.map((suggestion) => (
                        <Link key={suggestion.href} to={suggestion.href}>
                            <Button variant="outline" size="sm">
                                {suggestion.label}
                            </Button>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}
