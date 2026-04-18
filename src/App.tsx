import ThemeManager from './components/ThemeManager';
import Nav from './components/Nav';
import Hero from './components/Hero';
import Fund from './components/Fund';
import Record from './components/Record';
import Strategy from './components/Strategy';
import Ventures from './components/Ventures';
import Research from './components/Research';
import Firm from './components/Firm';
import Contact from './components/Contact';
import Footer from './components/Footer';

export default function App() {
  return (
    <div className="relative min-h-screen">
      <ThemeManager />
      <Nav />
      <main>
        <Hero />
        <Fund />
        <Record />
        <Strategy />
        <Ventures />
        <Research />
        <Firm />
        <Contact />
      </main>
      <Footer />
    </div>
  );
}
