import { useNavigate } from "react-router";
import { useState, useCallback, type FormEvent, type KeyboardEvent } from "react";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

interface SearchInputProps {
    defaultValue?: string;
    placeholder?: string;
    className?: string;
    autoFocus?: boolean;
}

/**
 * SearchInput component with submit handling
 * Requirements: 7.1 - Search input with submit handling
 */
export function SearchInput({
    defaultValue = "",
    placeholder = "搜索商品名称或描述...",
    className,
    autoFocus = false,
}: SearchInputProps) {
    const navigate = useNavigate();
    const [value, setValue] = useState(defaultValue);

    const handleSubmit = useCallback((e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const trimmedValue = value.trim();
        if (trimmedValue) {
            navigate(`/search?q=${encodeURIComponent(trimmedValue)}`);
        }
    }, [value, navigate]);

    const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            const trimmedValue = value.trim();
            if (trimmedValue) {
                navigate(`/search?q=${encodeURIComponent(trimmedValue)}`);
            }
        }
    }, [value, navigate]);

    return (
        <form onSubmit={handleSubmit} className={cn("flex gap-2", className)}>
            <div className="relative flex-1">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                <Input
                    type="search"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    autoFocus={autoFocus}
                    className="pl-10 h-11"
                    aria-label="搜索商品"
                />
            </div>
            <Button type="submit" className="h-11 px-6">
                搜索
            </Button>
        </form>
    );
}

/**
 * Compact search input for header/navigation
 */
export function CompactSearchInput({
    className,
}: {
    className?: string;
}) {
    const navigate = useNavigate();
    const [value, setValue] = useState("");

    const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            const trimmedValue = value.trim();
            if (trimmedValue) {
                navigate(`/search?q=${encodeURIComponent(trimmedValue)}`);
                setValue("");
            }
        }
    }, [value, navigate]);

    return (
        <div className={cn("relative", className)}>
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
            <Input
                type="search"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="搜索..."
                className="pl-9 h-9 w-48 lg:w-64"
                aria-label="搜索商品"
            />
        </div>
    );
}

function SearchIcon({ className }: { className?: string }) {
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
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
        </svg>
    );
}
