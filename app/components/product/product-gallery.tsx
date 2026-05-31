import { useState } from "react";
import { cn } from "~/lib/utils";
import type { ProductImage } from "~/lib/supabase/types";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "~/components/ui/button";

interface ProductGalleryProps {
    images: ProductImage[];
    productName: string;
    className?: string;
}

/**
 * Get sorted images with primary image first
 */
function getSortedImages(images: ProductImage[]): ProductImage[] {
    return [...images].sort((a, b) => {
        // Primary image first
        if (a.is_primary && !b.is_primary) return -1;
        if (!a.is_primary && b.is_primary) return 1;
        // Then by sort_order
        return a.sort_order - b.sort_order;
    });
}

/**
 * ProductGallery component for displaying product images
 * Requirements 2.1: Display product images with primary/secondary images
 */
export function ProductGallery({
    images,
    productName,
    className,
}: ProductGalleryProps) {
    const sortedImages = getSortedImages(images);
    const [selectedIndex, setSelectedIndex] = useState(0);

    const selectedImage = sortedImages[selectedIndex];

    const handlePrevious = () => {
        setSelectedIndex((prev) =>
            prev === 0 ? sortedImages.length - 1 : prev - 1
        );
    };

    const handleNext = () => {
        setSelectedIndex((prev) =>
            prev === sortedImages.length - 1 ? 0 : prev + 1
        );
    };

    if (sortedImages.length === 0) {
        return (
            <div
                className={cn(
                    "aspect-square bg-bg-secondary rounded-xl flex items-center justify-center",
                    className
                )}
            >
                <span className="text-6xl">📦</span>
            </div>
        );
    }

    return (
        <div className={cn("space-y-4", className)}>
            {/* Main Image */}
            <div className="relative aspect-square bg-bg-secondary rounded-xl overflow-hidden group">
                <img
                    src={selectedImage.image_url}
                    alt={selectedImage.alt_text || productName}
                    className="w-full h-full object-cover"
                />

                {/* Navigation arrows - only show if multiple images */}
                {sortedImages.length > 1 && (
                    <>
                        <Button
                            variant="secondary"
                            size="icon"
                            className="absolute left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={handlePrevious}
                            aria-label="上一张图片"
                        >
                            <ChevronLeft className="h-5 w-5" />
                        </Button>
                        <Button
                            variant="secondary"
                            size="icon"
                            className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={handleNext}
                            aria-label="下一张图片"
                        >
                            <ChevronRight className="h-5 w-5" />
                        </Button>
                    </>
                )}

                {/* Image counter */}
                {sortedImages.length > 1 && (
                    <div className="absolute bottom-2 right-2 bg-bg/80 backdrop-blur-sm px-2 py-1 rounded-md text-xs text-text-primary">
                        {selectedIndex + 1} / {sortedImages.length}
                    </div>
                )}
            </div>

            {/* Thumbnail strip - only show if multiple images */}
            {sortedImages.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-2">
                    {sortedImages.map((image, index) => (
                        <button
                            key={image.id}
                            type="button"
                            onClick={() => setSelectedIndex(index)}
                            className={cn(
                                "flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all",
                                index === selectedIndex
                                    ? "border-accent"
                                    : "border-transparent hover:border-border-hover"
                            )}
                            aria-label={`查看图片 ${index + 1}`}
                            aria-current={index === selectedIndex ? "true" : undefined}
                        >
                            <img
                                src={image.image_url}
                                alt={image.alt_text || `${productName} - 图片 ${index + 1}`}
                                className="w-full h-full object-cover"
                            />
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
