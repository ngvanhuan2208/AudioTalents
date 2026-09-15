import React, { useState } from 'react';
import { AuthShell, AuthFeedback, Field } from './AuthShell';
import { useAuth } from '../../context/AuthContext';

interface LoginProps { onNavigate: (path: string) => void; }

function loginErrorMessage(error: Error & {code?: string; status?: number}) {
  if (error.code === 'ACCOUNT_SUSPENDED') return 'Tài khoản đang bị tạm khóa.';
  if (error.code === 'ACCOUNT_DEACTIVATED') return 'Tài khoản đã bị vô hiệu hóa.';
  if (error.code === 'INVALID_CREDENTIALS') return 'Email hoặc mật khẩu không hợp lệ.';
  if (!error.status) return 'Không thể kết nối máy chủ. Vui lòng thử lại.';
  return 'Email hoặc mật khẩu không hợp lệ.';
}

export const Login: React.FC<LoginProps> = ({onNavigate}) => {
  const {login} = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await login({email, password});
      onNavigate('/');
    } catch (submissionError) {
      const authError = submissionError as Error & {code?: string; status?: number};
      if (authError.code === 'EMAIL_NOT_VERIFIED') {
        window.sessionStorage.setItem('audiotalents_verification_email', email);
        onNavigate('/verify-email');
        return;
      }
      setError(loginErrorMessage(authError));
    } finally {
      setIsLoading(false);
    }
  }

  return <AuthShell title="Đăng nhập" subtitle="Tiếp tục hành trình nghe những thế giới." footer={<span>Chưa có tài khoản? <button className="text-primary font-semibold" onClick={() => onNavigate('/register')}>Đăng ký</button></span>}>
    <form onSubmit={submit} className="space-y-4">
      <Field label="Email" type="email" required autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} />
      <label className="block text-xs text-[#c7c4d7]">Mật khẩu<div className="relative"><input type={showPassword ? 'text' : 'password'} required autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} className="mt-1.5 w-full rounded-xl bg-[#262a33] border border-white/10 px-3 py-2.5 pr-16 text-sm text-[#dfe2ee] outline-none focus:border-primary/60" /><button type="button" onClick={() => setShowPassword(value => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-primary">{showPassword ? 'Ẩn' : 'Hiện'}</button></div></label>
      <div className="text-right"><button type="button" onClick={() => onNavigate('/forgot-password')} className="text-xs text-primary">Quên mật khẩu?</button></div>
      <AuthFeedback error={error} />
      <button disabled={isLoading} className="w-full py-2.5 rounded-xl bg-primary text-on-primary text-sm font-bold disabled:opacity-50">{isLoading ? 'Đang đăng nhập...' : 'Đăng nhập'}</button>
    </form>
  </AuthShell>;
};
