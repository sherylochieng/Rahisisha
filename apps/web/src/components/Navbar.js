'use client';
// 'use client' — needed because we use useState for the mobile menu toggle
// If we didn't have the mobile menu, this could be a Server Component

import { useState } from 'react';
import Link from 'next/link';

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  // menuOpen — tracks whether the mobile hamburger menu is open or closed
  // false = closed (default), true = open

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-gray-100 backdrop-blur-sm">
      {/* sticky top-0 — stays at the top of the screen as user scrolls */}
      {/* z-50 — sits above all other content */}
      {/* backdrop-blur-sm — subtle glass effect if background shows through */}

      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-full bg-brand-orange flex items-center justify-center transition-transform group-hover:scale-110">
            {/* group-hover:scale-110 — logo pops slightly when hovered */}
            <span className="text-white font-bold text-sm">R</span>
          </div>
          <span className="font-display font-bold text-brand-navy">
            Rahisisha Biashara
          </span>
          {/* font-display — uses Plus Jakarta Sans from our theme */}
        </Link>

        {/* Desktop nav links — hidden on mobile */}
        <div className="hidden md:flex items-center gap-8">
          <Link href="/#features" className="text-sm text-gray-500 hover:text-brand-navy transition-colors font-medium">
            Features
          </Link>
          <Link href="/#services" className="text-sm text-gray-500 hover:text-brand-navy transition-colors font-medium">
            Services
          </Link>
          <Link href="/#about" className="text-sm text-gray-500 hover:text-brand-navy transition-colors font-medium">
            About
          </Link>
        </div>

        {/* Desktop CTA buttons — hidden on mobile */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm text-gray-600 hover:text-brand-navy font-medium transition-colors px-4 py-2"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="text-sm bg-brand-orange hover:bg-brand-orange-dark text-white font-semibold rounded-lg px-5 py-2.5 transition-all hover:shadow-lg hover:shadow-orange-200 hover:-translate-y-0.5"
          >
            {/* hover:-translate-y-0.5 — button lifts slightly on hover */}
            {/* hover:shadow-lg — shadow appears on hover for depth */}
            Get started free
          </Link>
        </div>

        {/* Mobile hamburger button — visible only on mobile */}
        <button
          className="md:hidden flex flex-col gap-1.5 p-2"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
          // aria-label — accessibility: screen readers announce this button correctly
        >
          <span className={`block w-5 h-0.5 bg-brand-navy transition-all duration-300 ${menuOpen ? 'rotate-45 translate-y-2' : ''}`} />
          <span className={`block w-5 h-0.5 bg-brand-navy transition-all duration-300 ${menuOpen ? 'opacity-0' : ''}`} />
          <span className={`block w-5 h-0.5 bg-brand-navy transition-all duration-300 ${menuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
          {/* Three spans form the hamburger icon */}
          {/* When menuOpen=true they animate into an X */}
        </button>
      </div>

      {/* Mobile menu — slides down when hamburger is clicked */}
      <div className={`md:hidden transition-all duration-300 overflow-hidden ${menuOpen ? 'max-h-64 opacity-100' : 'max-h-0 opacity-0'}`}>
        {/* max-h animation — smooth slide open/close without JS height calculations */}
        <div className="px-6 pb-6 flex flex-col gap-4 border-t border-gray-100 pt-4">
          <Link href="/#features" className="text-sm text-gray-600 hover:text-brand-navy font-medium" onClick={() => setMenuOpen(false)}>
            Features
          </Link>
          <Link href="/#services" className="text-sm text-gray-600 hover:text-brand-navy font-medium" onClick={() => setMenuOpen(false)}>
            Services
          </Link>
          <Link href="/#about" className="text-sm text-gray-600 hover:text-brand-navy font-medium" onClick={() => setMenuOpen(false)}>
            About
          </Link>
          <Link href="/login" className="text-sm text-gray-600 hover:text-brand-navy font-medium" onClick={() => setMenuOpen(false)}>
            Log in
          </Link>
          <Link
            href="/signup"
            className="text-sm bg-brand-orange text-white font-semibold rounded-lg px-5 py-2.5 text-center transition-colors hover:bg-brand-orange-dark"
            onClick={() => setMenuOpen(false)}
          >
            Get started free
          </Link>
        </div>
      </div>
    </nav>
  );
}