export const metadata = {
  title: 'Rahisisha Biashara',
  description: 'Simplify your business',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}