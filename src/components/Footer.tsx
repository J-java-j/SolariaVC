export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="relative border-t border-white/[0.06] bg-ink-950">
      <div className="container-x py-14">
        <div className="grid gap-10 md:grid-cols-12">
          <div className="md:col-span-5">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="Solaria" className="h-9 w-9 object-contain" />
              <div className="font-display text-2xl tracking-tight">Solaria</div>
            </div>
            <p className="mt-4 max-w-md text-sm text-white/55 leading-relaxed">
              Solaria Capital, LLC. A privately held investment partnership operating the Medallion
              Fund, Solaria Ventures, and Solaria Research.
            </p>
            <div className="num mt-6 text-xs text-white/40">
              johnsonj198207@gmail.com
            </div>
          </div>

          <div className="md:col-span-7 grid grid-cols-2 gap-8 sm:grid-cols-4">
            <FooterCol
              title="Capital"
              items={[
                { label: 'Medallion Fund', href: '#fund' },
                { label: 'Investor inquiries', href: '#contact' },
              ]}
            />
            <FooterCol
              title="Ventures"
              items={[
                { label: 'Portfolio', href: '#ventures' },
                { label: 'Pitch us', href: '#contact' },
              ]}
            />
            <FooterCol
              title="Research"
              items={[
                { label: 'Notes', href: '#research' },
                { label: 'Subscribe', href: '#research' },
              ]}
            />
            <FooterCol
              title="Firm"
              items={[
                { label: 'Approach', href: '#approach' },
                { label: 'Team', href: '#firm' },
                { label: 'Contact', href: '#contact' },
              ]}
            />
          </div>
        </div>

        <div className="mt-14 border-t border-white/[0.06] pt-6 text-[11px] text-white/40 leading-relaxed">
          <p>
            © {year} Solaria Capital, LLC. All rights reserved. Solaria, the Medallion Fund,
            Solaria Ventures, and Solaria Research are marks of Solaria Capital, LLC.
          </p>
          <p className="mt-3 max-w-4xl">
            This material is for informational purposes only and does not constitute an offer to sell or a
            solicitation to buy any security. The Medallion Fund is offered only to accredited investors via
            a private placement memorandum. Past performance is not indicative of future results. Investments
            in the Fund involve substantial risk, including loss of principal.
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, items }: { title: string; items: { label: string; href: string }[] }) {
  return (
    <div>
      <div className="label !text-white/45">{title}</div>
      <ul className="mt-4 space-y-2.5">
        {items.map((it) => (
          <li key={it.label}>
            <a href={it.href} className="text-sm text-white/65 hover:text-white">
              {it.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
