import { useState, type ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost';

type Props = {
  email: string;
  subject?: string;
  body?: string;
  variant?: Variant;
  className?: string;
  showAddress?: boolean;
  children: ReactNode;
};

/**
 * Contact button that actually works:
 *  - Always copies the email to the clipboard (reliable across browsers / OS)
 *  - Shows an inline "Copied" confirmation
 *  - Also triggers the default mail client via mailto (in case one is set up)
 *  - Optionally shows the literal address underneath so users can copy it by eye
 */
export default function EmailButton({
  email,
  subject,
  body,
  variant = 'primary',
  className = '',
  showAddress = true,
  children,
}: Props) {
  const [copied, setCopied] = useState(false);

  const params = new URLSearchParams();
  if (subject) params.set('subject', subject);
  if (body) params.set('body', body);
  const href = `mailto:${email}${params.toString() ? `?${params.toString()}` : ''}`;

  const onClick = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(email);
      } else {
        legacyCopy(email);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2400);
    } catch {
      // clipboard denied — still let the mailto navigation try
    }
  };

  const baseBtn =
    'inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold transition-all';
  const variants: Record<Variant, string> = {
    primary:
      'bg-moss-500 text-ink-950 hover:bg-moss-400 hover:translate-y-[-1px] glow-moss',
    secondary:
      'border border-white/15 bg-white/[0.04] text-white hover:bg-white/[0.08] hover:border-white/25 hover:translate-y-[-1px]',
    ghost: 'text-white/80 hover:text-white',
  };

  return (
    <div className={className}>
      <a
        href={href}
        onClick={onClick}
        className={`${baseBtn} ${variants[variant]} relative overflow-hidden`}
      >
        <span className={`transition-opacity ${copied ? 'opacity-0' : 'opacity-100'}`}>
          {children}
        </span>
        <span
          aria-live="polite"
          className={`absolute inset-0 grid place-items-center transition-all ${
            copied ? 'opacity-100 scale-100' : 'opacity-0 scale-90 pointer-events-none'
          }`}
        >
          <span className="inline-flex items-center gap-1.5">
            <CheckIcon />
            Email copied
          </span>
        </span>
        {!copied && <span aria-hidden>→</span>}
      </a>
      {showAddress && (
        <div className="mt-3 flex items-center gap-2 text-[11px] text-white/45">
          <MailIcon />
          <span className="num select-all">{email}</span>
          <span className="text-white/25">·</span>
          <span>{copied ? 'Copied to clipboard' : 'Click to copy + compose'}</span>
        </div>
      )}
    </div>
  );
}

function legacyCopy(text: string) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
  } finally {
    document.body.removeChild(ta);
  }
}

function CheckIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 8.5 L6.5 12 L13 4.5" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-moss-400/80"
      aria-hidden
    >
      <rect x="1.5" y="3" width="13" height="10" rx="1.5" />
      <path d="M2 4l6 5 6-5" />
    </svg>
  );
}

export const SOLARIA_EMAIL = 'joj059@ucsd.edu';
