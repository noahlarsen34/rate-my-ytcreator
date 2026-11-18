import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ExternalLink,
  Star,
  Flag,
  X,
  Check,
  UserPlus,
  UserCheck,
  Sparkles,
  UsersRound,
} from 'lucide-react';
import { Avatar, Stars, ReviewAuthor, ReviewVotes } from '../components/shared';
import { supabase } from '../lib/supabase';

export function Profile({ creator, navigate, reviews, reviewsLoading, reviewsError, user, reviewFocusId, onReviewVoteCountsChange, isFollowing, followerCount, onToggleFollow }) {
  const [bug, setBug] = useState(false), [sent, setSent] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [reportSaving, setReportSaving] = useState(false);
  const [reportError, setReportError] = useState('');
  const [reportLoginPrompt, setReportLoginPrompt] = useState(false);
  const [reportLoginPromptReview, setReportLoginPromptReview] = useState(null);
  const [reportReview, setReportReview] = useState(null);
  const [openCreatorReport, setOpenCreatorReport] = useState(false);
  const [openReviewReports, setOpenReviewReports] = useState(() => new Set());
  const [reportStatusLoading, setReportStatusLoading] = useState(false);
  const [reportStatusError, setReportStatusError] = useState(false);
  const [reportStatusLoadedFor, setReportStatusLoadedFor] = useState(null);
  const [reportStatusAttempt, setReportStatusAttempt] = useState(0);
  const reportStatusKey = user?.id && creator.databaseId ? `${user.id}:${creator.databaseId}` : null;
  const [bioExpanded, setBioExpanded] = useState(false);
  const creatorBio = creator.description || creator.tagline || '';
  const canExpandBio = creatorBio.length > 220;
  const reportLinkRef = useRef(null);
  useEffect(() => {
    if (!reportLoginPrompt && !reportLoginPromptReview) return;
    const dismissOutside = event => {
      if (event.target.closest('.review-report-control')) return;
      if (!reportLinkRef.current?.contains(event.target)) {
        setReportLoginPrompt(false);
        setReportLoginPromptReview(null);
      }
    };
    document.addEventListener('pointerdown', dismissOutside);
    return () => document.removeEventListener('pointerdown', dismissOutside);
  }, [reportLoginPrompt, reportLoginPromptReview]);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    let timeoutId;
    setOpenCreatorReport(false);
    setOpenReviewReports(new Set());
    setReportStatusError(false);
    setReportStatusLoadedFor(null);
    if (!user?.id || !creator.databaseId) {
      setReportStatusLoading(false);
      return () => { active = false; };
    }
    if (!supabase) {
      setReportStatusError(true);
      setReportStatusLoadedFor(`${user.id}:${creator.databaseId}`);
      setReportStatusLoading(false);
      return () => { active = false; };
    }
    setReportStatusLoading(true);
    timeoutId = window.setTimeout(() => controller.abort(), 10000);
    const loadReportStatus = async () => {
      try {
        const { data, error } = await supabase.rpc('get_my_open_report_status', { p_creator_id: creator.databaseId }).abortSignal(controller.signal);
        if (!active) return;
        if (error) throw error;
        const status = Array.isArray(data) ? data[0] : data;
        if (!status) throw new Error('The open report status function returned no row.');
        const reportedReviewIds = Array.isArray(status.review_ids)
          ? status.review_ids
          : typeof status.review_ids === 'string'
            ? status.review_ids.replace(/^\{|\}$/g, '').split(',').filter(Boolean)
            : [];
        setOpenCreatorReport(status.creator_reported === true || status.creator_reported === 'true');
        setOpenReviewReports(new Set(reportedReviewIds.map(String)));
        setReportStatusLoadedFor(`${user.id}:${creator.databaseId}`);
      } catch (error) {
        if (!active) return;
        console.error('Open report status could not be loaded:', error);
        setReportStatusError(true);
        setReportStatusLoadedFor(`${user.id}:${creator.databaseId}`);
      } finally {
        window.clearTimeout(timeoutId);
        if (active) setReportStatusLoading(false);
      }
    };
    loadReportStatus();
    return () => { active = false; window.clearTimeout(timeoutId); controller.abort(); };
  }, [user?.id, creator.databaseId, reportStatusAttempt]);
  const submitReport = async event => {
    event.preventDefault();
    if (!user) { setReportLoginPrompt(true); return; }
    if (!supabase || (!reportReview && !creator.databaseId) || reportSaving) return;
    setReportSaving(true);
    setReportError('');
    const reportTarget = reportReview
      ? { review_id: reportReview.id, creator_id: null }
      : { creator_id: creator.databaseId };
    const { error } = await supabase.from('reports').insert({
      user_id: user.id,
      ...reportTarget,
      reason: reportReason,
      description: reportDescription.trim() || null
    });
    setReportSaving(false);
    if (error) {
      console.error('Report submission failed:', error);
      setReportError(error.code === '23505'
        ? 'You already have an open report for this item.'
        : `Your report could not be submitted: ${error.message}`);
      return;
    }
    if (reportReview) setOpenReviewReports(current => new Set(current).add(String(reportReview.id)));
    else setOpenCreatorReport(true);
    setSent(true);
  };
  const creatorReviews = reviews
    .filter(review => review.creatorId === creator.id)
    .sort((a, b) => (b.voteCounts?.up ?? 0) - (a.voteCounts?.up ?? 0) || new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  const syntheticReviewCount = creatorReviews.filter(review => review.reviewSource === 'synthetic_demo').length;
  const hasRatings = creator.reviews > 0;
  const scoreCard = <div className={`score-card ${hasRatings ? '' : 'unrated'}`}><span>Overall Rating</span>{hasRatings?<><div className="score-card-rating"><strong>{creator.score.toFixed(1)}</strong><Star size={30} fill="currentColor" aria-hidden="true"/></div><p>Based on {creator.reviews.toLocaleString()} ratings{creator.syntheticReviews ? `, including ${creator.syntheticReviews} demo` : ''}</p></>:<><strong>—</strong><b>Not rated yet</b><p>Be the first to rate this creator</p></>}</div>;
  const formatStat = value => value === null || value === undefined ? 'Not available' : Number(value).toLocaleString();
  const frequencyLabel = value => ['None', 'Rarely', 'Sometimes', 'Often', 'Frequently'][Math.max(0, Math.min(4, Math.round(Number(value) || 1) - 1))];
  const openReportForReview = review => {
    if (!user) {
      setReportLoginPrompt(false);
      setReportLoginPromptReview(current => String(current) === String(review.id) ? null : review.id);
      return;
    }
    setReportLoginPromptReview(null);
    setReportReview(review);
    setReportLoginPrompt(false);
    setBug(true);
    setSent(false);
    setReportReason('');
    setReportDescription('');
    setReportError('');
  };
  useEffect(() => {
    if (!reviewFocusId || reviewsLoading) return;
    document.getElementById(`review-${reviewFocusId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [creator.id, reviewFocusId, reviewsLoading]);
  return <main className="page profile-page"><button className="back" onClick={() => navigate('creators')}><ArrowLeft size={17}/> All creators</button>
    <section className="profile-hero"><Avatar creator={creator} size="xl"/><div className="profile-main"><span className="category">{creator.category}</span><h1>{creator.name}</h1><p className="handle">{creator.handle}</p><p className={`tagline profile-bio${canExpandBio && !bioExpanded ? ' profile-bio-collapsed' : ''}`}>{creatorBio}</p>{canExpandBio && <button type="button" className="profile-bio-toggle" aria-expanded={bioExpanded} onClick={() => setBioExpanded(expanded => !expanded)}>{bioExpanded ? 'View less' : 'View more'}</button>}<div className="profile-follow-count">{followerCount.toLocaleString()} subscriber{followerCount === 1 ? '' : 's'}</div><div className="profile-actions"><button className="primary" onClick={() => navigate('rate', creator.id)}><Star size={18}/> Rate this creator</button>{creator.databaseId&&<button className={`secondary follow-button ${isFollowing ? 'following' : ''}`} onClick={onToggleFollow}>{isFollowing?<UserCheck size={17}/>:<UserPlus size={17}/>} {isFollowing?'Subscribed':'Subscribe'}</button>}<button className="secondary" onClick={() => window.open(creator.channelUrl || 'https://youtube.com', '_blank')}>YouTube channel <ExternalLink size={16}/></button></div></div>{scoreCard}</section>
    <div className={`profile-top-grid ${creator.youtubeChannelId ? "" : "without-videos"}`}><div className="profile-left-stack">      <div className="panel family-overview-panel"><div className="panel-head"><h2>Family-friendliness overview</h2>{hasRatings&&<span>{creator.syntheticReviews ? 'Includes demo ratings' : 'Community guidance'}</span>}</div>{hasRatings?<><p className="family-overview-intro">A quick guide to content themes reported by reviewers. Individual videos may vary.</p><div className="family-overview-grid"><div className="age-guidance-card"><span>Suggested age level</span><strong>{creator.audience || 'Not enough data'}</strong><small>Most common recommendation in reviews</small></div><div className="family-content-metric"><div className="family-content-metric-head"><span>Profanity use</span><b>{creator.profanity === null ? 'Not rated' : frequencyLabel(creator.profanity)}</b></div>{creator.profanity === null ? <p>No profanity frequency was reported yet.</p> : <small>Average frequency reported across reviews</small>}</div><div className="family-content-metric"><div className="family-content-metric-head"><span>Alcohol, drugs, or vaping</span><b>{creator.substance === null ? 'Not rated' : frequencyLabel(creator.substance)}</b></div>{creator.substance === null ? <p>No substance frequency was reported yet.</p> : <small>Average frequency reported across reviews</small>}</div></div></>:<div className="ratings-empty"><UsersRound/><h3>No family guidance yet</h3><p>Be the first to share an age recommendation and content details for this creator.</p><button className="secondary" onClick={() => navigate('rate', creator.id)}>Add a review</button></div>}</div>    <div className="profile-full-width">
      <div className="panel ai-review-summary"><div className="ai-summary-heading"><Sparkles size={19}/><div><h2>AI review summary</h2><span>Generated from submitted reviews</span></div></div>{creator.aiReviewSummary?<><p>{creator.aiReviewSummary}</p><small>Based on {creator.aiSummaryReviewCount.toLocaleString()} review{creator.aiSummaryReviewCount === 1 ? '' : 's'}{syntheticReviewCount ? `, including ${syntheticReviewCount} synthetic demo review${syntheticReviewCount === 1 ? '' : 's'}` : ''}. AI summaries may miss context; read the original reviews below.</small></>:<p className="ai-summary-empty">{hasRatings?'A summary is being prepared from the available reviews.':'A summary will appear after reviews are submitted.'}</p>}</div>
      <div className="panel recent-reviews"><div className="panel-head"><h2>Top reviews</h2></div>
        {reviewsLoading && <p className="review-status">Loading reviews…</p>}
        {reviewsError && <p className="form-error">{reviewsError}</p>}
        {!reviewsLoading && !reviewsError && creatorReviews.length === 0 && <p className="review-status">No reviews yet. Be the first to rate this creator.</p>}
        {creatorReviews.map(review => {
          const username = review.reviewSource === 'synthetic_demo' ? review.seedAuthorName || 'demo reviewer' : review.authorUsername ? (review.authorUsername.startsWith('@') ? review.authorUsername : `@${review.authorUsername}`) : 'this user';
          const hasOpenReport = openReviewReports.has(String(review.id));
          const reportStatusPending = Boolean(reportStatusKey && (reportStatusLoading || reportStatusLoadedFor !== reportStatusKey));
          return <article className={`profile-review ${review.userId ? 'profile-review-clickable' : ''}`} id={`review-${review.id}`} key={review.id} onClick={event => { if (review.userId && !event.target.closest('.review-votes, .review-report-control')) navigate(review.userId === user?.id ? 'dashboard' : 'user-profile', ...(review.userId === user?.id ? [] : [review.userId])); }}><div className="profile-review-header"><div className="review-author-group"><ReviewAuthor review={review} navigate={navigate} currentUserId={user?.id}/>{review.reviewSource === 'synthetic_demo'&&<span className="synthetic-review-badge">Synthetic demo review</span>}</div><div className="profile-review-meta"><Stars score={review.score} small/><div className="review-report-control"><button type="button" className={`review-report-button${hasOpenReport ? ' reported' : ''}`} aria-label={hasOpenReport ? 'You have an open report for this review' : reportStatusError ? 'Retry checking report status' : `Report ${username}'s review`} title={hasOpenReport ? 'Open report submitted' : reportStatusPending ? 'Checking report status…' : reportStatusError ? 'Retry status check' : 'Report this review'} disabled={hasOpenReport || reportStatusPending} onClick={event => { event.stopPropagation(); if (reportStatusError) { setReportStatusAttempt(attempt => attempt + 1); return; } openReportForReview(review); }}><Flag size={17} fill={hasOpenReport ? 'currentColor' : 'none'}/></button>{String(reportLoginPromptReview) === String(review.id) && <div className="vote-login-prompt review-report-login-prompt" role="status"><span>Log in to submit a report.</span><button type="button" onClick={() => navigate('login')}>Log in</button></div>}</div></div></div><p>{review.text}</p><div className="review-details"><span>Age: {review.ageLevel || 'Not evaluated'}</span><span>Profanity: {review.profanity === null ? 'Not evaluated' : `${review.profanity}/5`}</span><span>Substance: {review.substance === null ? 'Not evaluated' : `${review.substance}/5`}</span>{review.usesAi && <span>AI: {review.usesAi}</span>}</div>{review.bias && <small>Recurring sponsorships/viewpoints: {review.bias}</small>}<div className="profile-review-footer"><time className="profile-review-date">{review.date}</time><ReviewVotes review={review} user={user} navigate={navigate} onVoteCountsChange={onReviewVoteCountsChange}/></div></article>;
        })}
      </div>
    </div>
</div><div className="profile-right-stack"><section className="panel glance-panel"><h2>At a glance</h2>{creator.isImported?<div className="facts"><div><span>Subscribers</span><b>{formatStat(creator.subscriberCount)}</b></div><div><span>Videos</span><b>{formatStat(creator.videoCount)}</b></div><div><span>Total views</span><b>{formatStat(creator.viewCount)}</b></div></div>:<div className="facts"><div><span>Content</span><b>{creator.topic}</b></div><div><span>Best for</span><b>{creator.audience}</b></div><div><span>Uses AI</span><b>{creator.ai}</b></div></div>}</section>{creator.youtubeChannelId && <section className="panel creator-videos"><h2>Videos</h2><div className="creator-videos-frame"><iframe src={`https://www.youtube-nocookie.com/embed?list=${encodeURIComponent(`UU${creator.youtubeChannelId.slice(2)}`)}`} title={`${creator.name} YouTube uploads`} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen /></div></section>}</div></div>
    {openCreatorReport ? <p className="report-link report-link-submitted" role="status">Report submitted, thank you for the information</p> : <div className="report-link-wrap" ref={reportLinkRef}><button className="report-link" disabled={Boolean(reportStatusKey && (reportStatusLoading || reportStatusLoadedFor !== reportStatusKey))} title={reportStatusError ? 'Click to retry the report status check' : undefined} onClick={() => { if (!user) { setReportLoginPromptReview(null); setReportLoginPrompt(current => !current); return; } if (reportStatusError) { setReportStatusAttempt(attempt => attempt + 1); return; } if (reportStatusLoading || reportStatusLoadedFor !== reportStatusKey) return; setReportLoginPrompt(false); setReportReview(null); setBug(true); setSent(false); setReportReason(''); setReportDescription(''); setReportError(''); }}><Flag size={15}/>{reportStatusLoading || Boolean(reportStatusKey && reportStatusLoadedFor !== reportStatusKey) ? 'Checking report status…' : reportStatusError ? 'Report status unavailable — retry' : 'See something incorrect? Report an issue'}</button>{reportLoginPrompt&&!bug&&<div className="vote-login-prompt report-link-login-prompt" role="status"><span>Log in to submit a report.</span><button type="button" onClick={() => navigate('login')}>Log in</button></div>}</div>}
    {bug && <div className="modal-backdrop" onMouseDown={() => setBug(false)}><div className="modal report-modal" onMouseDown={e => e.stopPropagation()}><button className="modal-close" onClick={() => setBug(false)}><X/></button>{sent ? <div className="success"><Check/><h2>Thanks for the heads-up!</h2><p>We’ll review your report soon.</p><button className="primary" onClick={() => setBug(false)}>Done</button></div> : <form className="report-form" onSubmit={submitReport}><span className="kicker">REPORT AN ISSUE</span><h2>What doesn’t look right?</h2><p>{reportReview ? `Tell us what’s inaccurate in ${reportReview.authorUsername ? `${reportReview.authorUsername.startsWith('@') ? reportReview.authorUsername : `@${reportReview.authorUsername}`}'s` : 'this user’s'} review.` : `Tell us what’s inaccurate on ${creator.name}’s profile.`}</p><label className="report-reason-field"><span>Reason</span><select required value={reportReason} onChange={event => setReportReason(event.target.value)}><option value="">Select a reason</option><option>Incorrect Information</option><option>Misleading</option><option>Spam or promotion</option><option>Harassment or harmful content</option><option>Other</option></select></label><label className="report-description-field"><span>Description <small>{reportDescription.length}/1000</small></span><textarea maxLength={1000} value={reportDescription} onChange={event => setReportDescription(event.target.value)} placeholder="Describe the issue or correction…" rows="5"/></label>{reportError&&<p className="form-error" role="alert">{reportError}</p>}<button className="primary full" type="submit" disabled={reportSaving || !reportReason}>{reportSaving?'Submitting…':'Submit report'}</button></form>}</div></div>}
  </main>;
}
