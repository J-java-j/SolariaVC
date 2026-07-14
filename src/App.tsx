import Nav from './components/Nav';
import Hero from './components/Hero';
import Approach from './components/Approach';
import Portfolio from './components/Portfolio';
import Community from './components/Community';
import People from './components/People';
import Experience from './components/Experience';
import InvestmentPortfolio from './components/InvestmentPortfolio';
import Research from './components/Research';
import Contact from './components/Contact';
import Footer from './components/Footer';
import { useNavTheme } from './hooks/useNavTheme';

export default function App() {
  useNavTheme();

  return (
    <div className="relative min-h-screen isolate">
      <Nav />
      <main>
        <Hero />
        <Approach />
        <Experience />
        <InvestmentPortfolio />
        <Research />
        <Portfolio />
        <Community />
        <People />
        <Contact />
      </main>
      <Footer />
    </div>
  );
}
