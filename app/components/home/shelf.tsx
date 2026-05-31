import { Link } from "react-router";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import type { Product } from "~/lib/supabase/types";
import { ProductCard } from "~/components/product";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { useRef, useState, useEffect } from "react";

interface ShelfProps {
    title: string;
    products: Product[];
    viewAllLink?: string;
    className?: string;
}

/**
 * Shelf component for horizontal scrollable product rows
 * Requirements 1.1: Display categorized Shelf sections
 */
export function Shelf({ title, products, viewAllLink, className }: ShelfProps) {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);

    const checkScrollability = () => {
        const container = scrollContainerRef.current;
        if (container) {
            setCanScrollLeft(container.scrollLeft > 0);
            setCanScrollRight(
                container.scrollLeft < container.scrollWidth - container.clientWidth - 1
            );
        }
    };

    useEffect(() => {
        checkScrollability();
        const container = scrollContainerRef.current;
        if (container) {
            container.addEventListener("scroll", checkScrollability);
            window.addEventListener("resize", checkScrollability);
            return () => {
                container.removeEventListener("scroll", checkScrollability);
                window.removeEventListener("resize", checkScrollability);
            };
        }
    }, [products]);

    const scroll = (direction: "left" | "right") => {
        const container = scrollContainerRef.current;
        if (container) {
            const scrollAmount = container.clientWidth * 0.8;
            container.scrollBy({
                left: direction === "left" ? -scrollAmount : scrollAmount,
                behavior: "smooth",
            });
        }
    };

    if (products.length === 0) {
        return null;
    }

    return (
        <section className={cn("relative", className)}>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl md:text-2xl font-bold text-text-primary">
                    {title}
                </h2>
                {viewAllLink && (
                    <Button variant="ghost" asChild className="group">
                        <Link to={viewAllLink}>
                            查看全部
                            <ChevronRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </Link>
                    </Button>
                )}
            </div>

            {/* Scrollable Container */}
            <div className="relative group">
                {/* Left Scroll Button */}
                {canScrollLeft && (
                    <Button
                        variant="secondary"
                        size="icon"
                        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hidden md:flex"
                        onClick={() => scroll("left")}
                        aria-label="向左滚动"
                    >
                        <ChevronLeft className="h-5 w-5" />
                    </Button>
                )}

                {/* Products Container */}
                <div
                    ref={scrollContainerRef}
                    className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0"
                    style={{
                        scrollSnapType: "x mandatory",
                        WebkitOverflowScrolling: "touch",
                    }}
                >
                    {products.map((product) => (
                        <div
                            key={product.id}
                            className="flex-shrink-0 w-[160px] sm:w-[180px] md:w-[200px] lg:w-[220px]"
                            style={{ scrollSnapAlign: "start" }}
                        >
                            <ProductCard product={product} />
                        </div>
                    ))}
                </div>

                {/* Right Scroll Button */}
                {canScrollRight && (
                    <Button
                        variant="secondary"
                        size="icon"
                        className="absolute right-0 top-1/2 -translate-y-1/2 z-10 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hidden md:flex"
                        onClick={() => scroll("right")}
                        aria-label="向右滚动"
                    >
                        <ChevronRight className="h-5 w-5" />
                    </Button>
                )}
            </div>
        </section>
    );
}
