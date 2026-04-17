import Nav from './components/Nav';
import Hero from './components/Hero';
import Marquee from './components/Marquee';
import About from './components/About';
import Thesis from './components/Thesis';
import Portfolio from './components/Portfolio';
import Team from './components/Team';
import Apply from './components/Apply';
import Footer from './components/Footer';

export default function App() {
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <div className="pointer-events-none absolute inset-0 noise opacity-40" aria-hidden />
      <Nav />
      <main>
        <Hero />
        <Marquee />
        <About />
        <Thesis />
        <Portfolio />
        <Team />
        <Apply />
      </main>
      <Footer />
    </div>
  );
}
