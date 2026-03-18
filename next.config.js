/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    instrumentationHook: true,
    serverComponentsExternalPackages: ['pino', 'pino-pretty', 'puppeteer', 'sharp', 'pdf-lib'],
  },
  webpack: (config) => {
    // pdfjs-dist uses canvas module (optional, for Node.js) — exclude from client bundles
    config.resolve.alias.canvas = false
    return config
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
