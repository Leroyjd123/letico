/** @type {import('next').NextConfig} */
const nextConfig = {
  // Transpile shared packages from the monorepo
  transpilePackages: ['@lectio/types'],
};

export default nextConfig;
