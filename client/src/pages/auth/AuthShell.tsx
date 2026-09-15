import React, {useRef} from 'react';

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}

export const AuthShell: React.FC<AuthShellProps> = ({title, subtitle, children, footer}) => (
  <main className="min-h-screen bg-[#0f131c] text-[#dfe2ee] flex items-center justify-center px-4 py-10">
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-[#1c2028] border border-white/10 flex items-center justify-center gap-1 p-2">
            <span className="w-1 h-4 bg-primary rounded-full" />
            <span className="w-1 h-7 bg-tertiary rounded-full" />
            <span className="w-1 h-5 bg-secondary rounded-full" />
          </div>
          <div className="text-left">
            <div className="text-xl font-bold text-primary">AudioTalents</div>
            <div className="text-[9px] font-semibold tracking-[0.18em] text-[#908fa0]">Audio Platform</div>
          </div>
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        <p className="text-sm text-[#908fa0] mt-2">{subtitle}</p>
      </div>
      <section className="bg-[#1c2028] border border-white/10 rounded-2xl p-6 shadow-2xl">{children}</section>
      <div className="text-center text-xs text-[#908fa0] mt-5">{footer}</div>
    </div>
  </main>
);

export function Field({label, ...props}: React.InputHTMLAttributes<HTMLInputElement> & {label: string}) {
  return (
    <label className="block text-xs text-[#c7c4d7]">
      {label}
      <input {...props} className="mt-1.5 w-full rounded-xl bg-[#262a33] border border-white/10 px-3 py-2.5 text-sm text-[#dfe2ee] outline-none focus:border-primary/60" />
    </label>
  );
}

export function AuthFeedback({error, success}: {error?: string; success?: string}) {
  return <>{error && <p role="alert" className="text-xs text-error">{error}</p>}{success && <p role="status" className="text-xs text-tertiary">{success}</p>}</>;
}

export function OtpInput({value, onChange, disabled}: {value: string; onChange: (next: string) => void; disabled?: boolean}) {
  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({length: 6}, (_, index) => value[index] || '');

  function focusIndex(index: number) {
    inputs.current[Math.max(0, Math.min(5, index))]?.focus();
  }

  function update(next: string) {
    onChange(next.replace(/\D/g, '').slice(0, 6));
  }

  return (
    <div className="flex justify-between gap-2" onPaste={event => { event.preventDefault(); update(event.clipboardData.getData('text')); }}>
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={element => { inputs.current[index] = element; }}
          value={digit}
          disabled={disabled}
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          autoFocus={index === 0}
          maxLength={1}
          aria-label={`OTP digit ${index + 1}`}
          className="w-10 h-12 sm:w-12 rounded-xl bg-[#262a33] border border-white/10 text-center text-lg text-[#dfe2ee] outline-none focus:border-primary/60"
          onChange={event => {
            const nextDigit = event.target.value.replace(/\D/g, '').slice(-1);
            const next = `${value.slice(0, index)}${nextDigit}${value.slice(index + 1)}`;
            update(next);
            if (nextDigit) focusIndex(index + 1);
          }}
          onKeyDown={event => {
            if (event.key === 'Backspace' && !digits[index]) focusIndex(index - 1);
          }}
        />
      ))}
    </div>
  );
}
