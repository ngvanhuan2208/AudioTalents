import React, { useId, useState } from 'react';

type AuthInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  passwordToggle?: boolean;
};

export function AuthInput({ label, error, passwordToggle, type, className = '', id, ...props }: AuthInputProps) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const [visible, setVisible] = useState(false);
  const inputType = passwordToggle ? (visible ? 'text' : 'password') : type;

  return <div>
    <label htmlFor={inputId} className="auth-label">{label}</label>
    <div className="relative">
      <input id={inputId} type={inputType} aria-invalid={Boolean(error)} aria-describedby={error ? `${inputId}-error` : undefined} className={`auth-input ${passwordToggle ? 'pr-14' : ''} ${error ? 'auth-input-error' : ''} ${className}`} {...props} />
      {passwordToggle && <button type="button" onClick={() => setVisible(value => !value)} className="auth-password-toggle" aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}>{visible ? 'Ẩn' : 'Hiện'}</button>}
    </div>
    {error && <p id={`${inputId}-error`} role="alert" className="auth-error">{error}</p>}
  </div>;
}
