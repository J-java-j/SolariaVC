import { Mark } from '../components/primitives';

// The staff page is a launcher. Each tool keeps its own sign-in, so nothing here is private.
type Tool = {
  name: string;
  about: string;
  signIn: string;
  links: { label: string; href: string; address: string }[];
};

const tools: Tool[] = [
  {
    name: 'Solaria Sign',
    about: 'Send documents for signature, track who has signed, and keep the sealed copies.',
    signIn: 'Sign in with your team email. We send you a one-time link.',
    links: [{ label: 'Open Solaria Sign', href: '/sign', address: 'solariavc.com/sign' }],
  },
  {
    name: 'Solaria Terminal',
    about: 'Options flow, prices and charts for the trading desk.',
    signIn: 'Sign in with the shared staff password.',
    links: [
      { label: 'Open Solaria Terminal', href: 'https://terminal.solariavc.com', address: 'terminal.solariavc.com' },
    ],
  },
  {
    name: 'Business cards',
    about: 'The pages behind our NFC cards. People can save your contact or send you theirs.',
    signIn: 'Public pages, no sign-in.',
    links: [
      { label: 'Johnson Jiang', href: '/card', address: 'solariavc.com/card' },
      { label: 'Karl Li', href: '/card/karl', address: 'solariavc.com/card/karl' },
    ],
  },
];

export default function Staff() {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--fg)]">
      <header className="container-x flex items-center justify-between py-6">
        <a href="/" className="flex items-center gap-3 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent-soft)]">
          <Mark size={36} />
          <span className="text-[20px] font-semibold leading-none tracking-tight">Solaria VC</span>
        </a>
        <a href="/" className="text-[16px] text-[var(--fg-muted)] transition-colors hover:text-[var(--fg)]">
          Back to the site
        </a>
      </header>

      <main className="container-x pb-24 pt-14 sm:pt-20">
        <h1 className="font-serif text-display-md font-normal">Staff</h1>
        <p className="mt-5 max-w-xl text-body-lg text-[var(--fg-muted)]">
          Everything the Solaria team works in. Each tool has its own sign-in.
        </p>

        <ul className="mt-14 border-t border-[var(--border-strong)]">
          {tools.map((tool) => (
            <li
              key={tool.name}
              className="grid gap-6 border-b border-[var(--border-strong)] py-10 md:grid-cols-12 md:gap-10"
            >
              <div className="md:col-span-7">
                <h2 className="text-[26px] font-medium leading-tight tracking-tight">{tool.name}</h2>
                <p className="mt-3 max-w-lg text-body text-[var(--fg-muted)]">{tool.about}</p>
                <p className="mt-3 text-[15px] text-[var(--fg-faint)]">{tool.signIn}</p>
              </div>
              <div className="flex flex-col gap-3 md:col-span-5 md:items-end md:justify-center">
                {tool.links.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    className="group flex w-full flex-col rounded-md border border-[var(--border-strong)] px-5 py-3.5 transition-colors hover:border-[var(--accent-soft)] hover:bg-[var(--accent-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-soft)] md:max-w-sm"
                  >
                    <span className="text-[17px] font-medium">{link.label}</span>
                    <span className="mt-0.5 break-all text-[14px] text-[var(--fg-faint)] group-hover:text-[var(--fg-muted)]">
                      {link.address}
                    </span>
                  </a>
                ))}
              </div>
            </li>
          ))}
        </ul>

        <p className="mt-10 max-w-xl text-[15px] text-[var(--fg-faint)]">
          The research office runs on the office Mac mini and opens only there. Need access to something?
          Email contact@solariavc.com.
        </p>
      </main>
    </div>
  );
}
