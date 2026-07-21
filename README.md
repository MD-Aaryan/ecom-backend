# E-Commerce Backend API

NestJS e-commerce backend with Prisma ORM, PostgreSQL, JWT authentication, and comprehensive module architecture.

## Tech Stack

- **Runtime:** Node.js
- **Framework:** NestJS 11
- **ORM:** Prisma 6 + PostgreSQL
- **Auth:** JWT (passport-jwt) + OTP
- **Validation:** class-validator + class-transformer
- **API Docs:** Swagger
- **Security:** Helmet, CORS, Throttler
- **File Upload:** Cloudinary

## Prerequisites

- Node.js >= 18
- PostgreSQL
- Cloudinary account (for image upload)

## Setup

```bash
# 1. Clone and install
npm install

# 2. Copy environment variables
cp .env.example .env

# 3. Edit .env with your credentials:
#    DATABASE_URL, JWT_SECRET, ADMIN_EMAIL/PASSWORD, CLOUDINARY_*

# 4. Run database migration
npx prisma migrate dev

# 5. (Optional) Seed sample data
npx prisma db seed

# 6. Start development server
npm run start:dev
```

## Running

```bash
# Development
npm run start:dev

# Production build
npm run build && npm run start:prod
```

## API Documentation

Swagger UI available at `/api/docs` after starting the server.

## Modules

| Module | Description |
|--------|-------------|
| Auth | Register, login, OTP verification, refresh token, admin login |
| User | Profile CRUD, role management, admin user list |
| Category | Category CRUD with soft-delete |
| Subcategory | Subcategory CRUD with soft-delete |
| Product | Product CRUD, variants, search/filter, Cloudinary upload |
| Review | Product reviews (delivered-order gate) |
| Wishlist | Add/remove/clear wishlist items |
| Cart | Auto-create cart, add/update/remove items, stock validation |
| Coupon | Coupon CRUD, validation with discount calculation |
| Order | Place order (transactional), cancel, track, admin status update |
| Return | Return request within 7-day window |
| Admin | Dashboard stats, revenue, top products, low stock alerts |
| Newsletter | Subscribe/unsubscribe, admin subscriber list |
| Audit Log | Action logging with admin query interface |
| Support | Ticket CRUD, replies, assign, priority |
| Webhook | Webhook registration, HMAC dispatch with retry |
| Health | Basic + detailed health check (DB ping) |
| Notifications | Email stub (placeholder) |

## Project Structure

```
src/
├── auth/           # Authentication module
├── user/           # User management
├── product/        # Product & variant management
├── category/       # Category management
├── subcategory/    # Subcategory management
├── cart/           # Shopping cart
├── order/          # Order processing
├── review/         # Product reviews
├── wishlist/       # Wishlist
├── coupon/         # Discount coupons
├── return/         # Return requests
├── admin/          # Admin dashboard
├── newsletter/     # Newsletter subscriptions
├── support/        # Support tickets
├── webhooks/       # Webhook dispatch
├── audit-log/      # Audit trail
├── health/         # Health endpoints
├── notifications/  # Notification stubs
├── cloudinary/     # File upload provider
├── common/         # Shared guards, helpers
└── prisma/         # Prisma service
```

## Environment Variables

See `.env.example` for all required variables. Key ones:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | JWT signing secret |
| `ADMIN_EMAIL` | Admin login email |
| `ADMIN_PASSWORD` | Admin login password |
| `CORS_ORIGIN` | Allowed CORS origin (required for production) |
| `CLOUDINARY_*` | Cloudinary credentials (for image upload) |

## Rate Limiting

Global: **100 requests per 60 seconds** per IP.
