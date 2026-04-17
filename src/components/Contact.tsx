import Spotlight from './Spotlight';
import ContactForm from './ContactForm';
import Reveal from './Reveal';

const facts = [
  { k: 'Response', v: '≤ 2 business days' },
  { k: 'Headquarters', v: 'San Diego, CA' },
  { k: 'Domicile', v: 'California, USA' },
  { k: 'Privacy', v: 'Never shared' },
];

export default function Contact() {
  return (
    <section
      id="contact"
      className="relative py-28 sm:py-36 border-t border-white/[0.06] bg-gradient-to-b from-ink-950 via-ink-900/40 to-ink-950"
    >
      <div className="container-x">
        <div className="grid gap-12 lg:grid-cols-12">
          <Reveal className="lg:col-span-5">
            <div className="label">Contact</div>
            <h2 className="mt-4 font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
              Tell us about <br className="hidden sm:block" />
              yourself.
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-white/70">
              Investor inquiries, founder pitches, and research collaborations all land in the
              same partner inbox. Short notes are welcome — we'd rather reply to a paragraph
              than skim a deck.
            </p>

            <dl className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
              {facts.map((f) => (
                <div key={f.k} className="bg-ink-900/60 px-5 py-4">
                  <dt className="label !text-white/40 !text-[10px]">{f.k}</dt>
                  <dd className="num mt-1.5 text-sm text-white">{f.v}</dd>
                </div>
              ))}
            </dl>
          </Reveal>

          <Reveal delay={120} className="lg:col-span-7">
            <Spotlight intensity={0.14} className="rounded-2xl">
              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-ink-900/80 via-ink-900/60 to-ink-800/60 p-6 sm:p-8 backdrop-blur-sm">
                <div
                  className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-moss-500/15 blur-3xl"
                  aria-hidden
                />
                <ContactForm />
              </div>
            </Spotlight>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
