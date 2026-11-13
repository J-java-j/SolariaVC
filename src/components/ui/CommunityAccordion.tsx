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
    <div className={`accordion__item${isOpen ? ' is-open' : ''}`}>
      <button
        type="button"
        id={triggerId}
        className="accordion__trigger"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={onToggle}
      >
        <span className="accordion__title">{item.title}</span>
        <span className="accordion__icon" aria-hidden />
      </button>

      <div
        id={panelId}
        className={`accordion__panel ${isOpen ? 'is-open' : ''}`}
        role="region"
        aria-labelledby={triggerId}
        aria-hidden={!isOpen}
      >
        <div className="accordion__panel-inner">
          <p className="accordion__body">{item.description}</p>
        </div>
      </div>
    </div>
  );
}

export default function CommunityAccordion({
  items,
  variant = 'list',
}: {
  items: CommunityProgram[];
  variant?: 'list' | 'cards';
}) {
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
    <div className={`accordion ${variant === 'cards' ? 'accordion--cards' : 'accordion--list'}`}>
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
