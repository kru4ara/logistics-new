/** @type {import('next').NextConfig} */
// Хост Supabase-проекта известен на этапе сборки (NEXT_PUBLIC_* доступен).
// Фолбэк — любой https-хост: проект может быть переименован или переехать.
const supabaseHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname;
  } catch {
    return '**';
  }
})();

const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'flagcdn.com' },
      { protocol: 'https', hostname: supabaseHost },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
    optimizePackageImports: ['lucide-react', 'docx', 'qrcode', 'image-size'],
  },
};

module.exports = nextConfig;
