import { useEffect, useMemo, useState } from 'react';
import { Sparkles, ChevronRight, Search, UsersRound } from 'lucide-react';
import { SearchBox, CreatorCard } from '../components/shared';
import { supabase } from '../lib/supabase';
import { recordUserSearch } from '../lib/searchHistory';

export function Home({ navigate, query, setQuery, creators, creatorsLoading }) {
  const [siteCounts, setSiteCounts] = useState({ ratings: null, creators: null });
  const [totalVotes, setTotalVotes] = useState(null);
  const [homeQuery, setHomeQuery] = useState(query);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const suggestions = useMemo(() => {
    const term = homeQuery.trim().toLowerCase();
    return term ? creators.filter(creator => `${creator.name} ${creator.handle || ''} ${creator.topic} ${creator.category}`.toLowerCase().includes(term)).slice(0, 8) : [];
  }, [creators, homeQuery]);
  const searchCreators = value => {
    void recordUserSearch(value);
    setQuery(value);
    navigate('creators');
  };

  useEffect(() => {
    if (!supabase) return;
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

  useEffect(() => {
    if (!supabase) {
      setTotalVotes(0);
      return;
    }
    let active = true;
    const loadTotalVotes = async () => {
      const pageSize = 1000;
      let offset = 0;
      let count = 0;
      try {
        while (active) {
          const { data: reviewRows, error: reviewsError } = await supabase
            .from('reviews')
            .select('review_id')
            .order('review_id', { ascending: true })
            .range(offset, offset + pageSize - 1);
          if (reviewsError) throw reviewsError;
          const reviewIds = (reviewRows || []).map(review => review.review_id);
          if (!reviewIds.length) break;

          const { data: voteCounts, error: voteCountsError } = await supabase.rpc('get_review_vote_counts', { p_review_ids: reviewIds });
          if (voteCountsError) throw voteCountsError;
          count += (voteCounts || []).reduce((total, row) => total + Number(row.upvotes) + Number(row.downvotes), 0);
          if (reviewIds.length < pageSize) break;
          offset += reviewIds.length;
        }
        if (active) setTotalVotes(count);
      } catch (error) {
        console.error('Review vote total could not be loaded:', error.message);
        if (active) setTotalVotes(null);
      }
    };
    loadTotalVotes();
    return () => { active = false; };
  }, []);

  const topRatedCreators = creators
    .filter(creator => creator.reviews > 0)
    .slice()
    .sort((first, second) => second.score - first.score || second.reviews - first.reviews || first.name.localeCompare(second.name))
    .slice(0, 3);

  return <main>
    <section className="hero">
      <div className="eyebrow"><Sparkles size={15} /> Make informed choices about online content</div>
      <h1>Know what’s worth<br /><em>your watch time.</em></h1>
     <p>Check community insights on creators before you watch or subscribe. For young viewers and the adults who support them.</p>
      <div className="hero-search discover-search-wrap" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setSuggestionsOpen(false); }}>
        <SearchBox value={homeQuery} setValue={value => { setHomeQuery(value); setSuggestionsOpen(true); }} onSubmit={() => searchCreators(homeQuery)} />
        {suggestionsOpen && suggestions.length > 0 && <div className="discover-creator-suggestions" role="listbox" aria-label="Creator suggestions">
          {suggestions.map(creator => <button type="button" role="option" key={creator.id} onMouseDown={event => event.preventDefault()} onClick={() => { setHomeQuery(creator.name); setSuggestionsOpen(false); searchCreators(creator.name); }}>
            <span className="creator-suggestion-avatar">{creator.initials}</span><span><b>{creator.name}</b><small>{creator.handle} · {creator.topic}</small></span>
          </button>)}
        </div>}
      </div>
    </section>
    <section className="home-pathways" aria-label="Choose a starting point">
      <button className="home-pathway-card" onClick={() => navigate('creators')}><span className="home-pathway-icon"><Search size={20}/></span><span><b>Check a creator</b><small>Explore community ratings and content insights before you watch.</small></span><ChevronRight size={19}/></button>
      <button className="home-pathway-card" onClick={() => navigate('family')}><span className="home-pathway-icon"><UsersRound size={20}/></span><span><b>Connect with family</b><small>Share creator subscriptions with a parent or teen.</small></span><ChevronRight size={19}/></button>
    </section>
    <section className="section featured">
      <div className="section-title"><div><span className="kicker">YOUTUBE CREATORS</span><h2>Top rated creators</h2></div><button className="text-button" onClick={() => navigate('creators')}>View all <ChevronRight size={18} /></button></div>
      {creatorsLoading ? <div className="empty"><h3>Loading creators…</h3></div> : topRatedCreators.length ? <div className="card-grid">{topRatedCreators.map(c => <CreatorCard key={c.id} creator={c} navigate={navigate} />)}</div> : <div className="empty"><h3>{creators.length ? 'No community ratings yet' : 'No creators yet'}</h3><p>{creators.length ? 'Rated creators will appear here when the community shares reviews.' : 'Creators will appear here when they are added to the community.'}</p></div>}
    </section>
    <section className="trust-strip">
      <div><strong>{siteCounts.ratings === null ? '—' : `${(Math.floor(siteCounts.ratings / 5) * 5).toLocaleString()}+`}</strong><span>community ratings</span></div><div><strong>{siteCounts.creators === null ? '—' : siteCounts.creators.toLocaleString()}</strong><span>creators</span></div><div><strong>{totalVotes === null ? '—' : totalVotes.toLocaleString()}</strong><span>review votes</span></div>
    </section>
    <section className="section google-data-summary" aria-labelledby="google-data-heading">
      <span className="kicker">OPTIONAL YOUTUBE CONNECTION</span>
      <h2 id="google-data-heading">How Rate My Creator works with Google and YouTube</h2>
      <p>Rate My Creator is a community review service that helps people evaluate YouTube creators before deciding what to watch. Anyone can browse public creator ratings without logging in.</p>
      <p>Users may optionally connect their Google account and grant read-only access to their YouTube subscriptions. We use that information only to match subscribed channels with creators available on Rate My Creator, follow those creators on the user’s behalf, and show their community scores. We do not modify a user’s YouTube account.</p>
      <p>Google user data is not sold, used for advertising or credit decisions, used to train artificial intelligence models, or used to create or distribute AI-generated non-consensual intimate imagery.</p>
      <button className="text-button" onClick={() => navigate('privacy')}>Read the Rate My Creator Privacy Policy <ChevronRight size={18}/></button>
    </section>
    <section className="cta"><div><span className="kicker">HELP OTHERS MAKE INFORMED CHOICES</span><h2>Notice something viewers should know?</h2><p>Share a specific review to help young viewers and families make informed choices.</p></div><button className="primary" onClick={() => navigate('rate')}>Write a rating <ChevronRight size={18} /></button></section>
  </main>;
}
