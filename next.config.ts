import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['pdf-parse', '@prisma/client', 'bullmq', 'ioredis'],
  turbopack: {},
}

export default nextConfig
