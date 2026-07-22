import { useState, type FormEvent } from 'react';
import { ArrowRight, KeyRound, LockKeyhole } from 'lucide-react';
import { useAuth } from '../../core/auth/AuthProvider';
import { AuthLayout } from './AuthLayout';

export function PasswordScreen({ mode }: { mode: 'forced' | 'reset' }) {
  const auth = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLocalError('');
    if (password.length < 8) {
      setLocalError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setLocalError('Passwords do not match.');
      return;
    }
    try {
      if (mode === 'forced') await auth.completeForcedPassword(password);
      else await auth.confirmReset(password);
    } catch {
      // The provider exposes the server message.
    }
  }

  return (
    <AuthLayout compact>
      <div className="auth-icon"><KeyRound size={24} /></div>
      <header className="auth-heading">
        <p className="eyebrow">{mode === 'forced' ? 'First sign in' : 'Account recovery'}</p>
        <h1>{mode === 'forced' ? 'Create a secure password' : 'Choose a new password'}</h1>
        <p>Use at least eight characters and keep it unique to KCP.</p>
      </header>
      {(localError || auth.error) && <div className="message message-error" role="alert">{localError || auth.error}</div>}
      <form className="auth-form" onSubmit={submit}>
        <label className="field">
          <span>New password</span>
          <div className="input-shell"><LockKeyhole size={18} /><input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></div>
        </label>
        <label className="field">
          <span>Confirm password</span>
          <div className="input-shell"><LockKeyhole size={18} /><input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required /></div>
        </label>
        <button className="button button-primary button-large" type="submit" disabled={auth.busy}>
          <span>{auth.busy ? 'Saving…' : 'Save password'}</span><ArrowRight size={18} />
        </button>
      </form>
    </AuthLayout>
  );
}
