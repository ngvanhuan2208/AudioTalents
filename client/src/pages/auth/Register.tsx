import React, { useState } from 'react';
import { AuthShell, AuthFeedback, Field } from './AuthShell';
import { useAuth } from '../../context/AuthContext';

interface RegisterProps { onNavigate: (path: string) => void; }

export const Register: React.FC<RegisterProps> = ({onNavigate}) => {
  const {register} = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    if (password !== confirmPassword) { setError('Mật khẩu xác nhận không khớp.'); return; }
    setIsLoading(true);
    try {
      await register({username, email, password});
      window.sessionStorage.setItem('audiotalents_verification_email', email);
      onNavigate('/verify-email');
    } catch (submissionError) {
      const code = (submissionError as Error & {code?: string}).code;
      setError(code === 'SMTP_NOT_CONFIGURED' ? 'Email service chưa được cấu hình. Vui lòng thử lại sau.' : code === 'CONFLICT' ? 'Email đã được đăng ký.' : 'Không thể tạo tài khoản. Vui lòng kiểm tra thông tin.');
    } finally { setIsLoading(false); }
  }

  return <AuthShell title="Tạo tài khoản" subtitle="Bắt đầu lưu lại những thế giới yêu thích." footer={<span>Đã có tài khoản? <button className="text-primary font-semibold" onClick={() => onNavigate('/login')}>Đăng nhập</button></span>}>
    <form onSubmit={submit} className="space-y-4">
      <Field label="Tên hiển thị" required minLength={2} autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} />
      <Field label="Email" type="email" required autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} />
      <Field label="Mật khẩu" type="password" required minLength={8} autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} />
      <Field label="Xác nhận mật khẩu" type="password" required minLength={8} autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} />
      <p className="text-[11px] text-[#908fa0]">Sau khi đăng ký, chúng tôi sẽ gửi mã xác thực đến email của bạn.</p>
      <AuthFeedback error={error} />
      <button disabled={isLoading} className="w-full py-2.5 rounded-xl bg-primary text-on-primary text-sm font-bold disabled:opacity-50">{isLoading ? 'Đang tạo tài khoản...' : 'Đăng ký'}</button>
    </form>
  </AuthShell>;
};
