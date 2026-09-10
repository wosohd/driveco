import type { NextConfig } from "next";

const securityHeaders = [
  {
    key: "X-DNS-Prefetch-Control",
    value: "off",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), accelerometer=(), gyroscope=(), magnetometer=(), usb=(), browsing-topics=()",
  },
  {
    key: "X-Permitted-Cross-Domain-Policies",
    value: "none",
  },
];

const nextConfig: NextConfig = {
  /*
   * Allows testing from another device
   * on the local network during
   * development.
   */
  allowedDevOrigins: [
    "192.168.0.113",
  ],

  /*
   * Avoid advertising the framework
   * through the X-Powered-By header.
   */
  poweredByHeader: false,

  async headers() {
    return [
      /*
       * Security headers applied to
       * the entire DriveCo website.
       */
      {
        source: "/:path*",
        headers: securityHeaders,
      },

      /*
       * Placement pages contain
       * application-specific references
       * and should never be indexed by
       * search engines.
       */
      {
        source:
          "/placement/:path*",

        headers: [
          {
            key: "X-Robots-Tag",
            value:
              "noindex, nofollow, noarchive, nosnippet",
          },
        ],
      },

      /*
       * API endpoints should never
       * appear in search indexes.
       */
      {
        source: "/api/:path*",

        headers: [
          {
            key: "X-Robots-Tag",
            value:
              "noindex, nofollow, noarchive",
          },
        ],
      },
    ];
  },
};

export default nextConfig;