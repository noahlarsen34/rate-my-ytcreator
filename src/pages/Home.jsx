import { useEffect, useState } from 'react';
import { Sparkles, ChevronRight } from 'lucide-react';
import { SearchBox, CreatorCard } from '../components/shared';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

export function Home({ navigate, query, setQuery, creators, creatorsLoading }) {
  const [ratingCount, setRatingCount] = useState(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let active = true;
    supabase.from('reviews').select('*', { count: 'exact', head: true }).then(ratingsResult => {
      if (!active) return;
      if (ratingsResult.error) console.error('Rating count could not be loaded:', ratingsResult.error.message);
      setRatingCount(ratingsResult.error ? null : ratingsResult.count);
    });
    return () => { active = false; };
  }, []);

  return <main>
    <section className="hero">
      <div className="eyebrow"><Sparkles size={15} /> Real people. Honest ratings.</div>
      <h1>Know what’s worth<br /><em>your watch time.</em></h1>
      <p>Discover creators you’ll love—and get the full picture before you hit subscribe.</p>
      <div className="hero-search"><SearchBox value={query} setValue={setQuery} onSubmit={() => navigate('creators')} /></div>
    </section>
    <section className="section featured">
      <div className="section-title"><div><span className="kicker">YOUTUBE CREATORS</span><h2>Creators in the community</h2></div><button className="text-button" onClick={() => navigate('creators')}>View all <ChevronRight size={18} /></button></div>
      {creatorsLoading ? <div className="empty"><h3>Loading creators…</h3></div> : creators.length ? <div className="card-grid">{creators.slice(0, 3).map(c => <CreatorCard key={c.id} creator={c} navigate={navigate} />)}</div> : <div className="empty"><h3>No creators yet</h3><p>Creators will appear here when they are added to the community.</p></div>}
    </section>
    <section className="trust-strip">
      <div><strong>{ratingCount === null ? '—' : ratingCount.toLocaleString()}</strong><span>community ratings</span></div><div><strong>{creators.length.toLocaleString()}</strong><span>creators</span></div>
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
