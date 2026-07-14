import { useId, useState } from 'react';
import type { CommunityProgram } from '../../lib/homeData';

function AccordionItem({
  item,
  isOpen,
  onToggle,
}: {
  item: CommunityProgram;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const triggerId = useId();
  const panelId = useId();

  return (
    <div className="community-accordion__item">
      <button
        type="button"
        id={triggerId}
        className="community-accordion__trigger"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={onToggle}
      >
        <span className="community-accordion__title">{item.title}</span>
        <span className="community-accordion__icon" aria-hidden>
          {isOpen ? '−' : '+'}
        </span>
      </button>

      <div className="community-accordion__rule" aria-hidden />

      <div
        id={panelId}
        className={`community-accordion__panel ${isOpen ? 'is-open' : ''}`}
        role="region"
        aria-labelledby={triggerId}
        aria-hidden={!isOpen}
      >
        <div className="community-accordion__panel-inner">
          <p className="community-accordion__body">{item.description}</p>
        </div>
      </div>
    </div>
  );
}

export default function CommunityAccordion({ items }: { items: CommunityProgram[] }) {
  const [openIndices, setOpenIndices] = useState<Set<number>>(() => new Set());

  const toggle = (index: number) => {
    setOpenIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  return (
    <div className="community-accordion">
      {items.map((item, index) => (
        <AccordionItem
          key={item.title}
          item={item}
          isOpen={openIndices.has(index)}
          onToggle={() => toggle(index)}
        />
      ))}
    </div>
  );
}
