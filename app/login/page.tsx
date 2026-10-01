'use client';
import { useState } from 'react';

export default function Login() {
  const [pw, setPw] = useState(''); const [err, setErr] = useState('');
  async function go(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch('/api/login', { method: 'POST', body: JSON.stringify({ password: pw }) });
    if (r.ok) location.href = '/'; else setErr('Wrong password');
  }
  return (
    <form onSubmit={go} style={{ maxWidth: 320 }}>
      <h2>Sign in</h2>
      <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Password" autoFocus />
      <div className="row"><button>Enter</button><span className="err">{err}</span></div>
    </form>
  );
}
