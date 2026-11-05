import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Play } from 'lucide-react';
import './styles.css';
import './reviews.css';
import './auth.css';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import { creators, protectedPages } from './data/creators';
import { creatorIdFromChannelLink, formatReview, generatedUsernameFor } from './utils';
import { Header } from './components/shared';
import { Home } from './pages/Home';
import { DiscoverCreators } from './pages/DiscoverCreators';
import { Profile as CreatorProfile } from './pages/CreatorProfile';
import { AccountSignIn } from './pages/AccountSignIn';
import { Dashboard } from './pages/Dashboard';
import { AccountSettings } from './pages/AccountSettings';
import { RateCreator } from './pages/RateCreator';

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
  const creator=creators.find(c=>c.id===selected)||creators[0];
  const shell=!['signup','login'].includes(page);
  if (!authReady) return <main className="auth-loading" aria-live="polite"><span className="brand-mark"><Play fill="white"/></span><p>Restoring your session…</p></main>;
  return <>{shell&&<Header navigate={navigate} query={query} setQuery={setQuery} user={session?.user} profileUsername={profileUsername}/>} {page==='home'&&<Home navigate={navigate} query={query} setQuery={setQuery}/>} {page==='creators'&&<DiscoverCreators navigate={navigate} query={query} setQuery={setQuery}/>} {page==='profile'&&<CreatorProfile creator={creator} navigate={navigate} reviews={reviews} reviewsLoading={reviewsLoading} reviewsError={reviewsError} user={session?.user}/>} {(page==='signup'||page==='login')&&<AccountSignIn type={page} navigate={navigate} requiresAuth={requiresAuth}/>} {page==='dashboard'&&session?.user&&<Dashboard navigate={navigate} reviews={reviews} user={session.user}/>} {page==='settings'&&session?.user&&<AccountSettings navigate={navigate} user={session.user} onUsernameChanged={handleUsernameChanged}/>} {page==='rate'&&session?.user&&<RateCreator navigate={navigate} selectedId={selected} submitReview={submitReview}/>} {shell&&<footer><button className="brand" onClick={()=>navigate('home')}><span className="brand-mark"><Play fill="white"/></span>Rate My <b>Creator</b></button><p>Better choices start with honest opinions.</p><span>© 2026 Rate My Creator · Class project</span></footer>}</>;
}

createRoot(document.getElementById('root')).render(<App/>);
