import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  rewrites: async () => {
    return {
      beforeFiles: [
        // Forward API requests to the backend
        // /api/v1/* -> http://localhost:3001/api/v1/*
        // /api/auth/* -> http://localhost:3001/api/v1/auth/*
        {
          source: '/api/v1/:path*',
          destination: `${process.env.API_BACKEND_URL || 'http://localhost:3001'}/api/v1/:path*`,
        },
        // Special handling for auth endpoints (also route to /api/v1/auth/*)
        {
          source: '/api/auth/:path*',
          destination: `${process.env.API_BACKEND_URL || 'http://localhost:3001'}/api/v1/auth/:path*`,
        },
      ],
    };
  },
};

export default nextConfig;

