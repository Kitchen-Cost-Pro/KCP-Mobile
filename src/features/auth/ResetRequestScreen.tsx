import { useState, type FormEvent } from 'react';
import { ArrowLeft, ExternalLink, Mail } from 'lucide-react';
import { useAuth } from '../../core/auth/AuthProvider';
import { AuthLayout } from './AuthLayout';

export function ResetRequestScreen() {
  const auth = useAuth();
  const [email, setEmail] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    await auth.requestReset(email).catch(() => undefined);
  }

  return (
    <AuthLayout compact>
      <button className="back-button" type="button" onClick={auth.showLogin}><ArrowLeft size={18} /> Back</button>
      <header className="auth-heading">
        <p className="eyebrow">Account recovery</p>
        <h1>Reset password</h1>
        <p>Password recovery continues in the secure KCP web sign-in page.</p>
      </header>
      {auth.error && <div className="message message-error" role="alert">{auth.error}</div>}
      <form className="auth-form" onSubmit={submit}>
        <label className="field">
          <span>Email address</span>
          <div className="input-shell">
            <Mail size={18} />
            <input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </div>
        </label>
        <button className="button button-primary button-large" type="submit" disabled={auth.busy}>
          <span>{auth.busy ? 'Opening…' : 'Continue to KCP web'}</span><ExternalLink size={18} />
        </button>
      </form>
    </AuthLayout>
  );
}
