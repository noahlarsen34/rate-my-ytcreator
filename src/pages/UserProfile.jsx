import { useEffect, useState } from 'react';
import { ArrowLeft, ChevronRight, MessageSquareText, Pencil, UserRound, UsersRound } from 'lucide-react';
import { Stars } from '../components/shared';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

export function UserProfile({ userId, navigate, returnTo, isOwnProfile = false, user }) {
  const [state, setState] = useState({ loading: true, profile: null, error: '' });
  const [connection, setConnection] = useState({ loading: false, status: 'unavailable', working: false, error: '', subscriptionsLoading: false, subscriptions: [] });

  useEffect(() => {
    let active = true;
    async function loadProfile() {
      if (!isSupabaseConfigured) {
        setState({ loading: false, profile: null, error: 'Public profiles need a configured Supabase connection.' });
        return;
      }
      const { data, error } = await supabase.rpc('get_public_user_profile', { p_user_id: userId });
      if (!active) return;
      setState({ loading: false, profile: data || null, error: error?.message || '' });
    }
    setState({ loading: true, profile: null, error: '' });
    loadProfile();
    return () => { active = false; };
  }, [userId]);

  useEffect(() => {
    let active = true;
    if (!user?.id || !userId || isOwnProfile || !isSupabaseConfigured) {
      setConnection({ loading: false, status: 'unavailable', working: false, error: '', subscriptionsLoading: false, subscriptions: [] });
      return () => { active = false; };
    }
    setConnection({ loading: true, status: 'unavailable', working: false, error: '', subscriptionsLoading: false, subscriptions: [] });
    supabase.rpc('get_user_connection_status', { p_user_id: userId }).then(({ data, error }) => {
      if (active) setConnection(current => ({ ...current, loading: false, status: error ? 'unavailable' : data || 'unavailable', error: error ? 'Connection requests are temporarily unavailable.' : '' }));
    });
    return () => { active = false; };
  }, [user?.id, userId, isOwnProfile]);

  useEffect(() => {
    let active = true;
    if (!user?.id || connection.status !== 'connected') {
      setConnection(current => ({ ...current, subscriptionsLoading: false, subscriptions: [] }));
      return () => { active = false; };
    }
    setConnection(current => ({ ...current, subscriptionsLoading: true }));
    supabase.rpc('get_connected_user_subscriptions', { p_user_id: userId }).then(({ data, error }) => {
      if (active) setConnection(current => ({ ...current, subscriptionsLoading: false, subscriptions: error ? [] : data || [], error: error ? 'This member’s creator subscriptions could not be loaded.' : current.error }));
    });
    return () => { active = false; };
  }, [connection.status, user?.id, userId]);

  const updateConnection = async action => {
    if (connection.working) return;
    if (!user) { navigate('login'); return; }
    setConnection(current => ({ ...current, working: true, error: '' }));
    let result;
    if (action === 'accept' || action === 'decline') {
      result = await supabase.rpc('respond_user_connection_request', { p_requester_id: userId, p_accept: action === 'accept' });
    } else if (action === 'cancel') {
      result = await supabase.rpc('cancel_user_connection_request', { p_recipient_id: userId });
    } else if (action === 'disconnect') {
      result = await supabase.rpc('disconnect_user_connection', { p_user_id: userId });
    } else {
      result = await supabase.rpc('send_user_connection_request', { p_recipient_id: userId });
    }
    if (result.error) setConnection(current => ({ ...current, working: false, error: 'Your connection request could not be updated. Please try again.' }));
    else setConnection(current => ({ ...current, status: action === 'accept' ? 'connected' : action === 'decline' || action === 'cancel' || action === 'disconnect' ? 'available' : result.data || 'request_sent', subscriptions: action === 'disconnect' ? [] : current.subscriptions, working: false }));
  };

  const profile = state.profile;
  const username = profile?.username || 'Rate My Creator member';
  const goBack = () => returnTo?.page
    ? navigate(returnTo.page, returnTo.id || null, returnTo.reviewId || null)
    : navigate('dashboard');
  return <main className="page user-profile-page">
    <button className="back" onClick={goBack}><ArrowLeft size={17}/> Back</button>
    {state.loading ? <div className="panel user-profile-state" role="status">Loading profile…</div>
      : state.error ? <div className="panel user-profile-state" role="alert"><h1>Profile unavailable</h1><p>{state.error}</p></div>
      : !profile ? <div className="panel user-profile-state"><h1>Profile not found</h1><p>This account could not be found.</p></div>
      : <>
        <section className="panel public-profile-heading">
          <div className="public-profile-avatar">{profile.avatar_url ? <img src={profile.avatar_url} alt="" referrerPolicy="no-referrer"/> : <UserRound size={34}/>}</div>
          <div><span className="kicker">COMMUNITY MEMBER</span><h1>{username.startsWith('@') ? username : `@${username}`}</h1></div>
          {isOwnProfile&&<button className="secondary" onClick={() => navigate('settings')}><Pencil size={16}/> Edit visibility settings</button>}
          {!isOwnProfile&&user&&connection.status !== 'unavailable'&&!connection.loading&&<div className="profile-connection-actions">
            {connection.status === 'connected'&&<><span className="connection-status">Connected</span><button className="text-button" disabled={connection.working} onClick={() => updateConnection('disconnect')}>Disconnect</button></>}
            {connection.status === 'request_sent'&&<button className="secondary" disabled={connection.working} onClick={() => updateConnection('cancel')}>{connection.working?'Please wait…':'Request sent'}</button>}
            {connection.status === 'available'&&<button className="primary small" disabled={connection.working} onClick={() => updateConnection('send')}>{connection.working?'Please wait…':'Connect'}</button>}
            {connection.status === 'request_received'&&<><button className="primary small" disabled={connection.working} onClick={() => updateConnection('accept')}>{connection.working?'Please wait…':'Accept request'}</button><button className="text-button" disabled={connection.working} onClick={() => updateConnection('decline')}>Decline</button></>}
          </div>}
        </section>
        {connection.error&&<p className="form-error" role="alert">{connection.error}</p>}
        <section className="panel public-profile-section">
          <div className="panel-head"><h2><MessageSquareText size={19}/> Reviews</h2>{profile.reviews_public&&<span>{profile.reviews?.length || 0}</span>}</div>
          {!profile.reviews_public ? <p className="public-profile-private">This member keeps their reviews private.</p>
            : profile.reviews?.length ? profile.reviews.map(review => <article className="public-user-review" key={review.review_id}>
              <button className="public-review-creator" onClick={() => navigate('profile', `db-${review.creator_id}`)}><strong>{review.creator_name}</strong><ChevronRight size={17}/></button>
              <div className="public-user-review-meta"><Stars score={Number(review.overall_rating)} small/><time>{new Date(review.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</time></div>
              <p>{review.review_text}</p>
            </article>) : <p className="public-profile-private">No reviews to show yet.</p>}
        </section>
        <section className="panel public-profile-section">
          <div className="panel-head"><h2><UsersRound size={19}/> Subscriptions</h2>{(profile.following_public || connection.status === 'connected')&&<span>{(profile.following_public ? profile.following : connection.subscriptions)?.length || 0}</span>}</div>
          {!(profile.following_public || connection.status === 'connected') ? <p className="public-profile-private">This member keeps their creator subscriptions private.</p>
            : connection.subscriptionsLoading&&!profile.following_public ? <p className="public-profile-private" role="status">Loading creator subscriptions…</p>
              : (profile.following_public ? profile.following : connection.subscriptions)?.length ? <div className="public-following-list">{(profile.following_public ? profile.following : connection.subscriptions).map(creator => <button key={creator.creator_id} onClick={() => navigate('profile', `db-${creator.creator_id}`)}><span>{creator.creator_name}</span><ChevronRight size={17}/></button>)}</div>
                : <p className="public-profile-private">No creator subscriptions yet.</p>}
        </section>
      </>}
  </main>;
}
