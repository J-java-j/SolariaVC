import ContactForm from './ContactForm';
import Reveal from './Reveal';

const facts = [
  { k: 'Response',     v: '≤ 2 business days' },
  { k: 'Headquarters', v: 'La Jolla, CA' },
  { k: 'Domicile',     v: 'California, USA' },
  { k: 'Privacy',      v: 'Never shared' },
];

export default function Contact() {
  return (
    <section
      id="contact"
      className="relative border-t border-white/[0.06] py-20 sm:py-28 lg:py-36"
    >
      <div className="container-x">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
          <Reveal className="lg:col-span-5">
            <div className="text-[11px] uppercase tracking-[0.24em] text-moss-300/80">
              Contact
            </div>
            <h2 className="mt-4 font-display text-3xl font-medium leading-tight tracking-tight sm:text-4xl">
              Tell us about yourself.
            </h2>
            <p className="mt-6 text-white/70 leading-relaxed">
              Investor inquiries, founder pitches, research collaborations.
            </p>

            <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-white/[0.06] pt-6 text-sm">
              {facts.map((f) => (
                <div key={f.k}>
                  <dt className="text-[10.5px] uppercase tracking-[0.2em] text-white/45">
                    {f.k}
                  </dt>
                  <dd className="num mt-1 text-white">{f.v}</dd>
                </div>
              ))}
            </dl>
          </Reveal>

          <Reveal delay={120} className="lg:col-span-7">
            <ContactForm />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
