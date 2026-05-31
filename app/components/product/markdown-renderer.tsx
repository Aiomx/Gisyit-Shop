import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { cn } from "~/lib/utils";

export interface MarkdownRendererProps {
    content: string;
    className?: string;
}

/**
 * MarkdownRenderer component renders Markdown content to HTML
 * with support for GitHub Flavored Markdown and raw HTML.
 * 
 * Features:
 * - Responsive images with max-width constraints
 * - Video elements with playback controls
 * - Prose styling for typography
 * - GFM support (tables, strikethrough, task lists, etc.)
 */
export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
    return (
        <div
            data-slot="markdown-renderer"
            className={cn("markdown-content", className)}
        >
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
                components={{
                    // Responsive images with proper styling
                    img: ({ node, ...props }) => (
                        <img
                            {...props}
                            className="max-w-full h-auto rounded-lg my-4 mx-auto block"
                            loading="lazy"
                            alt={props.alt || ""}
                        />
                    ),
                    // Videos with playback controls
                    video: ({ node, ...props }) => (
                        <video
                            {...props}
                            className="max-w-full h-auto rounded-lg my-4 mx-auto block"
                            controls
                            preload="metadata"
                        />
                    ),
                    // Styled headings
                    h1: ({ node, ...props }) => (
                        <h1
                            {...props}
                            className="text-2xl font-bold mt-8 mb-4 text-text-primary"
                        />
                    ),
                    h2: ({ node, ...props }) => (
                        <h2
                            {...props}
                            className="text-xl font-semibold mt-6 mb-3 text-text-primary"
                        />
                    ),
                    h3: ({ node, ...props }) => (
                        <h3
                            {...props}
                            className="text-lg font-semibold mt-5 mb-2 text-text-primary"
                        />
                    ),
                    h4: ({ node, ...props }) => (
                        <h4
                            {...props}
                            className="text-base font-semibold mt-4 mb-2 text-text-primary"
                        />
                    ),
                    // Paragraphs
                    p: ({ node, ...props }) => (
                        <p
                            {...props}
                            className="my-4 leading-relaxed text-text-secondary"
                        />
                    ),
                    // Links
                    a: ({ node, ...props }) => (
                        <a
                            {...props}
                            className="text-accent hover:text-accent-hover underline transition-colors"
                            target="_blank"
                            rel="noopener noreferrer"
                        />
                    ),
                    // Lists
                    ul: ({ node, ...props }) => (
                        <ul
                            {...props}
                            className="list-disc list-inside my-4 space-y-2 text-text-secondary"
                        />
                    ),
                    ol: ({ node, ...props }) => (
                        <ol
                            {...props}
                            className="list-decimal list-inside my-4 space-y-2 text-text-secondary"
                        />
                    ),
                    li: ({ node, ...props }) => (
                        <li {...props} className="leading-relaxed" />
                    ),
                    // Blockquotes
                    blockquote: ({ node, ...props }) => (
                        <blockquote
                            {...props}
                            className="border-l-4 border-accent pl-4 my-4 italic text-text-muted"
                        />
                    ),
                    // Code blocks
                    code: ({ node, className, children, ...props }) => {
                        const isInline = !className;
                        if (isInline) {
                            return (
                                <code
                                    {...props}
                                    className="bg-bg-tertiary px-1.5 py-0.5 rounded text-sm font-mono text-text-primary"
                                >
                                    {children}
                                </code>
                            );
                        }
                        return (
                            <code
                                {...props}
                                className={cn(
                                    "block bg-bg-tertiary p-4 rounded-lg overflow-x-auto text-sm font-mono text-text-primary",
                                    className
                                )}
                            >
                                {children}
                            </code>
                        );
                    },
                    pre: ({ node, ...props }) => (
                        <pre
                            {...props}
                            className="bg-bg-tertiary rounded-lg my-4 overflow-x-auto"
                        />
                    ),
                    // Tables
                    table: ({ node, ...props }) => (
                        <div className="overflow-x-auto my-4">
                            <table
                                {...props}
                                className="min-w-full border-collapse border border-border"
                            />
                        </div>
                    ),
                    thead: ({ node, ...props }) => (
                        <thead {...props} className="bg-bg-secondary" />
                    ),
                    th: ({ node, ...props }) => (
                        <th
                            {...props}
                            className="border border-border px-4 py-2 text-left font-semibold text-text-primary"
                        />
                    ),
                    td: ({ node, ...props }) => (
                        <td
                            {...props}
                            className="border border-border px-4 py-2 text-text-secondary"
                        />
                    ),
                    // Horizontal rule
                    hr: ({ node, ...props }) => (
                        <hr {...props} className="my-8 border-border" />
                    ),
                    // Strong and emphasis
                    strong: ({ node, ...props }) => (
                        <strong {...props} className="font-semibold text-text-primary" />
                    ),
                    em: ({ node, ...props }) => (
                        <em {...props} className="italic" />
                    ),
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
}

/**
 * Helper function to check if content is valid for rendering
 * Returns true if content is a non-empty string
 */
export function hasValidContent(content: string | null | undefined): boolean {
    return typeof content === "string" && content.trim().length > 0;
}
