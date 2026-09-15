import React, { useState } from 'react';
import { AuthShell, AuthFeedback, Field } from './AuthShell';
import { useAuth } from '../../context/AuthContext';

interface ForgotPasswordProps { onNavigate: (path: string) => void; }

export const ForgotPassword: React.FC<ForgotPasswordProps> = ({onNavigate}) => {
  const {forgotPassword} = useAuth();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(''); setSuccess(''); setIsLoading(true);
    try { await forgotPassword(email); window.sessionStorage.setItem('audiotalents_reset_email', email); setSuccess('Nếu email hợp lệ, hướng dẫn đặt lại mật khẩu sẽ được gửi.'); window.setTimeout(() => onNavigate('/reset-password'), 700); }
    catch { setError('Không thể gửi yêu cầu lúc này. Vui lòng thử lại sau.'); }
    finally { setIsLoading(false); }
  }

  return <AuthShell title="Quên mật khẩu" subtitle="Nhận mã để đặt lại mật khẩu tài khoản." footer={<button className="text-primary font-semibold" onClick={() => onNavigate('/login')}>Quay lại đăng nhập</button>}>
    <form onSubmit={submit} className="space-y-4">
      <Field label="Email" type="email" required autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} />
      <AuthFeedback error={error} success={success} />
      <button disabled={isLoading} className="w-full py-2.5 rounded-xl bg-primary text-on-primary text-sm font-bold disabled:opacity-50">{isLoading ? 'Đang gửi...' : 'Gửi mã xác thực'}</button>
    </form>
  </AuthShell>;
};
