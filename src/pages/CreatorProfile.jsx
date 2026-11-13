import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ExternalLink,
  Star,
  Flag,
  X,
  Check,
  CircleHelp,
  UserPlus,
  UserCheck,
  Sparkles,
} from 'lucide-react';
import { Avatar, Stars, Metric, ReviewAuthor, ReviewVotes } from '../components/shared';
import { supabase } from '../lib/supabase';

export function Profile({ creator, navigate, reviews, reviewsLoading, reviewsError, user, reviewFocusId, onReviewVoteCountsChange, isFollowing, followerCount, onToggleFollow }) {
  const [bug, setBug] = useState(false), [sent, setSent] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [reportSaving, setReportSaving] = useState(false);
  const [reportError, setReportError] = useState('');
  const [reportLoginPrompt, setReportLoginPrompt] = useState(false);
  const reportLinkRef = useRef(null);
  useEffect(() => {
    if (!reportLoginPrompt) return;
    const dismissOutside = event => {
      if (!reportLinkRef.current?.contains(event.target)) setReportLoginPrompt(false);
    };
    document.addEventListener('pointerdown', dismissOutside);
    return () => document.removeEventListener('pointerdown', dismissOutside);
  }, [reportLoginPrompt]);
  const submitReport = async event => {
    event.preventDefault();
    if (!user) { setReportLoginPrompt(true); return; }
    if (!supabase || !creator.databaseId || reportSaving) return;
    setReportSaving(true);
    setReportError('');
    const { error } = await supabase.from('reports').insert({
      user_id: user.id,
      creator_id: creator.databaseId,
      reason: reportReason,
      description: reportDescription.trim() || null
    });
    setReportSaving(false);
    if (error) {
      console.error('Report submission failed:', error);
      setReportError(`Your report could not be submitted: ${error.message}`);
      return;
    }
    setSent(true);
  };
  const creatorReviews = reviews
    .filter(review => review.creatorId === creator.id)
    .sort((a, b) => (b.voteCounts?.up ?? 0) - (a.voteCounts?.up ?? 0) || new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  const hasRatings = creator.reviews > 0;
  const ratingBreakdown = creator.ratingBreakdown || Array(10).fill(0);
  const formatStat = value => value === null || value === undefined ? 'Not available' : Number(value).toLocaleString();
  useEffect(() => {
    if (!reviewFocusId || reviewsLoading) return;
    document.getElementById(`review-${reviewFocusId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [creator.id, reviewFocusId, reviewsLoading]);
  return <main className="page profile-page"><button className="back" onClick={() => navigate('creators')}><ArrowLeft size={17}/> All creators</button>
    <section className="profile-hero"><Avatar creator={creator} size="xl"/><div className="profile-main"><span className="category">{creator.category}</span><h1>{creator.name}</h1><p className="handle">{creator.handle}</p><p className="tagline">“{creator.tagline}”</p><div className="profile-follow-count">{followerCount.toLocaleString()} subscriber{followerCount === 1 ? '' : 's'}</div><div className="profile-actions"><button className="primary" onClick={() => navigate('rate', creator.id)}><Star size={18}/> Rate this creator</button>{creator.databaseId&&<button className={`secondary follow-button ${isFollowing ? 'following' : ''}`} onClick={onToggleFollow}>{isFollowing?<UserCheck size={17}/>:<UserPlus size={17}/>} {isFollowing?'Subscribed':'Subscribe'}</button>}<button className="secondary" onClick={() => window.open(creator.channelUrl || 'https://youtube.com', '_blank')}>YouTube channel <ExternalLink size={16}/></button></div></div><div className={`score-card ${hasRatings ? '' : 'unrated'}`}><span>COMMUNITY SCORE</span>{hasRatings?<><strong>{creator.score.toFixed(1)}</strong><Stars score={creator.score}/><p>Based on {creator.reviews.toLocaleString()} ratings</p></>:<><strong>—</strong><b>Not rated yet</b><p>Be the first to rate this creator</p></>}</div></section>
    <div className="profile-grid"><section><div className="panel"><h2>At a glance</h2><p className="description">{creator.description}</p>{creator.isImported?<div className="facts"><div><span>Subscribers</span><b>{formatStat(creator.subscriberCount)}</b></div><div><span>Videos</span><b>{formatStat(creator.videoCount)}</b></div><div><span>Total views</span><b>{formatStat(creator.viewCount)}</b></div></div>:<div className="facts"><div><span>Content</span><b>{creator.topic}</b></div><div><span>Best for</span><b>{creator.audience}</b></div><div><span>Uses AI</span><b>{creator.ai}</b></div></div>}</div>
      <div className="panel ai-review-summary"><div className="ai-summary-heading"><Sparkles size={19}/><div><h2>AI review summary</h2><span>Generated from community reviews</span></div></div>{creator.aiReviewSummary?<><p>{creator.aiReviewSummary}</p><small>Based on {creator.aiSummaryReviewCount.toLocaleString()} review{creator.aiSummaryReviewCount === 1 ? '' : 's'}. AI summaries may miss context; read the original reviews below.</small></>:<p className="ai-summary-empty">{hasRatings?'A summary is being prepared from the available community reviews.':'A summary will appear after community reviews are submitted.'}</p>}</div>
      <div className="panel"><div className="panel-head"><h2>Community ratings</h2>{hasRatings&&<span>Based on community reviews</span>}</div>{hasRatings?<><Metric label="Overall creator rating" value={creator.score} note="Average community star rating"/><Metric label="Family-friendly" value={5-creator.profanity} note="Based on reported language and themes"/><Metric label="Low substance mention" value={5-creator.substance} note="Based on reported frequency"/></>:<div className="ratings-empty"><Star/><h3>No community ratings yet</h3><p>Be the first to share what viewers should know about this creator.</p><button className="secondary" onClick={() => navigate('rate', creator.id)}>Rate this creator</button></div>}</div>
      <div className="panel recent-reviews"><div className="panel-head"><h2>Top reviews</h2></div>
        {reviewsLoading && <p className="review-status">Loading reviews…</p>}
        {reviewsError && <p className="form-error">{reviewsError}</p>}
        {!reviewsLoading && !reviewsError && creatorReviews.length === 0 && <p className="review-status">No reviews yet. Be the first to rate this creator.</p>}
        {creatorReviews.map(review => <article className={`profile-review ${review.userId ? 'profile-review-clickable' : ''}`} id={`review-${review.id}`} key={review.id} onClick={event => { if (review.userId && !event.target.closest('.review-votes')) navigate('user-profile', review.userId); }}><div className="profile-review-header"><ReviewAuthor review={review} navigate={navigate}/><div><Stars score={review.score} small/><span className="date">{review.date}</span></div></div><p>{review.text}</p><div className="review-details"><span>Age: {review.ageLevel}</span><span>Profanity: {review.profanity}/5</span><span>Substance: {review.substance}/5</span>{review.usesAi && <span>AI: {review.usesAi}</span>}</div>{review.bias && <small>Recurring sponsorships/viewpoints: {review.bias}</small>}<ReviewVotes review={review} user={user} navigate={navigate} onVoteCountsChange={onReviewVoteCountsChange}/></article>)}
      </div>
    </section><aside><div className="panel rating-split"><h3 className="rating-split-title">Rating breakdown {hasRatings&&<span className="score-help"><button type="button" aria-label="Why this score?" aria-describedby="score-explanation"><CircleHelp size={18}/></button><span className="score-tooltip" role="tooltip" id="score-explanation">This breakdown is calculated from ratings submitted by the Rate My Creator community.</span></span>}</h3>{hasRatings?Array.from({ length: 10 }, (_, index) => 5 - index * 0.5).map(score=>{const percent=ratingBreakdown[Math.round(score * 2) - 1]||0;return <div key={score}><span>{score} <Star size={11} fill="currentColor"/></span><i><b style={{width:`${percent}%`}}/></i><small>{percent}%</small></div>}):<div className="breakdown-empty"><p>No rating distribution is available yet.</p></div>}</div>{creator.youtubeChannelId && <section className="panel creator-videos"><h2>Videos</h2><div className="creator-videos-frame"><iframe src={`https://www.youtube-nocookie.com/embed?list=${encodeURIComponent(`UU${creator.youtubeChannelId.slice(2)}`)}`} title={`${creator.name} YouTube uploads`} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen /></div></section>}</aside></div>
    <div className="report-link-wrap" ref={reportLinkRef}><button className="report-link" onClick={() => { if (!user) { setReportLoginPrompt(current => !current); return; } setReportLoginPrompt(false); setBug(true); setSent(false); setReportReason(''); setReportDescription(''); setReportError(''); }}><Flag size={15}/> See something incorrect? Report an issue</button>{reportLoginPrompt&&!bug&&<div className="vote-login-prompt report-link-login-prompt" role="status"><span>Log in to submit a report.</span><button type="button" onClick={() => navigate('login')}>Log in</button></div>}</div>
    {bug && <div className="modal-backdrop" onMouseDown={() => setBug(false)}><div className="modal report-modal" onMouseDown={e => e.stopPropagation()}><button className="modal-close" onClick={() => setBug(false)}><X/></button>{sent ? <div className="success"><Check/><h2>Thanks for the heads-up!</h2><p>We’ll review your report soon.</p><button className="primary" onClick={() => setBug(false)}>Done</button></div> : <form className="report-form" onSubmit={submitReport}><span className="kicker">REPORT AN ISSUE</span><h2>What doesn’t look right?</h2><p>Tell us what’s inaccurate on {creator.name}’s profile.</p><label className="report-reason-field"><span>Reason</span><select required value={reportReason} onChange={event => setReportReason(event.target.value)}><option value="">Select a reason</option><option>Incorrect Information</option><option>Misleading</option><option>Spam or promotion</option><option>Harassment or harmful content</option><option>Other</option></select></label><label className="report-description-field"><span>Description <small>{reportDescription.length}/1000</small></span><textarea maxLength={1000} value={reportDescription} onChange={event => setReportDescription(event.target.value)} placeholder="Describe the issue or correction…" rows="5"/></label>{reportError&&<p className="form-error" role="alert">{reportError}</p>}<button className="primary full" type="submit" disabled={reportSaving || !reportReason}>{reportSaving?'Submitting…':'Submit report'}</button></form>}</div></div>}
  </main>;
}
