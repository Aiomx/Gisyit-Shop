/**
 * CDK Display Component
 *
 * Displays delivered CDK codes with copy-to-clipboard functionality.
 * Only shows codes for paid orders.
 *
 * Requirements: 7.1, 7.2, 7.4
 * - Display delivered codes with "已发货" label
 * - Provide copy-to-clipboard functionality
 * - Hide content for unpaid orders
 */

import { useState } from "react";
import { Card } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Copy, Check, Package } from "lucide-react";
import type { DeliveredCode } from "~/lib/cdk/types";

interface CDKDisplayProps {
    /** Delivered CDK codes to display */
    codes: DeliveredCode[];
    /** Whether the order is paid (codes only visible when true) */
    isPaid: boolean;
}

/**
 * Single CDK code row with copy functionality
 * Requirements: 7.2 - Copy-to-clipboard functionality
 */
function CDKCodeRow({ code }: { code: DeliveredCode }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(code.code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            console.error("Failed to copy:", error);
        }
    };

    return (
        <div className="flex items-center justify-between py-3 border-b border-border last:border-b-0">
            <code className="font-mono text-sm bg-muted px-3 py-1.5 rounded select-all">
                {code.code}
            </code>
            <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="ml-2 h-8 w-8 p-0"
                title={copied ? "已复制" : "复制激活码"}
            >
                {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                ) : (
                    <Copy className="h-4 w-4" />
                )}
            </Button>
        </div>
    );
}

/**
 * CDK Display Component
 * 
 * Requirements: 7.1, 7.2, 7.4
 * - Display delivered codes with "已发货" label (7.1)
 * - Provide copy-to-clipboard functionality (7.2)
 * - Hide content for unpaid orders (7.4)
 */
export function CDKDisplay({ codes, isPaid }: CDKDisplayProps) {
    // Requirements 7.4: Hide content for unpaid orders
    if (!isPaid) {
        return null;
    }

    // No CDK codes to display
    if (!codes || codes.length === 0) {
        return null;
    }

    return (
        <Card className="p-4">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-primary" />
                    <h2 className="font-semibold text-text-primary">激活码</h2>
                </div>
                {/* Requirements 7.1: Display "已发货" label */}
                <Badge variant="default" className="bg-green-500 hover:bg-green-600">
                    已发货
                </Badge>
            </div>
            <div className="divide-y divide-border">
                {codes.map((code) => (
                    <CDKCodeRow key={code.id} code={code} />
                ))}
            </div>
            {codes.length > 1 && (
                <CopyAllButton codes={codes} />
            )}
        </Card>
    );
}

/**
 * Copy all codes button for multiple codes
 */
function CopyAllButton({ codes }: { codes: DeliveredCode[] }) {
    const [copied, setCopied] = useState(false);

    const handleCopyAll = async () => {
        try {
            const allCodes = codes.map((c) => c.code).join("\n");
            await navigator.clipboard.writeText(allCodes);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            console.error("Failed to copy all:", error);
        }
    };

    return (
        <div className="mt-4 pt-4 border-t border-border">
            <Button
                variant="outline"
                size="sm"
                onClick={handleCopyAll}
                className="w-full"
            >
                {copied ? (
                    <>
                        <Check className="h-4 w-4 mr-2 text-green-500" />
                        已复制全部
                    </>
                ) : (
                    <>
                        <Copy className="h-4 w-4 mr-2" />
                        复制全部激活码
                    </>
                )}
            </Button>
        </div>
    );
}

/**
 * Utility function to check if order status indicates paid
 * Used for determining CDK visibility
 */
export function isOrderPaid(status: string): boolean {
    const paidStatuses = ["paid", "fulfilled", "completed"];
    return paidStatuses.includes(status);
}
