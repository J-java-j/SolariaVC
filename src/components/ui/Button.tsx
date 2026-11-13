import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'sm' | 'md' | 'lg';
type Icon = 'arrow' | 'external' | 'download';

const variants: Record<Variant, string> = {
  primary: 'btn--primary',
  secondary: 'btn--secondary',
  ghost: 'btn--ghost',
};

const sizes: Record<Size, string> = {
  sm: 'btn--sm',
  md: 'btn--md',
  lg: 'btn--lg',
};

const icons: Record<Icon, { className: string; path: ReactNode }> = {
  arrow: { className: 'btn__icon--arrow', path: <path d="M3 8h9.5M8.5 4l4 4-4 4" /> },
  external: { className: 'btn__icon--external', path: <path d="M5 11l6-6M6 5h5v5" /> },
  download: {
    className: 'btn__icon--download',
    path: <path d="M8 2.5v8M4.5 7L8 10.5 11.5 7M3 13.5h10" />,
  },
};

type Common = {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  icon?: Icon;
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
  icon,
  className = '',
  href,
  ...rest
}: ButtonProps | LinkProps) {
  const cls = `btn ${variants[variant]} ${sizes[size]} ${className}`.trim();
  const content = (
    <>
      {children}
      {icon ? (
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`btn__icon ${icons[icon].className}`}
          aria-hidden
        >
          {icons[icon].path}
        </svg>
      ) : null}
    </>
  );

  if (href) {
    return (
      <a href={href} className={cls} {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)}>
        {content}
      </a>
    );
  }

  const { type = 'button', ...buttonRest } = rest as ButtonHTMLAttributes<HTMLButtonElement>;
  return (
    <button type={type} className={cls} {...buttonRest}>
      {content}
    </button>
  );
}
