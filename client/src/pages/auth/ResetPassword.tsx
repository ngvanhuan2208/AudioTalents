import React, { useState } from 'react';
import { AuthShell, AuthFeedback, Field, OtpInput } from './AuthShell';
import { useAuth } from '../../context/AuthContext';

interface ResetPasswordProps { onNavigate: (path: string) => void; }

export const ResetPassword: React.FC<ResetPasswordProps> = ({onNavigate}) => {
  const {resetPassword} = useAuth();
  const [email, setEmail] = useState(() => window.sessionStorage.getItem('audiotalents_reset_email') || '');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(''); setSuccess('');
    if (password !== confirmPassword) { setError('Mật khẩu xác nhận không khớp.'); return; }
    if (password.length < 8) { setError('Mật khẩu phải có ít nhất 8 ký tự.'); return; }
    setIsLoading(true);
    try {
      await resetPassword({email, otp, password});
      window.sessionStorage.removeItem('audiotalents_reset_email');
      setSuccess('Mật khẩu đã được đặt lại.');
      window.setTimeout(() => onNavigate('/login'), 700);
    } catch (submissionError) {
      const code = (submissionError as Error & {code?: string}).code;
      setError(code === 'OTP_EXPIRED' ? 'Mã đã hết hạn.' : code === 'OTP_ALREADY_USED' ? 'Mã đã được sử dụng.' : code === 'OTP_MAX_ATTEMPTS' ? 'Bạn đã nhập sai quá số lần cho phép.' : code === 'VALIDATION_ERROR' ? 'Mật khẩu chưa đủ mạnh.' : 'Mã không hợp lệ hoặc không thể đặt lại mật khẩu.');
    } finally { setIsLoading(false); }
  }

  return <AuthShell title="Đặt lại mật khẩu" subtitle="Tạo mật khẩu mới cho tài khoản của bạn." footer={<button className="text-primary font-semibold" onClick={() => onNavigate('/login')}>Quay lại đăng nhập</button>}>
    <form onSubmit={submit} className="space-y-4">
      <Field label="Email" type="email" required value={email} onChange={event => setEmail(event.target.value)} />
      <div>
        <p className="text-xs text-[#c7c4d7] mb-1.5">Mã xác thực</p>
        <OtpInput value={otp} onChange={setOtp} disabled={isLoading} />
      </div>
      <Field label="Mật khẩu mới" type="password" required minLength={8} autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} />
      <Field label="Xác nhận mật khẩu mới" type="password" required minLength={8} autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} />
      <AuthFeedback error={error} success={success} />
      <button disabled={isLoading} className="w-full py-2.5 rounded-xl bg-primary text-on-primary text-sm font-bold disabled:opacity-50">{isLoading ? 'Đang cập nhật...' : 'Đặt lại mật khẩu'}</button>
    </form>
  </AuthShell>;
};
