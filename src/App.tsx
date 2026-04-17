import Nav from './components/Nav';
import Hero from './components/Hero';
import LiveTicker from './components/LiveTicker';
import PerformanceDashboard from './components/PerformanceDashboard';
import MedallionFund from './components/MedallionFund';
import Ventures from './components/Ventures';
import Research from './components/Research';
import Approach from './components/Approach';
import FirmActivity from './components/FirmActivity';
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
        <PerformanceDashboard />
        <MedallionFund />
        <Ventures />
        <Research />
        <Approach />
        <FirmActivity />
        <Firm />
        <Contact />
      </main>
      <Footer />
    </div>
  );
}
