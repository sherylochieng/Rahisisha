import LoginForm from './LoginForm';

// metadata — Next.js reads this and sets the browser tab + Google snippet
export const metadata = {
  title: 'Log in — Rahisisha Biashara',
  description: 'Log in to manage your business, track sales, and serve your customers.',
};

export default function LoginPage() {
  return (
    <main>
      <LoginForm />
    </main>
  );
}