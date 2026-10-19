'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SignupPage() {
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
      slug:        formData.get('slug'),
    };

    try {
      const res = await fetch('http://localhost:3000/v1/signup', {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body:        JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Signup failed');
        setLoading(false);
        return;
      }

      router.push('/dashboard');

    } catch (err) {
      setError('Could not connect to server');
      setLoading(false);
    }
  }

  return (
    <main>
      <h1>Create your account</h1>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="name">Your name</label>
          <input id="name" name="name" type="text" required />
        </div>

        <div>
          <label htmlFor="phone">Phone number</label>
          <input id="phone" name="phone" type="tel" required />
        </div>

        <div>
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" required />
        </div>

        <div>
          <label htmlFor="tenant_name">Business name</label>
          <input id="tenant_name" name="tenant_name" type="text" required />
        </div>

        <div>
          <label htmlFor="slug">Business slug</label>
          <input id="slug" name="slug" type="text" required />
          <small>Lowercase letters, digits, hyphens only. Example: aminas-boutique</small>
        </div>

        <button type="submit" disabled={loading}>
          {loading ? 'Creating account...' : 'Create account'}
        </button>
      </form>
    </main>
  );
}