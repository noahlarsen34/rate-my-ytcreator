import { useEffect, useState } from 'react';
import { Sparkles, ChevronRight } from 'lucide-react';
import { creators } from '../data/creators';
import { SearchBox, CreatorCard } from '../components/shared';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

export function Home({ navigate, query, setQuery }) {
  const [siteCounts, setSiteCounts] = useState({ ratings: null, creators: null });

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let active = true;
    Promise.all([
      supabase.from('reviews').select('*', { count: 'exact', head: true }),
      supabase.from('content_creators').select('*', { count: 'exact', head: true })
    ]).then(([ratingsResult, creatorsResult]) => {
      if (!active) return;
      if (ratingsResult.error) console.error('Rating count could not be loaded:', ratingsResult.error.message);
      if (creatorsResult.error) console.error('Creator count could not be loaded:', creatorsResult.error.message);
      setSiteCounts({ ratings: ratingsResult.error ? null : ratingsResult.count, creators: creatorsResult.error ? null : creatorsResult.count });
    });
    return () => { active = false; };
  }, []);

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
      <div><strong>{siteCounts.ratings === null ? '—' : `${(Math.floor(siteCounts.ratings / 5) * 5).toLocaleString()}+`}</strong><span>community ratings</span></div><div><strong>{siteCounts.creators === null ? '—' : siteCounts.creators.toLocaleString()}</strong><span>creators</span></div><div><strong>4.7</strong><span>average usefulness</span></div>
    </section>
    <section className="section google-data-summary" aria-labelledby="google-data-heading">
      <span className="kicker">OPTIONAL YOUTUBE CONNECTION</span>
      <h2 id="google-data-heading">How Rate My Creator works with Google and YouTube</h2>
      <p>Rate My Creator is a community review service that helps people evaluate YouTube creators before deciding what to watch. Anyone can browse public creator ratings without logging in.</p>
      <p>Users may optionally connect their Google account and grant read-only access to their YouTube subscriptions. We use that information only to match subscribed channels with creators available on Rate My Creator, follow those creators on the user’s behalf, and show their community scores. We do not modify a user’s YouTube account.</p>
      <p>Google user data is not sold, used for advertising or credit decisions, used to train artificial intelligence models, or used to create or distribute AI-generated non-consensual intimate imagery.</p>
      <button className="text-button" onClick={() => navigate('privacy')}>Read the Rate My Creator Privacy Policy <ChevronRight size={18}/></button>
    </section>
    <section className="cta"><div><span className="kicker">YOUR VOICE MATTERS</span><h2>Watched something worth sharing?</h2><p>Help someone else decide what deserves their next click.</p></div><button className="primary" onClick={() => navigate('rate')}>Write a rating <ChevronRight size={18} /></button></section>
  </main>;
}
