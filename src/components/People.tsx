import { useReveal } from '../hooks/useReveal';
import { SectionIntro } from './primitives';
import { sectionSurface } from '../lib/sectionTheme';

type PortraitFit = {
  /** Horizontal object-position — higher values shift the subject left in the frame. */
  x?: number;
  /** Vertical object-position — tuned so the hairline sits the same distance from the frame top. */
  y: number;
  scale: number;
  /** 1 = Karl Li reference exposure; higher values brighten underexposed source photos. */
  brightness?: number;
  /** Darkens image edges to tone down bright backgrounds (0–1). */
  vignette?: number;
};

/** Karl Li is the brightness reference (brightness 1). */
const PORTRAIT_BRIGHTNESS_REFERENCE = 1;
const PORTRAIT_BRIGHTNESS_DEFAULT = 1.1;

/** Esteban Reyes is the shoulder-margin reference (scale 1.24). */
const PORTRAIT_FIT_BY_IMAGE: Record<string, PortraitFit> = {
  '/team/esteban-reyes.png': { y: 6, scale: 1.24, brightness: 1.1, vignette: 0.34 },
  '/team/monica.png': { x: 58, y: 5, scale: 1.45, brightness: 1.1 },
  '/team/daniel-zhang.png': { x: 56, y: 5, scale: 1.56, brightness: 1.1 },
  '/team/hiraku.png': { y: 21, scale: 1.24, brightness: 1.1 },
  '/team/johnson-jiang.png': { y: 6, scale: 1.24, brightness: 1.1 },
  '/team/kail-li.png': { x: 58, y: 13, scale: 1.45, brightness: PORTRAIT_BRIGHTNESS_REFERENCE },
  '/team/jack-zhang.png': { x: 63, y: 7, scale: 1.24, brightness: 1.1 },
  '/team/greesh.png': { y: 6, scale: 1.24, brightness: 1.12 },
  '/team/placeholder.png': { y: 6, scale: 1.24, brightness: 1.48 },
  '/team/placeholder-3.png': { y: 6, scale: 1.24, brightness: 1.15 },
};

function portraitFitFor(imageUrl?: string): PortraitFit {
  if (imageUrl && PORTRAIT_FIT_BY_IMAGE[imageUrl]) {
    return PORTRAIT_FIT_BY_IMAGE[imageUrl];
  }
  return { y: 8, scale: 1.24, brightness: PORTRAIT_BRIGHTNESS_DEFAULT };
}

function portraitImageFilter(brightness: number): string | undefined {
  if (brightness <= PORTRAIT_BRIGHTNESS_REFERENCE) return undefined;
  const contrast = 1 + Math.min((brightness - PORTRAIT_BRIGHTNESS_REFERENCE) * 0.2, 0.08);
  return `brightness(${brightness}) contrast(${contrast})`;
}

type TeamMember = {
  name: string;
  role?: string;
  imageUrl?: string;
};

const partners: TeamMember[] = [
  { name: 'Johnson Jiang', role: 'President / Co-Founder', imageUrl: '/team/johnson-jiang.png' },
  { name: 'Karl Li', role: 'Vice President / Co-Founder', imageUrl: '/team/kail-li.png' },
];

type DeskGroup = {
  label: string;
  members: TeamMember[];
};

const deskGroups: DeskGroup[] = [
  {
    label: 'Board',
    members: [
      { name: 'Daniel Zhang', role: 'Chief Technology Officer', imageUrl: '/team/daniel-zhang.png' },
      { name: 'Elliott Yaroslavsky', role: 'Chief Legal Officer' },
      { name: 'Jack Zhang', role: 'Chief Human Resources Officer', imageUrl: '/team/jack-zhang.png' },
      { name: 'Hiraku Aoki', role: 'Chief Marketing Officer', imageUrl: '/team/hiraku.png' },
      { name: 'Aayush Sen', role: 'Head of Investment Department' },
      { name: 'Esteban Reyes', role: 'Head of Research Department', imageUrl: '/team/esteban-reyes.png' },
      {
        name: 'Greeshma Doppalapudi',
        role: 'Head of Venture Capital Department',
        imageUrl: '/team/greesh.png',
      },
      { name: 'Ella Ma', role: 'Head of External Relations Department' },
    ],
  },
  {
    label: 'Staff',
    members: [
      { name: 'Jacob De Palma', role: 'Department of Investment', imageUrl: '/team/placeholder-3.png' },
      { name: 'Tahir Eygoren', role: 'Department of Research', imageUrl: '/team/placeholder.png' },
      { name: 'Monica Lin', role: 'Department of Marketing', imageUrl: '/team/monica.png' },
    ],
  },
];

function PortraitTile({
  size = 'lg',
  imageUrl,
  name,
}: {
  size?: 'lg' | 'sm';
  imageUrl?: string;
  name: string;
}) {
  const dims = size === 'lg' ? 'h-60 w-44' : 'h-48 w-36';
  const fit = portraitFitFor(imageUrl);

  return (
    <div
      className={`${dims} relative mb-5 overflow-hidden border border-[var(--border-strong)] bg-[var(--bg-soft)]`}
      aria-hidden={!imageUrl}
    >
      {imageUrl ? (
        <>
          <img
            src={imageUrl}
            alt={`Portrait of ${name}`}
            className="h-full w-full max-w-none object-cover"
            style={{
              objectPosition: `${fit.x ?? 50}% ${fit.y}%`,
              transform: `scale(${fit.scale})`,
              transformOrigin: `${fit.x ?? 50}% top`,
              filter: portraitImageFilter(fit.brightness ?? PORTRAIT_BRIGHTNESS_DEFAULT),
            }}
          />
          {fit.vignette ? (
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background: `radial-gradient(ellipse 90% 100% at 50% 30%, transparent 38%, rgba(0, 0, 0, ${fit.vignette}) 100%)`,
              }}
              aria-hidden
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export default function People() {
  const [ref, inView] = useReveal(0.08);

  return (
    <section id="people" data-theme="dark" className={`relative scroll-mt-24 ${sectionSurface.dark}`}>
      <div
        ref={ref}
        className={`container-x section-py transition-all duration-700 ease-out ${
          inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
        }`}
      >
        <SectionIntro
          eyebrow="Team"
          title="Partners on every call."
          description="A small, hands-on team — founders and operators who work directly with companies in the portfolio."
        />

        <div className="section-grid grid gap-14 sm:grid-cols-2 sm:gap-16">
          {partners.map((p) => (
            <div key={p.name}>
              <PortraitTile size="lg" imageUrl={p.imageUrl} name={p.name} />
              <div className="text-[21px] font-medium leading-snug text-[var(--fg)]">{p.name}</div>
              {p.role ? <div className="mt-2 text-[16px] text-[var(--fg-muted)]">{p.role}</div> : null}
            </div>
          ))}
        </div>

        <div className="mt-16 border-t border-[var(--border)] pt-12 lg:mt-20">
          {deskGroups.map((group, groupIndex) => (
            <div key={group.label} className={groupIndex > 0 ? 'mt-12' : ''}>
              <p className="text-[14px] font-medium uppercase tracking-[0.05em] text-[var(--fg-faint)]">
                {group.label}
              </p>
              <div className="mt-8 grid gap-12 sm:grid-cols-2 lg:grid-cols-4">
                {group.members.map((member, i) => (
                  <div key={member.imageUrl ?? `${member.name}-${i}`}>
                    <PortraitTile size="sm" imageUrl={member.imageUrl} name={member.name} />
                    <div className="text-[17px] font-medium text-[var(--fg)]">{member.name}</div>
                    {member.role ? (
                      <div className="mt-1.5 text-[15px] text-[var(--fg-muted)]">{member.role}</div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="container-x">
        <div className="rule" />
      </div>
    </section>
  );
}
