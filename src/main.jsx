import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Search, UserRound, ChevronRight, Star, ExternalLink, SlidersHorizontal,
  Settings, Bookmark, ThumbsUp, ThumbsDown, MessageSquareText, ArrowLeft, Play,
  ShieldCheck, Sparkles, Flag, X, Check, Eye, EyeOff, LogOut, Menu, CircleHelp
} from 'lucide-react';
import './styles.css';
import './reviews.css';
import './auth.css';
import { isSupabaseConfigured, supabase } from './lib/supabase';

// Creator profiles are supplied by the YouTube data integration; do not add local seed records here.
const creators = [];

const categories = ['All', ...new Set(creators.map(c => c.category))];
const protectedPages = new Set(['dashboard', 'settings', 'rate']);

function creatorIdFromChannelLink(channelLink) {
  const handle = channelLink?.match(/@([^/?#]+)/)?.[1]?.toLowerCase();
  return creators.find(creator => creator.handle.slice(1).toLowerCase() === handle)?.id;
}

function formatReview(review, creatorId, channelLink = review.content_creators?.channel_link) {
  const creator = creators.find(item => item.id === creatorId);
  const channelHandle = channelLink?.match(/@([^/?#]+)/)?.[1];

  return {
    id: review.review_id,
    userId: review.user_id,
    creatorId,
    creator: creator?.name ?? (channelHandle ? `@${channelHandle}` : 'Creator review'),
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

function Header({ navigate, query, setQuery, user, profileUsername }) {
  const [open, setOpen] = useState(false);
  const displayName = profileUsername || user?.user_metadata?.username || user?.user_metadata?.first_name || user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Account';
  return (
    <header className="header">
      <button className="brand" onClick={() => navigate('home')}><span className="brand-mark"><Play fill="white" /></span><span>Rate My <b>Creator</b></span></button>
      <div className="nav-search"><SearchBox compact value={query} setValue={setQuery} onSubmit={() => navigate('creators')} /></div>
      <nav className={open ? 'open' : ''}>
        <button onClick={() => navigate('creators')}>Discover</button>
        {user ? <button className="account-chip" onClick={() => navigate('dashboard')}><UserRound size={18} /> {displayName}</button> : <><button onClick={() => navigate('login')}>Log in</button><button className="primary small" onClick={() => navigate('signup')}>Sign up</button></>}
      </nav>
      <button className="menu" onClick={() => setOpen(!open)}><Menu /></button>
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
    </section>
    <section className="section featured">
      <div className="section-title"><div><span className="kicker">DISCOVER</span><h2>Creator profiles are on the way</h2></div><button className="text-button" onClick={() => navigate('creators')}>Browse creators <ChevronRight size={18} /></button></div>
      <div className="empty"><h3>Creator data is coming soon</h3><p>Once creator profiles are connected, you’ll find them here.</p></div>
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
      <section className="results"><div className="results-head"><b>{filtered.length} creators</b></div>{filtered.length ? filtered.map(c => <CreatorCard key={c.id} creator={c} navigate={navigate} wide />) : <div className="empty"><Search size={36}/><h3>{query ? 'No creators found' : 'Creator data is coming soon'}</h3><p>{query ? 'Try another name or clear your search.' : 'Creator profiles will appear here when the YouTube data connection is ready.'}</p>{query && <button className="secondary" onClick={() => setQuery('')}>Clear search</button>}</div>}</section>
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
    if (signup && password !== form.get('confirmPassword')) { setError('Passwords do not match.'); setSubmitting(false); return; }
    if (signup) {
      const { data, error: signupError } = await supabase.auth.signUp({ email, password, options:{ emailRedirectTo:`${window.location.origin}/?auth=callback`, data:{ username:form.get('username').trim() } } });
      if (signupError) setError(signupError.message);
      else if (!data.session) setNotice('Check your email to confirm your account, then return here to log in. If no email arrives, this address may already be linked to an account; try Continue with Google or log in with your existing method.');
      // SIGNED_IN is handled centrally so guarded navigation can resume.
    } else {
      const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
      if (loginError) setError(loginError.message);
    }
    setSubmitting(false);
  };
  return <main className="auth-page"><section className="auth-side"><button className="brand light" onClick={() => navigate('home')}><span className="brand-mark"><Play fill="white"/></span>Rate My <b>Creator</b></button><div><span className="kicker">JOIN THE COMMUNITY</span><h1>Your opinion helps shape the feed.</h1><p>Rate creators, save your favorites, and help people choose better content.</p></div><div className="auth-quote">Share your experience and help others choose what to watch.</div></section><section className="auth-form"><div className="form-wrap"><button className="back" onClick={() => navigate('home')}><ArrowLeft size={17}/> Back home</button><h2>{signup ? 'Create your account' : 'Welcome back'}</h2><p>{requiresAuth ? 'Log in to continue where you left off.' : signup ? 'Start rating creators in just a minute.' : 'Log in to continue to your dashboard.'}</p>{requiresAuth&&<p className="auth-required" role="status"><ShieldCheck size={17}/> You need an account to access that page.</p>}<button type="button" className="google-button" onClick={signInWithGoogle} disabled={submitting}><GoogleIcon/> Continue with Google</button><div className="auth-divider"><span>or continue with email</span></div><form onSubmit={submit} noValidate><label>Email address<input name="email" required type="email" autoComplete="email" placeholder="alex@example.com"/></label>{signup && <label>Username<input name="username" required autoComplete="username" placeholder="alexreviews"/></label>}<label>Password<div className="password"><input name="password" required minLength={signup ? 8 : undefined} type={show?'text':'password'} autoComplete={signup?'new-password':'current-password'} placeholder="At least 8 characters"/><button type="button" onClick={() => setShow(!show)} aria-label={show?'Hide password':'Show password'}>{show?<EyeOff/>:<Eye/>}</button></div></label>{signup && <label>Confirm password<input name="confirmPassword" required minLength="8" type={show?'text':'password'} autoComplete="new-password" placeholder="Re-enter your password"/></label>}{error&&<p className="form-error" role="alert">{error}</p>}{notice&&<p className="form-notice" role="status">{notice}</p>}<button className="primary full" disabled={submitting}>{submitting?'Please wait…':signup?'Create account':'Log in'} {!submitting&&<ChevronRight size={18}/>}</button></form><p className="switch">{signup?'Already have an account?':'New here?'} <button onClick={() => navigate(signup?'login':'signup')}>{signup?'Log in':'Create an account'}</button></p></div></section></main>;
}

function generatedUsernameFor(user) {
  const metadata = user?.user_metadata || {};
  const source = metadata.full_name || metadata.name || user?.email?.split('@')[0] || 'creator';
  const base = source.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 20).replace(/-+$/g, '') || 'creator';
  const suffix = user.id.replace(/-/g, '').slice(-8).toLowerCase();
  return `${base}-${suffix}`;
}

function Dashboard({ navigate, reviews, reviewsLoading, reviewsError, user }) {
  const userReviews = reviews.filter(review => review.userId === user.id);
  const following = [];
  const displayName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'there';
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
  return <main className="page dashboard"><div className="dash-head"><div><span className="kicker">YOUR DASHBOARD</span><h1>Good to see you, {displayName}.</h1><p>Here’s everything you’ve contributed and saved.</p></div><button className="icon-button" title="Settings" onClick={() => navigate('settings')}><Settings/></button></div><div className="dash-stats"><div><MessageSquareText/><strong>{reviewsLoading ? '—' : userReviews.length}</strong><span>Ratings written</span></div><div><Bookmark/><strong>{following.length}</strong><span>Creators followed</span></div><div><ThumbsUp/><strong>{helpfulVotes === null ? '—' : helpfulVotes}</strong><span>Helpful votes</span></div></div><div className="dashboard-grid"><section className="panel"><div className="panel-head"><h2>Your ratings</h2><button className="text-button" onClick={() => navigate('rate')}>Write a rating</button></div>{reviewsLoading ? <p className="review-status">Loading your ratings…</p> : reviewsError ? <p className="review-status">Your ratings couldn’t be loaded.</p> : userReviews.length ? userReviews.map((r,i)=><div className="review-row" key={i}><div><h3>{r.creator}</h3><Stars score={r.score} small/><span className="date">{r.date}</span><p>{r.text}</p></div><ChevronRight/></div>) : <p className="review-status">You haven’t left any ratings yet.</p>}</section><aside className="panel"><div className="panel-head"><h2>Following</h2><span>{following.length}</span></div>{following.length ? following.map(c=><button className="follow-row" key={c.id} onClick={()=>navigate('profile',c.id)}><Avatar creator={c}/><span><b>{c.name}</b><small>{c.topic}</small></span><ChevronRight/></button>) : <p className="review-status">You aren’t following any creators yet.</p>}</aside></div></main>;
}

function SettingsPage({ navigate, user, onUsernameChanged }) {
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
    const savedUsername = values.username.trim();
    const { error: saveError } = await supabase.from('users').upsert({ user_id: user.id, first_name: values.firstName.trim(), last_name: values.lastName.trim(), birthdate: values.birthday || null, username: savedUsername || null, gender: values.gender || null, phone_number: values.phoneNumber.trim() || null }, { onConflict: 'user_id' });
    if (saveError) setError(saveError.message || 'Your profile could not be saved.');
    else { onUsernameChanged?.(savedUsername); setEditing(false); setNotice('Your profile was saved.'); }
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
  if (!creators.length) return <main className="page rating-page"><button className="back" onClick={()=>navigate('dashboard')}><ArrowLeft size={17}/> Back</button><div className="empty"><h3>Creator profiles are coming soon</h3><p>You’ll be able to leave a rating after creator data is connected.</p><button className="secondary" onClick={()=>navigate('creators')}>Browse creators</button></div></main>;
  return <main className="page rating-page"><button className="back" onClick={()=>navigate(selectedId?'profile':'dashboard',selectedId)}><ArrowLeft size={17}/> Back</button><div className="form-heading"><span className="kicker">SHARE YOUR EXPERIENCE</span><h1>Rate a content creator</h1><p>Be honest, specific, and respectful. All fields are required.</p></div><form className="rating-form" onSubmit={submit}><section className="panel"><h2>About the creator</h2><label>Content creator<select name="creator" required defaultValue={selectedId || ''}><option value="" disabled>Choose a creator</option>{creators.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Your review <span>{wordCount}/150 words</span><textarea name="review" required rows="6" placeholder="What stands out about this creator? What should new viewers know?" onChange={e=>{const words=e.target.value.trim().split(/\s+/).filter(Boolean);if(words.length<=150)setWordCount(words.length);else e.target.value=words.slice(0,150).join(' ')}}/></label><label>Any biases to disclose?<input name="bias" required placeholder="Example: I have followed this creator for 2 years"/></label></section><section className="panel"><h2>Content ratings</h2><RangeField label="Truthfulness" low="Misleading" high="Highly reliable" value={values.truth} set={v=>setValues({...values,truth:v})}/><label>Overall age-appropriateness<select name="ageLevel" required><option value="">Select an age range</option><option value="All ages">All ages</option><option>8+</option><option>13+</option><option>16+</option><option>18+</option></select></label><RangeField label="Profanity" low="None" high="Very frequent" value={values.profanity} set={v=>setValues({...values,profanity:v})}/><RangeField label="Substance use / mention" low="Never" high="Every video" value={values.substance} set={v=>setValues({...values,substance:v})}/><label>Does the creator use AI?<select name="usesAi" required><option value="">Choose one</option><option>Yes</option><option>No</option><option>Unsure</option></select></label></section>{error && <p className="submit-error" role="alert">{error}</p>}<button className="primary submit-rating" disabled={submitting}>{submitting ? 'Submitting…' : <>Submit rating <ChevronRight size={18}/></>}</button></form></main>;
}

function RangeField({label,low,high,value,set}) {return <label className="range-label"><span>{label}<b>{value}/5</b></span><input type="range" min="1" max="5" value={value} onChange={e=>set(e.target.value)}/><small><span>{low}</span><span>{high}</span></small></label>}

function App() {
  const [page,setPage]=useState('home'), [selected,setSelected]=useState(null), [query,setQuery]=useState(''), [session,setSession]=useState(null), [authReady,setAuthReady]=useState(!isSupabaseConfigured), [requiresAuth,setRequiresAuth]=useState(false), [reviews,setReviews]=useState([]), [databaseCreatorIds,setDatabaseCreatorIds]=useState({}), [reviewsLoading,setReviewsLoading]=useState(true), [reviewsError,setReviewsError]=useState(''), [profileUsername,setProfileUsername]=useState(null);
  const pendingDestination = useRef(null);
  const signInNavigationHandled = useRef(false);
  const usernameUpdatesInFlight = useRef(new Set());
  const profileUsernameRequest = useRef(0);

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
      setSession(data.session);
      setAuthReady(true);
      ensureUsername(data.session?.user);
      if (data.session && new URLSearchParams(window.location.search).get('auth') === 'callback') finishSignIn(data.session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      setAuthReady(true);
      if (event === 'SIGNED_IN') finishSignIn(nextSession);
      if (event === 'SIGNED_OUT') signInNavigationHandled.current = false;
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const userId = session?.user?.id;
    const requestId = ++profileUsernameRequest.current;
    if (!userId) {
      setProfileUsername(null);
      return;
    }
    if (!isSupabaseConfigured) return;
    let active = true;
    supabase.from('users').select('username').eq('user_id', userId).maybeSingle().then(({ data, error }) => {
      if (!active || requestId !== profileUsernameRequest.current) return;
      setProfileUsername(error ? null : data?.username || null);
    });
    return () => { active = false; };
  }, [session?.user?.id]);

  const handleUsernameChanged = username => {
    profileUsernameRequest.current += 1;
    setProfileUsername(username || null);
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
    async function loadDatabaseReviews() {
      if (!isSupabaseConfigured) {
        setReviewsLoading(false);
        return;
      }

      setReviewsLoading(true);
      const [creatorsResult, reviewsResult] = await Promise.all([
        supabase.from('content_creators').select('creator_id, channel_link'),
        supabase.from('reviews').select('review_id, user_id, creator_id, overall_rating, profanity, substance_use, age_level, review_text, bias_text, uses_ai, created_at, content_creators(channel_link)').order('created_at', { ascending: false })
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
        return formatReview(review, localId);
      });

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
    }).select('review_id, user_id, creator_id, overall_rating, profanity, substance_use, age_level, review_text, bias_text, uses_ai, created_at').single();

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
    } else {
      if (!['login','signup'].includes(next)) {
        pendingDestination.current = null;
        window.sessionStorage.removeItem('authReturnTo');
        setRequiresAuth(false);
      }
      setSelected(id);
      setPage(next);
    }
    window.scrollTo(0,0);
  };
  const creator=creators.find(c=>c.id===selected);
  const shell=!['signup','login'].includes(page);
  if (!authReady) return <main className="auth-loading" aria-live="polite"><span className="brand-mark"><Play fill="white"/></span><p>Restoring your session…</p></main>;
  return <>{shell&&<Header navigate={navigate} query={query} setQuery={setQuery} user={session?.user} profileUsername={profileUsername}/>} {page==='home'&&<Home navigate={navigate} query={query} setQuery={setQuery}/>} {page==='creators'&&<Creators navigate={navigate} query={query} setQuery={setQuery}/>} {page==='profile'&&(creator ? <Profile creator={creator} navigate={navigate} reviews={reviews} reviewsLoading={reviewsLoading} reviewsError={reviewsError} user={session?.user}/> : <main className="page"><div className="empty"><h3>Creator profile unavailable</h3><p>Creator data has not been connected yet.</p><button className="secondary" onClick={()=>navigate('creators')}>Browse creators</button></div></main>)} {(page==='signup'||page==='login')&&<Auth type={page} navigate={navigate} requiresAuth={requiresAuth}/>} {page==='dashboard'&&session?.user&&<Dashboard navigate={navigate} reviews={reviews} reviewsLoading={reviewsLoading} reviewsError={reviewsError} user={session.user}/>} {page==='settings'&&session?.user&&<SettingsPage navigate={navigate} user={session.user} onUsernameChanged={handleUsernameChanged}/>} {page==='rate'&&session?.user&&<Rate navigate={navigate} selectedId={selected} submitReview={submitReview}/>} {shell&&<footer><button className="brand" onClick={()=>navigate('home')}><span className="brand-mark"><Play fill="white"/></span>Rate My <b>Creator</b></button><p>Better choices start with honest opinions.</p><span>© 2026 Rate My Creator · Class project</span></footer>}</>;
}

createRoot(document.getElementById('root')).render(<App/>);

