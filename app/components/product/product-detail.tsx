import { useState, useMemo } from "react";
import { cn } from "~/lib/utils";
import type { Product, ProductType } from "~/lib/supabase/types";
import { ProductGallery } from "./product-gallery";
import { ProductSpecs, getInitialSpecSelection } from "./product-specs";
import {
    ProductPrice,
    getPriceBySpecs,
    getLowestPrice,
    formatPrice,
} from "./product-price";
import { PlatformBadge, type Platform } from "./platform-badge";
import { TypeBadge, getProductTypeCategory } from "./type-badge";
import { VerifiedBadge } from "./verified-badge";
import { MarkdownRenderer, hasValidContent } from "./markdown-renderer";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
    ShoppingCart,
    Download,
    Key,
    Truck,
    Globe,
    Clock,
    Package,
    AlertCircle,
    CheckCircle,
    Info,
    Loader2,
    CreditCard,
} from "lucide-react";
import {
    checkFreeProduct,
    shouldShowPrice,
    shouldShowCartOptions,
} from "~/lib/product/free-product";

interface ProductDetailProps {
    product: Product;
    onAddToCart?: (specCombination: Record<string, string>) => void;
    onBuyNow?: (specCombination: Record<string, string>, priceId: string) => void;
    onFreeDownload?: () => void;
    isAddingToCart?: boolean;
    isBuyingNow?: boolean;
    isDownloading?: boolean;
    downloadError?: string | null;
    className?: string;
}

/**
 * Get platform from spec combination or product type
 */
function getPlatformFromProduct(product: Product): Platform | null {
    // Check specs for platform info
    const platformSpec = product.specs?.find(
        (s) => s.spec_name.toLowerCase() === "平台" || s.spec_name.toLowerCase() === "platform"
    );

    if (platformSpec?.options && platformSpec.options.length > 0) {
        const firstOption = platformSpec.options[0].option_value.toLowerCase();
        if (firstOption.includes("mac") && firstOption.includes("windows")) {
            return "cross-platform";
        }
        if (firstOption.includes("mac")) return "mac";
        if (firstOption.includes("windows")) return "windows";
    }

    // Default based on product type
    if (product.product_type === "app") {
        return "cross-platform";
    }

    return null;
}

/**
 * Get delivery type info
 */
function getDeliveryInfo(product: Product): {
    icon: typeof Download;
    label: string;
    description: string;
} {
    switch (product.delivery_type) {
        case "download":
            return {
                icon: Download,
                label: "下载交付",
                description: "购买后可立即下载",
            };
        case "license_key":
            return {
                icon: Key,
                label: "激活码交付",
                description: "购买后获取激活码",
            };
        case "cdk":
            return {
                icon: Key,
                label: "CDK 交付",
                description: "购买后获取兑换码",
            };
        case "shipment":
            return {
                icon: Truck,
                label: "物流配送",
                description: "预计 3-7 个工作日送达",
            };
        case "manual":
            return {
                icon: Package,
                label: "人工处理",
                description: "客服将在 24 小时内联系您",
            };
        default:
            return {
                icon: Package,
                label: "待确认",
                description: "请联系客服确认交付方式",
            };
    }
}

/**
 * Type-specific info section based on product type
 */
function TypeSpecificInfo({ product }: { product: Product }) {
    const productType = product.product_type;

    switch (productType) {
        case "app":
            return <AppProductInfo product={product} />;
        case "game_card":
        case "game_cdk":
        case "game_digital":
            return <GameProductInfo product={product} />;
        case "physical":
            return <PhysicalProductInfo product={product} />;
        case "overseas":
            return <OverseasProductInfo product={product} />;
        default:
            return null;
    }
}

/**
 * App product specific info
 * Requirements 2.2: Display platform compatibility, version info, download/license instructions
 */
function AppProductInfo({ product }: { product: Product }) {
    const platform = getPlatformFromProduct(product);
    const deliveryInfo = getDeliveryInfo(product);
    const DeliveryIcon = deliveryInfo.icon;

    return (
        <div className="space-y-3 p-4 bg-bg-secondary rounded-lg">
            <h4 className="font-medium text-text-primary flex items-center gap-2">
                <Info className="h-4 w-4" />
                应用信息
            </h4>
            <div className="space-y-2 text-sm">
                {platform && (
                    <div className="flex items-center gap-2">
                        <span className="text-text-muted">平台兼容性:</span>
                        <PlatformBadge platform={platform} />
                    </div>
                )}
                <div className="flex items-center gap-2">
                    <DeliveryIcon className="h-4 w-4 text-text-muted" />
                    <span className="text-text-muted">{deliveryInfo.label}:</span>
                    <span className="text-text-primary">{deliveryInfo.description}</span>
                </div>
            </div>
        </div>
    );
}

/**
 * Game product specific info
 * Requirements 2.3: Display platform, region restrictions, activation instructions
 */
function GameProductInfo({ product }: { product: Product }) {
    const deliveryInfo = getDeliveryInfo(product);
    const DeliveryIcon = deliveryInfo.icon;

    // Check for region spec
    const regionSpec = product.specs?.find(
        (s) =>
            s.spec_name.toLowerCase().includes("区服") ||
            s.spec_name.toLowerCase().includes("region")
    );

    return (
        <div className="space-y-3 p-4 bg-bg-secondary rounded-lg">
            <h4 className="font-medium text-text-primary flex items-center gap-2">
                <Info className="h-4 w-4" />
                游戏信息
            </h4>
            <div className="space-y-2 text-sm">
                {regionSpec && regionSpec.options && regionSpec.options.length > 0 && (
                    <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-text-muted" />
                        <span className="text-text-muted">可用区服:</span>
                        <span className="text-text-primary">
                            {regionSpec.options.map((o) => o.option_value).join(", ")}
                        </span>
                    </div>
                )}
                <div className="flex items-center gap-2">
                    <DeliveryIcon className="h-4 w-4 text-text-muted" />
                    <span className="text-text-muted">{deliveryInfo.label}:</span>
                    <span className="text-text-primary">{deliveryInfo.description}</span>
                </div>
                <div className="flex items-center gap-2 text-warning">
                    <AlertCircle className="h-4 w-4" />
                    <span>请确认您的账号区服与所选商品一致</span>
                </div>
            </div>
        </div>
    );
}

/**
 * Physical product specific info
 * Requirements 2.4: Display shipping information and estimated delivery time
 */
function PhysicalProductInfo({ product }: { product: Product }) {
    return (
        <div className="space-y-3 p-4 bg-bg-secondary rounded-lg">
            <h4 className="font-medium text-text-primary flex items-center gap-2">
                <Truck className="h-4 w-4" />
                配送信息
            </h4>
            <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-text-muted" />
                    <span className="text-text-muted">预计送达:</span>
                    <span className="text-text-primary">3-7 个工作日</span>
                </div>
                <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-text-muted" />
                    <span className="text-text-muted">配送方式:</span>
                    <span className="text-text-primary">快递配送</span>
                </div>
                <div className="flex items-center gap-2 text-success">
                    <CheckCircle className="h-4 w-4" />
                    <span>支持 7 天无理由退换</span>
                </div>
            </div>
        </div>
    );
}

/**
 * Overseas product specific info
 * Requirements 2.5: Display delivery timeline, tax inclusion status, return policy
 */
function OverseasProductInfo({ product }: { product: Product }) {
    return (
        <div className="space-y-3 p-4 bg-bg-secondary rounded-lg">
            <h4 className="font-medium text-text-primary flex items-center gap-2">
                <Globe className="h-4 w-4" />
                海外代购信息
            </h4>
            <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-text-muted" />
                    <span className="text-text-muted">预计送达:</span>
                    <span className="text-text-primary">7-21 个工作日</span>
                </div>
                <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-text-muted" />
                    <span className="text-text-muted">税费:</span>
                    <span className="text-text-primary">已含税（如有额外税费将提前告知）</span>
                </div>
                <div className="flex items-center gap-2 text-warning">
                    <AlertCircle className="h-4 w-4" />
                    <span>海外代购商品不支持无理由退换，请谨慎下单</span>
                </div>
            </div>
        </div>
    );
}

/**
 * Inventory status display
 * Requirements 2.6: Display availability status
 * null/undefined means unlimited inventory (always in stock)
 */
function InventoryStatus({ product }: { product: Product }) {
    const inventory = product.inventory_count;

    // null or undefined means unlimited inventory - show as "有货"
    if (inventory === undefined || inventory === null) {
        return (
            <Badge variant="success" className="gap-1">
                <CheckCircle className="h-3 w-3" />
                有货
            </Badge>
        );
    }

    if (inventory <= 0) {
        return (
            <Badge variant="destructive" className="gap-1">
                <AlertCircle className="h-3 w-3" />
                暂时缺货
            </Badge>
        );
    }

    if (inventory <= 10) {
        return (
            <Badge variant="warning" className="gap-1">
                <AlertCircle className="h-3 w-3" />
                仅剩 {inventory} 件
            </Badge>
        );
    }

    return (
        <Badge variant="success" className="gap-1">
            <CheckCircle className="h-3 w-3" />
            有货
        </Badge>
    );
}

/**
 * ProductDetail component for displaying full product information
 * Requirements 2.1: Display product name, description, images, price, and platform/type badges
 * Requirements 3.2, 3.3, 3.4: Handle free product display (hide price, show only download button)
 */
export function ProductDetail({
    product,
    onAddToCart,
    onBuyNow,
    onFreeDownload,
    isAddingToCart = false,
    isBuyingNow = false,
    isDownloading = false,
    downloadError = null,
    className,
}: ProductDetailProps) {
    // Initialize spec selection with first option of each spec
    const initialSpecs = useMemo(
        () => getInitialSpecSelection(product.specs),
        [product.specs]
    );
    const [selectedSpecs, setSelectedSpecs] =
        useState<Record<string, string>>(initialSpecs);

    // Get current price based on selected specs
    const currentPrice = useMemo(
        () => getPriceBySpecs(product.prices, selectedSpecs),
        [product.prices, selectedSpecs]
    );

    const lowestPrice = useMemo(
        () => getLowestPrice(product.prices),
        [product.prices]
    );

    // Check if product is free
    // Requirements: 3.2, 3.3, 3.4
    const freeProductCheck = useMemo(
        () => checkFreeProduct(product),
        [product]
    );
    const showPrice = shouldShowPrice(product);
    const showCartOptions = shouldShowCartOptions(product);

    const typeCategory = getProductTypeCategory(product.product_type);
    // null or undefined means unlimited inventory (always in stock)
    // Only show out of stock when inventory_count is explicitly 0 or negative
    const isOutOfStock =
        product.inventory_count !== null &&
        product.inventory_count !== undefined &&
        product.inventory_count <= 0;

    const handleSpecChange = (specName: string, optionValue: string) => {
        setSelectedSpecs((prev) => ({
            ...prev,
            [specName]: optionValue,
        }));
    };

    const handleAddToCart = () => {
        if (onAddToCart && !isOutOfStock) {
            onAddToCart(selectedSpecs);
        }
    };

    const handleBuyNow = () => {
        if (onBuyNow && !isOutOfStock && currentPrice) {
            onBuyNow(selectedSpecs, currentPrice.id);
        }
    };

    const handleFreeDownload = () => {
        if (onFreeDownload) {
            onFreeDownload();
        }
    };

    return (
        <div className={cn("space-y-8", className)}>
            {/* Top Section: Image Gallery + Product Info */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left: Image Gallery */}
                <ProductGallery
                    images={product.images || []}
                    productName={product.name}
                />

                {/* Right: Product Info */}
                <div className="space-y-6">
                    {/* Header: Name, badges, inventory */}
                    <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                            <TypeBadge type={typeCategory} />
                            <InventoryStatus product={product} />
                            {product.has_discount && (
                                <Badge variant="success">优惠中</Badge>
                            )}
                            {freeProductCheck.isFree && (
                                <Badge variant="success">免费</Badge>
                            )}
                            {/* Requirements 3.1, 3.4, 3.5: Display verified badge when is_verified is true */}
                            {product.is_verified && <VerifiedBadge />}
                        </div>

                        <h1 className="text-2xl lg:text-3xl font-bold text-text-primary">
                            {product.name}
                        </h1>

                        {product.subtitle && (
                            <p className="text-lg text-text-muted">{product.subtitle}</p>
                        )}

                        <p className="text-sm text-text-muted">
                            商品编号: {product.product_code}
                        </p>
                    </div>

                    {/* Price - Hidden for free products (Requirements: 3.3) */}
                    {showPrice && (
                        <div className="space-y-1">
                            {currentPrice ? (
                                <ProductPrice price={currentPrice} size="lg" />
                            ) : lowestPrice ? (
                                <div className="flex items-baseline gap-2">
                                    <span className="text-sm text-text-muted">起</span>
                                    <ProductPrice price={lowestPrice} size="lg" />
                                </div>
                            ) : (
                                <span className="text-lg text-text-muted">价格待定</span>
                            )}
                        </div>
                    )}

                    {/* Specs Selection */}
                    {product.specs && product.specs.length > 0 && (
                        <ProductSpecs
                            specs={product.specs}
                            selectedSpecs={selectedSpecs}
                            onSpecChange={handleSpecChange}
                        />
                    )}

                    {/* Action Buttons */}
                    <div className="flex flex-col gap-3">
                        {/* Free Product: Show only download button (Requirements: 3.2) */}
                        {freeProductCheck.isFree && freeProductCheck.isValid ? (
                            <div className="space-y-2">
                                <Button
                                    size="lg"
                                    className="w-full"
                                    onClick={handleFreeDownload}
                                    disabled={isDownloading}
                                >
                                    {isDownloading ? (
                                        <>
                                            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                                            获取下载链接...
                                        </>
                                    ) : (
                                        <>
                                            <Download className="h-5 w-5 mr-2" />
                                            下载
                                        </>
                                    )}
                                </Button>
                                {downloadError && (
                                    <p className="text-sm text-error flex items-center gap-1">
                                        <AlertCircle className="h-4 w-4" />
                                        {downloadError}
                                    </p>
                                )}
                            </div>
                        ) : (
                            /* Paid Product: Show Buy Now and Add to Cart buttons (Requirements: 3.1, 3.4) */
                            showCartOptions && (
                                <div className="flex gap-3">
                                    {/* Buy Now Button - Requirements: 3.1, 3.5 */}
                                    <Button
                                        size="lg"
                                        className="flex-1"
                                        onClick={handleBuyNow}
                                        disabled={isOutOfStock || isBuyingNow || !currentPrice}
                                    >
                                        {isBuyingNow ? (
                                            <>
                                                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                                                处理中...
                                            </>
                                        ) : (
                                            <>
                                                <CreditCard className="h-5 w-5 mr-2" />
                                                {isOutOfStock ? "暂时缺货" : "立即购买"}
                                            </>
                                        )}
                                    </Button>
                                    {/* Add to Cart Button */}
                                    <Button
                                        size="lg"
                                        variant="outline"
                                        className="flex-1"
                                        onClick={handleAddToCart}
                                        disabled={isOutOfStock || isAddingToCart}
                                    >
                                        <ShoppingCart className="h-5 w-5 mr-2" />
                                        {isAddingToCart ? "添加中..." : "加入购物车"}
                                    </Button>
                                </div>
                            )
                        )}
                    </div>

                    {/* Type-specific Info */}
                    <TypeSpecificInfo product={product} />

                    {/* Description */}
                    {product.description && (
                        <div className="space-y-2">
                            <h3 className="font-medium text-text-primary">商品描述</h3>
                            <div className="prose prose-sm text-text-muted max-w-none">
                                {product.description.split("\n").map((paragraph, index) => (
                                    <p key={index}>{paragraph}</p>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom Section: Detail Content - Full width, centered below product info */}
            {/* Requirements 7.1, 7.5, 7.6: Display description section when detail_content exists */}
            {hasValidContent(product.detail_content) && (
                <div className="w-full max-w-4xl mx-auto space-y-4 pt-8 border-t border-border">
                    <h3 className="text-xl font-semibold text-text-primary text-center">详细介绍</h3>
                    <MarkdownRenderer
                        content={product.detail_content!}
                        className="text-text-secondary"
                    />
                </div>
            )}
        </div>
    );
}
