export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="relative border-t border-white/5 bg-ink-950">
      <div className="container-x py-12">
        <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="font-display text-2xl tracking-tight">
              Solaria<span className="text-sun-400"> VC</span>
            </div>
            <p className="mt-2 max-w-md text-sm text-white/55">
              A student-led venture club and LLC. Backing the founders building what's next.
            </p>
          </div>
          <div className="flex flex-wrap gap-6 text-sm text-white/60">
            <a href="#about" className="hover:text-white">About</a>
            <a href="#thesis" className="hover:text-white">Thesis</a>
            <a href="#portfolio" className="hover:text-white">Portfolio</a>
            <a href="#team" className="hover:text-white">Team</a>
            <a href="mailto:johnsonj198207@gmail.com" className="hover:text-white">Contact</a>
          </div>
        </div>
        <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-white/5 pt-6 text-xs text-white/40 sm:flex-row sm:items-center">
          <div>© {year} Solaria VC, LLC. All rights reserved.</div>
          <div>Investments are speculative and not for everyone. Not investment advice.</div>
        </div>
      </div>
    </footer>
  );
}
