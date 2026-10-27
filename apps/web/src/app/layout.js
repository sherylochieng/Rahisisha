import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
// Next.js has a built-in Google Fonts system
// It downloads fonts at BUILD time and serves them from your own server
// No external request at runtime — faster, no privacy issue, no GDPR concern
// This is the correct Next.js way — never use a <link> tag for fonts

import './globals.css';

// Inter — clean, readable, used by Linear, Vercel, Notion
// Perfect for body text, labels, inputs
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  // variable — creates a CSS variable we reference in tailwind.config.js
  display: 'swap',
  // swap — shows system font immediately while Inter loads
  // prevents invisible text (FOIT — Flash Of Invisible Text)
});

// Plus Jakarta Sans — modern, slightly rounded, feels premium
// Perfect for headings and hero text
const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-plus-jakarta',
  display: 'swap',
});

export const metadata = {
  title: {
    default: 'Rahisisha Biashara',
    template: '%s — Rahisisha Biashara',
    // template — individual pages set their own title
    // %s gets replaced with the page title
    // Result: "Log in — Rahisisha Biashara"
  },
  description: 'Business management for small businesses in Kenya. Manage customers, track sales, and grow with AI.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${plusJakarta.variable} font-sans antialiased`}>
        {/* inter.variable + plusJakarta.variable — injects the CSS variables */}
        {/* font-sans — sets Inter as the default body font (from tailwind.config.js) */}
        {/* antialiased — smoother font rendering on screens */}
        {children}
      </body>
    </html>
  );
}