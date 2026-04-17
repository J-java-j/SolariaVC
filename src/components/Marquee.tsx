const items = [
  'Frontier AI',
  'Energy & Climate',
  'Robotics',
  'Defense Tech',
  'Bio × Compute',
  'Spatial & Devices',
  'Next-Gen Infra',
  'Crypto Primitives',
];

export default function Marquee() {
  return (
    <section className="relative border-y border-white/5 bg-ink-900/40 py-6 overflow-hidden">
      <div className="flex whitespace-nowrap gap-12 animate-[marquee_40s_linear_infinite]">
        {[...items, ...items, ...items].map((it, i) => (
          <div key={i} className="flex items-center gap-12 text-white/40">
            <span className="font-display text-2xl tracking-tight">{it}</span>
            <Star />
          </div>
        ))}
      </div>
      <style>{`
        @keyframes marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
    </section>
  );
}

function Star() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" className="text-sun-500/70" aria-hidden>
      <path
        d="M7 0 L8.4 5.6 L14 7 L8.4 8.4 L7 14 L5.6 8.4 L0 7 L5.6 5.6 Z"
        fill="currentColor"
      />
    </svg>
  );
}
