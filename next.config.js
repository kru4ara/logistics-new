/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
    optimizePackageImports: ['lucide-react', 'docx', 'qrcode', 'image-size'],
  },
};

let config = nextConfig;

// Подключаем bundle-analyzer только если он установлен и запрошен
if (process.env.ANALYZE === 'true') {
  try {
    const withBundleAnalyzer = require('@next/bundle-analyzer')({
      enabled: true,
    });
    config = withBundleAnalyzer(nextConfig);
  } catch (e) {
    console.warn('[next.config] @next/bundle-analyzer not found, skipping analysis');
  }
}

module.exports = config;
