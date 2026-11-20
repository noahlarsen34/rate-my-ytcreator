import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Pencil, Plus, RefreshCw, Search, ShieldCheck, Star, Trash2, UserRound, X } from 'lucide-react';

const emptyForm = { email: '', password: '', username: '', firstName: '', lastName: '', birthdate: '', phoneNumber: '', gender: '' };
const emptyReviewForm = { overallRating: '', profanity: '', substanceUse: '', ageLevel: '', reviewText: '', biasText: '', usesAi: '' };
const emptyNewReviewForm = { userId: '', creatorId: '', overallRating: '', reviewText: '', ageLevel: '', profanity: '1', substanceUse: '1', usesAi: 'Unsure', biasText: '' };
// Keep account completeness checks consistent between the summary card and user rows.
const isProfileIncomplete = user => !user.firstName?.trim() || !user.lastName?.trim() || !user.username?.trim();
// Show a readable account label in the review author selector, even for incomplete profiles.
const userOptionLabel = user => `${[user.firstName, user.lastName].filter(Boolean).join(' ') || user.username && `@${user.username}` || 'Incomplete profile'} (${user.email})`;

export function AdminUsers({ session, navigate, onAdminStatus }) {
  // Account and review data are loaded separately because they use different admin API routes.
  const [users, setUsers] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [creators, setCreators] = useState([]);
  const [metrics, setMetrics] = useState(null);
  // Track each table's loading state, plus shared save/delete progress for modal controls.
  const [loading, setLoading] = useState(true);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsLoaded, setReviewsLoaded] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [reviewsError, setReviewsError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  // Accounts is the default tab; review details and form values are held locally until saved.
  const [activeTab, setActiveTab] = useState('accounts');
  const [dialog, setDialog] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [reviewForm, setReviewForm] = useState(emptyReviewForm);
  const [hoveredReviewRating, setHoveredReviewRating] = useState(0);
  const [newReviewForm, setNewReviewForm] = useState(emptyNewReviewForm);

  // All account mutations are sent to the protected server endpoint with the signed-in token.
  const request = async (method = 'GET', body) => {
    const response = await fetch('/api/admin/users', {
      method,
      headers: { Authorization: `Bearer ${session.access_token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const requestError = new Error(result.error || 'The admin request failed.');
      requestError.status = response.status;
      throw requestError;
    }
    return result;
  };

  // Review operations use their own endpoint so the browser never receives service-role access.
  const requestReviews = async (method = 'GET', body) => {
    const response = await fetch('/api/admin/reviews', {
      method,
      headers: { Authorization: `Bearer ${session.access_token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const requestError = new Error(result.error || 'The review admin request failed.');
      requestError.status = response.status;
      throw requestError;
    }
    return result;
  };

  // Load users and OKR totals together; an authorization failure also updates the app's admin state.
  const loadUsers = async () => {
    setLoading(true); setError('');
    try {
      const result = await request();
      setUsers(result.users || []);
      setMetrics(result.metrics || null);
      onAdminStatus?.(true);
    } catch (loadError) {
      setError(loadError.message);
      if ([401, 403].includes(loadError.status)) onAdminStatus?.(false);
    } finally { setLoading(false); }
  };

  // Load review rows and the creator choices needed by the add-review form.
  const loadReviews = async () => {
    setReviewsLoading(true); setReviewsError('');
    try {
      const result = await requestReviews();
      setReviews(result.reviews || []);
      setCreators(result.creators || []);
      setReviewsLoaded(true);
      onAdminStatus?.(true);
    } catch (loadError) {
      setReviewsError(loadError.message);
      if ([401, 403].includes(loadError.status)) onAdminStatus?.(false);
    } finally { setReviewsLoading(false); }
  };

  // Refresh account data whenever the authenticated session token changes.
  useEffect(() => { loadUsers(); }, [session.access_token]);

  // Fetch reviews on first tab selection rather than delaying the account panel's initial load.
  useEffect(() => {
    if (activeTab === 'reviews' && !reviewsLoaded && !reviewsLoading) loadReviews();
  }, [activeTab, reviewsLoaded, session.access_token]);

  // Search fields are combined into one case-insensitive filter for each tab.
  const visibleUsers = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return users;
    return users.filter(user => `${user.firstName} ${user.lastName} ${user.username} ${user.email}`.toLowerCase().includes(term));
  }, [query, users]);

  const visibleReviews = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return reviews;
    return reviews.filter(review => `${review.creatorName} ${review.reviewerName} ${review.reviewerDetail} ${review.reviewText}`.toLowerCase().includes(term));
  }, [query, reviews]);

  // Dialog helpers reset messages and form state so a previous action cannot leak into a new one.
  const openCreate = () => { setForm(emptyForm); setError(''); setNotice(''); setDialog({ type: 'create' }); };
  const openEdit = user => {
    setForm({ email: user.email, password: '', username: user.username, firstName: user.firstName, lastName: user.lastName, birthdate: user.birthdate || '', phoneNumber: user.phoneNumber || '', gender: user.gender || '' });
    setError(''); setNotice(''); setDialog({ type: 'edit', user });
  };
  const closeDialog = () => { if (!working) setDialog(null); };

  // Account form handlers call the admin API, close on success, and then refresh the account summary.
  const saveUser = async event => {
    event.preventDefault(); setWorking(true); setError(''); setNotice('');
    try {
      const editing = dialog.type === 'edit';
      const result = await request(editing ? 'PATCH' : 'POST', { ...form, ...(editing ? { id: dialog.user.id } : {}) });
      setNotice(result.message);
      setDialog(null);
      await loadUsers();
    } catch (saveError) { setError(saveError.message); }
    finally { setWorking(false); }
  };

  const deleteUser = async () => {
    setWorking(true); setError(''); setNotice('');
    try {
      const result = await request('DELETE', { id: dialog.user.id });
      setNotice(result.message);
      setDialog(null);
      await loadUsers();
    } catch (deleteError) { setError(deleteError.message); }
    finally { setWorking(false); }
  };

  // Review edits retain the author and creator IDs; only review content is loaded into editable state.
  const openEditReview = review => {
    setHoveredReviewRating(0);
    setReviewForm({
      overallRating: String(review.overallRating),
      profanity: review.profanity === null ? '' : String(review.profanity),
      substanceUse: review.substanceUse === null ? '' : String(review.substanceUse),
      ageLevel: review.ageLevel || '',
      reviewText: review.reviewText,
      biasText: review.biasText || '',
      usesAi: review.usesAi || ''
    });
    setError(''); setReviewsError(''); setNotice(''); setDialog({ type: 'editReview', review });
  };

  const openCreateReview = () => {
    setNewReviewForm(emptyNewReviewForm);
    setError(''); setReviewsError(''); setNotice(''); setDialog({ type: 'createReview' });
  };

  // Create a review for a selected existing account and creator, then refresh both review and OKR data.
  const createReview = async event => {
    event.preventDefault(); setWorking(true); setReviewsError(''); setNotice('');
    try {
      const result = await requestReviews('POST', {
        ...newReviewForm,
        overallRating: Number(newReviewForm.overallRating),
        profanity: Number(newReviewForm.profanity),
        substanceUse: Number(newReviewForm.substanceUse)
      });
      setNotice(result.message);
      setDialog(null);
      await loadReviews();
      await loadUsers();
    } catch (createError) { setReviewsError(createError.message); }
    finally { setWorking(false); }
  };

  // Persist all editable review fields through the server API and reload the table after saving.
  const saveReview = async event => {
    event.preventDefault(); setWorking(true); setReviewsError(''); setNotice('');
    try {
      const result = await requestReviews('PATCH', {
        id: dialog.review.id,
        overallRating: Number(reviewForm.overallRating),
        profanity: reviewForm.profanity === '' ? null : Number(reviewForm.profanity),
        substanceUse: reviewForm.substanceUse === '' ? null : Number(reviewForm.substanceUse),
        ageLevel: reviewForm.ageLevel,
        reviewText: reviewForm.reviewText,
        biasText: reviewForm.biasText,
        usesAi: reviewForm.usesAi || null
      });
      setNotice(result.message);
      setDialog(null);
      await loadReviews();
    } catch (saveError) { setReviewsError(saveError.message); }
    finally { setWorking(false); }
  };

  // Delete confirmation uses the selected review; refresh both the list and its dashboard totals.
  const deleteReview = async () => {
    setWorking(true); setReviewsError(''); setNotice('');
    try {
      const result = await requestReviews('DELETE', { id: dialog.review.id });
      setNotice(result.message);
      setDialog(null);
      await loadReviews();
      await loadUsers();
    } catch (deleteError) { setReviewsError(deleteError.message); }
    finally { setWorking(false); }
  };

  // Avoid rendering the management console if the first account request confirms the session is not an admin.
  if (!loading && error && !users.length && /administrator|session|sign in/i.test(error)) return <main className="page admin-page"><section className="admin-access-denied"><ShieldCheck/><span>ADMIN ACCESS</span><h1>Access denied</h1><p>{error}</p><button className="secondary" onClick={() => navigate('home')}>Return home</button></section></main>;

  return <main className="page admin-page">
    <section className="admin-heading"><div><span className="kicker"><ShieldCheck size={16}/> ADMIN CONSOLE</span><h1>Admin management</h1><p>Manage accounts and reviews across Rate My Creator.</p></div></section>
    {/* Summary cards describe account totals, while OKR cards display metrics from the same admin response. */}
    <section className="admin-summary"><div><strong>{users.length}</strong><span>Total users</span></div><div><strong>{users.filter(user => user.lastSignInAt).length}</strong><span>Signed in before</span></div><div><strong>{users.filter(isProfileIncomplete).length}</strong><span>Incomplete profiles</span></div></section>
    <section className="admin-okr-section" aria-labelledby="admin-okr-heading"><h2 id="admin-okr-heading">OKR tracking</h2><div className="admin-okr-group"><h3>Parents are more informed about what their children are watching</h3><div className="admin-okr-grid"><div><strong>{metrics ? metrics.reviewLikes.toLocaleString() : '—'}</strong><span>Review votes</span><small>Positive and negative votes on reviews</small></div><div><strong>{metrics ? metrics.creatorsFollowed.toLocaleString() : '—'}</strong><span>Creators followed</span><small>Distinct user and creator follows</small></div><div><strong>{metrics ? metrics.searches.toLocaleString() : '—'}</strong><span>Searches</span><small>Submitted searches recorded</small></div></div></div><div className="admin-okr-group signup-okr-group"><h3>People share important information about creators</h3><div className="admin-okr-grid"><div><strong>{metrics ? metrics.signups.toLocaleString() : '—'}</strong><span>Sign-ups</span><small>Accounts in the user profile table</small></div><div><strong>{metrics ? metrics.reviews.toLocaleString() : '—'}</strong><span>Reviews submitted</span><small>Entries in the reviews table</small></div></div></div></section>
    {/* Both record types live in the same panel; only the active tab's table and toolbar are rendered. */}
    <section className="panel admin-users-panel">
      <div className="admin-tabs" role="tablist" aria-label="Admin records"><button id="admin-accounts-tab" role="tab" aria-selected={activeTab === 'accounts'} aria-controls="admin-accounts-panel" className={activeTab === 'accounts' ? 'active' : ''} onClick={() => { setActiveTab('accounts'); setQuery(''); }}>Accounts</button><button id="admin-reviews-tab" role="tab" aria-selected={activeTab === 'reviews'} aria-controls="admin-reviews-panel" className={activeTab === 'reviews' ? 'active' : ''} onClick={() => { setActiveTab('reviews'); setQuery(''); }}>Reviews</button></div>
      {activeTab === 'accounts' ? <div id="admin-accounts-panel" role="tabpanel" aria-labelledby="admin-accounts-tab">
      {/* The original account table stays intact inside the Accounts tab, including its CRUD controls. */}
      <div className="admin-toolbar"><label><Search size={18}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search name, username, or email" aria-label="Search users"/></label><div className="admin-toolbar-actions"><button className="primary" onClick={openCreate}><Plus size={18}/> Add user</button><button className="secondary" onClick={loadUsers} disabled={loading}><RefreshCw size={17} className={loading ? 'spin' : ''}/> Refresh</button></div></div>
      {notice&&<p className="form-success" role="status">{notice}</p>}
      {error&&<p className="form-error" role="alert">{error}</p>}
      {loading?<div className="admin-loading"><RefreshCw className="spin"/><p>Loading users…</p></div>:<div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>User</th><th>Email</th><th>Joined</th><th>Last sign-in</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{visibleUsers.map(user=><tr key={user.id}><td><div className="admin-user-cell"><span>{user.avatarUrl?<img src={user.avatarUrl} alt="" referrerPolicy="no-referrer"/>:<UserRound/>}</span><div><b>{[user.firstName,user.lastName].filter(Boolean).join(' ')||'Incomplete profile'}</b><small>{user.username?`@${user.username}`:'No username'}</small></div></div></td><td>{user.email}</td><td>{new Date(user.createdAt).toLocaleDateString()}</td><td>{user.lastSignInAt?new Date(user.lastSignInAt).toLocaleDateString():'Never'}</td><td><div className="admin-row-actions"><button aria-label={`Edit ${user.email}`} onClick={()=>openEdit(user)}><Pencil size={17}/></button><button className="danger-icon" aria-label={`Delete ${user.email}`} onClick={()=>{setError('');setNotice('');setDialog({type:'delete',user});}}><Trash2 size={17}/></button></div></td></tr>)}</tbody></table>{!visibleUsers.length&&<div className="admin-empty"><UserRound/><h3>No users found</h3><p>Try a different search.</p></div>}</div>}
      </div> : <div id="admin-reviews-panel" role="tabpanel" aria-labelledby="admin-reviews-tab">
        {/* Review tools share search and refresh controls; Add review opens a form that assigns an account and creator. */}
        <div className="admin-toolbar"><label><Search size={18}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search creator, reviewer, or review" aria-label="Search reviews"/></label><div className="admin-toolbar-actions"><button className="primary" onClick={openCreateReview} disabled={loading || !users.length || !creators.length}><Plus size={18}/> Add review</button><button className="secondary" onClick={loadReviews} disabled={reviewsLoading}><RefreshCw size={17} className={reviewsLoading ? 'spin' : ''}/> Refresh</button></div></div>
        {notice&&<p className="form-success" role="status">{notice}</p>}
        {reviewsError&&<p className="form-error" role="alert">{reviewsError}</p>}
        {reviewsLoading?<div className="admin-loading"><RefreshCw className="spin"/><p>Loading reviews…</p></div>:<div className="admin-table-wrap"><table className="admin-table admin-review-table"><thead><tr><th>Creator</th><th>Reviewer</th><th>Description</th><th>Rating</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{visibleReviews.map(review=><tr key={review.id}><td><button className="admin-profile-link" onClick={()=>navigate('profile', 'db-' + review.creatorId)}>{review.creatorName}</button></td><td>{review.reviewerProfileVisible ? <button className="admin-profile-link" onClick={()=>navigate('user-profile', review.reviewerUserId)}>{review.reviewerName}</button> : <b>{review.reviewerName}</b>}<small className="admin-review-subtext">{review.reviewerDetail}</small></td><td><p className="admin-review-description">{review.reviewText}</p></td><td><span className="admin-rating"><Star size={15} fill="currentColor"/>{review.overallRating}/5</span></td><td><div className="admin-row-actions"><button aria-label={`View or edit review by ${review.reviewerName}`} title="View / edit" onClick={()=>openEditReview(review)}><Pencil size={17}/></button><button className="danger-icon" aria-label={`Delete review by ${review.reviewerName} for ${review.creatorName}`} onClick={()=>{setReviewsError('');setNotice('');setDialog({type:'deleteReview',review});}}><Trash2 size={17}/></button></div></td></tr>)}</tbody></table>{!visibleReviews.length&&<div className="admin-empty"><Star/><h3>No reviews found</h3><p>Try a different search.</p></div>}</div>}
      </div>}
    </section>
    {/* Shared modal host renders the selected create/edit/delete dialog and blocks close while a request is saving. */}
    {dialog&&<div className="modal-backdrop" onMouseDown={closeDialog}><div className="modal admin-modal" onMouseDown={event=>event.stopPropagation()}><button className="modal-close" onClick={closeDialog} aria-label="Close"><X/></button>{dialog.type==='delete'?<div className="admin-delete-confirm"><div className="admin-delete-heading"><AlertTriangle/><span className="kicker">PERMANENT ACTION</span></div><h2>Delete this user?</h2><p>This will permanently delete <strong>{dialog.user.email}</strong> and may also remove their related account data. This cannot be undone.</p>{error&&<p className="form-error">{error}</p>}<div><button className="secondary" onClick={closeDialog} disabled={working}>Cancel</button><button className="admin-danger-button" onClick={deleteUser} disabled={working}>{working?'Deleting…':'Delete user'}</button></div></div>:dialog.type==='deleteReview'?<div className="admin-delete-confirm"><div className="admin-delete-heading"><AlertTriangle/><span className="kicker">PERMANENT ACTION</span></div><h2>Delete this review?</h2><p>This will permanently delete the review by <strong>{dialog.review.reviewerName}</strong> for <strong>{dialog.review.creatorName}</strong>. This cannot be undone.</p>{reviewsError&&<p className="form-error">{reviewsError}</p>}<div><button className="secondary" onClick={closeDialog} disabled={working}>Cancel</button><button className="admin-danger-button" onClick={deleteReview} disabled={working}>{working?'Deleting…':'Delete review'}</button></div></div>:dialog.type==='editReview'?<form className="admin-user-form" onSubmit={saveReview}><span className="kicker">REVIEW MANAGEMENT</span><h2>Review for {dialog.review.creatorName}</h2><p className="admin-review-byline">By {dialog.review.reviewerName} · {dialog.review.reviewerDetail}</p><div className="admin-review-create-grid"><div className="admin-star-rating-field"><span>Overall rating</span><div className="star-rating" role="group" aria-label="Overall creator rating" onMouseLeave={() => setHoveredReviewRating(0)}>{[1, 2, 3, 4, 5].map(star => { const displayedRating = hoveredReviewRating || Number(reviewForm.overallRating); const fillPercent = displayedRating >= star ? 100 : displayedRating >= star - 0.5 ? 50 : 0; return <button type="button" key={star} aria-label={`${star - 0.5} or ${star} stars; click the left half for ${star - 0.5}, right half for ${star}`} aria-pressed={Number(reviewForm.overallRating) === star || Number(reviewForm.overallRating) === star - 0.5} className={`star-rating-star ${fillPercent ? 'active' : ''}`} onMouseMove={event => { const bounds = event.currentTarget.getBoundingClientRect(); setHoveredReviewRating(event.clientX - bounds.left < bounds.width / 2 ? star - 0.5 : star); }} onFocus={() => setHoveredReviewRating(Number(reviewForm.overallRating) || star)} onBlur={() => setHoveredReviewRating(0)} onClick={event => { const bounds = event.currentTarget.getBoundingClientRect(); const value = event.detail === 0 || event.clientX - bounds.left >= bounds.width / 2 ? star : star - 0.5; setReviewForm(current => ({ ...current, overallRating: String(value) })); }}><Star className="star-outline" size={38}/><Star className="star-fill" size={38} fill="currentColor" style={{ clipPath: `inset(0 ${100 - fillPercent}% 0 0)` }}/></button>; })}</div><span className="star-rating-value" aria-live="polite">{reviewForm.overallRating ? `${reviewForm.overallRating} out of 5 stars` : 'Select a rating'}</span></div><label>Recommended age level<select required value={reviewForm.ageLevel} onChange={event=>setReviewForm(current=>({...current,ageLevel:event.target.value}))}><option value="">Select an age range</option><option>Under 8</option><option>8+</option><option>13+</option><option>16+</option><option>18+</option><option>All ages</option></select></label><label>Profanity frequency<select value={reviewForm.profanity} onChange={event=>setReviewForm(current=>({...current,profanity:event.target.value}))}><option value="">Not evaluated</option><option value="0">Not rated</option><option value="1">None</option><option value="2">Rarely</option><option value="3">Sometimes</option><option value="4">Often</option><option value="5">Very frequently</option></select></label><label>Substance use frequency<select value={reviewForm.substanceUse} onChange={event=>setReviewForm(current=>({...current,substanceUse:event.target.value}))}><option value="">Not evaluated</option><option value="0">Not rated</option><option value="1">Never</option><option value="2">Rarely</option><option value="3">Sometimes</option><option value="4">Often</option><option value="5">Very often</option></select></label><label>AI use<select value={reviewForm.usesAi} onChange={event=>setReviewForm(current=>({...current,usesAi:event.target.value}))}><option value="">Not specified</option><option>Yes</option><option>No</option><option>Unsure</option></select></label></div><label className="admin-review-field">Description<textarea required rows="6" maxLength="10000" value={reviewForm.reviewText} onChange={event=>setReviewForm(current=>({...current,reviewText:event.target.value}))}/></label><label className="admin-review-field">Sponsors or viewpoints<textarea rows="3" maxLength="10000" value={reviewForm.biasText} onChange={event=>setReviewForm(current=>({...current,biasText:event.target.value}))}/></label>{reviewsError&&<p className="form-error" role="alert">{reviewsError}</p>}<div className="admin-form-actions"><button type="button" className="secondary" onClick={closeDialog} disabled={working}>Cancel</button><button className="primary" disabled={working}>{working?'Saving…':'Save changes'}</button></div></form>:dialog.type==='createReview'?<form className="admin-user-form" onSubmit={createReview}><span className="kicker">REVIEW MANAGEMENT</span><h2>Add a review</h2><div className="admin-review-create-grid"><label>Assign to user<select required value={newReviewForm.userId} onChange={event=>setNewReviewForm(current=>({...current,userId:event.target.value}))}><option value="">Select an account</option>{users.map(user=><option key={user.id} value={user.id}>{userOptionLabel(user)}</option>)}</select></label><label>Creator<select required value={newReviewForm.creatorId} onChange={event=>setNewReviewForm(current=>({...current,creatorId:event.target.value}))}><option value="">Select a creator</option>{creators.map(creator=><option key={creator.id} value={creator.id}>{creator.name}</option>)}</select></label><label>Overall rating<input type="number" min="0.5" max="5" step="0.5" required value={newReviewForm.overallRating} onChange={event=>setNewReviewForm(current=>({...current,overallRating:event.target.value}))}/></label><label>Recommended age level<select required value={newReviewForm.ageLevel} onChange={event=>setNewReviewForm(current=>({...current,ageLevel:event.target.value}))}><option value="">Select an age range</option><option>Under 8</option><option>8+</option><option>13+</option><option>16+</option><option>18+</option><option>All ages</option></select></label><label>Profanity frequency<select required value={newReviewForm.profanity} onChange={event=>setNewReviewForm(current=>({...current,profanity:event.target.value}))}><option value="1">None</option><option value="2">Rarely</option><option value="3">Sometimes</option><option value="4">Often</option><option value="5">Very frequently</option></select></label><label>Substance use frequency<select required value={newReviewForm.substanceUse} onChange={event=>setNewReviewForm(current=>({...current,substanceUse:event.target.value}))}><option value="1">Never</option><option value="2">Rarely</option><option value="3">Sometimes</option><option value="4">Often</option><option value="5">Very often</option></select></label><label>AI use<select required value={newReviewForm.usesAi} onChange={event=>setNewReviewForm(current=>({...current,usesAi:event.target.value}))}><option value="Unsure">Unsure</option><option value="Yes">Yes</option><option value="No">No</option></select></label><label className="admin-review-create-bias">Sponsors or viewpoints (optional)<textarea rows="3" maxLength="10000" value={newReviewForm.biasText} onChange={event=>setNewReviewForm(current=>({...current,biasText:event.target.value}))}/></label></div><label className="admin-review-field">Description<textarea required rows="6" maxLength="10000" value={newReviewForm.reviewText} onChange={event=>setNewReviewForm(current=>({...current,reviewText:event.target.value}))}/></label>{reviewsError&&<p className="form-error" role="alert">{reviewsError}</p>}<div className="admin-form-actions"><button type="button" className="secondary" onClick={closeDialog} disabled={working}>Cancel</button><button className="primary" disabled={working}>{working?'Creating…':'Create review'}</button></div></form>:<form className="admin-user-form" onSubmit={saveUser}><span className="kicker">{dialog.type==='create'?'CREATE USER':'EDIT USER'}</span><h2>{dialog.type==='create'?'Add a new user':'Update profile'}</h2><div className="admin-form-grid"><label>Email<input type="email" required value={form.email} disabled={dialog.type==='edit'} onChange={event=>setForm(current=>({...current,email:event.target.value}))}/></label>{dialog.type==='create'&&<label>Temporary password<input type="password" required minLength="8" value={form.password} onChange={event=>setForm(current=>({...current,password:event.target.value}))}/></label>}<label>First name<input required value={form.firstName} onChange={event=>setForm(current=>({...current,firstName:event.target.value}))}/></label><label>Last name<input required value={form.lastName} onChange={event=>setForm(current=>({...current,lastName:event.target.value}))}/></label><label>Username<input required pattern="[A-Za-z0-9_-]{3,30}" value={form.username} onChange={event=>setForm(current=>({...current,username:event.target.value}))}/></label><label>Birthdate<input type="date" required value={form.birthdate} onChange={event=>setForm(current=>({...current,birthdate:event.target.value}))}/></label><label>Phone number<input value={form.phoneNumber} onChange={event=>setForm(current=>({...current,phoneNumber:event.target.value}))}/></label><label>Gender<select value={form.gender} onChange={event=>setForm(current=>({...current,gender:event.target.value}))}><option value="">Not specified</option><option value="M">Male</option><option value="F">Female</option><option value="other">Other</option></select></label></div>{error&&<p className="form-error">{error}</p>}<div className="admin-form-actions"><button type="button" className="secondary" onClick={closeDialog} disabled={working}>Cancel</button><button className="primary" disabled={working}>{working?'Saving…':dialog.type==='create'?'Create user':'Save changes'}</button></div></form>}</div></div>}
  </main>;
}
