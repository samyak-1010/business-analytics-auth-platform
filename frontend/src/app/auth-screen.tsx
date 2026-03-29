"use client";
import { useState } from "react";
import styles from "./auth.module.css";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api/v1";

export default function AuthScreen({ onAuth }: { onAuth: (token: string, user: any) => void }) {
  const [mode, setMode] = useState<'login'|'signup'>('login');
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string|null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/user-auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === 'signup' ? { email, password, name } : { email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Auth failed');
      if (mode === 'login') onAuth(data.token, data.user);
      else setMode('login'); // After signup, go to login
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.authShell}>
      <form className={styles.authForm} onSubmit={handleSubmit}>
        <p className={styles.authBrand}>Amboras Analytics</p>
        <h2>{mode === 'login' ? 'Welcome Back' : 'Create Account'}</h2>
        {mode === 'signup' && (
          <label>Name
            <input type="text" value={name} onChange={e => setName(e.target.value)} required />
          </label>
        )}
        <label>Email
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
        </label>
        <label>Password
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
        </label>
        {error && <div className={styles.error}>{error}</div>}
        <button type="submit" disabled={loading}>{loading ? 'Please wait...' : (mode === 'login' ? 'Login' : 'Sign Up')}</button>
        <div className={styles.switchMode}>
          {mode === 'login' ? (
            <span>New user? <button type="button" onClick={() => setMode('signup')}>Sign Up</button></span>
          ) : (
            <span>Already have an account? <button type="button" onClick={() => setMode('login')}>Login</button></span>
          )}
        </div>
      </form>
    </div>
  );
}
