/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
    optimizePackageImports: ['lucide-react', 'recharts', 'docx', 'qrcode', 'image-size'],
  },
};

module.exports = nextConfig;
