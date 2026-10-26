import Link from 'next/link';
// Link — internal navigation, no full page reload

export default function NotFound() {
  return (
    <div className="min-h-screen bg-blue-950 flex items-center justify-center px-4">
      {/* Full screen — same dark navy as login page, consistent brand feel */}

      <div className="text-center text-white max-w-md">

        {/* Logo mark */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center">
            <span className="text-orange-500 font-bold text-lg">R</span>
          </div>
          <span className="font-bold text-lg">Rahisisha Biashara</span>
        </div>

        {/* Big 404 */}
        <h1 className="text-8xl font-bold text-orange-500 mb-4">404</h1>
        {/* text-8xl — very large, makes it immediately clear what happened */}
        {/* text-orange-500 — brand orange, not a scary red */}

        {/* Human-friendly message */}
        <h2 className="text-2xl font-semibold mb-3">
          Page not found
        </h2>
        <p className="text-blue-300 text-sm mb-8">
          The page you are looking for does not exist or has been moved.
          Let us take you back to safety.
        </p>
        {/* text-blue-300 — softer than white, easy to read on dark background */}

        {/* Call to action — takes user somewhere useful */}
        {/* Call to action */}
<Link
  href="/"
  className="inline-block bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg px-6 py-3 text-sm transition-colors"
>
  Go to home page
</Link>

{/* Secondary option */}
<p className="text-blue-300 text-sm mt-4">
  or{' '}
  <Link href="/login" className="text-white hover:underline font-medium">
    log in to your account
  </Link>
</p>
      </div>
    </div>
  );
}