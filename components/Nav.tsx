'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Nav() {
  const path = usePathname();
  const item = (href: string, label: string) => (
    <Link href={href} className={path === href ? 'on' : ''}>{label}</Link>
  );
  return (
    <header className="top">
      <div className="brand">Kargo <span>Hiring</span></div>
      <nav className="nav">{item('/', 'Candidates')}{item('/upload', 'Upload CVs')}</nav>
    </header>
  );
}
