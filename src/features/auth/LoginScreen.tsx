import { useState, type FormEvent } from 'react';
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react';
import { useAuth } from '../../core/auth/AuthProvider';
import { AuthLayout } from './AuthLayout';

export function LoginScreen() {
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    await auth.signIn(email, password).catch(() => undefined);
  }

  return (
    <AuthLayout>
      <header className="auth-heading">
        <p className="eyebrow">Secure workspace access</p>
        <h1>Welcome back</h1>
        <p>Sign in to keep your kitchen moving.</p>
      </header>

      {auth.error && <div className="message message-error" role="alert">{auth.error}</div>}
      {auth.notice && <div className="message message-success">{auth.notice}</div>}

      <form className="auth-form" onSubmit={submit}>
        <label className="field">
          <span>Email address</span>
          <div className="input-shell">
            <Mail size={18} />
            <input
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@company.com"
              required
            />
          </div>
        </label>

        <label className="field">
          <span>Password</span>
          <div className="input-shell">
            <LockKeyhole size={18} />
            <input
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              required
            />
            <button className="input-action" type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </label>

        <button className="text-button align-right" type="button" onClick={auth.showResetRequest}>
          Forgot password?
        </button>

        <button className="button button-primary button-large" type="submit" disabled={auth.busy}>
          <span>{auth.busy ? 'Opening workspace…' : 'Sign in'}</span>
          {!auth.busy && <ArrowRight size={19} />}
        </button>
      </form>

      <p className="legal-copy">
        By continuing you agree to the <a href="/terms.html" target="_blank" rel="noreferrer">Terms of Service</a> and acknowledge the <a href="/privacy.html" target="_blank" rel="noreferrer">Privacy Policy</a>.
      </p>
    </AuthLayout>
  );
}
