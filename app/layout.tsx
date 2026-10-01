import './globals.css';
import Link from 'next/link';

export const metadata = { title: 'Kargo Hiring' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en"><body>
      <header><b>Kargo Hiring</b><Link href="/">Candidates</Link><Link href="/upload">Upload CV</Link></header>
      <main>{children}</main>
    </body></html>
  );
}
