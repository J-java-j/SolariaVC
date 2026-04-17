import Nav from './components/Nav';
import Hero from './components/Hero';
import LiveTicker from './components/LiveTicker';
import MedallionFund from './components/MedallionFund';
import Research from './components/Research';
import Approach from './components/Approach';
import Firm from './components/Firm';
import Contact from './components/Contact';
import Footer from './components/Footer';

export default function App() {
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <div className="pointer-events-none absolute inset-0 noise opacity-30" aria-hidden />
      <Nav />
      <main>
        <Hero />
        <LiveTicker />
        <MedallionFund />
        <Research />
        <Approach />
        <Firm />
        <Contact />
      </main>
      <Footer />
    </div>
  );
}
