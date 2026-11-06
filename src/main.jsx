import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Play } from 'lucide-react';
import './styles.css';
import './reviews.css';
import './auth.css';
import { isSupabaseConfigured, supabase } from './lib/supabase';

const creators = [
  { id: 'maya-makes', name: 'Maya Makes', handle: '@mayamakes', initials: 'MM', color: '#ef4444', score: 4.8, reviews: 1284, category: 'DIY', audience: 'All ages', topic: 'Creative DIY & design', tagline: 'Big ideas, small tools.', description: 'Maya turns everyday materials into clever home projects. Her videos make design approachable with clear steps, honest budgets, and plenty of personality.', truth: 4.9, profanity: 1.1, substance: 1.0, ai: 'No', featured: true },
  { id: 'orbit-lab', name: 'Orbit Lab', handle: '@orbitlab', initials: 'OL', color: '#8b5cf6', score: 4.7, reviews: 956, category: 'Science', audience: '8+', topic: 'Space & science explained', tagline: 'The universe, made simple.', description: 'A visual science channel exploring space, physics, and the questions nobody thought to ask. Research-forward and wonderfully curious.', truth: 4.8, profanity: 1.0, substance: 1.0, ai: 'No', featured: true },
  { id: 'theo-travels', name: 'Theo Travels', handle: '@theotravels', initials: 'TT', color: '#f59e0b', score: 4.6, reviews: 731, category: 'Travel', audience: '13+', topic: 'Budget travel stories', tagline: 'Go farther. Spend smarter.', description: 'Theo shares immersive city guides and honest budget breakdowns from destinations around the world.', truth: 4.5, profanity: 2.0, substance: 1.8, ai: 'No', featured: true },
  { id: 'pixel-pantry', name: 'Pixel Pantry', handle: '@pixelpantry', initials: 'PP', color: '#ec4899', score: 4.5, reviews: 642, category: 'Food', audience: 'All ages', topic: 'Quick recipes & food science', tagline: 'Good food, no fuss.', description: 'Fast, friendly recipes paired with bite-sized food science. Perfect for new cooks and busy weeknights.', truth: 4.6, profanity: 1.0, substance: 1.4, ai: 'Unsure' },
  { id: 'rewind-room', name: 'The Rewind Room', handle: '@rewindroom', initials: 'RR', color: '#3b82f6', score: 4.4, reviews: 519, category: 'History', audience: '13+', topic: 'Untold moments in history', tagline: 'History has another side.', description: 'Smart, cinematic deep-dives into overlooked people and surprising moments from the past.', truth: 4.7, profanity: 1.7, substance: 1.5, ai: 'No' },
  { id: 'gameplan', name: 'GamePlan', handle: '@gameplan', initials: 'GP', color: '#22c55e', score: 4.3, reviews: 884, category: 'Sports', audience: '8+', topic: 'Sports strategy & stories', tagline: 'See the game differently.', description: 'Sharp play breakdowns, athlete stories, and sports history for fans who want more than highlights.', truth: 4.3, profanity: 2.1, substance: 1.3, ai: 'No' },
  { id: 'code-campfire', name: 'Code Campfire', handle: '@codecampfire', initials: 'CC', color: '#06b6d4', score: 4.2, reviews: 467, category: 'Education', audience: '13+', topic: 'Friendly coding tutorials', tagline: 'Build something tonight.', description: 'Relaxed, project-led coding tutorials that help beginners go from blank screen to working app.', truth: 4.5, profanity: 1.1, substance: 1.0, ai: 'Yes' },
  { id: 'glow-theory', name: 'Glow Theory', handle: '@glowtheory', initials: 'GT', color: '#e879f9', score: 4.1, reviews: 392, category: 'Beauty', audience: '16+', topic: 'Beauty reviews & routines', tagline: 'Beauty, tested honestly.', description: 'Ingredient-aware product reviews, wearable tutorials, and honest conversations about beauty marketing.', truth: 4.0, profanity: 1.5, substance: 1.0, ai: 'No' }
];

const categories = ['All', ...new Set(creators.map(c => c.category))];
const protectedPages = new Set(['dashboard', 'settings', 'rate']);

function creatorIdFromChannelLink(channelLink) {
  const handle = channelLink?.match(/@([^/?#]+)/)?.[1]?.toLowerCase();
  return creators.find(creator => creator.handle.slice(1).toLowerCase() === handle)?.id;
}

function formatReview(review, creatorId) {
  const creator = creators.find(item => item.id === creatorId);

  return {
    id: review.review_id,
    creatorId,
    creator: creator?.name ?? 'Unknown creator',
    score: review.overall_rating,
    profanity: review.profanity,
    substance: review.substance_use,
    ageLevel: review.age_level,
    usesAi: review.uses_ai,
    text: review.review_text,
    bias: review.bias_text,
    date: new Date(review.created_at).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  };
}

function Avatar({ creator, size = 'md' }) {
  return <div className={`avatar ${size}`} style={{ '--avatar': creator.color }}><span>{creator.initials}</span><Play size={size === 'lg' ? 28 : 15} fill="currentColor" /></div>;
}

function Stars({ score, small = false }) {
  return <span className={`stars ${small ? 'small' : ''}`}><Star fill="currentColor" /> <b>{score.toFixed(1)}</b></span>;
}

function SearchBox({ value, setValue, onSubmit, compact = false }) {
  return (
    <form className={`search-box ${compact ? 'compact' : ''}`} onSubmit={e => { e.preventDefault(); onSubmit?.(); }}>
      <Search size={compact ? 18 : 23} />
      <input value={value} onChange={e => setValue(e.target.value)} placeholder="Search creators, topics, or categories" aria-label="Search creators" />
      {!compact && <button>Search</button>}
    </form>
  );
}

function Header({ navigate, query, setQuery, user }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef(null);
  const displayName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Account';
  useEffect(() => {
    if (!accountMenuOpen) return;
    const closeOutside = event => { if (!accountMenuRef.current?.contains(event.target)) setAccountMenuOpen(false); };
    const closeOnEscape = event => { if (event.key === 'Escape') setAccountMenuOpen(false); };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => { document.removeEventListener('pointerdown', closeOutside); document.removeEventListener('keydown', closeOnEscape); };
  }, [accountMenuOpen]);
  const logout = async () => {
    if (supabase) await supabase.auth.signOut();
    setAccountMenuOpen(false);
    setMobileNavOpen(false);
    navigate('home');
  };
  const goTo = page => {
    setAccountMenuOpen(false);
    setMobileNavOpen(false);
    navigate(page);
  };
  return (
    <header className="header">
      <button className="brand" onClick={() => navigate('home')}><span className="brand-mark"><Play fill="white" /></span><span>Rate My <b>Creator</b></span></button>
      <div className="nav-search"><SearchBox compact value={query} setValue={setQuery} onSubmit={() => navigate('creators')} /></div>
      <nav className={mobileNavOpen ? 'open' : ''}>
        <button onClick={() => goTo('creators')}>Discover</button>
        {user ? <div className="account-menu" ref={accountMenuRef}>
          <button className="account-chip" aria-haspopup="menu" aria-expanded={accountMenuOpen} onClick={() => setAccountMenuOpen(!accountMenuOpen)}><UserRound size={18} /> {displayName} <ChevronRight className="account-mobile-chevron" size={17} /></button>
          {accountMenuOpen && <div className="account-dropdown" role="menu">
            <button role="menuitem" onClick={() => goTo('dashboard')}>Dashboard</button>
            <button role="menuitem" onClick={() => goTo('settings')}><Settings size={17}/> Account settings</button>
            <button className="dropdown-logout" role="menuitem" onClick={logout}><LogOut size={17}/> Log out</button>
          </div>}
        </div> : <><button onClick={() => navigate('login')}>Log in</button><button className="primary small" onClick={() => navigate('signup')}>Sign up</button></>}
      </nav>
      <button className="menu" aria-expanded={mobileNavOpen} aria-label="Toggle navigation menu" onClick={() => setMobileNavOpen(!mobileNavOpen)}><Menu /></button>
    </header>
  );
}

function CreatorCard({ creator, navigate, wide = false }) {
  return (
    <button className={`creator-card ${wide ? 'wide' : ''}`} onClick={() => navigate('profile', creator.id)}>
      <Avatar creator={creator} size={wide ? 'md' : 'lg'} />
      <div className="creator-copy">
        <div className="creator-heading"><div><h3>{creator.name}</h3><p>{creator.handle}</p></div><Stars score={creator.score} /></div>
        <p className="topic">{creator.topic}</p>
        {wide && <p className="summary">{creator.description}</p>}
        <div className="tags"><span>{creator.category}</span><span>{creator.audience}</span><span>{creator.reviews.toLocaleString()} ratings</span></div>
      </div>
      <ChevronRight className="card-arrow" />
    </button>
  );
}

function Home({ navigate, query, setQuery }) {
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

function Creators({ navigate, query, setQuery }) {
  const [selected, setSelected] = useState(['All']);
  const filtered = useMemo(() => creators.filter(c => (selected.includes('All') || selected.includes(c.category)) && (`${c.name} ${c.topic} ${c.category}`).toLowerCase().includes(query.toLowerCase())), [query, selected]);
  const toggle = cat => setSelected(cat === 'All' ? ['All'] : (selected.includes(cat) ? (selected.filter(x => x !== cat).length ? selected.filter(x => x !== cat) : ['All']) : [...selected.filter(x => x !== 'All'), cat]));
  return <main className="page"><div className="page-heading"><span className="kicker">DISCOVER</span><h1>Find your next favorite creator</h1><p>Explore honest community ratings across every kind of content.</p></div>
    <SearchBox value={query} setValue={setQuery} />
    <div className="browse-layout"><aside className="filters"><div className="filter-title"><SlidersHorizontal size={18} /> Filter by topic</div>{categories.map(cat => <label key={cat}><input type="checkbox" checked={selected.includes(cat)} onChange={() => toggle(cat)} /><span>{cat}</span><small>{cat === 'All' ? creators.length : creators.filter(c => c.category === cat).length}</small></label>)}</aside>
      <section className="results"><div className="results-head"><b>{filtered.length} creators</b><span>Highest rated first</span></div>{filtered.length ? filtered.sort((a,b) => b.score-a.score).map(c => <CreatorCard key={c.id} creator={c} navigate={navigate} wide />) : <div className="empty"><Search size={36}/><h3>No creators found</h3><p>Try another name, topic, or remove a filter.</p><button className="secondary" onClick={() => {setQuery('');setSelected(['All']);}}>Clear search</button></div>}</section>
    </div>
  </main>;
}

function Metric({ label, value, note, inverse = false }) {
  const pct = inverse ? (6-value)*20 : value*20;
  return <div className="metric"><div className="metric-top"><span>{label}</span><b>{value.toFixed(1)}<small>/5</small></b></div><div className="bar"><i style={{width: `${pct}%`}} /></div><p>{note}</p></div>;
}

function ReviewVotes({ review, user, navigate }) {
  const [vote, setVote] = useState(review.myVote ?? null);
  const [counts, setCounts] = useState(review.voteCounts ?? { up: 0, down: 0 });
  const [loginPromptFor, setLoginPromptFor] = useState(null);
  const [saving, setSaving] = useState(false);
  const [voteError, setVoteError] = useState('');
  const voteControlsRef = useRef(null);
  useEffect(() => { setVote(review.myVote ?? null); }, [review.myVote]);
  useEffect(() => { setCounts(review.voteCounts ?? { up: 0, down: 0 }); }, [review.voteCounts]);
  useEffect(() => {
    if (!loginPromptFor) return;
    const dismissOutside = event => {
      if (!voteControlsRef.current?.contains(event.target)) setLoginPromptFor(null);
    };
    document.addEventListener('pointerdown', dismissOutside);
    return () => document.removeEventListener('pointerdown', dismissOutside);
  }, [loginPromptFor]);
  const choose = async next => {
    if (!user) { setLoginPromptFor(current => current === next ? null : next); return; }
    setLoginPromptFor(null);
    if (saving) return;
    setSaving(true);
    setVoteError('');
    const nextVote = vote === next ? null : next;
    const userId = user.id;
    const result = nextVote
      ? await supabase.from('review_votes').upsert({ review_id: review.id, user_id: userId, vote: nextVote === 'up' ? 1 : -1 }, { onConflict: 'review_id,user_id' })
      : await supabase.from('review_votes').delete().eq('review_id', review.id).eq('user_id', userId);
    setSaving(false);
    if (result.error) { setVoteError('Your vote could not be saved. Please try again.'); return; }
    setCounts(current => ({
      up: current.up + (nextVote === 'up' ? (vote === 'up' ? 0 : 1) : vote === 'up' ? -1 : 0),
      down: current.down + (nextVote === 'down' ? (vote === 'down' ? 0 : 1) : vote === 'down' ? -1 : 0)
    }));
    setVote(nextVote);
  };
  return <div className="review-votes" ref={voteControlsRef} aria-label="Review votes"><button type="button" disabled={saving} className={vote === 'up' ? 'selected' : ''} aria-label={`Upvote review (${counts.up})`} aria-pressed={vote === 'up'} onClick={() => choose('up')}><ThumbsUp size={19} fill={vote === 'up' ? 'currentColor' : 'none'}/><span>{counts.up}</span></button><button type="button" disabled={saving} className={vote === 'down' ? 'selected' : ''} aria-label={`Downvote review (${counts.down})`} aria-pressed={vote === 'down'} onClick={() => choose('down')}><ThumbsDown size={19} fill={vote === 'down' ? 'currentColor' : 'none'}/><span>{counts.down}</span></button>{loginPromptFor && <div className={`vote-login-prompt ${loginPromptFor}`} role="status"><span>Log in to leave a vote.</span><button type="button" onClick={() => navigate('login')}>Log in</button></div>}{voteError && <span className="vote-error" role="alert">{voteError}</span>}</div>;
}

function Profile({ creator, navigate, reviews, reviewsLoading, reviewsError, user }) {
  const [bug, setBug] = useState(false), [sent, setSent] = useState(false);
  const creatorReviews = reviews.filter(review => review.creatorId === creator.id);
  return <main className="page profile-page"><button className="back" onClick={() => navigate('creators')}><ArrowLeft size={17}/> All creators</button>
    <section className="profile-hero"><Avatar creator={creator} size="xl"/><div className="profile-main"><span className="category">{creator.category}</span><h1>{creator.name}</h1><p className="handle">{creator.handle}</p><p className="tagline">“{creator.tagline}”</p><div className="profile-actions"><button className="primary" onClick={() => navigate('rate', creator.id)}><Star size={18}/> Rate this creator</button><button className="secondary" onClick={() => window.open('https://youtube.com', '_blank')}>YouTube channel <ExternalLink size={16}/></button></div></div><div className="score-card"><span>COMMUNITY SCORE</span><strong>{creator.score.toFixed(1)}</strong><Stars score={creator.score}/><p>Based on {creator.reviews.toLocaleString()} ratings</p></div></section>
    <div className="profile-grid"><section><div className="panel"><h2>At a glance</h2><p className="description">{creator.description}</p><div className="facts"><div><span>Content</span><b>{creator.topic}</b></div><div><span>Best for</span><b>{creator.audience}</b></div><div><span>Uses AI</span><b>{creator.ai}</b></div></div></div>
      <div className="panel"><div className="panel-head"><h2>Community ratings</h2><span>Last 90 days</span></div><Metric label="Truthfulness" value={creator.truth} note="Well-researched and transparent"/><Metric label="Family-friendly" value={6-creator.profanity} note="Based on language and themes"/><Metric label="Low substance mention" value={6-creator.substance} note="Frequency across recent content"/></div>
      <div className="panel recent-reviews"><div className="panel-head"><h2>Recent reviews</h2><span>{creatorReviews.length} from database</span></div>
        {reviewsLoading && <p className="review-status">Loading reviews…</p>}
        {reviewsError && <p className="form-error">{reviewsError}</p>}
        {!reviewsLoading && !reviewsError && creatorReviews.length === 0 && <p className="review-status">No reviews yet. Be the first to rate this creator.</p>}
        {creatorReviews.map(review => <article className="profile-review" key={review.id}><div><Stars score={review.score} small/><span className="date">{review.date}</span></div><p>{review.text}</p><div className="review-details"><span>Age: {review.ageLevel}</span><span>Profanity: {review.profanity}/5</span><span>Substance: {review.substance}/5</span>{review.usesAi && <span>AI: {review.usesAi}</span>}</div>{review.bias && <small>Disclosure: {review.bias}</small>}<ReviewVotes review={review} user={user} navigate={navigate}/></article>)}
      </div>
    </section><aside><div className="panel rating-split"><h3 className="rating-split-title">Rating breakdown <span className="score-help"><button type="button" aria-label="Why this score?" aria-describedby="score-explanation"><CircleHelp size={18}/></button><span className="score-tooltip" role="tooltip" id="score-explanation">Viewers consistently praise this creator’s clear presentation and honest approach. Ratings suggest reliable, age-appropriate content with strong educational value.</span></span></h3>{[[5,68],[4,22],[3,7],[2,2],[1,1]].map(([s,p])=><div key={s}><span>{s} <Star size={11} fill="currentColor"/></span><i><b style={{width:`${p}%`}}/></i><small>{p}%</small></div>)}</div></aside></div>
    <button className="report-link" onClick={() => setBug(true)}><Flag size={15}/> See something incorrect? Report an issue</button>
    {bug && <div className="modal-backdrop" onMouseDown={() => setBug(false)}><div className="modal" onMouseDown={e => e.stopPropagation()}><button className="modal-close" onClick={() => setBug(false)}><X/></button>{sent ? <div className="success"><Check/><h2>Thanks for the heads-up!</h2><p>We’ll review your report soon.</p><button className="primary" onClick={() => setBug(false)}>Done</button></div> : <><span className="kicker">REPORT AN ISSUE</span><h2>What doesn’t look right?</h2><p>Tell us what’s inaccurate on {creator.name}’s profile.</p><textarea placeholder="Describe the issue or correction…" rows="5"/><button className="primary full" onClick={() => setSent(true)}>Submit report</button></>}</div></div>}
  </main>;
}

function GoogleIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.06H12v3.9h5.38a4.6 4.6 0 0 1-2 3.02v2.53h3.24c1.9-1.75 2.98-4.33 2.98-7.39Z"/><path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.62-2.38l-3.24-2.53c-.9.6-2.05.96-3.38.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.61A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.39 13.92A6.02 6.02 0 0 1 6.08 12c0-.67.11-1.32.31-1.92V7.47H3.04A10 10 0 0 0 2 12c0 1.61.39 3.14 1.04 4.53l3.35-2.61Z"/><path fill="#EA4335" d="M12 5.95c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.63 9.63 0 0 0 12 2a10 10 0 0 0-8.96 5.47l3.35 2.61C7.18 7.71 9.39 5.95 12 5.95Z"/></svg>;
}

function Auth({ type, navigate, requiresAuth = false }) {
  const signup = type === 'signup';
  const [show, setShow] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState(''), [submitting, setSubmitting] = useState(false);
  const signInWithGoogle = async () => {
    setError(''); setNotice('');
    if (!isSupabaseConfigured) { setError('Supabase is not configured. Add the project variables and restart the app.'); return; }
    setSubmitting(true);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({ provider:'google', options:{ redirectTo:`${window.location.origin}/?auth=callback` } });
    if (oauthError) { setError(oauthError.message); setSubmitting(false); }
  };
  const submit = async e => {
    e.preventDefault(); setError(''); setNotice('');
    if (!e.currentTarget.checkValidity()) { setError('Please complete every required field.'); return; }
    if (!isSupabaseConfigured) { setError('Supabase is not configured. Add the project variables and restart the app.'); return; }
    setSubmitting(true);
    const form = new FormData(e.currentTarget), email = form.get('email'), password = form.get('password');
    if (signup) {
      const { data, error: signupError } = await supabase.auth.signUp({ email, password, options:{ emailRedirectTo:`${window.location.origin}/?auth=callback`, data:{ full_name:form.get('fullName'), birthday:form.get('birthday'), username:form.get('username') } } });
      if (signupError) setError(signupError.message);
      else if (!data.session) setNotice('Check your email to confirm your account, then return here to log in.');
      // SIGNED_IN is handled centrally so guarded navigation can resume.
    } else {
      const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
      if (loginError) setError(loginError.message);
    }
    setSubmitting(false);
  };
  return <main className="auth-page"><section className="auth-side"><button className="brand light" onClick={() => navigate('home')}><span className="brand-mark"><Play fill="white"/></span>Rate My <b>Creator</b></button><div><span className="kicker">JOIN THE COMMUNITY</span><h1>Your opinion helps shape the feed.</h1><p>Rate creators, save your favorites, and help people choose better content.</p></div><div className="auth-quote">“Finally, one place to see whether a channel is actually worth my time.”<span>— Community member</span></div></section><section className="auth-form"><div className="form-wrap"><button className="back" onClick={() => navigate('home')}><ArrowLeft size={17}/> Back home</button><h2>{signup ? 'Create your account' : 'Welcome back'}</h2><p>{requiresAuth ? 'Log in to continue where you left off.' : signup ? 'Start rating creators in just a minute.' : 'Log in to continue to your dashboard.'}</p>{requiresAuth&&<p className="auth-required" role="status"><ShieldCheck size={17}/> You need an account to access that page.</p>}<button type="button" className="google-button" onClick={signInWithGoogle} disabled={submitting}><GoogleIcon/> Continue with Google</button><div className="auth-divider"><span>or continue with email</span></div><form onSubmit={submit} noValidate>{signup && <><label>Full name<input name="fullName" required autoComplete="name" placeholder="Alex Morgan"/></label><label>Birthday<input name="birthday" required type="date" autoComplete="bday"/></label></>}<label>Email address<input name="email" required type="email" autoComplete="email" placeholder="alex@example.com"/></label>{signup && <label>Username<input name="username" required autoComplete="username" placeholder="alexreviews"/></label>}<label>Password<div className="password"><input name="password" required minLength="8" type={show?'text':'password'} autoComplete={signup?'new-password':'current-password'} placeholder="At least 8 characters"/><button type="button" onClick={() => setShow(!show)} aria-label={show?'Hide password':'Show password'}>{show?<EyeOff/>:<Eye/>}</button></div></label>{error&&<p className="form-error" role="alert">{error}</p>}{notice&&<p className="form-notice" role="status">{notice}</p>}<button className="primary full" disabled={submitting}>{submitting?'Please wait…':signup?'Create account':'Log in'} {!submitting&&<ChevronRight size={18}/>}</button></form><p className="switch">{signup?'Already have an account?':'New here?'} <button onClick={() => navigate(signup?'login':'signup')}>{signup?'Log in':'Create an account'}</button></p></div></section></main>;
}

function Dashboard({ navigate, reviews, user }) {
  const following = creators.slice(0,3);
  const metadata = user?.user_metadata || {};
  const fallbackName = metadata.given_name || metadata.full_name?.trim().split(/\s+/)[0] || metadata.name?.trim().split(/\s+/)[0] || user?.email?.split('@')[0] || 'there';
  const [firstName, setFirstName] = useState(fallbackName);
  useEffect(() => {
    let active = true;
    async function loadFirstName() {
      if (!isSupabaseConfigured) return;
      const { data, error } = await supabase.from('users').select('first_name').eq('user_id', user.id).maybeSingle();
      if (active && !error && data?.first_name?.trim()) setFirstName(data.first_name.trim());
    }
    loadFirstName();
    return () => { active = false; };
  }, [user.id]);
  const displayName = firstName;
  const [helpfulVotes, setHelpfulVotes] = useState(null);
  useEffect(() => {
    let active = true;
    async function loadHelpfulVotes() {
      if (!supabase || !user?.id) { setHelpfulVotes(0); return; }
      const { count, error } = await supabase.from('review_votes').select('review_id', { count: 'exact', head: true }).eq('user_id', user.id);
      if (!active) return;
      if (error) {
        console.error('Helpful votes could not be loaded:', error.message);
        setHelpfulVotes(null);
      } else setHelpfulVotes(count ?? 0);
    }
    loadHelpfulVotes();
    return () => { active = false; };
  }, [user?.id]);
  return <main className="page dashboard"><div className="dash-head"><div><span className="kicker">YOUR DASHBOARD</span><h1>Good to see you, {displayName}</h1><p>Here’s everything you’ve contributed and saved.</p></div><button className="icon-button" title="Settings" onClick={() => navigate('settings')}><Settings/></button></div><div className="dash-stats"><div><MessageSquareText/><strong>{reviews.length}</strong><span>Ratings written</span></div><div><Bookmark/><strong>3</strong><span>Creators followed</span></div><div><ThumbsUp/><strong>{helpfulVotes === null ? '—' : helpfulVotes}</strong><span>Helpful votes</span></div></div><div className="dashboard-grid"><section className="panel"><div className="panel-head"><h2>Your ratings</h2><button className="text-button" onClick={() => navigate('rate')}>Write a rating</button></div>{reviews.map((r,i)=><div className="review-row" key={i}><div><h3>{r.creator}</h3><Stars score={r.score} small/><span className="date">{r.date}</span><p>{r.text}</p></div><ChevronRight/></div>)}</section><aside className="panel"><div className="panel-head"><h2>Following</h2><span>{following.length}</span></div>{following.map(c=><button className="follow-row" key={c.id} onClick={()=>navigate('profile',c.id)}><Avatar creator={c}/><span><b>{c.name}</b><small>{c.topic}</small></span><ChevronRight/></button>)}</aside></div></main>;
}

function SettingsPage({ navigate, user }) {
  const metadata = user?.user_metadata || {};
  const metadataName = metadata.full_name || metadata.name || '';
  const [values, setValues] = useState({ firstName: metadata.given_name || metadataName.split(/\s+/)[0] || '', lastName: metadata.family_name || metadataName.split(/\s+/).slice(1).join(' ') || '', birthday: metadata.birthday || '', username: metadata.username || '', gender: '', phoneNumber: '' });
  const [editing, setEditing] = useState(false), [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [notice, setNotice] = useState(''), [error, setError] = useState('');
  const logout = async () => { if (supabase) await supabase.auth.signOut(); navigate('home'); };
  useEffect(() => {
    let active = true;
    async function loadProfile() {
      if (!isSupabaseConfigured) { setError('Supabase is not configured. Profile changes cannot be saved.'); setLoading(false); return; }
      const userResult = await supabase.from('users').select('first_name, last_name, birthdate, username, gender, phone_number, email').eq('user_id', user.id).maybeSingle();
      if (!active) return;
      if (userResult.error) setError(userResult.error.message || 'Your profile could not be loaded.');
      const row = userResult.data || {};
      setValues(current => ({ firstName: row.first_name ?? current.firstName, lastName: row.last_name ?? current.lastName, birthday: row.birthdate ?? current.birthday, username: row.username ?? current.username, gender: row.gender ?? current.gender, phoneNumber: row.phone_number ?? current.phoneNumber }));
      setLoading(false);
    }
    loadProfile();
    return () => { active = false; };
  }, [user.id]);
  const save = async () => {
    setSaving(true); setError(''); setNotice('');
    const { error: saveError } = await supabase.from('users').upsert({ user_id: user.id, first_name: values.firstName.trim(), last_name: values.lastName.trim(), birthdate: values.birthday || null, username: values.username.trim() || null, gender: values.gender || null, phone_number: values.phoneNumber.trim() || null }, { onConflict: 'user_id' });
    if (saveError) setError(saveError.message || 'Your profile could not be saved.');
    else { setEditing(false); setNotice('Your profile was saved.'); }
    setSaving(false);
  };
  const birthdayMax = new Date();
  birthdayMax.setFullYear(birthdayMax.getFullYear() - 5);
  const birthdayMaxValue = `${birthdayMax.getFullYear()}-${String(birthdayMax.getMonth() + 1).padStart(2, '0')}-${String(birthdayMax.getDate()).padStart(2, '0')}`;
  const field = (label, key, type = 'text') => <div className="setting-row" key={key}><label htmlFor={`profile-${key}`}>{label}</label>{editing ? <input id={`profile-${key}`} type={type} {...(key === 'birthday' ? { max: birthdayMaxValue } : {})} value={values[key]} onChange={event => setValues(current => ({ ...current, [key]: event.target.value }))} disabled={loading || saving} /> : <span>{values[key] || 'Not provided'}</span>}</div>;
  const genderField = <div className="setting-row" key="gender"><label htmlFor="profile-gender">Gender</label>{editing ? <select id="profile-gender" value={values.gender} onChange={event => setValues(current => ({ ...current, gender: event.target.value }))} disabled={loading || saving}><option value="">Select gender</option><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option><option value="Prefer Not to Say">Prefer Not to Say</option></select> : <span>{values.gender || 'Not provided'}</span>}</div>;
  return <main className="page settings-page"><button className="back" onClick={() => navigate('dashboard')}><ArrowLeft size={17}/> Dashboard</button><div className="settings-head"><div><h1>Account settings</h1><p>View and edit your account information.</p></div></div>{loading&&<p role="status">Loading your profile…</p>}{error&&<p className="form-error" role="alert">{error}</p>}{notice&&<div className="save-note" role="status"><Check/> {notice}</div>}<section className="panel settings-form"><div className="settings-panel-head"><h2 className="settings-section-title">Account information</h2>{!editing&&<button className="secondary" disabled={loading || !isSupabaseConfigured} onClick={() => (setError(''), setNotice(''), setEditing(true))}>Edit profile</button>}</div>{field('Username','username')}<div className="setting-row"><label>Email address</label><span>{user.email || 'Not provided'} <small className="email-readonly"> · Not editable here</small></span></div><h2 className="settings-section-title personal-section-title">Personal information</h2><div className="setting-pair">{field('First name','firstName')}{field('Last name','lastName')}</div>{field('Birthday','birthday','date')}{field('Phone number','phoneNumber','tel')}{genderField}{editing&&<div className="settings-actions"><button className="secondary" disabled={saving} onClick={() => setEditing(false)}>Cancel</button><button className="primary" disabled={saving || !isSupabaseConfigured} onClick={save}>{saving?'Saving…':'Save changes'}</button></div>}</section><button className="logout" onClick={logout}><LogOut size={17}/> Log out</button></main>;
}

function Rate({ navigate, selectedId, submitReview }) {
  const [wordCount,setWordCount]=useState(0), [submitting,setSubmitting]=useState(false), [error,setError]=useState(''), [values,setValues]=useState({truth:'3',profanity:'1',substance:'1'});
  const submit=async e=>{
    e.preventDefault();
    setSubmitting(true);
    setError('');
    const form = new FormData(e.currentTarget);
    const creatorId = form.get('creator');

    try {
      await submitReview({ creatorId, overallRating:Number(values.truth), profanity:Number(values.profanity), substanceUse:Number(values.substance), ageLevel:form.get('ageLevel'), reviewText:form.get('review'), biasText:form.get('bias'), usesAi:form.get('usesAi') });
      navigate('profile', creatorId);
    } catch (submitError) {
      setError(submitError.message || 'Your rating could not be submitted. Please try again.');
      setSubmitting(false);
    }
  };
  return <main className="page rating-page"><button className="back" onClick={()=>navigate(selectedId?'profile':'dashboard',selectedId)}><ArrowLeft size={17}/> Back</button><div className="form-heading"><span className="kicker">SHARE YOUR EXPERIENCE</span><h1>Rate a content creator</h1><p>Be honest, specific, and respectful. All fields are required.</p></div><form className="rating-form" onSubmit={submit}><section className="panel"><h2>About the creator</h2><label>Content creator<select name="creator" required defaultValue={selectedId || ''}><option value="" disabled>Choose a creator</option>{creators.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Your review <span>{wordCount}/150 words</span><textarea name="review" required rows="6" placeholder="What stands out about this creator? What should new viewers know?" onChange={e=>{const words=e.target.value.trim().split(/\s+/).filter(Boolean);if(words.length<=150)setWordCount(words.length);else e.target.value=words.slice(0,150).join(' ')}}/></label><label>Any biases to disclose?<input name="bias" required placeholder="Example: I have followed this creator for 2 years"/></label></section><section className="panel"><h2>Content ratings</h2><RangeField label="Truthfulness" low="Misleading" high="Highly reliable" value={values.truth} set={v=>setValues({...values,truth:v})}/><label>Overall age-appropriateness<select name="ageLevel" required><option value="">Select an age range</option><option value="All ages">All ages</option><option>8+</option><option>13+</option><option>16+</option><option>18+</option></select></label><RangeField label="Profanity" low="None" high="Very frequent" value={values.profanity} set={v=>setValues({...values,profanity:v})}/><RangeField label="Substance use / mention" low="Never" high="Every video" value={values.substance} set={v=>setValues({...values,substance:v})}/><label>Does the creator use AI?<select name="usesAi" required><option value="">Choose one</option><option>Yes</option><option>No</option><option>Unsure</option></select></label></section>{error && <p className="submit-error" role="alert">{error}</p>}<button className="primary submit-rating" disabled={submitting}>{submitting ? 'Submitting…' : <>Submit rating <ChevronRight size={18}/></>}</button></form></main>;
}

function RangeField({label,low,high,value,set}) {return <label className="range-label"><span>{label}<b>{value}/5</b></span><input type="range" min="1" max="5" value={value} onChange={e=>set(e.target.value)}/><small><span>{low}</span><span>{high}</span></small></label>}
import { creators, protectedPages } from './data/creators';
import { creatorIdFromChannelLink, formatReview, generatedUsernameFor, isProfileComplete, pageFromPathname } from './utils';
import { Header } from './components/shared';
import { Home } from './pages/Home';
import { DiscoverCreators } from './pages/DiscoverCreators';
import { Profile as CreatorProfile } from './pages/CreatorProfile';
import { AccountSignIn } from './pages/AccountSignIn';
import { CompleteProfile } from './pages/CompleteProfile';
import { Dashboard } from './pages/Dashboard';
import { AccountSettings } from './pages/AccountSettings';
import { RateCreator } from './pages/RateCreator';
import { LegalPage } from './pages/LegalPage';

function App() {
  const [page,setPage]=useState(pageFromPathname), [selected,setSelected]=useState(null), [query,setQuery]=useState(''), [session,setSession]=useState(null), [authReady,setAuthReady]=useState(!isSupabaseConfigured), [profile,setProfile]=useState(null), [profileReady,setProfileReady]=useState(!isSupabaseConfigured), [profileError,setProfileError]=useState(''), [requiresAuth,setRequiresAuth]=useState(false), [reviews,setReviews]=useState([]), [databaseCreatorIds,setDatabaseCreatorIds]=useState({}), [reviewsLoading,setReviewsLoading]=useState(true), [reviewsError,setReviewsError]=useState('');
  const pendingDestination = useRef(null);
  const signInNavigationHandled = useRef(false);
  const usernameUpdatesInFlight = useRef(new Set());
  const profileRequest = useRef(0);
  const authUserId = useRef(null);

  useEffect(() => {
    const handlePopState = () => { setPage(pageFromPathname()); setSelected(null); window.scrollTo(0, 0); };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const ensureUsername = authUser => {
      if (!authUser?.id || authUser.user_metadata?.username || usernameUpdatesInFlight.current.has(authUser.id)) return;
      usernameUpdatesInFlight.current.add(authUser.id);
      const username = generatedUsernameFor(authUser);
      window.setTimeout(() => {
        void supabase.auth.updateUser({ data: { username } }).then(({ data, error }) => {
          if (!error && data.user) setSession(current => current ? { ...current, user: data.user } : current);
        }).catch(() => {}).finally(() => usernameUpdatesInFlight.current.delete(authUser.id));
      }, 0);
    };
    const finishSignIn = nextSession => {
      if (!nextSession) return;
      ensureUsername(nextSession.user);
      if (signInNavigationHandled.current) return;
      const params = new URLSearchParams(window.location.search);
      let destination = pendingDestination.current;
      try {
        destination ||= JSON.parse(window.sessionStorage.getItem('authReturnTo'));
      } catch {
        destination = null;
      }
      destination ||= { page: 'dashboard', id: null };
      signInNavigationHandled.current = true;
      setSelected(destination.id || null);
      setPage(destination.page);
      setRequiresAuth(false);
      pendingDestination.current = null;
      window.sessionStorage.removeItem('authReturnTo');
      if (params.get('auth') === 'callback') {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    };
    supabase.auth.getSession().then(({ data }) => {
      authUserId.current = data.session?.user?.id || null;
      setProfileReady(!data.session?.user);
      setSession(data.session);
      setAuthReady(true);
      ensureUsername(data.session?.user);
      if (data.session && new URLSearchParams(window.location.search).get('auth') === 'callback') finishSignIn(data.session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      const nextUserId = nextSession?.user?.id || null;
      if (authUserId.current !== nextUserId) setProfileReady(!nextUserId);
      authUserId.current = nextUserId;
      setSession(nextSession);
      setAuthReady(true);
      if (event === 'SIGNED_IN') finishSignIn(nextSession);
      if (event === 'SIGNED_OUT') signInNavigationHandled.current = false;
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const userId = session?.user?.id;
    const requestId = ++profileRequest.current;
    if (!userId) {
      setProfile(null);
      setProfileError('');
      setProfileReady(true);
      return;
    }
    if (!isSupabaseConfigured) return;
    setProfileReady(false);
    setProfileError('');
    let active = true;
    supabase.from('users').select('user_id, first_name, last_name, birthdate, phone_number, email, gender, username, avatar_url').eq('user_id', userId).maybeSingle().then(({ data, error }) => {
      if (!active || requestId !== profileRequest.current) return;
      setProfile(error ? null : data);
      setProfileError(error ? error.message || 'Your profile could not be loaded.' : '');
      setProfileReady(true);
    });
    return () => { active = false; };
  }, [session?.user?.id]);

  const handleProfileChanged = nextProfile => {
    profileRequest.current += 1;
    setProfile(nextProfile);
    setProfileError('');
    setProfileReady(true);
  };

  useEffect(() => {
    if (!authReady || session?.user || !protectedPages.has(page)) return;
    const destination = { page, id: selected };
    signInNavigationHandled.current = false;
    pendingDestination.current = destination;
    window.sessionStorage.setItem('authReturnTo', JSON.stringify(destination));
    setRequiresAuth(true);
    setPage('login');
  }, [authReady, page, selected, session]);

  useEffect(() => {
    if (!authReady || !profileReady || !session?.user || isProfileComplete(profile) || page === 'complete-profile' || !protectedPages.has(page)) return;
    const destination = { page, id: selected };
    window.sessionStorage.setItem('profileReturnTo', JSON.stringify(destination));
    setPage('complete-profile');
    window.scrollTo(0, 0);
  }, [authReady, page, profile, profileReady, selected, session?.user]);

  const finishProfile = nextProfile => {
    handleProfileChanged(nextProfile);
    let destination = { page: 'dashboard', id: null };
    try {
      destination = JSON.parse(window.sessionStorage.getItem('profileReturnTo')) || destination;
    } catch {
      // Use the dashboard fallback when stored navigation is invalid.
    }
    window.sessionStorage.removeItem('profileReturnTo');
    setSelected(destination.id || null);
    setPage(destination.page);
    window.scrollTo(0, 0);
  };

  const logoutFromOnboarding = async () => {
    window.sessionStorage.removeItem('profileReturnTo');
    if (supabase) await supabase.auth.signOut();
    setPage('home');
  };

  useEffect(() => {
    async function loadDatabaseReviews() {
      if (!isSupabaseConfigured) {
        setReviewsLoading(false);
        return;
      }

      setReviewsLoading(true);
      const [creatorsResult, reviewsResult] = await Promise.all([
        supabase.from('content_creators').select('creator_id, channel_link'),
        supabase.from('reviews').select('review_id, creator_id, overall_rating, profanity, substance_use, age_level, review_text, bias_text, uses_ai, created_at, content_creators(channel_link)').order('created_at', { ascending: false })
      ]);

      if (creatorsResult.error || reviewsResult.error) {
        setReviewsError(creatorsResult.error?.message || reviewsResult.error?.message || 'Reviews could not be loaded.');
        setReviewsLoading(false);
        return;
      }

      const idMap = {};
      creatorsResult.data.forEach(databaseCreator => {
        const localId = creatorIdFromChannelLink(databaseCreator.channel_link);
        if (localId) idMap[localId] = databaseCreator.creator_id;
      });
      const loadedReviews = reviewsResult.data.map(review => {
        const localId = creatorIdFromChannelLink(review.content_creators?.channel_link);
        return localId ? formatReview(review, localId) : null;
      }).filter(Boolean);

      const reviewIds = loadedReviews.map(review => review.id);
      let voteCounts = new Map();
      let userVotes = new Map();
      if (reviewIds.length) {
        const voteQueries = [supabase.rpc('get_review_vote_counts', { p_review_ids: reviewIds })];
        if (session?.user?.id) {
          voteQueries.push(supabase.from('review_votes').select('review_id, vote').eq('user_id', session.user.id).in('review_id', reviewIds));
        }
        const [countsResult, userVotesResult] = await Promise.all(voteQueries);
        if (countsResult.error) console.error('Review vote counts could not be loaded:', countsResult.error.message);
        else voteCounts = new Map((countsResult.data || []).map(row => [String(row.review_id), { up: Number(row.upvotes), down: Number(row.downvotes) }]));
        if (userVotesResult) {
          if (userVotesResult.error) console.error('Your review votes could not be loaded:', userVotesResult.error.message);
          else userVotes = new Map((userVotesResult.data || []).map(row => [String(row.review_id), Number(row.vote) === 1 ? 'up' : 'down']));
        }
      }
      const reviewsWithVotes = loadedReviews.map(review => ({
        ...review,
        voteCounts: voteCounts.get(String(review.id)) || { up: 0, down: 0 },
        myVote: userVotes.get(String(review.id)) || null
      }));

      setDatabaseCreatorIds(idMap);
      setReviews(reviewsWithVotes);
      setReviewsError('');
      setReviewsLoading(false);
    }

    loadDatabaseReviews();
  }, [authReady, session?.user?.id]);

  const submitReview = async review => {
    if (!isSupabaseConfigured) {
      throw new Error('Review submissions require Supabase. Add the project variables to .env.local and restart the dev server.');
    }

    if (!session?.user?.id) {
      throw new Error('Please log in with a valid account before submitting a review.');
    }

    const databaseCreatorId = databaseCreatorIds[review.creatorId];
    if (!databaseCreatorId) throw new Error('This creator is not connected to a database record yet.');

    const { data, error } = await supabase.from('reviews').insert({
      user_id:session.user.id,
      creator_id:databaseCreatorId,
      overall_rating:review.overallRating,
      profanity:review.profanity,
      substance_use:review.substanceUse,
      age_level:review.ageLevel,
      review_text:review.reviewText,
      bias_text:review.biasText,
      uses_ai:review.usesAi
    }).select('review_id, creator_id, overall_rating, profanity, substance_use, age_level, review_text, bias_text, uses_ai, created_at').single();

    if (error) throw new Error(error.message);
    const insertedReview = formatReview(data, review.creatorId);
    setReviews(currentReviews => [insertedReview, ...currentReviews]);
    return insertedReview;
  };

  const navigate=(next,id=null)=>{
    if (protectedPages.has(next) && !session?.user) {
      const destination = { page: next, id };
      signInNavigationHandled.current = false;
      pendingDestination.current = destination;
      window.sessionStorage.setItem('authReturnTo', JSON.stringify(destination));
      setRequiresAuth(true);
      setPage('login');
    } else if (protectedPages.has(next) && next !== 'complete-profile' && profileReady && !isProfileComplete(profile)) {
      window.sessionStorage.setItem('profileReturnTo', JSON.stringify({ page: next, id }));
      setPage('complete-profile');
    } else {
      if (!['login','signup'].includes(next)) {
        pendingDestination.current = null;
        window.sessionStorage.removeItem('authReturnTo');
        setRequiresAuth(false);
      }
      setSelected(id);
      setPage(next);
    }
    const nextPath = next === 'privacy' ? '/privacy' : next === 'terms' ? '/terms' : '/';
    if (window.location.pathname !== nextPath) window.history.pushState({}, '', nextPath);
    window.scrollTo(0,0);
  };
  const creator=creators.find(c=>c.id===selected)||creators[0];
  const shell=!['signup','login','complete-profile'].includes(page);
  if ((!authReady && protectedPages.has(page)) || (session?.user && !profileReady && protectedPages.has(page))) return <main className="auth-loading" aria-live="polite"><span className="brand-mark"><Play fill="white"/></span><p>Loading your account…</p></main>;
  return <>{shell&&<Header navigate={navigate} query={query} setQuery={setQuery} user={session?.user} profileUsername={profile?.username}/>} {page==='home'&&<Home navigate={navigate} query={query} setQuery={setQuery}/>} {page==='creators'&&<DiscoverCreators navigate={navigate} query={query} setQuery={setQuery}/>} {page==='profile'&&<CreatorProfile creator={creator} navigate={navigate} reviews={reviews} reviewsLoading={reviewsLoading} reviewsError={reviewsError} user={session?.user}/>} {page==='privacy'&&<LegalPage type="privacy" navigate={navigate}/>} {page==='terms'&&<LegalPage type="terms" navigate={navigate}/>} {(page==='signup'||page==='login')&&<AccountSignIn type={page} navigate={navigate} requiresAuth={requiresAuth}/>} {page==='complete-profile'&&session?.user&&<CompleteProfile user={session.user} profile={profile} initialError={profileError} onComplete={finishProfile} onLogout={logoutFromOnboarding}/>} {page==='dashboard'&&session?.user&&<Dashboard navigate={navigate} reviews={reviews} user={session.user} profile={profile}/>} {page==='settings'&&session?.user&&<AccountSettings navigate={navigate} user={session.user} profile={profile} onProfileChanged={handleProfileChanged}/>} {page==='rate'&&session?.user&&<RateCreator navigate={navigate} selectedId={selected} submitReview={submitReview}/>} {shell&&<footer><button className="brand" onClick={()=>navigate('home')}><span className="brand-mark"><Play fill="white"/></span>Rate My <b>Creator</b></button><p>Better choices start with honest opinions.</p><button className="footer-link" onClick={()=>navigate('privacy')}>Privacy</button><button className="footer-link" onClick={()=>navigate('terms')}>Terms</button><span>© 2026 Rate My Creator · Class project</span></footer>}</>;
}

createRoot(document.getElementById('root')).render(<App/>);
