import { useEffect, useState } from 'react';
import { Settings, MessageSquareText, Bookmark, ThumbsUp, ChevronRight } from 'lucide-react';
import { creators } from '../data/creators';
import { supabase } from '../lib/supabase';
import { Avatar, Stars } from '../components/shared';

export function Dashboard({ navigate, reviews, user, profile }) {
  const following = creators.slice(0,3);
  const displayName = profile?.first_name || profile?.username || user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'there';
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
  return <main className="page dashboard"><div className="dash-head"><div><span className="kicker">YOUR DASHBOARD</span><h1>Good to see you, {displayName}.</h1><p>Here’s everything you’ve contributed and saved.</p></div><button className="icon-button" title="Settings" onClick={() => navigate('settings')}><Settings/></button></div><div className="dash-stats"><div><MessageSquareText/><strong>{reviews.length}</strong><span>Ratings written</span></div><div><Bookmark/><strong>3</strong><span>Creators followed</span></div><div><ThumbsUp/><strong>{helpfulVotes === null ? '—' : helpfulVotes}</strong><span>Helpful votes</span></div></div><div className="dashboard-grid"><section className="panel"><div className="panel-head"><h2>Your ratings</h2><button className="text-button" onClick={() => navigate('rate')}>Write a rating</button></div>{reviews.map((r,i)=><div className="review-row" key={i}><div><h3>{r.creator}</h3><Stars score={r.score} small/><span className="date">{r.date}</span><p>{r.text}</p></div><ChevronRight/></div>)}</section><aside className="panel"><div className="panel-head"><h2>Following</h2><span>{following.length}</span></div>{following.map(c=><button className="follow-row" key={c.id} onClick={()=>navigate('profile',c.id)}><Avatar creator={c}/><span><b>{c.name}</b><small>{c.topic}</small></span><ChevronRight/></button>)}</aside></div></main>;
}
