'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';

export default function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const formData = new FormData(e.target);

    const body = {
      phone:    formData.get('phone'),
      password: formData.get('password'),
    };

    try {
      await api.login(body);
      router.push('/dashboard');
    } catch (err) {
      setError(err.message || 'Could not connect to server');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-blue-950 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-4xl flex rounded-2xl shadow-2xl overflow-hidden">

        {/* Left side — orange brand panel */}
        <div className="hidden md:flex flex-col justify-between bg-orange-500 text-white w-1/2 p-10">
          <div>
            {/* Logo */}
            <div className="flex items-center gap-3 mb-10">
              <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center">
                <span className="text-orange-500 font-bold text-lg">R</span>
              </div>
              <span className="font-bold text-lg">Rahisisha Biashara</span>
            </div>

            {/* Headline */}
            <h2 className="text-3xl font-bold leading-tight mb-4">
              Welcome back.
            </h2>
            <p className="text-orange-100 text-sm leading-relaxed mb-8">
              Log in to manage your business, track your sales,
              and keep growing with Rahisisha Biashara.
            </p>

            {/* Feature list */}
            <ul className="space-y-3 text-sm text-orange-100">
              <li className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-white flex items-center justify-center text-xs text-orange-500">✓</span>
                Your customers are waiting
              </li>
              <li className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-white flex items-center justify-center text-xs text-orange-500">✓</span>
                Your sales dashboard is ready
              </li>
              <li className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-white flex items-center justify-center text-xs text-orange-500">✓</span>
                Your business never sleeps
              </li>
            </ul>
          </div>

          {/* Bottom link */}
          <p className="text-orange-100 text-sm">
            Don&apos;t have an account?{' '}
            <a href="/signup" className="text-white hover:underline font-medium">
              Create one
            </a>
          </p>
        </div>

        {/* Right side — form */}
        <div className="bg-white w-full md:w-1/2 p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-blue-950">Log in</h1>
            <p className="text-gray-500 text-sm mt-1">Enter your phone and password</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-5 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                Phone number
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                required
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="0712345678"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="Your password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-semibold rounded-lg py-2.5 text-sm transition-colors mt-2"
            >
              {loading ? 'Logging in...' : 'Log in'}
            </button>
          </form>

          {/* Mobile only */}
          <p className="text-center text-sm text-gray-500 mt-5 md:hidden">
            Don&apos;t have an account?{' '}
            <a href="/signup" className="text-orange-500 hover:underline font-medium">
              Create one
            </a>
          </p>
        </div>

      </div>
    </div>
  );
}