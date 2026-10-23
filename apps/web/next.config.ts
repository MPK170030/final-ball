import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@finalball/agent', '@finalball/db'],
  webpack: (config) => {
    // NodeNext TypeScript imports use .js extensions that resolve to .ts files.
    // Webpack needs this alias so transpilePackages can find the source.
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.js'],
      '.jsx': ['.tsx', '.jsx'],
    }
    return config
  },
}

export default nextConfig
