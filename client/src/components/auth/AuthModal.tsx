import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { AuthInput } from './AuthInput';
import { OtpInput } from './OtpInput';

export type AuthMode = 'login' | 'register' | 'verify' | 'forgot' | 'reset' | 'success';
interface AuthModalProps { mode: AuthMode; onModeChange: (mode: AuthMode) => void; onClose: () => void; }

const loginMessage = (error: Error & { code?: string; status?: number }) => {
  if (error.code === 'ACCOUNT_SUSPENDED') return 'Tài khoản đang bị tạm khóa.';
  if (error.code === 'ACCOUNT_DEACTIVATED') return 'Tài khoản đã bị vô hiệu hóa.';
  if (!error.status) return 'Không thể kết nối máy chủ. Vui lòng thử lại.';
  return 'Email hoặc mật khẩu không hợp lệ.';
};
const otpMessage = (code?: string) => code === 'OTP_EXPIRED' ? 'Mã đã hết hạn.' : code === 'OTP_ALREADY_USED' ? 'Mã đã được sử dụng.' : code === 'OTP_MAX_ATTEMPTS' ? 'Bạn đã nhập sai quá số lần cho phép.' : 'Mã xác thực không hợp lệ.';

export function AuthModal({ mode, onModeChange, onClose }: AuthModalProps) {
  const { login, register, verifyEmail, resendVerification, forgotPassword, resetPassword } = useAuth();
  const [email, setEmail] = useState(() => sessionStorage.getItem('audiotalents_verification_email') || sessionStorage.getItem('audiotalents_reset_email') || '');
  const [username, setUsername] = useState(''); const [password, setPassword] = useState(''); const [confirmPassword, setConfirmPassword] = useState(''); const [otp, setOtp] = useState('');
  const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [loading, setLoading] = useState(false); const [cooldown, setCooldown] = useState(0); const [completed, setCompleted] = useState(false);
  const isRegister = mode === 'register';
  useEffect(() => { if (!cooldown) return; const timer = window.setInterval(() => setCooldown(value => Math.max(value - 1, 0)), 1000); return () => clearInterval(timer); }, [cooldown]);
  useEffect(() => { const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && !loading) onClose(); }; window.addEventListener('keydown', escape); return () => window.removeEventListener('keydown', escape); }, [loading, onClose]);
  const switchMode = (next: AuthMode) => { setError(''); setNotice(''); setOtp(''); onModeChange(next); };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError(''); setNotice(''); setLoading(true);
    try {
      if (mode === 'login') { await login({ email, password }); onClose(); return; }
      if (mode === 'register') { if (password !== confirmPassword) throw new Error('Mật khẩu xác nhận không khớp.'); await register({ username, email, password }); sessionStorage.setItem('audiotalents_verification_email', email); switchMode('verify'); return; }
      if (mode === 'verify') { await verifyEmail(email, otp); sessionStorage.removeItem('audiotalents_verification_email'); setCompleted(true); return; }
      if (mode === 'forgot') { await forgotPassword(email); sessionStorage.setItem('audiotalents_reset_email', email); setNotice('Nếu email hợp lệ, mã xác thực đã được gửi đến hộp thư của bạn.'); window.setTimeout(() => switchMode('reset'), 500); return; }
      if (mode === 'reset') { if (password !== confirmPassword) throw new Error('Mật khẩu xác nhận không khớp.'); if (password.length < 8) throw new Error('Mật khẩu phải có ít nhất 8 ký tự.'); await resetPassword({ email, otp, password }); sessionStorage.removeItem('audiotalents_reset_email'); setCompleted(true); }
    } catch (reason) {
      const apiError = reason as Error & { code?: string; status?: number };
      if (mode === 'login' && apiError.code === 'EMAIL_NOT_VERIFIED') {
        sessionStorage.setItem('audiotalents_verification_email', email);
        setNotice('Email này chưa được xác minh. Hãy nhập mã OTP hoặc gửi lại mã.');
        onModeChange('verify');
        return;
      }
      setError(apiError.message === 'Mật khẩu xác nhận không khớp.' || apiError.message.startsWith('Mật khẩu phải') ? apiError.message : mode === 'login' ? loginMessage(apiError) : (mode === 'verify' || mode === 'reset') ? otpMessage(apiError.code) : (apiError.code === 'CONFLICT' || apiError.code === 'EMAIL_ALREADY_REGISTERED') ? 'Email đã được đăng ký. Vui lòng đăng nhập.' : 'Không thể xử lý yêu cầu lúc này. Vui lòng thử lại.');
    } finally { setLoading(false); }
  };
  const resend = async () => { setError(''); setLoading(true); try { await resendVerification(email); setCooldown(60); setNotice('Mã xác thực mới đã được gửi.'); } catch { setError('Không thể gửi lại mã lúc này.'); } finally { setLoading(false); } };
  const title = completed ? (mode === 'verify' ? 'Email đã xác thực' : 'Đặt lại mật khẩu thành công') : mode === 'login' ? 'Đăng nhập' : mode === 'register' ? 'Tạo tài khoản' : mode === 'verify' ? 'Xác thực email' : mode === 'forgot' ? 'Quên mật khẩu' : 'Đặt lại mật khẩu';
  const subtitle = completed ? 'Bạn đã sẵn sàng tiếp tục hành trình âm thanh.' : mode === 'login' ? 'Tiếp tục hành trình nghe những thế giới.' : mode === 'register' ? 'Tham gia cộng đồng AudioTalents.' : mode === 'verify' ? 'Mã xác thực đã được gửi đến email của bạn.' : mode === 'forgot' ? 'Nhập email để nhận mã xác thực.' : 'Tạo mật khẩu mới cho tài khoản của bạn.';
  return <div className="auth-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !loading) onClose(); }}><div className={`auth-modal ${isRegister ? 'auth-modal-register' : ''}`} role="dialog" aria-modal="true" aria-labelledby="auth-title">
    <button type="button" className="auth-close" onClick={onClose} aria-label="Đóng cửa sổ xác thực"><span className="material-symbols-outlined">close</span></button>
    <div className="auth-brand"><div className="auth-mark"><i /><i /><i /><i /></div><div><strong>AudioTalents</strong><span>Audio Platform</span></div></div>
    <header><h1 id="auth-title">{title}</h1><p>{subtitle}</p></header>
    {completed ? <div className="auth-success"><div>✓</div><p>{subtitle}</p><button className="auth-primary" onClick={() => switchMode('login')}>Đăng nhập</button></div> : <form onSubmit={submit} className="auth-form">
      {mode === 'register' && <AuthInput label="Tên hiển thị" value={username} onChange={event => setUsername(event.target.value)} autoComplete="username" minLength={2} required />}
      {(mode !== 'verify' || !email) && <AuthInput label="Email" type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" required />}
      {mode === 'login' && <><AuthInput label="Mật khẩu" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" passwordToggle required /><button type="button" className="auth-link auth-forgot" onClick={() => switchMode('forgot')}>Quên mật khẩu?</button></>}
      {mode === 'register' && <><AuthInput label="Mật khẩu" value={password} onChange={event => setPassword(event.target.value)} autoComplete="new-password" minLength={8} passwordToggle required /><AuthInput label="Xác nhận mật khẩu" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} autoComplete="new-password" minLength={8} passwordToggle required /><label className="auth-terms"><input type="checkbox" required /> <span>Tôi đồng ý với Điều khoản sử dụng và Chính sách bảo mật</span></label></>}
      {(mode === 'verify' || mode === 'reset') && <><div><span className="auth-label">Mã xác thực</span><OtpInput value={otp} onChange={setOtp} disabled={loading} /></div>{mode === 'reset' && <><AuthInput label="Mật khẩu mới" value={password} onChange={event => setPassword(event.target.value)} minLength={8} passwordToggle required /><div className="auth-strength"><span style={{ width: `${Math.min(password.length * 10, 100)}%` }} /></div><AuthInput label="Xác nhận mật khẩu mới" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} minLength={8} passwordToggle required /></>}</>}
      {error && <p role="alert" className="auth-error">{error}</p>}{notice && <p role="status" className="auth-notice">{notice}</p>}
      <button disabled={loading || ((mode === 'verify' || mode === 'reset') && otp.length !== 6)} className="auth-primary">{loading ? 'Đang xử lý...' : mode === 'login' ? 'Đăng nhập' : mode === 'register' ? 'Tạo tài khoản' : mode === 'verify' ? 'Xác nhận' : mode === 'forgot' ? 'Gửi mã xác thực' : 'Cập nhật mật khẩu'}</button>
      {mode === 'verify' && <button type="button" disabled={loading || cooldown > 0} onClick={resend} className="auth-resend">{cooldown ? `Gửi lại sau ${cooldown}s` : 'Gửi lại mã'}</button>}
    </form>}
    {mode === 'login' && <p className="auth-footer">Chưa có tài khoản? <button onClick={() => switchMode('register')}>Đăng ký</button></p>}
    {mode === 'register' && <p className="auth-footer">Đã có tài khoản? <button onClick={() => switchMode('login')}>Đăng nhập</button></p>}
    {(mode === 'forgot' || mode === 'verify' || mode === 'reset') && <p className="auth-footer"><button onClick={() => switchMode('login')}>Quay lại đăng nhập</button></p>}
  </div></div>;
}
