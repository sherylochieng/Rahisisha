// sitemap.js — gives Google a list of all public pages
// Next.js generates /sitemap.xml automatically from this file

export default function sitemap() {
  return [
    {
      url: 'https://rahisisha.co.ke',
      // Your home page
      lastModified: new Date(),
      // lastModified — tells Google when this page last changed
      // new Date() = right now — Google will re-crawl it soon
      changeFrequency: 'monthly',
      // How often does this page change?
      // home page changes rarely — monthly is right
      priority: 1.0,
      // Priority 1.0 = most important page on your site
    },
    {
      url: 'https://rahisisha.co.ke/login',
      lastModified: new Date(),
      changeFrequency: 'yearly',
      // Login page almost never changes
      priority: 0.8,
    },
    {
      url: 'https://rahisisha.co.ke/signup',
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.9,
      // Signup is slightly more important than login
      // It's where new customers enter — Google should surface it
    },
  ];
  // Dashboard is NOT in the sitemap — private pages never go here
}