import { useEffect, useState } from 'react';
import { ArrowLeft, ExternalLink, Star, Flag, X, Check, CircleHelp, UserPlus, UserCheck } from 'lucide-react';
import { Avatar, Stars, Metric, ReviewVotes } from '../components/shared';

export function Profile({ creator, navigate, reviews, reviewsLoading, reviewsError, user, reviewFocusId, onReviewVoteCountsChange, isFollowing, followerCount, onToggleFollow }) {
  const [bug, setBug] = useState(false), [sent, setSent] = useState(false);
  const creatorReviews = reviews
    .filter(review => review.creatorId === creator.id)
    .sort((a, b) => (b.voteCounts?.up ?? 0) - (a.voteCounts?.up ?? 0) || new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  useEffect(() => {
    if (!reviewFocusId || reviewsLoading) return;
    document.getElementById(`review-${reviewFocusId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [creator.id, reviewFocusId, reviewsLoading]);
  return <main className="page profile-page"><button className="back" onClick={() => navigate('creators')}><ArrowLeft size={17}/> All creators</button>
    <section className="profile-hero"><Avatar creator={creator} size="xl"/><div className="profile-main"><span className="category">{creator.category}</span><h1>{creator.name}</h1><p className="handle">{creator.handle}</p><p className="tagline">“{creator.tagline}”</p><div className="profile-follow-count">{followerCount.toLocaleString()} follower{followerCount === 1 ? '' : 's'}</div><div className="profile-actions"><button className="primary" onClick={() => navigate('rate', creator.id)}><Star size={18}/> Rate this creator</button>{creator.databaseId&&<button className={`secondary follow-button ${isFollowing ? 'following' : ''}`} onClick={onToggleFollow}>{isFollowing?<UserCheck size={17}/>:<UserPlus size={17}/>} {isFollowing?'Following':'Follow'}</button>}<button className="secondary" onClick={() => window.open(creator.channelUrl || 'https://youtube.com', '_blank')}>YouTube channel <ExternalLink size={16}/></button></div></div><div className="score-card"><span>COMMUNITY SCORE</span><strong>{creator.score.toFixed(1)}</strong><Stars score={creator.score}/><p>Based on {creator.reviews.toLocaleString()} ratings</p></div></section>
    <div className="profile-grid"><section><div className="panel"><h2>At a glance</h2><p className="description">{creator.description}</p><div className="facts"><div><span>Content</span><b>{creator.topic}</b></div><div><span>Best for</span><b>{creator.audience}</b></div><div><span>Uses AI</span><b>{creator.ai}</b></div></div></div>
      <div className="panel"><div className="panel-head"><h2>Community ratings</h2><span>Last 90 days</span></div><Metric label="Truthfulness" value={creator.truth} note="Well-researched and transparent"/><Metric label="Family-friendly" value={6-creator.profanity} note="Based on language and themes"/><Metric label="Low substance mention" value={6-creator.substance} note="Frequency across recent content"/></div>
      <div className="panel recent-reviews"><div className="panel-head"><h2>Top reviews</h2></div>
        {reviewsLoading && <p className="review-status">Loading reviews…</p>}
        {reviewsError && <p className="form-error">{reviewsError}</p>}
        {!reviewsLoading && !reviewsError && creatorReviews.length === 0 && <p className="review-status">No reviews yet. Be the first to rate this creator.</p>}
        {creatorReviews.map(review => <article className="profile-review" id={`review-${review.id}`} key={review.id}><div><Stars score={review.score} small/><span className="date">{review.date}</span></div><p>{review.text}</p><div className="review-details"><span>Age: {review.ageLevel}</span><span>Profanity: {review.profanity}/5</span><span>Substance: {review.substance}/5</span>{review.usesAi && <span>AI: {review.usesAi}</span>}</div>{review.bias && <small>Disclosure: {review.bias}</small>}<ReviewVotes review={review} user={user} navigate={navigate} onVoteCountsChange={onReviewVoteCountsChange}/></article>)}
      </div>
    </section><aside><div className="panel rating-split"><h3 className="rating-split-title">Rating breakdown <span className="score-help"><button type="button" aria-label="Why this score?" aria-describedby="score-explanation"><CircleHelp size={18}/></button><span className="score-tooltip" role="tooltip" id="score-explanation">Viewers consistently praise this creator’s clear presentation and honest approach. Ratings suggest reliable, age-appropriate content with strong educational value.</span></span></h3>{[[5,68],[4,22],[3,7],[2,2],[1,1]].map(([s,p])=><div key={s}><span>{s} <Star size={11} fill="currentColor"/></span><i><b style={{width:`${p}%`}}/></i><small>{p}%</small></div>)}</div></aside></div>
    <button className="report-link" onClick={() => setBug(true)}><Flag size={15}/> See something incorrect? Report an issue</button>
    {bug && <div className="modal-backdrop" onMouseDown={() => setBug(false)}><div className="modal" onMouseDown={e => e.stopPropagation()}><button className="modal-close" onClick={() => setBug(false)}><X/></button>{sent ? <div className="success"><Check/><h2>Thanks for the heads-up!</h2><p>We’ll review your report soon.</p><button className="primary" onClick={() => setBug(false)}>Done</button></div> : <><span className="kicker">REPORT AN ISSUE</span><h2>What doesn’t look right?</h2><p>Tell us what’s inaccurate on {creator.name}’s profile.</p><textarea placeholder="Describe the issue or correction…" rows="5"/><button className="primary full" onClick={() => setSent(true)}>Submit report</button></>}</div></div>}
  </main>;
}
