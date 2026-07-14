import Card from './Card';
import type { PortfolioCompany } from '../../lib/homeData';

export default function PortfolioCard({ company }: { company: PortfolioCompany }) {
  return (
    <Card className="flex h-full flex-col">
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="text-[22px] font-semibold leading-snug text-[var(--fg)]">{company.name}</h3>
        <span className="shrink-0 text-[15px] text-[var(--fg-muted)]">{company.status}</span>
      </div>

      <p className="mt-5 text-body leading-relaxed text-[var(--fg-muted)]">{company.tagline}</p>

      <p className="mt-auto pt-6 text-[16px] text-[var(--fg-muted)]">
        {company.tags.join(' · ')} · {company.stage}
      </p>
    </Card>
  );
}
