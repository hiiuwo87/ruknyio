import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
  rewrites: async () => {
    return {
      beforeFiles: [
        // Forward API requests to the backend
        // /api/v1/* -> http://localhost:3001/api/v1/*
        {
          source: '/api/v1/:path*',
          destination: `${process.env.API_BACKEND_URL || 'http://localhost:3001'}/api/v1/:path*`,
        },
        // Note: /api/auth/* is handled by Route Handler (app/api/auth/[...path]/route.ts)
        // for reliable Set-Cookie header forwarding across subdomains
      ],
    };
  },
};

export default nextConfig;

