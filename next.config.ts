import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next externalizes the S3 client by default. Under `bun --bun`, Turbopack's
  // hashed external alias can fail to resolve on a cold dev start, so bundle it.
  transpilePackages: ["@aws-sdk/client-s3"],
};

export default nextConfig;
