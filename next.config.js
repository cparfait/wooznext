/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  allowedDevOrigins: ['http://localhost:3000', 'http://127.0.0.1:3000'],
};

module.exports = nextConfig;
