import { useEffect, useState } from 'react';
import { Check, Eye, Settings, MessageSquareText, Bookmark, ThumbsUp, ChevronRight, UsersRound, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Avatar, Stars } from '../components/shared';

export function Dashboard({ navigate, reviews, reviewsLoading, reviewsError, user, profile, creators, followingIds }) {
  const following = creators.filter(creator => creator.databaseId && followingIds.has(String(creator.databaseId)));
  const displayName = profile?.first_name || profile?.username || user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'there';
  const myReviews = reviews.filter(review => review.userId === user?.id);
  const [helpfulVotes, setHelpfulVotes] = useState(null);
  const [connections, setConnections] = useState({ loading: true, items: [], error: '', workingId: null });

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

  useEffect(() => {
    let active = true;
    async function loadConnections() {
      const { data, error } = await supabase.rpc('get_my_user_connections');
      if (!active) return;
      setConnections({ loading: false, items: data || [], error: error ? 'Your connections could not be loaded.' : '', workingId: null });
    }
    loadConnections();
    return () => { active = false; };
  }, [user?.id]);

  const respondToConnection = async (connection, action) => {
    if (connections.workingId) return;
    setConnections(current => ({ ...current, workingId: connection.user_id, error: '' }));
    const result = connection.direction === 'received'
      ? await supabase.rpc('respond_user_connection_request', { p_requester_id: connection.user_id, p_accept: action === 'accept' })
      : await supabase.rpc('cancel_user_connection_request', { p_recipient_id: connection.user_id });
    if (result.error) {
      setConnections(current => ({ ...current, workingId: null, error: 'That connection request could not be updated. Please try again.' }));
    } else {
      setConnections(current => ({ ...current, workingId: null, items: current.items.filter(item => item.user_id !== connection.user_id || (action === 'accept' && item.direction === 'received')).map(item => item.user_id === connection.user_id ? { ...item, direction: 'connected', status: 'accepted' } : item) }));
    }
  };

  return <main className="page dashboard">
    <div className="dash-head"><div><span className="kicker">YOUR DASHBOARD</span><h1>Good to see you, {displayName}.</h1><p>Here’s everything you’ve contributed and saved.</p></div><button className="icon-button" title="Settings" onClick={() => navigate('settings')}><Settings/></button></div>
    <div className="dash-stats"><div><MessageSquareText/><strong>{myReviews.length}</strong><span>Ratings written</span></div><div><Bookmark/><strong>{following.length}</strong><span>Creator subscriptions</span></div><div><ThumbsUp/><strong>{helpfulVotes === null ? '—' : helpfulVotes}</strong><span>Helpful votes</span></div></div>
    <div className="dashboard-grid">
      <section className="panel"><div className="panel-head"><h2>Your ratings</h2><button className="text-button" onClick={() => navigate('rate')}>Write a rating</button></div>{reviewsLoading ? <p className="dashboard-empty" role="status">Loading reviews…</p> : reviewsError ? <p className="dashboard-empty" role="alert">Reviews couldn’t be loaded.</p> : myReviews.length === 0 ? <div className="empty-reviews"><p>You have not reviewed any creators.</p><button className="primary" onClick={() => navigate('rate')}>Write a rating <ChevronRight size={18}/></button></div> : myReviews.map(r=><button type="button" className="review-row" key={r.id} aria-label={'View rating for ' + r.creator} onClick={() => navigate('profile', r.creatorId, r.id)}><div><h3>{r.creator}</h3><Stars score={r.score} small/><span className="date">{r.date}</span><p>{r.text}</p></div><ChevronRight aria-hidden="true"/></button>)}</section>
      <aside className="panel"><div className="panel-head"><h2>Subscriptions</h2><span>{following.length}</span></div>{following.length ? following.map(c=><button className="follow-row" key={c.id} onClick={()=>navigate('profile',c.id)}><Avatar creator={c}/><span><b>{c.name}</b><small>{c.topic}</small></span><ChevronRight/></button>) : <p className="dashboard-empty">You have no creator subscriptions yet.</p>}</aside>
    </div>
    <section className="panel dashboard-connections">
      <div className="panel-head"><h2><UsersRound size={19}/> Connections</h2><button className="text-button" onClick={() => navigate('creators')}>Find people</button></div>
      {connections.loading ? <p className="dashboard-empty" role="status">Loading connections…</p>
        : connections.error ? <p className="dashboard-empty" role="alert">{connections.error}</p>
          : <>
            {connections.items.filter(item => item.direction === 'received').length > 0&&<div className="connection-group"><h3>Requests for you</h3>{connections.items.filter(item => item.direction === 'received').map(connection => <div className="connection-row" key={connection.user_id}>
              <button type="button" className="connection-person" onClick={() => navigate('user-profile', connection.user_id)}><span className="connection-avatar">{connection.avatar_url ? <img src={connection.avatar_url} alt="" referrerPolicy="no-referrer"/> : <UsersRound size={18}/>}</span><b>@{connection.username}</b></button>
              <div><button className="primary small" disabled={connections.workingId === connection.user_id} onClick={() => respondToConnection(connection, 'accept')}>{connections.workingId === connection.user_id?'Please wait…':<><Check size={15}/> Accept</>}</button><button className="text-button" disabled={connections.workingId === connection.user_id} onClick={() => respondToConnection(connection, 'decline')}><X size={15}/> Decline</button></div>
            </div>)}</div>}
            {connections.items.filter(item => item.direction === 'connected').length > 0&&<div className="connection-group"><h3>Your connections</h3>{connections.items.filter(item => item.direction === 'connected').map(connection => <div className="connection-row" key={connection.user_id}>
              <button type="button" className="connection-person" onClick={() => navigate('user-profile', connection.user_id)}><span className="connection-avatar">{connection.avatar_url ? <img src={connection.avatar_url} alt="" referrerPolicy="no-referrer"/> : <UsersRound size={18}/>}</span><b>@{connection.username}</b></button><span className="connection-status">Connected</span>
            </div>)}</div>}
            {connections.items.filter(item => item.direction === 'sent').length > 0&&<div className="connection-group"><h3>Requests sent</h3>{connections.items.filter(item => item.direction === 'sent').map(connection => <div className="connection-row" key={connection.user_id}>
              <button type="button" className="connection-person" onClick={() => navigate('user-profile', connection.user_id)}><span className="connection-avatar">{connection.avatar_url ? <img src={connection.avatar_url} alt="" referrerPolicy="no-referrer"/> : <UsersRound size={18}/>}</span><b>@{connection.username}</b></button><button className="secondary" disabled={connections.workingId === connection.user_id} onClick={() => respondToConnection(connection, 'cancel')}>{connections.workingId === connection.user_id?'Please wait…':'Request sent'}</button>
            </div>)}</div>}
            {!connections.items.length&&<p className="dashboard-empty">Search for people by username to send a connection request.</p>}
            {connections.error&&<p className="form-error" role="alert">{connections.error}</p>}
          </>}
    </section>
    <div className="dashboard-profile-preview"><div><h2>Public profile</h2><p>Preview the profile other people see when they open your reviews.</p></div><button className="secondary" onClick={() => navigate('user-profile', user.id)}><Eye size={17}/> Preview public profile</button></div>
  </main>;
}
