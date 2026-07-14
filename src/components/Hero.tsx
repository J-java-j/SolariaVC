import { motion, useReducedMotion } from 'framer-motion';
import SolariaOrbit from './SolariaOrbit';
import { easeOut } from '../lib/motion';
import { sectionSurface } from '../lib/sectionTheme';

const enter = (delay = 0, reduced = false) =>
  reduced
    ? {}
    : {
        initial: { opacity: 0, y: 14 },
        animate: { opacity: 1, y: 0 },
        transition: { ...easeOut, delay },
      };

function HeroAtmosphere() {
  return (
    <div className="hero-atmosphere" aria-hidden>
      <div className="hero-atmosphere__grid" />
      <SolariaOrbit className="hero-atmosphere__orbit" />
      <div className="hero-atmosphere__light" />
      <div className="hero-atmosphere__vignette" />
      <div className="hero-atmosphere__horizon" />
    </div>
  );
}

export default function Hero() {
  const reduced = useReducedMotion() ?? false;

  return (
    <section
      id="top"
      data-theme="dark"
      data-hero="vc-2026"
      className={`hero-scene relative overflow-hidden border-b border-[var(--border)] ${sectionSurface.dark}`}
    >
      <HeroAtmosphere />

      <div className="hero-content container-x w-full pb-16 pt-[7.25rem] sm:pb-24 sm:pt-[9.5rem] lg:pb-28 lg:pt-[11rem]">
        <motion.div className="max-w-[980px]" {...enter(0, reduced)}>
          <p className="eyebrow-meta">Student venture capital · UC San Diego</p>

          <h1 className="hero-headline">
            <span className="hero-headline__line hero-headline__primary">
              <span className="hero-headline__word">Backing</span>{' '}
              <span className="hero-headline__word">Builders</span>
            </span>
            <span className="hero-headline__line hero-headline__secondary">
              <span className="hero-headline__word">at</span>{' '}
              <span className="hero-headline__word">the</span>{' '}
              <span className="hero-headline__word">Frontier.</span>
            </span>
          </h1>

          <p className="hero-lede">
            Solaria VC is a student-led venture platform — sourcing startups, writing first
            checks, and building a community around ambitious founders and frontier technology.
          </p>
        </motion.div>
      </div>

      <div className="hero-content container-x pb-0">
        <div className="rule" />
      </div>
    </section>
  );
}
