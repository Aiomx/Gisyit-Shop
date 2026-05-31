import { Link } from "react-router";

interface FooterLink {
    label: string;
    href: string;
}

interface FooterSection {
    title: string;
    links: FooterLink[];
}

const footerSections: FooterSection[] = [
    {
        title: "商店",
        links: [
            { label: "应用", href: "/apps" },
            { label: "游戏", href: "/games" },
            { label: "实物商品", href: "/store" },
            { label: "海外代购", href: "/overseas" },
        ],
    },
    {
        title: "帮助",
        links: [
            { label: "常见问题", href: "/help/faq" },
            { label: "联系我们", href: "/help/contact" },
            { label: "退换货政策", href: "/help/returns" },
        ],
    },
    {
        title: "关于",
        links: [
            { label: "关于我们", href: "/about" },
            { label: "服务条款", href: "/terms" },
            { label: "隐私政策", href: "/privacy" },
        ],
    },
];

/**
 * Footer component
 * Requirements 6.4: Use defined color system
 */
export function Footer() {
    return (
        <footer className="border-t border-border bg-bg-secondary">
            <div className="container mx-auto px-4 py-8">
                {/* Footer links grid */}
                <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
                    {footerSections.map((section) => (
                        <div key={section.title}>
                            <h3 className="mb-4 text-sm font-semibold text-text-primary">
                                {section.title}
                            </h3>
                            <ul className="space-y-2">
                                {section.links.map((link) => (
                                    <li key={link.href}>
                                        <Link
                                            to={link.href}
                                            className="text-sm text-text-secondary hover:text-accent transition-colors"
                                        >
                                            {link.label}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}

                    {/* Newsletter / Contact section */}
                    <div>
                        <h3 className="mb-4 text-sm font-semibold text-text-primary">
                            联系方式
                        </h3>
                        <p className="text-sm text-text-secondary mb-2">
                            客服邮箱：support@gisyit.com
                        </p>
                        <p className="text-sm text-text-secondary">
                            工作时间：周一至周五 9:00-18:00
                        </p>
                    </div>
                </div>

                {/* Bottom bar */}
                <div className="mt-8 border-t border-border pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
                    <p className="text-sm text-text-muted">
                        © {new Date().getFullYear()} Gisyit Shop. All rights reserved.
                    </p>
                    <div className="flex items-center gap-4">
                        <Link
                            to="/terms"
                            className="text-sm text-text-muted hover:text-text-secondary transition-colors"
                        >
                            服务条款
                        </Link>
                        <Link
                            to="/privacy"
                            className="text-sm text-text-muted hover:text-text-secondary transition-colors"
                        >
                            隐私政策
                        </Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}
