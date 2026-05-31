/**
 * AI Search Input Component
 * 
 * A natural language input field for AI-powered product recommendations.
 * Shows loading state during AI processing.
 * 
 * Requirements: 5.1, 5.5
 */

import { useState, useRef, useCallback, type KeyboardEvent } from "react";
import { cn } from "~/lib/utils";

interface AISearchInputProps {
    /** Callback when search is submitted */
    onSearch: (query: string) => void;
    /** Whether AI is currently processing */
    isLoading?: boolean;
    /** Placeholder text */
    placeholder?: string;
    /** Additional CSS classes */
    className?: string;
    /** Auto focus on mount */
    autoFocus?: boolean;
}

/**
 * AISearchInput - Natural language search input for AI recommendations
 * 
 * Features:
 * - Natural language input field
 * - Loading state indicator
 * - Submit on Enter key
 * - Disabled state during processing
 * 
 * Requirements: 5.1, 5.5
 */
export function AISearchInput({
    onSearch,
    isLoading = false,
    placeholder = "描述你想要的商品，例如：适合设计师使用的 Mac 软件...",
    className,
    autoFocus = false,
}: AISearchInputProps) {
    const [query, setQuery] = useState("");
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const handleSubmit = useCallback(() => {
        const trimmedQuery = query.trim();
        if (trimmedQuery && !isLoading) {
            onSearch(trimmedQuery);
        }
    }, [query, isLoading, onSearch]);

    const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
        // Submit on Enter (without Shift for new line)
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    }, [handleSubmit]);

    return (
        <div className={cn("relative", className)}>
            {/* Input Container */}
            <div className={cn(
                "relative flex items-start gap-2 rounded-lg",
                "border border-border bg-input-bg",
                "focus-within:ring-1 focus-within:ring-accent",
                "transition-all duration-200",
                isLoading && "opacity-70"
            )}>
                {/* AI Icon */}
                <div className="flex items-center justify-center w-10 h-10 shrink-0 mt-1 ml-1">
                    {isLoading ? (
                        <LoadingSpinner className="w-5 h-5 text-accent" />
                    ) : (
                        <SparklesIcon className="w-5 h-5 text-accent" />
                    )}
                </div>

                {/* Textarea Input */}
                <textarea
                    ref={inputRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    disabled={isLoading}
                    autoFocus={autoFocus}
                    rows={2}
                    className={cn(
                        "flex-1 py-2.5 pr-12 bg-transparent resize-none",
                        "text-base text-text-primary placeholder:text-text-muted",
                        "focus:outline-none",
                        "disabled:cursor-not-allowed"
                    )}
                    aria-label="AI 搜索输入"
                />

                {/* Submit Button */}
                <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isLoading || !query.trim()}
                    className={cn(
                        "absolute right-2 top-1/2 -translate-y-1/2",
                        "w-8 h-8 rounded-md",
                        "flex items-center justify-center",
                        "bg-accent text-white",
                        "hover:bg-accent-hover",
                        "disabled:opacity-50 disabled:cursor-not-allowed",
                        "transition-colors duration-200"
                    )}
                    aria-label="发送"
                >
                    <SendIcon className="w-4 h-4" />
                </button>
            </div>

            {/* Helper Text */}
            <p className="mt-2 text-xs text-text-muted">
                {isLoading ? (
                    <span className="flex items-center gap-1">
                        <span className="animate-pulse">AI 正在思考中</span>
                        <span className="animate-bounce">...</span>
                    </span>
                ) : (
                    "按 Enter 发送，Shift + Enter 换行"
                )}
            </p>
        </div>
    );
}

// ============================================
// Icons
// ============================================

function SparklesIcon({ className }: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
            <path d="M20 3v4" />
            <path d="M22 5h-4" />
            <path d="M4 17v2" />
            <path d="M5 18H3" />
        </svg>
    );
}

function SendIcon({ className }: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z" />
            <path d="m21.854 2.147-10.94 10.939" />
        </svg>
    );
}

function LoadingSpinner({ className }: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={cn("animate-spin", className)}
        >
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
    );
}

export default AISearchInput;
