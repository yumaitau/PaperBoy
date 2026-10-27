import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // HTML and text each accept 2 MiB of UTF-16 code units. Allow their
      // UTF-8 bytes together, plus multipart metadata and the other fields.
      bodySizeLimit: "16mb",
    },
  },
  // Next externalizes the S3 client by default. Under `bun --bun`, Turbopack's
  // hashed external alias can fail to resolve on a cold dev start, so bundle it.
  transpilePackages: ["@aws-sdk/client-s3"],
};

export default nextConfig;
