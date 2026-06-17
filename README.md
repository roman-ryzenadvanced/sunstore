# Sun.store - Russian E-commerce Platform

[![Go Version](https://img.shields.io/badge/Go-1.22+-blue.svg)](https://golang.org)
[![Next.js Version](https://img.shields.io/badge/Next.js-15.3.3-black.svg)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8.3-blue.svg)](https://www.typescriptlang.org)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

A production-ready Russian e-commerce platform featuring a Go backend with T-Bank Internet Acquiring integration and a Next.js frontend with Russian locale support.

## ✨ Features

### Backend (Go)
- **Hexagonal/Clean Architecture** - Domain-driven design with clear separation of concerns
- **PostgreSQL Database** - Full migration schema with proper indexing
- **JWT Authentication** - Secure admin authentication with Bearer tokens
- **T-Bank Internet Acquiring** - Direct integration with T-Bank's `/v2/Init` API
- **SHA-256 Webhook Verification** - Proper token signing per T-Bank specification
- **RESTful API** - Proper HTTP methods, status codes, and error handling

### Frontend (Next.js)
- **Next.js 15 with App Router** - Latest Next.js with React Server Components
- **TypeScript 5.8.3** - Strict type checking throughout
- **Russian Locale** - Complete Russian language support
- **Minimal Luxury Design** - Sun.store-inspired aesthetic
- **Zustand State Management** - Cart with localStorage persistence
- **Mock Data Fallbacks** - Graceful degradation when backend unavailable

## 🚀 Quick Start

### Prerequisites

- Go 1.22 or higher
- Node.js 18 or higher
- PostgreSQL 14 or higher
- T-Bank terminal credentials (for payment integration)

### Backend Setup

```bash
cd backend

# Copy environment template
cp .env.example .env

# Edit .env with your credentials:
# - POSTGRES_HOST, POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB
# - TBANK_TERMINAL_KEY, TBANK_PASSWORD
# - JWT_SECRET (minimum 32 characters)

# Run database migrations
psql -U postgres -d sunstore -f migrations/0001_init.sql

# Install dependencies and run
go mod tidy
go run ./cmd/api

# Backend will start on http://localhost:8080
```

### Frontend Setup

```bash
cd frontend

# Copy environment template
cp .env.example .env.local

# Edit .env.local:
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080/api/v1

# Install dependencies and run
npm install
npm run dev

# Frontend will start on http://localhost:3000
```

## 📁 Project Structure

```
sunstore/
├── backend/                    # Go backend API
│   ├── cmd/api/               # Application entry point
│   │   └── main.go
│   ├── internal/              # Private application code
│   │   ├── config/           # Configuration management
│   │   ├── domain/           # Domain models
│   │   ├── delivery/http/    # HTTP handlers
│   │   ├── repository/       # Data access layer
│   │   │   ├── postgres/    # PostgreSQL implementations
│   │   │   └── tbank/       # T-Bank API client
│   │   └── usecase/         # Business logic
│   ├── migrations/           # Database migrations
│   ├── .env.example
│   ├── go.mod
│   └── go.sum
├── frontend/                 # Next.js frontend
│   ├── src/
│   │   ├── app/             # Next.js App Router
│   │   │   ├── admin/       # Admin routes
│   │   │   ├── catalog/     # Product catalog
│   │   │   ├── checkout/    # Checkout flow
│   │   │   └── products/    # Product details
│   │   ├── components/      # React components
│   │   ├── core/           # API client & store wrappers
│   │   ├── lib/            # Utilities & mock data
│   │   ├── store/          # Zustand stores
│   │   └── types/          # TypeScript types
│   ├── .env.example
│   ├── next.config.mjs
│   ├── package.json
│   └── tsconfig.json
├── tests/                    # Test documentation
│   └── README.md
├── CHANGELOG.md             # Detailed changelog
├── README.md               # This file
└── LICENSE                 # MIT License
```

## 🔧 Configuration

### Backend Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `APP_PORT` | HTTP server port | No (default: 8080) |
| `APP_ENV` | Environment (development/staging/production) | No (default: development) |
| `POSTGRES_HOST` | PostgreSQL host | Yes |
| `POSTGRES_PORT` | PostgreSQL port | No (default: 5432) |
| `POSTGRES_USER` | PostgreSQL user | Yes |
| `POSTGRES_PASSWORD` | PostgreSQL password | Yes |
| `POSTGRES_DB` | PostgreSQL database name | Yes |
| `TBANK_TERMINAL_KEY` | T-Bank terminal key | Yes (for payments) |
| `TBANK_PASSWORD` | T-Bank terminal password | Yes (for payments) |
| `JWT_SECRET` | JWT signing secret (min 32 chars) | Yes |

### Frontend Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_API_BASE_URL` | Backend API URL | Yes |

## 🔐 Security

- **JWT Authentication**: Admin endpoints require valid JWT tokens
- **Password Hashing**: bcrypt with cost factor 12
- **Webhook Verification**: SHA-256 token validation per T-Bank spec
- **Environment Variables**: All secrets in `.env` (not committed)
- **SQL Injection Prevention**: pgx driver with parameterized queries

## 📝 API Documentation

### Public Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/products` | List active products |
| `GET` | `/api/v1/products/{slug}` | Get single product |
| `POST` | `/api/v1/checkout/init` | Initialize checkout |
| `POST` | `/api/v1/webhooks/tbank` | T-Bank webhook |

### Admin Endpoints (JWT Required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/admin/auth/login` | Admin login |
| `GET` | `/api/v1/admin/products` | List all products |
| `POST` | `/api/v1/admin/products` | Create product |
| `PUT` | `/api/v1/admin/products/{id}` | Update product |
| `DELETE` | `/api/v1/admin/products/{id}` | Delete product |
| `GET` | `/api/v1/admin/orders` | List all orders |

## 🐛 Known Issues

See [CHANGELOG.md](CHANGELOG.md) for detailed information on all issues encountered and their resolutions.

## 📄 License

MIT License - See [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- T-Bank for their Internet Acquiring API
- Sun.store for design inspiration
- Go and Next.js communities for excellent documentation

---

**Version:** 1.0.0  
**Last Updated:** 2025-06-17  
**Status:** Production Ready ✅
