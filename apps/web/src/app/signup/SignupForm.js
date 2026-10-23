'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';

export default function SignupForm() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const formData = new FormData(e.target);

    const body = {
      phone:       formData.get('phone'),
      name:        formData.get('name'),
      password:    formData.get('password'),
      tenant_name: formData.get('tenant_name'),
    };

    try {
      await api.signup(body);
      router.push('/dashboard');
    } catch (err) {
      setError(err.message || 'Could not connect to server');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-blue-950 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-4xl flex rounded-2xl shadow-2xl overflow-hidden">

        {/* Left side — brand messaging */}
        <div className="hidden md:flex flex-col justify-between bg-blue-900 text-white w-1/2 p-10">
          <div>
            {/* Logo */}
            <div className="flex items-center gap-3 mb-10">
              <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center">
                <span className="text-white font-bold text-lg">R</span>
              </div>
              <span className="font-bold text-lg">Rahisisha Biashara</span>
            </div>

            {/* Headline */}
            <h2 className="text-3xl font-bold leading-tight mb-4">
              Simplify your business.
            </h2>
            <p className="text-blue-200 text-sm leading-relaxed mb-8">
              Rahisisha Biashara gives small businesses in Kenya the tools
              to manage customers, track sales, and grow all in one place.
            </p>

            {/* Feature list */}
            <ul className="space-y-3 text-sm text-blue-100">
              <li className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center text-xs">✓</span>
                Manage your customers
              </li>
              <li className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center text-xs">✓</span>
                Track your sales and revenue
              </li>
              <li className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center text-xs">✓</span>
                Grow your business with AI
              </li>
            </ul>
          </div>

          {/* Bottom link */}
          <p className="text-blue-300 text-sm">
            Already have an account?{' '}
            <a href="/login" className="text-orange-400 hover:underline font-medium">
              Log in
            </a>
          </p>
        </div>

        {/* Right side — form */}
        <div className="bg-white w-full md:w-1/2 p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-blue-950">Create account</h1>
            <p className="text-gray-500 text-sm mt-1">Get started in less than a minute</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-5 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Your name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="Sheryl Ochieng"
              />
            </div>

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
                placeholder="At least 8 characters"
              />
            </div>

            <div>
              <label htmlFor="tenant_name" className="block text-sm font-medium text-gray-700 mb-1">
                Business name
              </label>
              <input
                id="tenant_name"
                name="tenant_name"
                type="text"
                required
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="Amina's Boutique"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-semibold rounded-lg py-2.5 text-sm transition-colors mt-2"
            >
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </form>

          {/* Mobile only — show login link */}
          <p className="text-center text-sm text-gray-500 mt-5 md:hidden">
            Already have an account?{' '}
            <a href="/login" className="text-orange-500 hover:underline font-medium">
              Log in
            </a>
          </p>
        </div>

      </div>
    </div>
  );
}