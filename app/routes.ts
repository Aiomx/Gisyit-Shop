import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
    index("routes/home.tsx"),
    // Apps section routes
    route("apps", "routes/apps._index.tsx"),
    route("apps/:category", "routes/apps.$category.tsx"),
    // Games section routes
    route("games", "routes/games._index.tsx"),
    route("games/:category", "routes/games.$category.tsx"),
    // Store (physical products) section routes
    route("store", "routes/store._index.tsx"),
    route("store/:category", "routes/store.$category.tsx"),
    // Overseas section routes
    route("overseas", "routes/overseas._index.tsx"),
    route("overseas/:region", "routes/overseas.$region.tsx"),
    // AI section routes
    route("ai", "routes/ai._index.tsx"),
    route("ai/:category", "routes/ai.$category.tsx"),
    // Brand routes (Requirements 3.1, 3.2, 3.3, 3.4)
    route("brands", "routes/brands._index.tsx"),
    route("brands/:slug", "routes/brands.$slug.tsx"),
    // Product detail route (Requirements 2.1, 2.2 - Slug URL routing)
    route("product/:slug", "routes/product.$slug.tsx"),
    // Cart route
    route("cart", "routes/cart.tsx"),
    // Cart API route
    route("api/cart", "routes/api.cart.ts"),
    // Checkout routes
    route("checkout", "routes/checkout.tsx"),
    route("checkout/success", "routes/checkout.success.tsx"),
    route("checkout/return", "routes/checkout.return.tsx"),
    // Checkout API route
    route("api/checkout", "routes/api.checkout.ts"),
    // Search route
    route("search", "routes/search.tsx"),
    // Auth routes
    route("auth/login", "routes/auth.login.tsx"),
    route("auth/register", "routes/auth.register.tsx"),
    route("auth/logout", "routes/auth.logout.tsx"),
    // Account routes
    route("account", "routes/account._index.tsx"),
    route("account/profile", "routes/account.profile.tsx"),
    route("account/orders", "routes/account.orders.tsx"),
    route("account/orders/:id", "routes/account.orders.$id.tsx"),
    // Webhook API route
    route("api/webhook/stripe", "routes/api.webhook.stripe.ts"),
    // Download API route
    route("api/download/:fileId", "routes/api.download.$fileId.ts"),
] satisfies RouteConfig;
