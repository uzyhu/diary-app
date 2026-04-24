import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // 사진 업로드 5MB + 폼 필드 여유 (Next.js 기본 1MB는 이미지에 부족)
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
