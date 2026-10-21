import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@finalball/agent', '@finalball/db'],
}

export default nextConfig
