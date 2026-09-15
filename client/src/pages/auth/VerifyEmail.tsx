import React, { useEffect, useState } from 'react';
import { AuthShell, AuthFeedback, Field, OtpInput } from './AuthShell';
import { useAuth } from '../../context/AuthContext';

interface VerifyEmailProps { onNavigate: (path: string) => void; }

export const VerifyEmail: React.FC<VerifyEmailProps> = ({onNavigate}) => {
  const {verifyEmail, resendVerification} = useAuth();
  const [email, setEmail] = useState(() => window.sessionStorage.getItem('audiotalents_verification_email') || '');
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('Chúng tôi đã gửi mã xác thực đến email của bạn.');

  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setInterval(() => setCooldown(value => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(''); setSuccess(''); setIsLoading(true);
    try {
      await verifyEmail(email, otp);
      window.sessionStorage.removeItem('audiotalents_verification_email');
      setSuccess('Email đã được xác thực.');
      window.setTimeout(() => onNavigate('/login'), 700);
    } catch (submissionError) {
      const code = (submissionError as Error & {code?: string}).code;
      setError(code === 'OTP_EXPIRED' ? 'Mã đã hết hạn.' : code === 'OTP_ALREADY_USED' ? 'Mã đã được sử dụng.' : code === 'OTP_MAX_ATTEMPTS' ? 'Bạn đã nhập sai quá số lần cho phép.' : code === 'SMTP_NOT_CONFIGURED' ? 'Email service chưa được cấu hình.' : 'Mã xác thực không hợp lệ.');
    } finally { setIsLoading(false); }
  }

  async function resend() {
    setError(''); setSuccess('');
    try {
      await resendVerification(email);
      setCooldown(60);
      setSuccess('Mã xác thực mới đã được gửi.');
    } catch (submissionError) {
      const code = (submissionError as Error & {code?: string}).code;
      setError(code === 'OTP_RESEND_COOLDOWN' ? 'Vui lòng chờ trước khi gửi lại mã.' : code === 'SMTP_NOT_CONFIGURED' ? 'Email service chưa được cấu hình.' : 'Không thể gửi lại mã xác thực.');
    }
  }

  return <AuthShell title="Xác thực email" subtitle="Nhập mã 6 chữ số đã được gửi đến email của bạn." footer={<button className="text-primary font-semibold" onClick={() => onNavigate('/login')}>Quay lại đăng nhập</button>}>
    <form onSubmit={submit} className="space-y-4">
      <Field label="Email" type="email" required value={email} onChange={event => setEmail(event.target.value)} />
      <div>
        <p className="text-xs text-[#c7c4d7] mb-1.5">Mã xác thực</p>
        <OtpInput value={otp} onChange={setOtp} disabled={isLoading} />
      </div>
      <AuthFeedback error={error} success={success} />
      <button disabled={isLoading || otp.length !== 6} className="w-full py-2.5 rounded-xl bg-primary text-on-primary text-sm font-bold disabled:opacity-50">{isLoading ? 'Đang xác thực...' : 'Xác thực email'}</button>
      <button type="button" disabled={cooldown > 0} onClick={resend} className="w-full text-xs text-primary disabled:text-[#908fa0]">{cooldown ? `Gửi lại sau ${cooldown}s` : 'Gửi lại mã xác thực'}</button>
    </form>
  </AuthShell>;
};
