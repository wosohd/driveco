import type {
  NextConfig,
} from "next";

/* ---------------------------------------
   Environment / Origins
--------------------------------------- */

const isProduction =
  process.env.NODE_ENV ===
  "production";

function getOrigin(
  value:
    string | undefined,
) {
  if (!value) {
    return null;
  }

  try {
    return new URL(
      value,
    ).origin;
  } catch {
    return null;
  }
}

const supabaseOrigin =
  getOrigin(
    process.env
      .NEXT_PUBLIC_SUPABASE_URL,
  );

/* ---------------------------------------
   Content Security Policy
--------------------------------------- */

const scriptSources = [
  "'self'",
  "'unsafe-inline'",
  "https://challenges.cloudflare.com",
];

/*
 * Turbopack / development tooling may
 * require eval-style JavaScript locally.
 * This is NOT permitted in production.
 */
if (!isProduction) {
  scriptSources.push(
    "'unsafe-eval'",
  );
}

const connectSources = [
  "'self'",
  "https://challenges.cloudflare.com",
];

if (supabaseOrigin) {
  connectSources.push(
    supabaseOrigin,
  );
}

const contentSecurityPolicy = [
  "default-src 'self'",

  "base-uri 'self'",

  "object-src 'none'",

  "frame-ancestors 'none'",

  "form-action 'self'",

  `script-src ${scriptSources.join(
    " ",
  )}`,

  /*
   * Next.js and the Turnstile container
   * currently require inline styles.
   */
  "style-src 'self' 'unsafe-inline'",

  "img-src 'self' data: blob:",

  "font-src 'self' data:",

  `connect-src ${connectSources.join(
    " ",
  )}`,

  "frame-src https://challenges.cloudflare.com",

  "worker-src 'self' blob:",

  "media-src 'self'",

  "manifest-src 'self'",
]
  .join("; ")
  .replace(
    /\s{2,}/g,
    " ",
  )
  .trim();

/* ---------------------------------------
   Global Security Headers
--------------------------------------- */

const securityHeaders: {
  key: string;
  value: string;
}[] = [
  {
    key:
      "X-DNS-Prefetch-Control",

    value:
      "off",
  },

  {
    key:
      "Strict-Transport-Security",

    value:
      "max-age=31536000",
  },

  {
    key:
      "X-Frame-Options",

    value:
      "DENY",
  },

  {
    key:
      "X-Content-Type-Options",

    value:
      "nosniff",
  },

  {
    key:
      "Referrer-Policy",

    value:
      "strict-origin-when-cross-origin",
  },

  {
    key:
      "Permissions-Policy",

    value:
      "camera=(), microphone=(), geolocation=(), accelerometer=(), gyroscope=(), magnetometer=(), usb=(), browsing-topics=()",
  },

  {
    key:
      "X-Permitted-Cross-Domain-Policies",

    value:
      "none",
  },
];

/*
 * Apply CSP only to production-mode
 * builds.
 *
 * This keeps Next.js/Turbopack local
 * development tooling from being
 * unnecessarily restricted.
 */
if (isProduction) {
  securityHeaders.push({
    key:
      "Content-Security-Policy",

    value:
      contentSecurityPolicy,
  });
}

/* ---------------------------------------
   Next.js Configuration
--------------------------------------- */

const nextConfig:
  NextConfig = {
  /*
   * Allows DriveCo development from
   * another device on the local LAN.
   */
  allowedDevOrigins: [
    "192.168.0.113",
  ],

  /*
   * Do not advertise Next.js through
   * X-Powered-By.
   */
  poweredByHeader:
    false,

  async headers() {
    return [
      /* ---------------------------------
         Entire website
      --------------------------------- */

      {
        source:
          "/:path*",

        headers:
          securityHeaders,
      },

      /* ---------------------------------
         Application-specific placement
         pages

         Never index and never cache.
      --------------------------------- */

      {
        source:
          "/placement/:path*",

        headers: [
          {
            key:
              "X-Robots-Tag",

            value:
              "noindex, nofollow, noarchive, nosnippet",
          },

          {
            key:
              "Cache-Control",

            value:
              "private, no-store, max-age=0, must-revalidate",
          },

          {
            key:
              "Pragma",

            value:
              "no-cache",
          },
        ],
      },

      /* ---------------------------------
         API endpoints

         API responses should neither be
         indexed nor cached.
      --------------------------------- */

      {
        source:
          "/api/:path*",

        headers: [
          {
            key:
              "X-Robots-Tag",

            value:
              "noindex, nofollow, noarchive",
          },

          {
            key:
              "Cache-Control",

            value:
              "no-store, max-age=0",
          },
        ],
      },
    ];
  },
};

export default nextConfig;