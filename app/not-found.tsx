import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="page">
      <p className="mono">404 · No object on this tray</p>
      <h1>Nothing under this light.</h1>
      <Link href="/">Back to the booth →</Link>
    </main>
  );
}
