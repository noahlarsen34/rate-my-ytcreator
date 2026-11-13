import { useEffect, useRef, useState } from 'react';
import {
  Search, UserRound, ChevronRight, Star, ThumbsUp, ThumbsDown, Menu, Play, Settings, LogOut
} from 'lucide-react';
import { supabase } from '../lib/supabase';

export function Avatar({ creator, size = 'md' }) {
  return <div className={`avatar ${size}`} style={{ '--avatar': creator.color }}>{creator.thumbnailUrl ? <img src={creator.thumbnailUrl} alt="" referrerPolicy="no-referrer"/> : <span>{creator.initials}</span>}<Play size={size === 'lg' ? 28 : 15} fill="currentColor" /></div>;
}

export function Stars({ score, small = false }) {
  return <span className={`stars ${small ? 'small' : ''}`}><Star fill="currentColor" /> <b>{score.toFixed(1)}</b></span>;
}

export function ReviewAuthor({ review, navigate }) {
  if (!review.userId) return <span className="review-author unavailable"><span className="review-author-avatar"><UserRound size={16}/></span><b>Community member</b></span>;
  const name = review.authorUsername || 'Community member';
  return <button type="button" className="review-author" onClick={event => { event.stopPropagation(); navigate('user-profile', review.userId); }} aria-label={`View ${name}'s profile`}>
    <span className="review-author-avatar">{review.authorAvatarUrl ? <img src={review.authorAvatarUrl} alt="" referrerPolicy="no-referrer"/> : <UserRound size={16}/>}</span>
    <b>{name.startsWith('@') ? name : `@${name}`}</b>
  </button>;
}

export function SearchBox({ value, setValue, onSubmit, compact = false, placeholder = 'Search creators or users', ariaLabel = 'Search creators or users' }) {
  return (
    <form className={`search-box ${compact ? 'compact' : ''}`} onSubmit={e => { e.preventDefault(); onSubmit?.(); }}>
      <Search size={compact ? 18 : 23} />
      <input value={value} onChange={e => setValue(e.target.value)} placeholder={placeholder} aria-label={ariaLabel} />
      {!compact && <button>Search</button>}
    </form>
  );
}

export function Header({ navigate, query, setQuery, user, profileUsername, avatarUrl }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef(null);
  const displayName = profileUsername || user?.user_metadata?.username || user?.user_metadata?.first_name || user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Account';
  useEffect(() => {
    if (!accountMenuOpen) return;
    const closeOutside = event => { if (!accountMenuRef.current?.contains(event.target)) setAccountMenuOpen(false); };
    const closeOnEscape = event => { if (event.key === 'Escape') setAccountMenuOpen(false); };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => { document.removeEventListener('pointerdown', closeOutside); document.removeEventListener('keydown', closeOnEscape); };
  }, [accountMenuOpen]);
  const goTo = page => {
    setAccountMenuOpen(false);
    setMobileNavOpen(false);
    navigate(page);
  };
  const logout = async () => {
    if (supabase) await supabase.auth.signOut();
    goTo('home');
  };
  return (
    <header className="header">
      <button className="brand" onClick={() => navigate('home')}><span className="brand-mark"><Play fill="white" /></span><span>Rate My <b>Creator</b></span></button>
      <div className="nav-search"><SearchBox compact value={query} setValue={setQuery} onSubmit={() => navigate('creators')} /></div>
      <nav className={mobileNavOpen ? 'open' : ''}>
        <button onClick={() => goTo('creators')}>Discover</button>
        {user ? <div className="account-menu" ref={accountMenuRef}>
          <span className="account-avatar">{avatarUrl ? <img src={avatarUrl} alt="" referrerPolicy="no-referrer"/> : <UserRound size={18}/>}</span>
          <button className="account-chip" aria-haspopup="menu" aria-expanded={accountMenuOpen} onClick={() => setAccountMenuOpen(!accountMenuOpen)}>{displayName} <ChevronRight className="account-mobile-chevron" size={17} /></button>
          {accountMenuOpen && <div className="account-dropdown" role="menu">
            <button role="menuitem" onClick={() => goTo('dashboard')}>Dashboard</button>
            <button role="menuitem" onClick={() => goTo('settings')}><Settings size={17}/> Account settings</button>
            <button className="dropdown-logout" role="menuitem" onClick={logout}><LogOut size={17}/> Log out</button>
          </div>}
        </div> : <><button onClick={() => goTo('login')}>Log in</button><button className="primary small" onClick={() => goTo('signup')}>Sign up</button></>}
      </nav>
      <button className="menu" aria-expanded={mobileNavOpen} aria-label="Toggle navigation menu" onClick={() => setMobileNavOpen(!mobileNavOpen)}><Menu /></button>
    </header>
  );
}

export function CreatorCard({ creator, navigate, wide = false }) {
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

export function Metric({ label, value, note, inverse = false }) {
  const pct = inverse ? (6-value)*20 : value*20;
  return <div className="metric"><div className="metric-top"><span>{label}</span><b>{value.toFixed(1)}<small>/5</small></b></div><div className="bar"><i style={{width: `${pct}%`}} /></div><p>{note}</p></div>;
}

export function ReviewVotes({ review, user, navigate, onVoteCountsChange }) {
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
    const nextCounts = {
      up: counts.up + (nextVote === 'up' ? (vote === 'up' ? 0 : 1) : vote === 'up' ? -1 : 0),
      down: counts.down + (nextVote === 'down' ? (vote === 'down' ? 0 : 1) : vote === 'down' ? -1 : 0)
    };
    setCounts(nextCounts);
    onVoteCountsChange?.(review.id, nextCounts);
    setVote(nextVote);
  };
  return <div className="review-votes" ref={voteControlsRef} aria-label="Review votes"><button type="button" disabled={saving} className={vote === 'up' ? 'selected' : ''} aria-label={`Upvote review (${counts.up})`} aria-pressed={vote === 'up'} onClick={() => choose('up')}><ThumbsUp size={19} fill={vote === 'up' ? 'currentColor' : 'none'}/><span>{counts.up}</span></button><button type="button" disabled={saving} className={vote === 'down' ? 'selected' : ''} aria-label={`Downvote review (${counts.down})`} aria-pressed={vote === 'down'} onClick={() => choose('down')}><ThumbsDown size={19} fill={vote === 'down' ? 'currentColor' : 'none'}/><span>{counts.down}</span></button>{loginPromptFor && <div className={`vote-login-prompt ${loginPromptFor}`} role="status"><span>Log in to leave a vote.</span><button type="button" onClick={() => navigate('login')}>Log in</button></div>}{voteError && <span className="vote-error" role="alert">{voteError}</span>}</div>;
}

export function RangeField({label,low,high,value,set,min='1',max='5'}) {return <label className="range-label"><span>{label}<b>{value}/{max}</b></span><input type="range" min={min} max={max} value={value} onChange={e=>set(e.target.value)}/><small><span>{low}</span><span>{high}</span></small></label>}
