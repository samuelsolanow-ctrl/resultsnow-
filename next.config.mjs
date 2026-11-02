/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  // ao voltar para uma página, busca a versão nova (não usa cópia guardada no celular)
  experimental: { staleTimes: { dynamic: 0, static: 30 } },
};

export default nextConfig;
