import Link from 'next/link';
// Link — internal navigation, no full page reload

export const metadata = {
  title: 'Rahisisha Biashara — Business Management for Kenyan SMEs',
  description: 'Manage your customers, track your sales, and grow your business with AI. Built for small businesses in Kenya.',
};
// metadata — sets browser tab title and Google search snippet
// This is the most important metadata in the whole app — it's your homepage

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">

      {/* ── NAVIGATION ── */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center">
            <span className="text-white font-bold text-sm">R</span>
          </div>
          <span className="font-bold text-blue-950">Rahisisha Biashara</span>
        </div>

        {/* Nav links */}
        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="text-sm text-gray-600 hover:text-blue-950 font-medium"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="text-sm bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg px-4 py-2 transition-colors"
          >
            Get started free
          </Link>
        </div>
      </nav>

      {/* ── HERO SECTION ── */}
      <section className="max-w-4xl mx-auto px-6 py-20 text-center">
        {/* mx-auto — centres the content, max-w-4xl keeps it readable */}

        {/* Badge */}
        <div className="inline-block bg-orange-50 text-orange-600 text-xs font-semibold px-3 py-1 rounded-full mb-6">
          Built for Kenyan small businesses
        </div>

        {/* Main headline — the most important line on the page */}
        <h1 className="text-5xl font-bold text-blue-950 leading-tight mb-6">
          Simplify your business.<br />
          <span className="text-orange-500">Grow with confidence.</span>
        </h1>
        {/* <br /> — forces the line break for visual rhythm */}
        {/* text-orange-500 — orange accent on the emotional part of the headline */}

        {/* Subheadline — explains what it does */}
        <p className="text-gray-500 text-lg leading-relaxed mb-10 max-w-2xl mx-auto">
          Rahisisha Biashara gives small business owners in Kenya the tools
          to manage customers, track sales, and grow — all in one place.
        </p>

        {/* Call to action buttons */}
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link
            href="/signup"
            className="bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg px-8 py-3 text-sm transition-colors"
          >
            Start for free
          </Link>
          <Link
            href="/login"
            className="border border-gray-300 hover:border-gray-400 text-gray-700 font-semibold rounded-lg px-8 py-3 text-sm transition-colors"
          >
            Log in to your account
          </Link>
        </div>
        {/* flex-wrap — on mobile the buttons stack vertically instead of overflowing */}
      </section>

      {/* ── FEATURES SECTION ── */}
      <section className="bg-blue-950 py-20 px-6">
        <div className="max-w-4xl mx-auto">

          <h2 className="text-3xl font-bold text-white text-center mb-3">
            Everything your business needs
          </h2>
          <p className="text-blue-300 text-center text-sm mb-12">
            One platform. All the tools. No technical skills required.
          </p>

          {/* Feature grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* grid-cols-1 on mobile → stacks vertically */}
            {/* md:grid-cols-3 on desktop → three columns */}

            {/* Feature 1 */}
            <div className="text-center">
              <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center mx-auto mb-4">
                <span className="text-white text-xl">👥</span>
              </div>
              <h3 className="text-white font-semibold mb-2">Customer Management</h3>
              <p className="text-blue-300 text-sm leading-relaxed">
                Keep track of every customer, their orders, and their history in one place.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="text-center">
              <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center mx-auto mb-4">
                <span className="text-white text-xl">📊</span>
              </div>
              <h3 className="text-white font-semibold mb-2">Sales Tracking</h3>
              <p className="text-blue-300 text-sm leading-relaxed">
                See your revenue, top products, and trends at a glance every day.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="text-center">
              <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center mx-auto mb-4">
                <span className="text-white text-xl">🤖</span>
              </div>
              <h3 className="text-white font-semibold mb-2">AI Insights</h3>
              <p className="text-blue-300 text-sm leading-relaxed">
                Get smart suggestions to grow your business powered by AI.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-gray-100 px-6 py-8">
        <div className="max-w-4xl mx-auto flex items-center justify-between flex-wrap gap-4">

          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center">
              <span className="text-white font-bold text-xs">R</span>
            </div>
            <span className="font-bold text-blue-950 text-sm">Rahisisha Biashara</span>
          </div>

          {/* Footer links */}
          <div className="flex items-center gap-6 text-sm text-gray-500">
            <Link href="/signup" className="hover:text-blue-950">Sign up</Link>
            <Link href="/login" className="hover:text-blue-950">Log in</Link>
          </div>

          <p className="text-gray-400 text-xs w-full md:w-auto text-center">
            © 2026 Rahisisha Biashara. Built in Kenya.
          </p>
        </div>
      </footer>

    </div>
  );
}