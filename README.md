# 🏪 Gisyit Shop — Comprehensive E-Commerce Platform

A highly polished, modern, enterprise-ready full-stack e-commerce store built on **React Router v7** and **Vite**, powered by **Supabase** backend services and **Stripe** payment processing. 

Designed for high-performance and fluid UX, **Gisyit Shop** supports multiple product delivery channels (Downloads, license keys, physical shipping, etc.) and caters to five major departments: Applications (Software), Games, Physical Goods, Overseas Agent Purchases, and AI Services.

---

## 🚀 Key Features

- **🌐 Omnichannel Digital & Physical Storefront**: Optimized directory modules across 5 major business sections:
  - **Apps Section**: Software, utilities, and design assets (with digital download or license key delivery).
  - **Games Section**: Game CDs, gift cards, and CDK keys (with automated digital CDK fulfillment).
  - **Physical Store**: Standard merchandise with logistics shipping/delivery options.
  - **Overseas purchasing**: Agent-buying and logistics integration from global regions.
  - **AI Section**: Curated directory and integration of modern AI tools.
- **🛣️ Advanced Slug-Based Dynamic Routing**: Complete SEO optimization with unique slug-based product routing (`/product/:slug`), category filtering (`/:section/:category`), and brand paths (`/brands/:slug`).
- **💳 Fully Idempotent Stripe Checkout**:
  - Secure integration with Stripe checkout sessions supporting global cards & digital wallets.
  - State-of-the-art Stripe Webhook implementation featuring robust deduplication and idempotency verification via a custom `StripeEvent` log database.
  - Strict 15-minute checkout payment window before automatic reservation timeout & cart rollback.
- **� Dynamic Shopping Cart Sync**: State-preserved guest cart sessions that seamlessly sync with registered accounts upon user login.
- **📦 Multi-Channel Fulfillment & Delivery Engines**:
  - **Secure Downloads**: Encrypted, purchase-state validated file downloads handled via `/api/download/:fileId`.
  - **License/CDK Delivery**: Instant and automatic keys/licenses fulfillment.
  - **Standard Physical Shipment**: End-to-end logistic delivery tracking for physical & agent products.
- **� Secure Authentication & Dashboards**: Full session and profile administration powered by Supabase Auth with custom client profiles, orders summary, order details, and digital file download logs.
- **⚡ Advanced Frontend Experience**: Styled with **Tailwind CSS v4** and fluid custom components, paired with rich animations via **Framer Motion (`motion`)**, Radix UI primitives, Lucide Icons, and Tabler Icons.

---

## �️ Technology Stack

| Layer | Technology | Details |
| :--- | :--- | :--- |
| **Framework** | [React Router v7](https://reactrouter.com/) | Production-ready full-stack routing, data loaders, and state management |
| **Frontend UI** | [Tailwind CSS v4](https://tailwindcss.com/) & [Motion](https://motion.dev/) | Utility-first styling with hardware-accelerated animations |
| **Backend / DB** | [Supabase](https://supabase.com/) | PostgreSQL, Supabase Auth, Storage Buckets, and SQL Migrations |
| **Payments** | [Stripe SDK](https://stripe.com/) | Global checkout pipelines with secured webhook listeners |
| **Testing** | [Vitest](https://vitest.dev/) & [fast-check](https://github.com/dubzzz/fast-check) | Unit/integration suite alongside property-based testing |
| **Development** | [Vite](https://vite.dev/) & [TypeScript](https://www.typescriptlang.org/) | Next-generation frontend tooling and type safety |

---

## 📁 Repository Structure

The project has a highly modular domain-driven architecture under `app/lib/`:

```
store-frontend/
├── app/
│   ├── components/         # Reusable presentation & layout UI components
│   ├── hooks/              # Custom React hooks (state, interactions, theme)
│   ├── routes/             # Route loaders, actions, and page components
│   ├── routes.ts           # Central routing table (slugs, sections, auth, APIs)
│   ├── lib/                # Core domain and service logic
│   │   ├── ai/             # AI tools, formatting and sanitization (with tests)
│   │   ├── auth/           # Login, registration, cookies, and session handlers
│   │   ├── brand/          # Brands data fetching & slug resolution
│   │   ├── cache/          # In-memory and session caching layers
│   │   ├── cart/           # Shopping cart states, mutations, and database sync
│   │   ├── cdk/            # CDK/license generation and validation
│   │   ├── checkout/       # Checkout pipeline and payment validation
│   │   ├── download/       # Secure file download controllers and authorization
│   │   ├── order/          # Order generation, management, and status state machines
│   │   ├── product/        # Catalog, category, and pricing queries
│   │   ├── search/         # Indexing and search logic
│   │   ├── sections/       # Section directory configuration
│   │   ├── slug/           # SEO slug generation and router matching
│   │   ├── stripe/         # Stripe payments and secure webhook receivers
│   │   ├── supabase/       # Supabase client singleton & MCP interfaces
│   │   └── theme/          # Custom theme presets
│   └── root.tsx            # Global application entry, providers, and layout wrapper
├── components.json         # shadcn/ui configuration
├── supabase/
│   ├── functions/          # Supabase Edge Functions (automated logic)
│   ├── migrations/         # PostgreSQL schema tables, indexes, and triggers
│   └── seed/               # SQL seeds for development data
├── Dockerfile              # Production-ready multi-stage Docker build config
├── vite.config.ts          # Vite bundler, path aliases, and Tailwind compilation
└── tsconfig.json           # Global compiler configuration
```

---

## ⚙️ Getting Started

### Prerequisites

- **Node.js** v20 or higher
- **npm** (v10+)
- **Docker** (Optional, for containerized deployments)

### 1. Installation

Clone the repository and install dependencies:

```bash
npm install
```

### 2. Environment Configuration

Create a `.env` file in the root directory and configure the following variables:

```ini
# Supabase Configuration
SUPABASE_URL=https://your-supabase-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anonymous-key

# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# AI Models & Services (Optional)
DEEPSEEK_API_KEY=your-deepseek-api-key

# Application Settings
NODE_ENV=development
```

### 3. Database Setups (Supabase)

If you're deploying a custom instance of Supabase:
1. Ensure the PostgreSQL schema migrations inside `supabase/migrations` are applied to your database.
2. Load any required seed records from `supabase/seed` to populate categories, brands, and preliminary items.

### 4. Running the Development Server

Start Vite's local dev server with HMR:

```bash
npm run dev
```

The application will run locally at **`http://localhost:5173`**.

---

## 🧪 Testing

The codebase includes comprehensive unit, integration, and property-based tests.

### Run tests

```bash
npm run test
```

### Run tests in Watch Mode

```bash
npm run test:watch
```

### Check Test Coverage

```bash
npm run test:coverage
```

We leverage **`fast-check`** in tandem with **Vitest** to perform property-based robustness verification across critical business logic, specifically within sanitization and validation modules.

---

## 🐳 Production Build & Deployment

### Manual Production Build

Create optimized client-side and server-side production bundles:

```bash
npm run build
```

This generates output under the `build/` folder:
- `build/client/`: Static browser assets.
- `build/server/`: Node.js server-side production build.

Start the production Node server:

```bash
npm run start
```

By default, the server runs on port **`3000`**.

### Docker Deployment

A multi-stage `Dockerfile` is provided for containerized staging or production environments (ECS, Cloud Run, Fly.io, etc.).

Build the container image:

```bash
docker build -t gisyit-shop .
```

Run the container locally:

```bash
docker run -p 3000:3000 --env-file .env gisyit-shop
```

---

Built with ❤️ by the Gisyit Shop Team.

