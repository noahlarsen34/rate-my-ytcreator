import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Search, UserRound, ChevronRight, Star, ExternalLink, SlidersHorizontal,
  Settings, Bookmark, ThumbsUp, MessageSquareText, ArrowLeft, Play,
  ShieldCheck, Sparkles, Flag, X, Check, Eye, EyeOff, LogOut, Menu
} from 'lucide-react';
import './styles.css';

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
const initialReviews = [
  { creator: 'Orbit Lab', score: 5, date: 'Sep 18, 2026', text: 'Clear explanations and incredible visuals. I always learn something new.' },
  { creator: 'Maya Makes', score: 4, date: 'Aug 30, 2026', text: 'Creative and easy to follow. Material lists could be a little clearer.' }
];

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

function Header({ navigate, query, setQuery, loggedIn, setLoggedIn }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="header">
      <button className="brand" onClick={() => navigate('home')}><span className="brand-mark"><Play fill="white" /></span><span>Rate My <b>Creator</b></span></button>
      <div className="nav-search"><SearchBox compact value={query} setValue={setQuery} onSubmit={() => navigate('creators')} /></div>
      <nav className={open ? 'open' : ''}>
        <button onClick={() => navigate('creators')}>Discover</button>
        {loggedIn ? <button className="account-chip" onClick={() => navigate('dashboard')}><UserRound size={18} /> Alex</button> : <><button onClick={() => navigate('login')}>Log in</button><button className="primary small" onClick={() => navigate('signup')}>Sign up</button></>}
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

function Profile({ creator, navigate }) {
  const [bug, setBug] = useState(false), [sent, setSent] = useState(false);
  return <main className="page profile-page"><button className="back" onClick={() => navigate('creators')}><ArrowLeft size={17}/> All creators</button>
    <section className="profile-hero"><Avatar creator={creator} size="xl"/><div className="profile-main"><span className="category">{creator.category}</span><h1>{creator.name}</h1><p className="handle">{creator.handle}</p><p className="tagline">“{creator.tagline}”</p><div className="profile-actions"><button className="primary" onClick={() => navigate('rate', creator.id)}><Star size={18}/> Rate this creator</button><button className="secondary" onClick={() => window.open('https://youtube.com', '_blank')}>YouTube channel <ExternalLink size={16}/></button></div></div><div className="score-card"><span>COMMUNITY SCORE</span><strong>{creator.score.toFixed(1)}</strong><Stars score={creator.score}/><p>Based on {creator.reviews.toLocaleString()} ratings</p></div></section>
    <div className="profile-grid"><section><div className="panel"><h2>At a glance</h2><p className="description">{creator.description}</p><div className="facts"><div><span>Content</span><b>{creator.topic}</b></div><div><span>Best for</span><b>{creator.audience}</b></div><div><span>Uses AI</span><b>{creator.ai}</b></div></div></div>
      <div className="panel"><div className="panel-head"><h2>Community ratings</h2><span>Last 90 days</span></div><Metric label="Truthfulness" value={creator.truth} note="Well-researched and transparent"/><Metric label="Family-friendly" value={6-creator.profanity} note="Based on language and themes"/><Metric label="Low substance mention" value={6-creator.substance} note="Frequency across recent content"/></div>
    </section><aside><div className="panel verdict"><ShieldCheck/><h3>Why this score?</h3><p>Viewers consistently praise this creator’s clear presentation and honest approach. Ratings suggest reliable, age-appropriate content with strong educational value.</p></div><div className="panel rating-split"><h3>Rating breakdown</h3>{[[5,68],[4,22],[3,7],[2,2],[1,1]].map(([s,p])=><div key={s}><span>{s} <Star size={11} fill="currentColor"/></span><i><b style={{width:`${p}%`}}/></i><small>{p}%</small></div>)}</div></aside></div>
    <button className="report-link" onClick={() => setBug(true)}><Flag size={15}/> See something incorrect? Report an issue</button>
    {bug && <div className="modal-backdrop" onMouseDown={() => setBug(false)}><div className="modal" onMouseDown={e => e.stopPropagation()}><button className="modal-close" onClick={() => setBug(false)}><X/></button>{sent ? <div className="success"><Check/><h2>Thanks for the heads-up!</h2><p>We’ll review your report soon.</p><button className="primary" onClick={() => setBug(false)}>Done</button></div> : <><span className="kicker">REPORT AN ISSUE</span><h2>What doesn’t look right?</h2><p>Tell us what’s inaccurate on {creator.name}’s profile.</p><textarea placeholder="Describe the issue or correction…" rows="5"/><button className="primary full" onClick={() => setSent(true)}>Submit report</button></>}</div></div>}
  </main>;
}

function Auth({ type, navigate, setLoggedIn }) {
  const signup = type === 'signup'; const [show, setShow] = useState(false), [error, setError] = useState('');
  const submit = e => {e.preventDefault(); if (!e.currentTarget.checkValidity()) { setError('Please complete every required field.'); return; } setLoggedIn(true); navigate('dashboard');};
  return <main className="auth-page"><section className="auth-side"><button className="brand light" onClick={() => navigate('home')}><span className="brand-mark"><Play fill="white"/></span>Rate My <b>Creator</b></button><div><span className="kicker">JOIN THE COMMUNITY</span><h1>Your opinion helps shape the feed.</h1><p>Rate creators, save your favorites, and help people choose better content.</p></div><div className="auth-quote">“Finally, one place to see whether a channel is actually worth my time.”<span>— Community member</span></div></section><section className="auth-form"><div className="form-wrap"><button className="back" onClick={() => navigate('home')}><ArrowLeft size={17}/> Back home</button><h2>{signup ? 'Create your account' : 'Welcome back'}</h2><p>{signup ? 'Start rating creators in just a minute.' : 'Log in to continue to your dashboard.'}</p><form onSubmit={submit} noValidate>{signup && <><label>Full name<input required autoComplete="name" placeholder="Alex Morgan"/></label><label>Birthday<input required type="date" autoComplete="bday"/></label></>}<label>Email address<input required type="email" autoComplete="email" placeholder="alex@example.com"/></label>{signup && <label>Username<input required autoComplete="username" placeholder="alexreviews"/></label>}<label>Password<div className="password"><input required minLength="8" type={show?'text':'password'} autoComplete={signup?'new-password':'current-password'} placeholder="At least 8 characters"/><button type="button" onClick={() => setShow(!show)}>{show?<EyeOff/>:<Eye/>}</button></div></label>{error && <p className="form-error">{error}</p>}<button className="primary full">{signup ? 'Create account' : 'Log in'} <ChevronRight size={18}/></button></form><p className="switch">{signup ? 'Already have an account?' : 'New here?'} <button onClick={() => navigate(signup?'login':'signup')}>{signup?'Log in':'Create an account'}</button></p></div></section></main>;
}

function Dashboard({ navigate, reviews }) {
  const following = creators.slice(0,3);
  return <main className="page dashboard"><div className="dash-head"><div><span className="kicker">YOUR DASHBOARD</span><h1>Good to see you, Alex.</h1><p>Here’s everything you’ve contributed and saved.</p></div><button className="icon-button" title="Settings" onClick={() => navigate('settings')}><Settings/></button></div><div className="dash-stats"><div><MessageSquareText/><strong>{reviews.length}</strong><span>Ratings written</span></div><div><Bookmark/><strong>3</strong><span>Creators followed</span></div><div><ThumbsUp/><strong>12</strong><span>Helpful votes</span></div></div><div className="dashboard-grid"><section className="panel"><div className="panel-head"><h2>Your ratings</h2><button className="text-button" onClick={() => navigate('rate')}>Write a rating</button></div>{reviews.map((r,i)=><div className="review-row" key={i}><div><h3>{r.creator}</h3><Stars score={r.score} small/><span className="date">{r.date}</span><p>{r.text}</p></div><ChevronRight/></div>)}</section><aside className="panel"><div className="panel-head"><h2>Following</h2><span>{following.length}</span></div>{following.map(c=><button className="follow-row" key={c.id} onClick={()=>navigate('profile',c.id)}><Avatar creator={c}/><span><b>{c.name}</b><small>{c.topic}</small></span><ChevronRight/></button>)}</aside></div></main>;
}

function SettingsPage({ navigate, setLoggedIn }) {
  const [editing, setEditing] = useState(false), [saved, setSaved] = useState(false);
  return <main className="page settings-page"><button className="back" onClick={() => navigate('dashboard')}><ArrowLeft size={17}/> Dashboard</button><div className="settings-head"><div><span className="kicker">ACCOUNT SETTINGS</span><h1>Your profile</h1><p>Manage your personal details and account information.</p></div><button className={editing?'primary':'secondary'} onClick={() => {if(editing)setSaved(true);setEditing(!editing)}}>{editing?'Save changes':'Edit profile'}</button></div>{saved&&<div className="save-note"><Check/> Your changes have been saved.</div>}<section className="panel settings-form"><h2>Personal information</h2>{[['Full name','Alex Morgan','text'],['Birthday','2002-06-15','date'],['Email address','alex@example.com','email'],['Username','alexreviews','text']].map(([label,value,type])=><div className="setting-row" key={label}><label>{label}</label>{editing?<input type={type} defaultValue={value}/>:<span>{value}</span>}</div>)}</section><button className="logout" onClick={() => {setLoggedIn(false);navigate('home')}}><LogOut size={17}/> Log out</button></main>;
}

function Rate({ navigate, selectedId, addReview }) {
  const [wordCount,setWordCount]=useState(0), [done,setDone]=useState(false), [values,setValues]=useState({truth:'3',profanity:'1',substance:'1'});
  const submit=e=>{e.preventDefault(); const f=new FormData(e.currentTarget); addReview({creator:f.get('creator'),score:Number(values.truth),date:'Today',text:f.get('review')});setDone(true)};
  if(done)return <main className="page"><div className="submission-success"><div><Check/></div><span className="kicker">RATING SUBMITTED</span><h1>Thanks for sharing your take.</h1><p>Your rating has been added to the community. Every thoughtful review helps someone make a better choice.</p><button className="primary" onClick={()=>navigate('dashboard')}>View your dashboard</button><button className="text-button" onClick={()=>navigate('creators')}>Discover more creators</button></div></main>;
  return <main className="page rating-page"><button className="back" onClick={()=>navigate(selectedId?'profile':'dashboard',selectedId)}><ArrowLeft size={17}/> Back</button><div className="form-heading"><span className="kicker">SHARE YOUR EXPERIENCE</span><h1>Rate a content creator</h1><p>Be honest, specific, and respectful. All fields are required.</p></div><form className="rating-form" onSubmit={submit}><section className="panel"><h2>About the creator</h2><label>Content creator<select name="creator" required defaultValue={selectedId?creators.find(c=>c.id===selectedId)?.name:''}><option value="" disabled>Choose a creator</option>{creators.map(c=><option key={c.id}>{c.name}</option>)}</select></label><label>Your review <span>{wordCount}/150 words</span><textarea name="review" required rows="6" placeholder="What stands out about this creator? What should new viewers know?" onChange={e=>{const words=e.target.value.trim().split(/\s+/).filter(Boolean);if(words.length<=150)setWordCount(words.length);else e.target.value=words.slice(0,150).join(' ')}}/></label><label>Any biases to disclose?<input name="bias" required placeholder="Example: I have followed this creator for 2 years"/></label></section><section className="panel"><h2>Content ratings</h2><RangeField label="Truthfulness" low="Misleading" high="Highly reliable" value={values.truth} set={v=>setValues({...values,truth:v})}/><label>Overall age-appropriateness<select required><option value="">Select an age range</option><option>All</option><option>8+</option><option>13+</option><option>16+</option><option>18+</option></select></label><RangeField label="Profanity" low="None" high="Very frequent" value={values.profanity} set={v=>setValues({...values,profanity:v})}/><RangeField label="Substance use / mention" low="Never" high="Every video" value={values.substance} set={v=>setValues({...values,substance:v})}/><label>Does the creator use AI?<select required><option value="">Choose one</option><option>Yes</option><option>No</option><option>Unsure</option></select></label></section><button className="primary submit-rating">Submit rating <ChevronRight size={18}/></button></form></main>;
}

function RangeField({label,low,high,value,set}) {return <label className="range-label"><span>{label}<b>{value}/5</b></span><input type="range" min="1" max="5" value={value} onChange={e=>set(e.target.value)}/><small><span>{low}</span><span>{high}</span></small></label>}

function App() {
  const [page,setPage]=useState('home'), [selected,setSelected]=useState(null), [query,setQuery]=useState(''), [loggedIn,setLoggedIn]=useState(false), [reviews,setReviews]=useState(initialReviews);
  const navigate=(next,id=null)=>{setSelected(id);setPage(next);window.scrollTo(0,0)};
  const creator=creators.find(c=>c.id===selected)||creators[0];
  const shell=!['signup','login'].includes(page);
  return <>{shell&&<Header navigate={navigate} query={query} setQuery={setQuery} loggedIn={loggedIn} setLoggedIn={setLoggedIn}/>} {page==='home'&&<Home navigate={navigate} query={query} setQuery={setQuery}/>} {page==='creators'&&<Creators navigate={navigate} query={query} setQuery={setQuery}/>} {page==='profile'&&<Profile creator={creator} navigate={navigate}/>} {(page==='signup'||page==='login')&&<Auth type={page} navigate={navigate} setLoggedIn={setLoggedIn}/>} {page==='dashboard'&&<Dashboard navigate={navigate} reviews={reviews}/>} {page==='settings'&&<SettingsPage navigate={navigate} setLoggedIn={setLoggedIn}/>} {page==='rate'&&<Rate navigate={navigate} selectedId={selected} addReview={r=>setReviews([r,...reviews])}/>} {shell&&<footer><button className="brand" onClick={()=>navigate('home')}><span className="brand-mark"><Play fill="white"/></span>Rate My <b>Creator</b></button><p>Better choices start with honest opinions.</p><span>© 2026 Rate My Creator · Class project</span></footer>}</>;
}

createRoot(document.getElementById('root')).render(<App/>);
