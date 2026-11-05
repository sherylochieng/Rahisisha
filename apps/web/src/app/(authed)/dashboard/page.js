'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    // When the page loads, fetch the current user's data
    api.me()
      .then(setData)
      .catch(() => {
        // If /me fails (no cookie, expired token) — send to login
        router.push('/login');
      });
  }, []);

  // Still loading
  if (!data && !error) {
    return <main><p>Loading...</p></main>;
  }

  return (
    <main>
      <h1>Welcome, {data.user.name}</h1>
      <p>Business: {data.tenant.name}</p>
      <p>Slug: {data.tenant.slug}</p>
    </main>
  );
}