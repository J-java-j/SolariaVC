import Nav from './components/Nav';
import Hero from './components/Hero';
import Approach from './components/Approach';
import Fund from './components/Fund';
import Ventures from './components/Ventures';
import Quote from './components/Quote';
import People from './components/People';
import Contact from './components/Contact';
import Footer from './components/Footer';

export default function App() {
  return (
    <div className="relative min-h-screen">
      <Nav />
      <main>
        <Hero />
        <Approach />
        <Fund />
        <Ventures />
        <Quote />
        <People />
        <Contact />
      </main>
      <Footer />
    </div>
  );
}
