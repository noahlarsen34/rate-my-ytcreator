import { useEffect, useMemo, useState } from 'react';
import { Sparkles, ChevronRight } from 'lucide-react';
import { SearchBox, CreatorCard } from '../components/shared';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

export function Home({ navigate, query, setQuery, creators, creatorsLoading }) {
  const [siteCounts, setSiteCounts] = useState({ ratings: null, creators: null, followedCreators: null });
  const [homeQuery, setHomeQuery] = useState(query);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const suggestions = useMemo(() => {
    const term = homeQuery.trim().toLowerCase();
    return term ? creators.filter(creator => `${creator.name} ${creator.handle || ''} ${creator.topic} ${creator.category}`.toLowerCase().includes(term)).slice(0, 8) : [];
  }, [creators, homeQuery]);
  const searchCreators = value => {
    setQuery(value);
    navigate('creators');
  };

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let active = true;
    Promise.all([
      supabase.from('reviews').select('*', { count: 'exact', head: true }),
      supabase.from('content_creators').select('*', { count: 'exact', head: true }),
      supabase.rpc('get_followed_creator_count')
    ]).then(([ratingsResult, creatorsResult, followedResult]) => {
      if (!active) return;
      if (ratingsResult.error) console.error('Rating count could not be loaded:', ratingsResult.error.message);
      if (creatorsResult.error) console.error('Creator count could not be loaded:', creatorsResult.error.message);
      if (followedResult.error) console.error('Followed creator count could not be loaded:', followedResult.error.message);
      setSiteCounts({ ratings: ratingsResult.error ? null : ratingsResult.count, creators: creatorsResult.error ? null : creatorsResult.count, followedCreators: followedResult.error ? null : followedResult.data });
    });
    return () => { active = false; };
  }, []);

  return <main>
    <section className="hero">
      <div className="eyebrow"><Sparkles size={15} /> Real people. Honest ratings.</div>
      <h1>Know what’s worth<br /><em>your watch time.</em></h1>
      <p>Discover creators you’ll love—and get the full picture before you hit subscribe.</p>
      <div className="hero-search discover-search-wrap" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setSuggestionsOpen(false); }}>
        <SearchBox value={homeQuery} setValue={value => { setHomeQuery(value); setSuggestionsOpen(true); }} onSubmit={() => searchCreators(homeQuery)} />
        {suggestionsOpen && suggestions.length > 0 && <div className="discover-creator-suggestions" role="listbox" aria-label="Creator suggestions">
          {suggestions.map(creator => <button type="button" role="option" key={creator.id} onMouseDown={event => event.preventDefault()} onClick={() => { setHomeQuery(creator.name); setSuggestionsOpen(false); searchCreators(creator.name); }}>
            <span className="creator-suggestion-avatar">{creator.initials}</span><span><b>{creator.name}</b><small>{creator.handle} · {creator.topic}</small></span>
          </button>)}
        </div>}
      </div>
    </section>
    <section className="section home-explore-layout">
      <aside className="home-explore-sidebar"><span className="kicker">EXPLORE</span><h2>Explore creators</h2><p>Browse community ratings by topic.</p><button type="button" className="home-explore-link" onClick={() => searchCreators('')}>All creators <ChevronRight size={16}/></button>{[...new Set(creators.map(creator => creator.category).filter(Boolean))].slice(0, 8).map(category=><button type="button" className="home-explore-link" key={category} onClick={()=>searchCreators(category)}>{category}<ChevronRight size={16}/></button>)}</aside>
      <div className="home-featured-creators"><section className="section featured">
      <div className="section-title"><div><span className="kicker">YOUTUBE CREATORS</span><h2>Creators in the community</h2></div><button className="text-button" onClick={() => navigate('creators')}>View all <ChevronRight size={18} /></button></div>
      {creatorsLoading ? <div className="empty"><h3>Loading creators…</h3></div> : creators.length ? <div className="card-grid">{creators.slice(0, 3).map(c => <CreatorCard key={c.id} creator={c} navigate={navigate} />)}</div> : <div className="empty"><h3>No creators yet</h3><p>Creators will appear here when they are added to the community.</p></div>}
    </section></div></section>
    <section className="trust-strip">
      <div><strong>{siteCounts.ratings === null ? '—' : `${(Math.floor(siteCounts.ratings / 5) * 5).toLocaleString()}+`}</strong><span>community ratings</span></div><div><strong>{siteCounts.creators === null ? '—' : siteCounts.creators.toLocaleString()}</strong><span>creators</span></div><div><strong>{siteCounts.followedCreators === null ? '—' : Number(siteCounts.followedCreators).toLocaleString()}</strong><span>creators followed</span></div>
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
