import Link from 'next/link';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import Card from '../components/Card';

// metadata — browser tab + Google search snippet
export const metadata = {
  title: 'Rahisisha Biashara — Business Management for Kenyan SMEs',
  description: 'Manage your customers, track sales, and grow your business with AI. Built for small businesses in Kenya.',
};

// Icons — inline SVG, solid color, no emojis
// Kept here since they are only used on this page
function IconUsers() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
    </svg>
  );
}

function IconChart() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z"/>
    </svg>
  );
}

function IconBrain() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
    </svg>
  );
}

function IconWhatsApp() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.118 1.528 5.855L.057 23.012a.75.75 0 00.931.931l5.157-1.471A11.943 11.943 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.907 0-3.699-.499-5.257-1.371l-.375-.214-3.882 1.108 1.108-3.882-.214-.375A9.956 9.956 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
    </svg>
  );
}

function IconMpesa() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/>
    </svg>
  );
}

function IconStore() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M20 4H4v2l16 .01V4zM4 20h16v-2H4v2zm0-4h16v-2H4v2zm0-4h16v-2H4v2z"/>
    </svg>
  );
}

function IconDashboard() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/>
    </svg>
  );
}

function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
    </svg>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">

      <Navbar />
      {/* Navbar — sticky, handles mobile menu, links to all sections */}

      {/* ── HERO SECTION ── */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-24 text-center">

        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-brand-cream text-brand-orange text-xs font-semibold px-4 py-2 rounded-full mb-8 animate-fade-in">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-orange" />
          Built for small businesses in Kenya
        </div>

        {/* Main headline */}
        <h1 className="font-display text-5xl md:text-6xl font-bold text-brand-navy leading-tight mb-6 animate-fade-up">
          Your business. Running<br />
          <span className="text-brand-orange">24 hours. Without you.</span>
        </h1>

        {/* Subheadline */}
        <p className="text-gray-500 text-lg leading-relaxed mb-10 max-w-2xl mx-auto animate-fade-up">
          Rahisisha Biashara handles your WhatsApp customers, processes M-Pesa payments,
          updates your stock, and posts your products automatically.
          You focus on your business. We handle the rest.
        </p>

        {/* CTA buttons */}
        <div className="flex items-center justify-center gap-4 flex-wrap animate-fade-up">
          <Link
            href="/signup"
            className="bg-brand-orange hover:bg-brand-orange-dark text-white font-semibold rounded-lg px-8 py-3.5 text-sm transition-all hover:shadow-lg hover:shadow-orange-200 hover:-translate-y-0.5"
          >
            Start for free
          </Link>
          <Link
            href="#about"
            className="border border-gray-200 hover:border-brand-orange text-gray-700 hover:text-brand-orange font-semibold rounded-lg px-8 py-3.5 text-sm transition-all"
          >
            See how it works
          </Link>
        </div>
      </section>

      {/* ── PROBLEM SECTION ── */}
      <section className="bg-brand-navy py-20 px-6">
        <div className="max-w-6xl mx-auto">

          <div className="text-center mb-14">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-4">
              Sound familiar?
            </h2>
            <p className="text-gray-400 text-sm max-w-xl mx-auto">
              Every small business owner in Kenya faces the same problems.
              Rahisisha was built to solve all of them.
            </p>
          </div>

          {/* Problem cards — dark variant */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card
              variant="dark"
              icon={<IconWhatsApp />}
              title="Buried in WhatsApp"
              description="A customer asks 'iko stock?' You reply by hand. Send an M-Pesa number. Wait for confirmation. Update your notebook. Then do it again. 50 times a day."
            />
            <Card
              variant="dark"
              icon={<IconUsers />}
              title="No time to market"
              description="You know you need to post on Instagram and WhatsApp consistently. But you are busy serving customers, managing stock, and running everything alone."
            />
            <Card
              variant="dark"
              icon={<IconChart />}
              title="Business stops when you do"
              description="If you are not on your phone, orders are missed. Customers move on. Your business only operates when you are there. That is not a business. That is a job."
            />
          </div>
        </div>
      </section>

      {/* ── VIDEO / DEMO SECTION ── */}
      <section className="py-20 px-6 bg-brand-cream" id="about">
        <div className="max-w-6xl mx-auto">

          <div className="text-center mb-14">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-brand-navy mb-4">
              One platform. Everything automated.
            </h2>
            <p className="text-gray-500 text-sm max-w-xl mx-auto">
              From product upload to M-Pesa confirmation, Rahisisha handles the
              entire customer journey without you touching a single chat.
            </p>
          </div>

          {/* Two column layout — video left, flow right */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">

            {/* Video placeholder */}
            <div className="rounded-2xl overflow-hidden bg-brand-navy aspect-video flex items-center justify-center group cursor-pointer hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
              {/* aspect-video — maintains 16:9 ratio regardless of width */}
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-brand-orange flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                  {/* Play button — animates on hover */}
                  <svg viewBox="0 0 24 24" fill="white" className="w-7 h-7 ml-1">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                </div>
                <p className="text-gray-400 text-sm">Product demo coming soon</p>
              </div>
            </div>

            {/* Full flow steps */}
            <div className="space-y-5">
              {[
                { step: '01', text: 'Owner uploads product photo' },
                { step: '02', text: 'AI enhances it with brand colours, price and logo' },
                { step: '03', text: 'Owner approves — storefront updates instantly' },
                { step: '04', text: 'WhatsApp announcement goes out automatically' },
                { step: '05', text: 'AI answers customer questions from real catalog' },
                { step: '06', text: 'Customer taps Buy — M-Pesa STK push fires' },
                { step: '07', text: 'Payment confirmed — stock updates — order created' },
                { step: '08', text: 'Owner sees the sale on their dashboard' },
              ].map(({ step, text }) => (
                <div key={step} className="flex items-start gap-4 group">
                  <span className="text-brand-orange font-display font-bold text-sm w-8 shrink-0 pt-0.5">
                    {step}
                  </span>
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full border-2 border-brand-orange flex items-center justify-center shrink-0 group-hover:bg-brand-orange transition-colors duration-200">
                      <IconCheck />
                    </div>
                    <p className="text-gray-600 text-sm">{text}</p>
                  </div>
                </div>
              ))}
              {/* .map() — loops over the array and renders one row per step */}
              {/* No copy-paste — one template, data drives the output */}
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES SECTION ── */}
      <section className="py-20 px-6" id="features">
        <div className="max-w-6xl mx-auto">

          <div className="text-center mb-14">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-brand-navy mb-4">
              Built for how you actually work
            </h2>
            <p className="text-gray-500 text-sm max-w-xl mx-auto">
              No complicated setup. No technical skills needed.
              Everything works the way your business already works.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card
              variant="light"
              icon={<IconStore />}
              title="Branded storefront"
              description="Every business gets its own storefront with its own brand colours, logo, and product catalog. Your customers see your business, not ours."
            />
            <Card
              variant="light"
              icon={<IconWhatsApp />}
              title="WhatsApp automation"
              description="AI answers customer questions, takes orders, and sends payment links directly in WhatsApp. Your business keeps selling while you sleep."
            />
            <Card
              variant="light"
              icon={<IconMpesa />}
              title="M-Pesa built in"
              description="M-Pesa STK push fires automatically when a customer taps Buy. No manual payment collection. No waiting. No chasing confirmation screenshots."
            />
            <Card
              variant="light"
              icon={<IconBrain />}
              title="AI product photos"
              description="Upload a plain photo. AI enhances it with your brand colours, adds your price, name, and logo automatically. Every post looks professionally made."
            />
            <Card
              variant="light"
              icon={<IconChart />}
              title="Real-time analytics"
              description="See your sales, revenue, top products, and stock levels on one dashboard. Know exactly how your business is performing at any moment."
            />
            <Card
              variant="light"
              icon={<IconDashboard />}
              title="Owner dashboard"
              description="Approve products, manage orders, view customer history, and get AI-powered business advice. Everything your business needs in one place."
            />
          </div>
        </div>
      </section>

      {/* ── SERVICES SECTION ── */}
      <section className="bg-brand-navy py-20 px-6" id="services">
        <div className="max-w-6xl mx-auto">

          <div className="text-center mb-14">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-4">
              What you get with Rahisisha
            </h2>
            <p className="text-gray-400 text-sm max-w-xl mx-auto">
              Four complete services running for your business from day one.
              No hiring. No setup. No technical skills.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Service 1 — Marketing */}
            <div className="bg-brand-navy-light rounded-2xl p-8 border border-white/10 hover:border-brand-orange/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
              <div className="w-12 h-12 rounded-xl bg-brand-orange/10 flex items-center justify-center mb-5">
                <div className="w-6 h-6 text-brand-orange">
                  <IconBrain />
                </div>
              </div>
              <h3 className="font-display font-semibold text-white text-lg mb-3">
                Marketing and visibility
              </h3>
              <p className="text-gray-400 text-sm leading-relaxed mb-5">
                AI enhances your product photos in your own brand colours and
                automatically posts them to WhatsApp. Your brand stays seen
                and consistent without you lifting a finger. Instagram and
                Facebook auto-posting coming in the next phase.
              </p>
              <Link href="/signup" className="inline-flex items-center gap-2 text-brand-orange text-sm font-semibold hover:gap-3 transition-all">
                Get started
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                  <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/>
                </svg>
              </Link>
            </div>

            {/* Service 2 — Customer support */}
            <div className="bg-brand-navy-light rounded-2xl p-8 border border-white/10 hover:border-brand-orange/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
              <div className="w-12 h-12 rounded-xl bg-brand-orange/10 flex items-center justify-center mb-5">
                <div className="w-6 h-6 text-brand-orange">
                  <IconWhatsApp />
                </div>
              </div>
              <h3 className="font-display font-semibold text-white text-lg mb-3">
                Customer support 24/7
              </h3>
              <p className="text-gray-400 text-sm leading-relaxed mb-5">
                AI replies to every customer question using your real catalog data.
                Prices, stock, sizes, delivery — answered instantly, day or night.
                Customers can browse and buy directly in WhatsApp without waiting
                for you to respond.
              </p>
              <Link href="/signup" className="inline-flex items-center gap-2 text-brand-orange text-sm font-semibold hover:gap-3 transition-all">
                Get started
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                  <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/>
                </svg>
              </Link>
            </div>

            {/* Service 3 — Payments */}
            <div className="bg-brand-navy-light rounded-2xl p-8 border border-white/10 hover:border-brand-orange/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
              <div className="w-12 h-12 rounded-xl bg-brand-orange/10 flex items-center justify-center mb-5">
                <div className="w-6 h-6 text-brand-orange">
                  <IconMpesa />
                </div>
              </div>
              <h3 className="font-display font-semibold text-white text-lg mb-3">
                End-to-end sales on WhatsApp
              </h3>
              <p className="text-gray-400 text-sm leading-relaxed mb-5">
                From product discovery to M-Pesa payment confirmation, the
                entire sale happens inside WhatsApp. Customer taps Buy,
                M-Pesa STK push fires, PIN entered, payment confirmed,
                stock updated. You see the completed order on your dashboard.
              </p>
              <Link href="/signup" className="inline-flex items-center gap-2 text-brand-orange text-sm font-semibold hover:gap-3 transition-all">
                Get started
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                  <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/>
                </svg>
              </Link>
            </div>

            {/* Service 4 — Dashboard and advice */}
            <div className="bg-brand-navy-light rounded-2xl p-8 border border-white/10 hover:border-brand-orange/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
              <div className="w-12 h-12 rounded-xl bg-brand-orange/10 flex items-center justify-center mb-5">
                <div className="w-6 h-6 text-brand-orange">
                  <IconDashboard />
                </div>
              </div>
              <h3 className="font-display font-semibold text-white text-lg mb-3">
                Owner dashboard and AI advice
              </h3>
              <p className="text-gray-400 text-sm leading-relaxed mb-5">
                See your sales, revenue, top products, and low stock alerts
                in real time. AI analyses your business data and gives you
                specific recommendations — which products to restock, which
                to promote, and what your customers are asking for most.
              </p>
              <Link href="/signup" className="inline-flex items-center gap-2 text-brand-orange text-sm font-semibold hover:gap-3 transition-all">
                Get started
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                  <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/>
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA SECTION ── */}
      <section className="py-20 px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-brand-navy mb-4">
            Ready to stop doing everything manually?
          </h2>
          <p className="text-gray-500 text-sm leading-relaxed mb-10">
            Join small business owners across Kenya who are using Rahisisha
            to serve more customers, make more sales, and reclaim their time.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link
              href="/signup"
              className="bg-brand-orange hover:bg-brand-orange-dark text-white font-semibold rounded-lg px-8 py-3.5 text-sm transition-all hover:shadow-lg hover:shadow-orange-200 hover:-translate-y-0.5"
            >
              Create your free account
            </Link>
            <Link
              href="/login"
              className="border border-gray-200 hover:border-brand-orange text-gray-700 hover:text-brand-orange font-semibold rounded-lg px-8 py-3.5 text-sm transition-all"
            >
              Log in to your account
            </Link>
          </div>
        </div>
      </section>

      <Footer />
      {/* Footer — links to all sections, built in Kenya */}

    </div>
  );
}