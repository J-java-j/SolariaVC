import type { ReactNode } from 'react';
import { Mark } from '../components/primitives';

// The staff page is a launcher. Each tool keeps its own sign-in, so nothing here is private.
type Link = { label: string; note: string; href: string; address: string; download?: boolean };
type Tool = { name: string; about: string; signIn: string; icon: ReactNode; links: Link[] };

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

const icons = {
  sign: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <path d="M4 19c3-1 4.5-4 6-4s1 3 3 3 2.5-2 4-2" />
      <path d="M14.5 4.5l3 3L9 16l-3.5.5L6 13z" />
    </svg>
  ),
  terminal: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <path d="M6 4v16M12 7v11M18 5v13" />
      <rect x="4.5" y="8" width="3" height="7" rx="0.5" />
      <rect x="10.5" y="10" width="3" height="5" rx="0.5" />
      <rect x="16.5" y="7" width="3" height="6" rx="0.5" />
    </svg>
  ),
  card: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <circle cx="8.5" cy="11" r="1.8" />
      <path d="M6 15.5c.6-1.2 1.5-1.8 2.5-1.8s1.9.6 2.5 1.8M14 10h4M14 13h3" />
    </svg>
  ),
  mail: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <path d="M3.5 7l8.5 6 8.5-6" />
    </svg>
  ),
  globe: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.5 2.6 3.5 5.4 3.5 8.5s-1 5.9-3.5 8.5c-2.5-2.6-3.5-5.4-3.5-8.5s1-5.9 3.5-8.5z" />
    </svg>
  ),
};

const tools: Tool[] = [
  {
    name: 'Solaria Sign',
    about: 'Send documents for signature, follow who has signed, and keep the sealed copies. Fields are found when a PDF is uploaded.',
    signIn: 'Email, then a one-time link. The team sees everything; anyone else sees only their own',
    icon: icons.sign,
    links: [
      { label: 'Documents', note: 'Send, track, remind and sign. One sign-in page for the team and for everyone we send to', href: '/sign', address: 'solariavc.com/sign' },
      { label: 'Check a signed document', note: 'Anyone can confirm a PDF we sealed is genuine', href: '/sign/verify', address: 'solariavc.com/sign/verify' },
      { label: 'Team', note: 'Owner only: add or remove admins', href: '/sign/team', address: 'solariavc.com/sign/team' },
    ],
  },
  {
    name: 'Solaria Terminal',
    about: 'Options flow, prices and charts for the trading desk.',
    signIn: 'Shared staff password',
    icon: icons.terminal,
    links: [
      { label: 'Terminal', note: 'Flow, quotes and charts', href: 'https://terminal.solariavc.com', address: 'terminal.solariavc.com' },
      { label: 'Admin', note: 'Owner only: set the staff password', href: 'https://terminal.solariavc.com/admin', address: 'terminal.solariavc.com/admin' },
    ],
  },
  {
    name: 'Business cards',
    about: 'The pages behind our NFC cards. People can save your contact or send you theirs.',
    signIn: 'Public, no sign-in',
    icon: icons.card,
    links: [
      { label: 'Johnson Jiang', note: 'Card page', href: '/card', address: 'solariavc.com/card' },
      { label: 'Karl Li', note: 'Card page', href: '/card/karl', address: 'solariavc.com/card/karl' },
      { label: 'Johnson’s contact', note: 'Download the vCard', href: '/card/johnson-jiang.vcf', address: 'johnson-jiang.vcf', download: true },
      { label: 'Karl’s contact', note: 'Download the vCard', href: '/card/karl-li.vcf', address: 'karl-li.vcf', download: true },
    ],
  },
  {
    name: 'Email',
    about: 'Solaria mail is hosted by Titan. Pitches and signing questions arrive at the contact inbox.',
    signIn: 'Your @solariavc.com address',
    icon: icons.mail,
    links: [
      { label: 'Webmail', note: 'Read and send Solaria email', href: 'https://app.titan.email', address: 'app.titan.email' },
      { label: 'Contact inbox', note: 'Write to the shared inbox', href: 'mailto:contact@solariavc.com', address: 'contact@solariavc.com' },
    ],
  },
  {
    name: 'Public pages',
    about: 'What people outside Solaria see.',
    signIn: 'Public, no sign-in',
    icon: icons.globe,
    links: [
      { label: 'Website', note: 'Home page and pitch form', href: '/', address: 'solariavc.com' },
      { label: 'Linktree', note: 'Our links in one place', href: 'https://linktr.ee/solariaventure', address: 'linktr.ee/solariaventure' },
    ],
  },
];

const isExternal = (href: string) => href.startsWith('http');

function LinkRow({ link }: { link: Link }) {
  const external = isExternal(link.href);
  return (
    <a
      href={link.href}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      {...(link.download ? { download: '' } : {})}
      className="staff-link group flex items-center gap-4 rounded-lg px-4 py-3.5 transition-colors duration-200 hover:bg-[var(--accent-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-soft)]"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[17px] font-medium leading-snug text-[var(--fg)]">{link.label}</span>
        <span className="mt-0.5 block text-[14px] leading-snug text-[var(--fg-faint)]">{link.note}</span>
      </span>
      <span className="hidden shrink-0 text-[13px] text-[var(--fg-faint)] transition-colors group-hover:text-[var(--accent-soft)] sm:block">
        {link.address}
      </span>
      <svg
        viewBox="0 0 16 16"
        className="h-4 w-4 shrink-0 text-[var(--fg-faint)] transition-[color,transform] duration-200 group-hover:translate-x-0.5 group-hover:text-[var(--accent-soft)]"
        aria-hidden
        {...stroke}
      >
        {link.download ? (
          <path d="M8 2.5v8M4.5 7.5L8 11l3.5-3.5M3 13.5h10" />
        ) : external ? (
          <path d="M5 11L11 5M6 5h5v5" />
        ) : (
          <path d="M6 3.5L10.5 8 6 12.5" />
        )}
      </svg>
      {external && <span className="sr-only">(opens in a new tab)</span>}
    </a>
  );
}

function ToolPanel({ tool, wide }: { tool: Tool; wide?: boolean }) {
  return (
    <section
      aria-labelledby={`tool-${tool.name}`}
      className={`rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-soft)] p-2 ${wide ? 'lg:col-span-2' : ''}`}
    >
      <div className="flex items-start gap-4 px-4 pb-4 pt-5">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--accent-muted)] text-[var(--accent-soft)] [&>svg]:h-6 [&>svg]:w-6">
          {tool.icon}
        </span>
        <div className="min-w-0">
          <h2 id={`tool-${tool.name}`} className="text-[22px] font-medium leading-tight tracking-tight">
            {tool.name}
          </h2>
          <p className="mt-1.5 max-w-md text-[16px] leading-relaxed text-[var(--fg-muted)]">{tool.about}</p>
          <p className="mt-2.5 inline-flex items-center gap-2 text-[13px] text-[var(--fg-faint)]">
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden {...stroke}>
              <rect x="3.5" y="7" width="9" height="6.5" rx="1.2" />
              <path d="M5.5 7V5.2a2.5 2.5 0 015 0V7" />
            </svg>
            {tool.signIn}
          </p>
        </div>
      </div>
      <div className={`border-t border-[var(--border)] pt-1.5 ${wide ? 'lg:grid lg:grid-cols-2 lg:gap-x-2' : ''}`}>
        {tool.links.map((link) => (
          <LinkRow key={link.href} link={link} />
        ))}
      </div>
    </section>
  );
}

export default function Staff() {
  const [sign, terminal, ...rest] = tools;
  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--bg)] text-[var(--fg)]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[520px]"
        style={{
          background:
            'radial-gradient(60% 70% at 15% 0%, rgba(73,121,107,0.28), transparent 70%), radial-gradient(40% 50% at 90% 10%, rgba(73,121,107,0.12), transparent 70%)',
        }}
      />

      <header className="container-x relative flex items-center justify-between py-6">
        <a
          href="/"
          className="flex items-center gap-3 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent-soft)]"
        >
          <Mark size={36} />
          <span className="text-[20px] font-semibold leading-none tracking-tight">Solaria VC</span>
        </a>
        <a href="/" className="text-[16px] text-[var(--fg-muted)] transition-colors hover:text-[var(--fg)]">
          Back to the site
        </a>
      </header>

      <main className="container-x relative pb-24 pt-12 sm:pt-16">
        <h1 className="font-serif text-display-md font-normal">Staff</h1>
        <p className="mt-4 max-w-xl text-body-lg text-[var(--fg-muted)]">
          Everything the Solaria team works in, in one place. Each tool has its own sign-in.
        </p>

        <div className="mt-12 grid gap-5 lg:grid-cols-2">
          <ToolPanel tool={sign} />
          <ToolPanel tool={terminal} />
          {rest.map((tool, i) => (
            <ToolPanel key={tool.name} tool={tool} wide={i === 0} />
          ))}
        </div>

        <p className="mt-10 max-w-2xl text-[15px] leading-relaxed text-[var(--fg-faint)]">
          The research office runs on the office Mac mini and opens only there. Need access to something here?
          Email{' '}
          <a href="mailto:contact@solariavc.com" className="text-[var(--fg-muted)] underline-offset-4 hover:underline">
            contact@solariavc.com
          </a>
          .
        </p>
      </main>
    </div>
  );
}
