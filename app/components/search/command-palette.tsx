/**
 * Command Palette Component
 * 
 * A floating search modal triggered by ⌘+K / Ctrl+K keyboard shortcut.
 * Provides quick search functionality for products and brands,
 * and AI-powered natural language search.
 * 
 * Requirements: 4.1, 4.2, 5.1
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router";
import { Dialog, DialogContent, DialogTitle } from "~/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";
import { cn } from "~/lib/utils";
import { QuickSearchTab } from "./quick-search-tab";
import { AISearchTab } from "./ai-search-tab";

interface CommandPaletteProps {
    /** Controlled open state */
    isOpen?: boolean;
    /** Callback when open state changes */
    onOpenChange?: (open: boolean) => void;
}

type SearchTab = "quick" | "ai";

/**
 * CommandPalette - Quick search modal with keyboard navigation and AI search
 * 
 * Features:
 * - Opens with ⌘+K (macOS) or Ctrl+K (Windows/Linux)
 * - Toggle between quick search and AI search
 * - Auto-focuses search input on open
 * - Backdrop blur effect
 * - Keyboard navigation for results
 * 
 * Requirements: 4.1, 4.2, 5.1
 */
export function CommandPalette({ isOpen: controlledOpen, onOpenChange }: CommandPaletteProps) {
    const [internalOpen, setInternalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<SearchTab>("quick");
    const navigate = useNavigate();

    // Use controlled or internal state
    const isOpen = controlledOpen ?? internalOpen;
    const setIsOpen = onOpenChange ?? setInternalOpen;

    // Global keyboard shortcut listener (⌘+K / Ctrl+K)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Check for ⌘+K (macOS) or Ctrl+K (Windows/Linux)
            if ((e.metaKey || e.ctrlKey) && e.key === "k") {
                e.preventDefault();
                setIsOpen(true);
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [setIsOpen]);

    // Reset state when closing
    useEffect(() => {
        if (!isOpen) {
            // Keep the active tab for next open
        }
    }, [isOpen]);

    // Handle navigation
    const handleNavigate = useCallback((url: string) => {
        navigate(url);
        setIsOpen(false);
    }, [navigate, setIsOpen]);

    // Handle close
    const handleClose = useCallback(() => {
        setIsOpen(false);
    }, [setIsOpen]);

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent
                className={cn(
                    "sm:max-w-[600px] p-0 gap-0 overflow-hidden",
                    "bg-card-bg/95 backdrop-blur-xl",
                    "border-border/50 shadow-2xl"
                )}
            >
                {/* Visually hidden title for accessibility */}
                <DialogTitle className="sr-only">搜索</DialogTitle>

                {/* Tabs */}
                <Tabs
                    value={activeTab}
                    onValueChange={(v) => setActiveTab(v as SearchTab)}
                    className="w-full"
                >
                    {/* Tab Header */}
                    <div className="flex items-center justify-between border-b border-border px-3 py-2">
                        <TabsList className="h-8 bg-transparent p-0 gap-1">
                            <TabsTrigger
                                value="quick"
                                className={cn(
                                    "h-7 px-3 text-xs rounded-md",
                                    "data-[state=active]:bg-bg-secondary data-[state=active]:shadow-none"
                                )}
                            >
                                <SearchIcon className="w-3.5 h-3.5 mr-1.5" />
                                快捷搜索
                            </TabsTrigger>
                            <TabsTrigger
                                value="ai"
                                className={cn(
                                    "h-7 px-3 text-xs rounded-md",
                                    "data-[state=active]:bg-bg-secondary data-[state=active]:shadow-none"
                                )}
                            >
                                <SparklesIcon className="w-3.5 h-3.5 mr-1.5" />
                                AI 搜索
                            </TabsTrigger>
                        </TabsList>

                        {/* Keyboard hint */}
                        <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-bg-secondary px-1.5 font-mono text-[10px] font-medium text-text-muted">
                            ESC
                        </kbd>
                    </div>

                    {/* Quick Search Tab */}
                    <TabsContent value="quick" className="mt-0">
                        <QuickSearchTab
                            isOpen={isOpen && activeTab === "quick"}
                            onNavigate={handleNavigate}
                            onClose={handleClose}
                        />
                    </TabsContent>

                    {/* AI Search Tab */}
                    <TabsContent value="ai" className="mt-0">
                        <AISearchTab
                            isOpen={isOpen && activeTab === "ai"}
                            onNavigate={handleNavigate}
                        />
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}

// ============================================
// Icons
// ============================================

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
        </svg>
    );
}

export default CommandPalette;
