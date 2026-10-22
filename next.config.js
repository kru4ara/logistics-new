/** @type {import('next').NextConfig} */
eslint: {
  ignoreDuringBuilds: true,
}

const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
    optimizePackageImports: ['lucide-react', 'docx', 'qrcode', 'image-size'],
  },
};

module.exports = nextConfig;
