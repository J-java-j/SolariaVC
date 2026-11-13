import { motion, useReducedMotion } from 'framer-motion';
import SolariaOrbit from './SolariaOrbit';
import { Eyebrow } from './primitives';
import { sectionSurface } from '../lib/sectionTheme';

const ease = [0.22, 1, 0.36, 1] as const;

const enter = (delay = 0, reduced = false) =>
  reduced
    ? {}
    : {
        initial: { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.5, ease, delay },
      };

function HeroAtmosphere() {
  return (
    <div className="hero-atmosphere" aria-hidden>
      <div className="hero-atmosphere__grid" />
      <div className="hero-atmosphere__light" />
      <SolariaOrbit className="hero-atmosphere__orbit" />
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
      className={`hero-scene relative overflow-hidden ${sectionSurface.dark}`}
    >
      <HeroAtmosphere />

      <div className="hero-content container-x w-full pb-14 sm:pb-20 lg:pb-12">
        <div className="max-w-[60rem]">
          <motion.div {...enter(0, reduced)}>
            <Eyebrow>Student venture capital · UC San Diego</Eyebrow>
          </motion.div>

          <motion.h1 className="hero-headline" {...enter(0.06, reduced)}>
            <span className="hero-headline__line hero-headline__primary">
              <span className="hero-headline__word">Back</span>{' '}
              <span className="hero-headline__word">It</span>,
            </span>
            <span className="hero-headline__line hero-headline__secondary">
              <span className="hero-headline__word">Before</span>{' '}
              <span className="hero-headline__word">It</span>{' '}
              <span className="hero-headline__word">Rises.</span>
            </span>
          </motion.h1>

          <motion.p className="hero-lede" {...enter(0.14, reduced)}>
            Solaria Capital is a student-led venture platform — sourcing startups, writing first
            checks, and building a community around ambitious founders and frontier technology.
          </motion.p>
        </div>
      </div>
    </section>
  );
}
