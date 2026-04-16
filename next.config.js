/** @type {import('next').NextConfig} */

const nextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  outputFileTracingRoot: require('path').join(__dirname),
  allowedDevOrigins: [`http://localhost:${process.env.PORT || 3002}`, `http://127.0.0.1:${process.env.PORT || 3002}`],
  async headers() {
    return [
      {
        source: '/sounds/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/api/logo',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=300' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
