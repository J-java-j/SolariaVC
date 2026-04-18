import Nav from './components/Nav';
import Hero from './components/Hero';
import Numbers from './components/Numbers';
import ThreeDesks from './components/ThreeDesks';
import MedallionFund from './components/MedallionFund';
import Ventures from './components/Ventures';
import Research from './components/Research';
import Firm from './components/Firm';
import Contact from './components/Contact';
import Footer from './components/Footer';

export default function App() {
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <Nav />
      <main>
        <Hero />
        <Numbers />
        <ThreeDesks />
        <MedallionFund />
        <Ventures />
        <Research />
        <Firm />
        <Contact />
      </main>
      <Footer />
    </div>
  );
}
