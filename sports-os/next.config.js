/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Keep file tracing scoped to this Next.js application. The app lives in
  // sports-os/ inside a larger repository with separate static-site files.
  outputFileTracingRoot: __dirname,

  // Termux/Android: avoid Watchpack traversing protected OS and dependency
  // directories. Do not ignore /data/** globally: the project itself lives
  // under /data/data/com.termux/files/home.
  webpack(config) {
    const currentIgnored = config.watchOptions?.ignored;
    const inheritedIgnored = Array.isArray(currentIgnored)
      ? currentIgnored
      : currentIgnored
        ? [currentIgnored]
        : [];

    // Next.js/webpack may provide an empty inherited pattern. Webpack rejects
    // empty strings in watchOptions.ignored, so retain only valid non-empty
    // string globs before adding the Termux exclusions.
    const ignored = inheritedIgnored.filter(
      (pattern) => typeof pattern === "string" && pattern.trim().length > 0
    );

    config.watchOptions = {
      ...config.watchOptions,
      ignored: [
        ...ignored,
        "**/node_modules/**",
        "**/.git/**",
        "**/.next/**",
        "/proc/**",
        "/sys/**",
        "/dev/**",
        "/data/data/com.termux/cache/**",
        "/data/data/com.termux/files/usr/**",
      ],
    };

    return config;
  },
};

module.exports = nextConfig;
