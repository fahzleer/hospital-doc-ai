/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @app/types ships raw TS — let Next transpile it.
  transpilePackages: ["@app/types"],
};

export default nextConfig;
