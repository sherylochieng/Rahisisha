// robots.js — tells search engines what to crawl
// Next.js generates /robots.txt automatically from this file

export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        // userAgent '*' means: applies to ALL search engines (Google, Bing, etc.)

        allow: [
          '/',          // home page — public, index it
          '/login',     // login page — public, index it
          '/signup',    // signup page — public, index it
        ],

        disallow: [
          '/dashboard', // private — never show in search results
          '/api/',      // API routes — never index these
        ],
      },
    ],
    sitemap: 'https://rahisisha.co.ke/sitemap.xml',
    // Tells Google where to find your sitemap
    // For local development this doesn't matter — it's for when you deploy
  };
}