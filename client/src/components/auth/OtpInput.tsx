import React, { useEffect, useRef } from 'react';

export function OtpInput({ value, onChange, disabled }: { value: string; onChange: (value: string) => void; disabled?: boolean }) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length: 6 }, (_, index) => value[index] || '');
  useEffect(() => { refs.current[0]?.focus(); }, []);
  const setValue = (next: string) => onChange(next.replace(/\D/g, '').slice(0, 6));

  return <div className="auth-otp" onPaste={event => { event.preventDefault(); setValue(event.clipboardData.getData('text')); }}>
    {digits.map((digit, index) => <input key={index} ref={element => { refs.current[index] = element; }} value={digit} disabled={disabled} inputMode="numeric" autoComplete={index === 0 ? 'one-time-code' : 'off'} maxLength={1} aria-label={`Chữ số OTP ${index + 1}`} className="auth-otp-box"
      onChange={event => { const nextDigit = event.target.value.replace(/\D/g, '').slice(-1); setValue(`${value.slice(0, index)}${nextDigit}${value.slice(index + 1)}`); if (nextDigit) refs.current[index + 1]?.focus(); }}
      onKeyDown={event => { if (event.key === 'Backspace' && !digits[index]) refs.current[index - 1]?.focus(); }} />)}
  </div>;
}
