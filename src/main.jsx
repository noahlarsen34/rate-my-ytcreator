import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Play } from 'lucide-react';
import './styles.css';
import './reviews.css';
import './auth.css';
import './follows.css';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import { creators as demoCreators, protectedPages } from './data/creators';
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

const initialsFor = name => name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'YT';
const cleanYouTubeDescription = value => {
  const cleaned = String(value || '')
    .replace(/\b(?:contact(?: me)?|business inquiries?|inquiries?|email|discord|twitter|instagram|tiktok)\s*[:\-]?.*$/gim, '')
    .replace(/\bhttps?:\/\/\S+/gi, '')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '')
    .replace(/[|•]+\s*$/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return 'This creator was imported from YouTube. Community details will appear as people contribute.';
  return cleaned.length > 360 ? `${cleaned.slice(0, 357).trimEnd()}…` : cleaned;
};
const lastViewedCreatorDestination = () => {
  try {
    const id = window.localStorage.getItem('lastViewedCreatorId');
    return id ? { page: 'profile', id } : null;
  } catch {
    return null;
  }
};
const creatorFromDatabase = (row, typeNames) => {
  const localId = creatorIdFromChannelLink(row.channel_link);
  const demo = demoCreators.find(item => item.id === localId);
  if (demo) return { ...demo, databaseId: row.creator_id, channelUrl: row.channel_link };
  const name = [row.first_name, row.last_name].filter(Boolean).join(' ').trim() || 'YouTube creator';
  return {
    id: `db-${row.creator_id}`,
    databaseId: row.creator_id,
    name,
    handle: row.youtube_handle || row.channel_link?.match(/@([^/?#]+)/)?.[0] || '@youtube',
    initials: initialsFor(name),
    color: '#d9383e',
    thumbnailUrl: row.thumbnail_url || row.profile_pic_url || row.avatar_url || null,
    channelUrl: row.channel_link,
    isImported: Boolean(row.youtube_channel_id) && !demo,
    subscriberCount: row.subscriber_count === null ? null : Number(row.subscriber_count),
    videoCount: row.video_count === null ? null : Number(row.video_count),
    viewCount: row.view_count === null ? null : Number(row.view_count),
    score: 0,
    reviews: 0,
    category: typeNames.get(String(row.type_id)) || 'YouTube',
    audience: 'Community rating pending',
    topic: typeNames.get(String(row.type_id)) || 'YouTube creator',
    tagline: 'New to Rate My Creator',
    description: cleanYouTubeDescription(row.creator_description || row.description),
    truth: 0,
    profanity: 1,
    substance: 1,
    ai: 'Not enough data',
    ratingBreakdown: [0, 0, 0, 0, 0]
  };
};

function App() {
  const [page,setPage]=useState(() => window.history.state?.rmcPage || pageFromPathname()), [selected,setSelected]=useState(() => window.history.state?.selected || null), [selectedReviewId,setSelectedReviewId]=useState(() => window.history.state?.reviewId || null), [query,setQuery]=useState(''), [session,setSession]=useState(null), [authReady,setAuthReady]=useState(!isSupabaseConfigured), [profile,setProfile]=useState(null), [profileReady,setProfileReady]=useState(!isSupabaseConfigured), [profileError,setProfileError]=useState(''), [requiresAuth,setRequiresAuth]=useState(false), [reviews,setReviews]=useState([]), [databaseCreatorIds,setDatabaseCreatorIds]=useState({}), [reviewsLoading,setReviewsLoading]=useState(true), [reviewsError,setReviewsError]=useState(''), [appCreators,setAppCreators]=useState(demoCreators), [creatorRefresh,setCreatorRefresh]=useState(0), [followingIds,setFollowingIds]=useState(new Set()), [followerCounts,setFollowerCounts]=useState({});
  const pendingDestination = useRef(null);
  const signInNavigationHandled = useRef(false);
  const usernameUpdatesInFlight = useRef(new Set());
  const profileRequest = useRef(0);
  const authUserId = useRef(null);

  useEffect(() => {
    if (!window.history.state?.rmcPage) {
      window.history.replaceState({ rmcPage: pageFromPathname(), selected: null, reviewId: null }, document.title, window.location.href);
    }
    const handlePopState = event => {
      const state = event.state;
      setPage(state?.rmcPage || pageFromPathname());
      setSelected(state?.selected || null);
      setSelectedReviewId(state?.reviewId || null);
      window.scrollTo(0, 0);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (page !== 'profile' || !selected) return;
    try { window.localStorage.setItem('lastViewedCreatorId', selected); } catch { /* Storage may be unavailable in private browsing. */ }
  }, [page, selected]);

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
      const authCallback = params.get('auth');
      const isYouTubeCallback = authCallback === 'youtube';
      let destination = isYouTubeCallback ? { page: 'settings', id: null } : pendingDestination.current;
      try {
        destination ||= JSON.parse(window.sessionStorage.getItem('authReturnTo'));
      } catch {
        destination = null;
      }
      destination ||= lastViewedCreatorDestination();
      destination ||= { page: 'dashboard', id: null };
      signInNavigationHandled.current = true;
      setSelected(destination.id || null);
      setPage(destination.page);
      setRequiresAuth(false);
      pendingDestination.current = null;
      window.sessionStorage.removeItem('authReturnTo');
      if (authCallback === 'callback' || authCallback === 'youtube') {
        window.history.replaceState({ rmcPage: destination.page, selected: destination.id || null, reviewId: null }, document.title, window.location.pathname);
      }
    };
    supabase.auth.getSession().then(({ data }) => {
      authUserId.current = data.session?.user?.id || null;
      setProfileReady(!data.session?.user);
      setSession(data.session);
      setAuthReady(true);
      ensureUsername(data.session?.user);
      const authCallback = new URLSearchParams(window.location.search).get('auth');
      if (data.session && (authCallback === 'callback' || authCallback === 'youtube')) finishSignIn(data.session);
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
    if (!authReady || !profileReady || !session?.user || isProfileComplete(profile) || ['complete-profile', 'login', 'signup'].includes(page)) return;
    const destination = { page, id: selected };
    window.sessionStorage.setItem('profileReturnTo', JSON.stringify(destination));
    setPage('complete-profile');
    window.scrollTo(0, 0);
  }, [authReady, page, profile, profileReady, selected, session?.user]);

  const finishProfile = nextProfile => {
    handleProfileChanged(nextProfile);
    let destination = lastViewedCreatorDestination() || { page: 'dashboard', id: null };
    try {
      destination = JSON.parse(window.sessionStorage.getItem('profileReturnTo')) || destination;
    } catch {
      // Use the dashboard fallback when stored navigation is invalid.
    }
    window.sessionStorage.removeItem('profileReturnTo');
    setSelected(destination.id || null);
    setPage(destination.page);
    window.history.replaceState({ rmcPage: destination.page, selected: destination.id || null, reviewId: null }, document.title, '/');
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
      const [creatorsResult, reviewsResult, typesResult] = await Promise.all([
        supabase.from('content_creators').select('*'),
        supabase.from('reviews').select('review_id, user_id, creator_id, overall_rating, profanity, substance_use, age_level, review_text, bias_text, uses_ai, created_at, content_creators(channel_link)').order('created_at', { ascending: false })
        ,supabase.from('channel_types').select('type_id, type_name')
      ]);

      if (creatorsResult.error || reviewsResult.error) {
        setReviewsError(creatorsResult.error?.message || reviewsResult.error?.message || 'Reviews could not be loaded.');
        setReviewsLoading(false);
        return;
      }

      const typeNames = new Map((typesResult.data || []).map(type => [String(type.type_id), type.type_name]));
      const databaseCreators = creatorsResult.data.map(row => creatorFromDatabase(row, typeNames));
      const creatorByDatabaseId = new Map(databaseCreators.map(creator => [String(creator.databaseId), creator]));
      const databaseIds = new Set(databaseCreators.map(creator => creator.databaseId));
      const combinedCreators = [...databaseCreators, ...demoCreators.filter(creator => !databaseIds.has(creator.databaseId) && !databaseCreators.some(item => item.id === creator.id))];
      const idMap = Object.fromEntries(databaseCreators.map(creator => [creator.id, creator.databaseId]));
      const loadedReviews = reviewsResult.data.map(review => {
        const matchedCreator = creatorByDatabaseId.get(String(review.creator_id));
        return matchedCreator ? formatReview(review, matchedCreator.id, matchedCreator.name) : null;
      }).filter(Boolean);

      const ratingTotals = new Map();
      for (const review of loadedReviews) {
        const current = ratingTotals.get(review.creatorId) || { total: 0, profanity: 0, substance: 0, count: 0, ages: {}, ai: {}, scores: [0, 0, 0, 0, 0] };
        current.total += review.score;
        current.profanity += review.profanity;
        current.substance += review.substance;
        current.count += 1;
        current.ages[review.ageLevel] = (current.ages[review.ageLevel] || 0) + 1;
        if (review.usesAi && review.usesAi !== 'Unsure') current.ai[review.usesAi] = (current.ai[review.usesAi] || 0) + 1;
        if (review.score >= 1 && review.score <= 5) current.scores[review.score - 1] += 1;
        ratingTotals.set(review.creatorId, current);
      }
      setAppCreators(combinedCreators.map(creator => {
        const rating = ratingTotals.get(creator.id);
        if (!rating) return creator;
        const mostCommon = values => Object.entries(values).sort((first, second) => second[1] - first[1])[0]?.[0];
        return {
          ...creator,
          score: rating.total / rating.count,
          reviews: rating.count,
          truth: rating.total / rating.count,
          profanity: rating.profanity / rating.count,
          substance: rating.substance / rating.count,
          audience: mostCommon(rating.ages) || 'Not enough data',
          ai: mostCommon(rating.ai) || 'Not enough data',
          ratingBreakdown: rating.scores.map(count => Math.round((count / rating.count) * 100))
        };
      }));

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
  }, [authReady, session?.user?.id, creatorRefresh]);

  useEffect(() => {
    if (!session?.user?.id || !supabase) {
      setFollowingIds(new Set());
      setFollowerCounts({});
      return;
    }
    let active = true;
    supabase.functions.invoke('youtube-sync', { body: { action: 'following' } }).then(({ data, error }) => {
      if (!active) return;
      if (error || data?.error) {
        console.error('Creator follows could not be loaded:', data?.error || error?.message);
        return;
      }
      setFollowingIds(new Set((data.creatorIds || []).map(String)));
      setFollowerCounts(data.counts || {});
    });
    return () => { active = false; };
  }, [session?.user?.id, creatorRefresh]);

  const toggleFollow = async creator => {
    if (!session?.user) { navigate('login'); return; }
    if (!creator.databaseId) return;
    const { data, error } = await supabase.functions.invoke('youtube-sync', { body: { action: 'toggle_follow', creatorId: creator.databaseId } });
    if (error || data?.error) throw new Error(data?.error || error?.message || 'Your follow could not be updated.');
    setFollowingIds(current => {
      const next = new Set(current);
      if (data.following) next.add(String(creator.databaseId)); else next.delete(String(creator.databaseId));
      return next;
    });
    setFollowerCounts(current => ({ ...current, [String(creator.databaseId)]: Number(data.followerCount || 0) }));
  };

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

  const navigate=(next,id=null,reviewId=null)=>{
    let historyPage = next;
    let historyId = id;
    let historyReviewId = reviewId;
    if (['login', 'signup'].includes(next) && page === 'profile' && selected) {
      const destination = { page: 'profile', id: selected };
      pendingDestination.current = destination;
      window.sessionStorage.setItem('authReturnTo', JSON.stringify(destination));
    }
    if (protectedPages.has(next) && !session?.user) {
      const destination = { page: next, id };
      signInNavigationHandled.current = false;
      pendingDestination.current = destination;
      window.sessionStorage.setItem('authReturnTo', JSON.stringify(destination));
      setRequiresAuth(true);
      setPage('login');
      historyPage = 'login';
      historyId = null;
      historyReviewId = null;
    } else if (protectedPages.has(next) && next !== 'complete-profile' && profileReady && !isProfileComplete(profile)) {
      window.sessionStorage.setItem('profileReturnTo', JSON.stringify({ page: next, id }));
      setPage('complete-profile');
      historyPage = 'complete-profile';
      historyId = null;
      historyReviewId = null;
    } else {
      if (!['login','signup'].includes(next)) {
        pendingDestination.current = null;
        window.sessionStorage.removeItem('authReturnTo');
        setRequiresAuth(false);
      }
      setSelected(id);
      setPage(next);
    }
    const nextPath = historyPage === 'privacy' ? '/privacy' : historyPage === 'terms' ? '/terms' : '/';
    setSelectedReviewId(historyReviewId);
    window.history.pushState({ rmcPage: historyPage, selected: historyId, reviewId: historyReviewId }, '', nextPath);
    window.scrollTo(0,0);
  };
  const creator=appCreators.find(c=>c.id===selected)||appCreators[0];
  const handleReviewVoteCountsChange = (reviewId, voteCounts) => {
    setReviews(current => current.map(review => review.id === reviewId ? { ...review, voteCounts } : review));
  };
  const shell=!['signup','login','complete-profile'].includes(page);
  if ((!authReady && protectedPages.has(page)) || (session?.user && !profileReady && protectedPages.has(page))) return <main className="auth-loading" aria-live="polite"><span className="brand-mark"><Play fill="white"/></span><p>Loading your account…</p></main>;
  return <>
    {shell&&<Header navigate={navigate} query={query} setQuery={setQuery} user={session?.user} profileUsername={profile?.username}/>}
    {page==='home'&&<Home navigate={navigate} query={query} setQuery={setQuery}/>}
    {page==='creators'&&<DiscoverCreators navigate={navigate} query={query} setQuery={setQuery} creators={appCreators}/>}
    {page==='profile'&&<CreatorProfile creator={creator} navigate={navigate} reviews={reviews} reviewsLoading={reviewsLoading} reviewsError={reviewsError} user={session?.user} reviewFocusId={selectedReviewId} onReviewVoteCountsChange={handleReviewVoteCountsChange} isFollowing={followingIds.has(String(creator.databaseId))} followerCount={Number(followerCounts[String(creator.databaseId)] || 0)} onToggleFollow={() => toggleFollow(creator)}/>}
    {page==='privacy'&&<LegalPage type="privacy" navigate={navigate}/>}
    {page==='terms'&&<LegalPage type="terms" navigate={navigate}/>}
    {(page==='signup'||page==='login')&&<AccountSignIn type={page} navigate={navigate} requiresAuth={requiresAuth}/>}
    {page==='complete-profile'&&session?.user&&<CompleteProfile user={session.user} profile={profile} initialError={profileError} onComplete={finishProfile} onLogout={logoutFromOnboarding}/>}
    {page==='dashboard'&&session?.user&&<Dashboard navigate={navigate} reviews={reviews} reviewsLoading={reviewsLoading} reviewsError={reviewsError} user={session.user} profile={profile} creators={appCreators} followingIds={followingIds}/>}
    {page==='settings'&&<AccountSettings navigate={navigate} user={session.user} session={session} profile={profile} onProfileChanged={handleProfileChanged} onCreatorsChanged={() => setCreatorRefresh(value => value + 1)}/>}
    {page==='rate'&&session?.user&&<RateCreator navigate={navigate} selectedId={selected} submitReview={submitReview} creators={appCreators}/>}
    {shell&&<footer><button className="brand" onClick={()=>navigate('home')}><span className="brand-mark"><Play fill="white"/></span>Rate My <b>Creator</b></button><p>Better choices start with honest opinions.</p><button className="footer-link" onClick={()=>navigate('privacy')}>Privacy</button><button className="footer-link" onClick={()=>navigate('terms')}>Terms</button><span>© 2026 Rate My Creator · Class project</span></footer>}
  </>;
}

createRoot(document.getElementById('root')).render(<App/>);
