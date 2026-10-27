import Link from 'next/link';
// No 'use client' needed — no interactivity, pure display
// This is a Server Component — renders on the server, faster

export default function Footer() {
  return (
    <footer className="bg-brand-navy text-white">

      {/* Main footer content */}
      <div className="max-w-6xl mx-auto px-6 py-16 grid grid-cols-1 md:grid-cols-3 gap-12">

        {/* Column 1 — Brand */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-full bg-brand-orange flex items-center justify-center">
              <span className="text-white font-bold text-sm">R</span>
            </div>
            <span className="font-display font-bold">Rahisisha Biashara</span>
          </div>
          <p className="text-gray-400 text-sm leading-relaxed">
            Business management built for small businesses in Kenya.
            Manage customers, track sales, and grow with AI.
          </p>
        </div>

        {/* Column 2 — Product links */}
        <div>
          <h4 className="font-semibold text-sm mb-4 text-gray-300 uppercase tracking-wider">
            Product
          </h4>
          <ul className="space-y-3">
            <li>
              <Link href="/#features" className="text-gray-400 hover:text-white text-sm transition-colors">
                Features
              </Link>
            </li>
            <li>
              <Link href="/#services" className="text-gray-400 hover:text-white text-sm transition-colors">
                Services
              </Link>
            </li>
            <li>
              <Link href="/#about" className="text-gray-400 hover:text-white text-sm transition-colors">
                About
              </Link>
            </li>
          </ul>
        </div>

        {/* Column 3 — Account links */}
        <div>
          <h4 className="font-semibold text-sm mb-4 text-gray-300 uppercase tracking-wider">
            Account
          </h4>
          <ul className="space-y-3">
            <li>
              <Link href="/signup" className="text-gray-400 hover:text-white text-sm transition-colors">
                Create account
              </Link>
            </li>
            <li>
              <Link href="/login" className="text-gray-400 hover:text-white text-sm transition-colors">
                Log in
              </Link>
            </li>
          </ul>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/10 px-6 py-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between flex-wrap gap-4">
          <p className="text-gray-500 text-xs">
            2026 Rahisisha Biashara. Built in Kenya.
          </p>
          <p className="text-gray-500 text-xs">
            Simplifying business, one owner at a time.
          </p>
        </div>
      </div>
    </footer>
  );
}