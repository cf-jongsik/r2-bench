# R2 Benchmark

A web application for benchmarking different upload methods to Cloudflare R2 storage across multiple geographic regions.

## Overview

This application provides a real-time comparison of three different upload strategies to Cloudflare R2:

- **Presigned URLs** - Client-side direct upload using AWS-compatible presigned URLs
- **Direct Binding** - Server-side upload using Cloudflare Workers R2 bindings
- **Multipart Upload** - Server-side multipart upload for large files

Test uploads across four regional buckets:

- Eastern Europe (eeur)
- Western Europe (weur)
- Western North America (wnam)
- Asia Pacific (apac)

## Tech Stack

- **Framework**: [React Router 7](https://reactrouter.com/) with SSR
- **Runtime**: [Cloudflare Workers](https://workers.cloudflare.com/)
- **Storage**: [Cloudflare R2](https://www.cloudflare.com/products/r2/)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/)
- **Package Manager**: [pnpm](https://pnpm.io/)
- **Language**: TypeScript

## Prerequisites

- Node.js 18+
- pnpm 10+
- Cloudflare account with R2 enabled
- Wrangler CLI

## Setup

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd r2-bench
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Configure environment**

   Copy the example configuration and update with your settings:

   ```bash
   cp wrangler.jsonc.example wrangler.jsonc
   ```

   Then edit `wrangler.jsonc` with your Cloudflare credentials, R2 bucket names, and custom domain.

4. **Configure R2 buckets**

   The `wrangler.jsonc` file is configured with four regional buckets. You need to:
   - Create the R2 buckets in your Cloudflare dashboard (eeur, weur, wnam, apac)
   - Update the bucket names in `wrangler.jsonc`
   - Update your Cloudflare Account ID in the `vars` section
   - Set your custom domain in the `route.pattern` field
   - Set R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY as secrets via Wrangler CLI

## Development

Start the development server:

```bash
pnpm dev
```

The app will be available at `http://localhost:5173`

## Building

Build the application for production:

```bash
pnpm build
```

## Deployment

Deploy to Cloudflare Workers:

```bash
pnpm deploy
```

This will:

1. Build the application
2. Deploy to Cloudflare Workers
3. Make it available at your configured custom domain

## Project Structure

```
r2-bench/
├── app/
│   ├── lib/              # Utility libraries
│   │   ├── errors.ts     # Error handling utilities
│   │   ├── upload-utils.ts # Upload helper functions
│   │   └── validation.ts # Input validation
│   ├── routes/           # Route handlers
│   │   ├── api/          # API endpoints for upload methods
│   │   │   ├── config/         # Configuration endpoint
│   │   │   ├── getPreSignedUrl/# Presigned URL generation
│   │   │   ├── uploadUsingBinding/ # Direct binding upload
│   │   │   └── uploadUsingMultiPart/ # Multipart upload
│   │   └── home.tsx      # Main page
│   ├── uploader/         # Upload components
│   │   ├── binding/      # Direct binding upload
│   │   ├── multipart/    # Multipart upload
│   │   ├── presigned/    # Presigned URL upload
│   │   └── uploader.tsx  # Main uploader component
│   ├── entry.server.tsx  # Server entry point
│   ├── root.tsx          # Root component
│   ├── routes.ts         # Route definitions
│   ├── types.d.ts        # TypeScript type definitions
│   └── utils.ts          # General utilities
├── workers/              # Cloudflare Workers code
│   └── app.ts            # Worker entry point
├── wrangler.jsonc.example # Example Wrangler configuration
├── react-router.config.ts # React Router configuration
└── vite.config.ts        # Vite build configuration
```

## Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm deploy` - Build and deploy to Cloudflare
- `pnpm typecheck` - Run TypeScript type checking
- `pnpm preview` - Preview production build locally

## Upload Methods

### Presigned URLs

Generates a presigned URL for direct client-to-R2 uploads. Best for browser-based uploads without proxying through your server.

### Direct Binding

Uploads files through your Cloudflare Worker using R2 bindings. Useful when you need server-side control over uploads.

### Multipart Upload

Uses multipart upload for handling large files efficiently. Allows for resumable uploads and better handling of network issues.

## Configuration

Key configuration files:

- **wrangler.jsonc** - Cloudflare Workers and R2 bucket configuration
- **react-router.config.ts** - React Router SSR settings
- **vite.config.ts** - Build configuration

## License

Private project

## Notes

This is a benchmarking tool for comparing upload performance to Cloudflare R2 across different methods and regions. Results may vary based on:

- Network conditions
- File size
- Geographic location
- Server load
