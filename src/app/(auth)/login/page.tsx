'use client';

import { useState, useTransition, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { User, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { login } from '@/lib/actions/auth';
import styles from './login.module.css';

/**
 * Main Login Page Content.
 * Separated to handle Suspense boundary for `useSearchParams()` during build/SSR.
 */
function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Retrieve redirect path if redirected by middleware
  const redirectUrl = searchParams.get('redirect') || '/dashboard';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Client-side quick validation (Poka-Yoke)
    if (!username.trim() || !password) {
      setError('Username dan password wajib diisi.');
      return;
    }

    startTransition(async () => {
      try {
        const response = await login({
          username: username.trim(),
          password,
        });

        if (response.success) {
          // Success: Force router refresh to capture new auth session and route
          router.refresh();
          router.push(redirectUrl);
        } else {
          setError(response.error || 'Login gagal.');
        }
      } catch (err) {
        console.error('Login submit error:', err);
        setError('Koneksi terputus. Silakan periksa jaringan Anda.');
      }
    });
  };

  return (
    <div className={styles.card}>
      <header className={styles.header}>
        <div className={styles.logoWrapper}>
          <img
            src="/Logo_Login.png"
            alt="Web GA Logo"
            className={styles.logoImage}
          />
        </div>
        <p className={styles.logoSub}>Sistem Pencatatan Aktivitas General Affairs</p>
      </header>

      {/* Error Feedback Banner */}
      {error && (
        <div className={styles.errorBanner} role="alert">
          <AlertCircle size={18} className={styles.errorIcon} />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className={styles.form} noValidate>
        {/* Username Input Field */}
        <div>
          <label htmlFor="username" className={styles.inputLabel}>
            Username
          </label>
          <div className={styles.inputWrapper}>
            <User size={18} className={styles.inputIcon} />
            <input
              id="username"
              type="text"
              className={`${styles.input} ${error && !username.trim() ? styles.inputError : ''}`}
              placeholder="Masukkan username Anda"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isPending}
              autoComplete="username"
              required
            />
          </div>
        </div>

        {/* Password Input Field with Toggle visibility */}
        <div>
          <label htmlFor="password" className={styles.inputLabel}>
            Kata Sandi
          </label>
          <div className={styles.inputWrapper}>
            <Lock size={18} className={styles.inputIcon} />
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              className={`${styles.input} ${error && !password ? styles.inputError : ''}`}
              placeholder="Masukkan kata sandi Anda"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isPending}
              autoComplete="current-password"
              style={{ paddingRight: 'var(--space-12)' }} // Extra padding on right for password eye toggle
              required
            />
            <button
              type="button"
              className={styles.togglePasswordBtn}
              onClick={() => setShowPassword(!showPassword)}
              disabled={isPending}
              aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {/* Submit Actions */}
        <button type="submit" className={styles.submitBtn} disabled={isPending}>
          {isPending ? (
            <>
              <div className={styles.spinner} />
              <span>Memverifikasi...</span>
            </>
          ) : (
            <span>Masuk ke Sistem</span>
          )}
        </button>
      </form>

      <p className={styles.footerText}>
        © {new Date().getFullYear()} General Affairs Activity Tracker. Hak Cipta Dilindungi.
      </p>
    </div>
  );
}

/**
 * Main Page Component.
 * Wraps Content in Suspense to satisfy static-analysis build criteria for Client components referencing useSearchParams().
 */
export default function LoginPage() {
  return (
    <main className={styles.container}>
      <Suspense
        fallback={
          <div className={styles.card} style={{ textAlign: 'center' }}>
            <p className={styles.logoSub} style={{ marginBottom: 'var(--space-6)' }}>
              Memuat sistem login...
            </p>
            <div className={styles.spinner} style={{ margin: '0 auto', borderTopColor: 'var(--color-primary)' }} />
          </div>
        }
      >
        <LoginContent />
      </Suspense>
    </main>
  );
}
