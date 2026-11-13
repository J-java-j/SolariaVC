import { Fragment } from 'react';
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
  /** Horizontal nudge in px on the image; positive shifts the subject right in the frame. */
  shiftX?: number;
};

/** Karl Li is the brightness reference (brightness 1). */
const PORTRAIT_BRIGHTNESS_REFERENCE = 1;
const PORTRAIT_BRIGHTNESS_DEFAULT = 1.1;

/** Esteban Reyes is the shoulder-margin reference (scale 1.24). */
const PORTRAIT_FIT_BY_IMAGE: Record<string, PortraitFit> = {
  '/team/esteban-reyes.png': { y: 6, scale: 1.24, brightness: 1 },
  '/team/monica.png': { x: 62, y: 5, scale: 1.45, brightness: 1 },
  '/team/daniel-zhang.png': { x: 86, y: 0, scale: 1.04, brightness: 1 },
  '/team/johnson-jiang.png': { y: 6, scale: 1.24, brightness: 1 },
  '/team/kail-li.png': { x: 65, y: 13, scale: 1.45, brightness: 1 },
  '/team/jack-zhang.png': { x: 63, y: 7, scale: 1.24, brightness: 1 },
  '/team/greesh.png': { x: 54, y: 6, scale: 1.24, brightness: 1 },
  '/team/placeholder.png': { x: 54, y: 6, scale: 1.24, brightness: 1 },
  '/team/placeholder-3.png': { x: 60, y: 6, scale: 1.24, brightness: 1 },
  '/team/elliott-yaroslavsky.png': { x: 16, y: 50, scale: 1, brightness: 1 },
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
      { name: 'Elliott Yaroslavsky', role: 'Chief Legal Officer', imageUrl: '/team/elliott-yaroslavsky.png' },
      { name: 'Jack Zhang', role: 'Chief Human Resources Officer', imageUrl: '/team/jack-zhang.png' },
      { name: 'Esteban Reyes', role: 'Head of Research Department', imageUrl: '/team/esteban-reyes.png' },
      {
        name: 'Greeshma Doppalapudi',
        role: 'Head of Venture Capital Department',
        imageUrl: '/team/greesh.png',
      },
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

/** Frame sizes the crops were tuned at. Tiles only shrink when a phone column is narrower. */
const PORTRAIT_FRAME = {
  lg: { width: 176, aspect: '176 / 240' },
  sm: { width: 144, aspect: '144 / 192' },
} as const;

function PortraitTile({
  size = 'lg',
  imageUrl,
  name,
}: {
  size?: 'lg' | 'sm';
  imageUrl?: string;
  name: string;
}) {
  const frame = PORTRAIT_FRAME[size];
  const fit = portraitFitFor(imageUrl);
  const shiftPct = ((fit.shiftX ?? 0) / frame.width) * 100;

  return (
    <div
      className="relative max-w-full overflow-hidden rounded-[0.375rem] bg-[#ece3d9]"
      style={{ width: frame.width, aspectRatio: frame.aspect }}
      aria-hidden={!imageUrl}
    >
      {imageUrl ? (
        <>
          <img
            src={imageUrl}
            alt={`Portrait of ${name}`}
            loading="lazy"
            decoding="async"
            className="h-full w-full max-w-none object-cover"
            style={{
              objectPosition: `${fit.x ?? 50}% ${fit.y}%`,
              transform: `scale(${fit.scale}) translateX(${shiftPct}%)`,
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
    <section id="people" data-theme="dark" className={`relative scroll-mt-20 ${sectionSurface.dark}`}>
      <div ref={ref} className={`container-x section-py reveal ${inView ? 'is-in' : ''}`}>
        <SectionIntro
          eyebrow="Team"
          title="Partners on every call."
          description="A small, hands-on team — founders and operators who work directly with companies in the portfolio."
        />

        <div className="team-grid mt-12 sm:mt-14">
          {partners.map((p) => (
            <div key={p.name}>
              <PortraitTile size="sm" imageUrl={p.imageUrl} name={p.name} />
              <div className="mt-4 text-[1.125rem] font-semibold leading-snug tracking-[-0.01em] text-[var(--fg)] sm:text-[1.3125rem]">
                {p.name}
              </div>
              {p.role ? (
                <div className="mt-1 text-[0.9375rem] leading-snug text-[var(--fg-muted)] sm:whitespace-nowrap sm:text-[1rem]">
                  {p.role.split(' / ').map((part, i, parts) => (
                    <Fragment key={part}>
                      {i > 0 ? ' ' : null}
                      <span className="whitespace-nowrap">
                        {part}
                        {i < parts.length - 1 ? ' /' : null}
                      </span>
                    </Fragment>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>

        <div className="mt-16 space-y-14 lg:mt-20 lg:space-y-16">
          {deskGroups.map((group) => (
            <div key={group.label}>
              <p className="group-label">{group.label}</p>
              <div className="team-grid mt-7">
                {group.members.map((member, i) => (
                  <div key={member.imageUrl ?? `${member.name}-${i}`}>
                    <PortraitTile size="sm" imageUrl={member.imageUrl} name={member.name} />
                    <div className="mt-4">
                      <div className="text-[1.0625rem] font-semibold leading-snug text-[var(--fg)]">
                        {member.name}
                      </div>
                      {member.role ? (
                        <div className="mt-1 text-[0.9375rem] leading-snug text-[var(--fg-muted)]">
                          {member.role}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
