import { useEffect, useState } from 'react';
import { ArrowLeft, ChevronRight, MessageSquareText, Pencil, UserRound, UsersRound } from 'lucide-react';
import { Stars } from '../components/shared';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

export function UserProfile({ userId, navigate, returnTo, isOwnProfile = false }) {
  const [state, setState] = useState({ loading: true, profile: null, error: '' });

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
          {isOwnProfile&&<button className="secondary" onClick={() => navigate('settings')}><Pencil size={16}/> Edit public profile</button>}
        </section>
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
          <div className="panel-head"><h2><UsersRound size={19}/> Following</h2>{profile.following_public&&<span>{profile.following?.length || 0}</span>}</div>
          {!profile.following_public ? <p className="public-profile-private">This member keeps their followed creators private.</p>
            : profile.following?.length ? <div className="public-following-list">{profile.following.map(creator => <button key={creator.creator_id} onClick={() => navigate('profile', `db-${creator.creator_id}`)}><span>{creator.creator_name}</span><ChevronRight size={17}/></button>)}</div>
              : <p className="public-profile-private">Not following any creators yet.</p>}
        </section>
      </>}
  </main>;
}
