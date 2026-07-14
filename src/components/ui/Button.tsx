import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'md' | 'lg';

const base =
  'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-[background-color,border-color,color,opacity] duration-200 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-deep)] disabled:pointer-events-none disabled:opacity-50';

const variants: Record<Variant, string> = {
  primary:
    'border border-[var(--fg)] bg-[var(--fg)] text-[var(--bg)] hover:opacity-90',
  secondary:
    'border border-[var(--border-strong)] bg-transparent text-[var(--fg)] hover:border-[var(--fg-muted)]',
  ghost: 'border border-transparent bg-transparent text-[var(--fg-muted)] hover:text-[var(--fg)]',
};

const sizes: Record<Size, string> = {
  md: 'px-6 py-3 text-[17px]',
  lg: 'px-7 py-3.5 text-[18px]',
};

type Common = {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  className?: string;
};

type ButtonProps = Common &
  ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };

type LinkProps = Common &
  AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  href,
  ...rest
}: ButtonProps | LinkProps) {
  const cls = `${base} ${variants[variant]} ${sizes[size]} ${className}`.trim();

  if (href) {
    return (
      <a href={href} className={cls} {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)}>
        {children}
      </a>
    );
  }

  const { type = 'button', ...buttonRest } = rest as ButtonHTMLAttributes<HTMLButtonElement>;
  return (
    <button type={type} className={cls} {...buttonRest}>
      {children}
    </button>
  );
}
