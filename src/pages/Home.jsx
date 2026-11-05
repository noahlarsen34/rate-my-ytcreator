import { Sparkles, ChevronRight } from 'lucide-react';
import { creators } from '../data/creators';
import { SearchBox, CreatorCard } from '../components/shared';

export function Home({ navigate, query, setQuery }) {
  return <main>
    <section className="hero">
      <div className="eyebrow"><Sparkles size={15} /> Real people. Honest ratings.</div>
      <h1>Know what’s worth<br /><em>your watch time.</em></h1>
      <p>Discover creators you’ll love—and get the full picture before you hit subscribe.</p>
      <div className="hero-search"><SearchBox value={query} setValue={setQuery} onSubmit={() => navigate('creators')} /></div>
      <div className="trend"><span>Trending:</span>{['science', 'DIY', 'travel'].map(x => <button key={x} onClick={() => { setQuery(x); navigate('creators'); }}>{x}</button>)}</div>
    </section>
    <section className="section featured">
      <div className="section-title"><div><span className="kicker">COMMUNITY FAVORITES</span><h2>Creators people trust</h2></div><button className="text-button" onClick={() => navigate('creators')}>View all <ChevronRight size={18} /></button></div>
      <div className="card-grid">{creators.filter(c => c.featured).map(c => <CreatorCard key={c.id} creator={c} navigate={navigate} />)}</div>
    </section>
    <section className="trust-strip">
      <div><strong>8,420+</strong><span>community ratings</span></div><div><strong>540</strong><span>creators reviewed</span></div><div><strong>4.7</strong><span>average usefulness</span></div>
    </section>
    <section className="cta"><div><span className="kicker">YOUR VOICE MATTERS</span><h2>Watched something worth sharing?</h2><p>Help someone else decide what deserves their next click.</p></div><button className="primary" onClick={() => navigate('rate')}>Write a rating <ChevronRight size={18} /></button></section>
  </main>;
}
