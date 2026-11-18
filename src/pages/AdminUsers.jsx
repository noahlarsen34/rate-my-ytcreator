import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Pencil, Plus, RefreshCw, Search, ShieldCheck, Trash2, UserRound, X } from 'lucide-react';

const emptyForm = { email: '', password: '', username: '', firstName: '', lastName: '', birthdate: '', phoneNumber: '', gender: '' };

export function AdminUsers({ session, navigate, onAdminStatus }) {
  const [users, setUsers] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [dialog, setDialog] = useState(null);
  const [form, setForm] = useState(emptyForm);

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

  useEffect(() => { loadUsers(); }, [session.access_token]);

  const visibleUsers = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return users;
    return users.filter(user => `${user.firstName} ${user.lastName} ${user.username} ${user.email}`.toLowerCase().includes(term));
  }, [query, users]);

  const openCreate = () => { setForm(emptyForm); setError(''); setNotice(''); setDialog({ type: 'create' }); };
  const openEdit = user => {
    setForm({ email: user.email, password: '', username: user.username, firstName: user.firstName, lastName: user.lastName, birthdate: user.birthdate || '', phoneNumber: user.phoneNumber || '', gender: user.gender || '' });
    setError(''); setNotice(''); setDialog({ type: 'edit', user });
  };
  const closeDialog = () => { if (!working) setDialog(null); };

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

  if (!loading && error && !users.length && /administrator|session|sign in/i.test(error)) return <main className="page admin-page"><section className="admin-access-denied"><ShieldCheck/><span>ADMIN ACCESS</span><h1>Access denied</h1><p>{error}</p><button className="secondary" onClick={() => navigate('home')}>Return home</button></section></main>;

  return <main className="page admin-page">
    <section className="admin-heading"><div><span className="kicker"><ShieldCheck size={16}/> ADMIN CONSOLE</span><h1>User management</h1><p>Create accounts, update user profiles, or remove accounts from Rate My Creator.</p></div><button className="primary" onClick={openCreate}><Plus size={18}/> Add user</button></section>
    <section className="admin-summary"><div><strong>{users.length}</strong><span>Total users</span></div><div><strong>{users.filter(user => user.lastSignInAt).length}</strong><span>Signed in before</span></div><div><strong>{users.filter(user => !user.username).length}</strong><span>Incomplete profiles</span></div></section>
    <section className="admin-okr-section" aria-labelledby="admin-okr-heading"><h2 id="admin-okr-heading">OKR tracking</h2><div className="admin-okr-group"><h3>Parents are more informed about what their children are watching</h3><div className="admin-okr-grid"><div><strong>{metrics ? metrics.reviewLikes.toLocaleString() : '—'}</strong><span>Review votes</span><small>Positive and negative votes on reviews</small></div><div><strong>{metrics ? metrics.creatorsFollowed.toLocaleString() : '—'}</strong><span>Creators followed</span><small>Distinct user and creator follows</small></div><div><strong>{metrics ? metrics.searches.toLocaleString() : '—'}</strong><span>Searches</span><small>Submitted searches recorded</small></div></div></div><div className="admin-okr-group signup-okr-group"><h3>People share important information about creators</h3><div className="admin-okr-grid"><div><strong>{metrics ? metrics.signups.toLocaleString() : '—'}</strong><span>Sign-ups</span><small>Accounts in the user profile table</small></div><div><strong>{metrics ? metrics.reviews.toLocaleString() : '—'}</strong><span>Reviews submitted</span><small>Entries in the reviews table</small></div></div></div></section>
    <section className="panel admin-users-panel">
      <div className="admin-toolbar"><label><Search size={18}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search name, username, or email" aria-label="Search users"/></label><button className="secondary" onClick={loadUsers} disabled={loading}><RefreshCw size={17} className={loading ? 'spin' : ''}/> Refresh</button></div>
      {notice&&<p className="form-success" role="status">{notice}</p>}
      {error&&<p className="form-error" role="alert">{error}</p>}
      {loading?<div className="admin-loading"><RefreshCw className="spin"/><p>Loading users…</p></div>:<div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>User</th><th>Email</th><th>Joined</th><th>Last sign-in</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{visibleUsers.map(user=><tr key={user.id}><td><div className="admin-user-cell"><span>{user.avatarUrl?<img src={user.avatarUrl} alt="" referrerPolicy="no-referrer"/>:<UserRound/>}</span><div><b>{[user.firstName,user.lastName].filter(Boolean).join(' ')||'Incomplete profile'}</b><small>{user.username?`@${user.username}`:'No username'}</small></div></div></td><td>{user.email}</td><td>{new Date(user.createdAt).toLocaleDateString()}</td><td>{user.lastSignInAt?new Date(user.lastSignInAt).toLocaleDateString():'Never'}</td><td><div className="admin-row-actions"><button aria-label={`Edit ${user.email}`} onClick={()=>openEdit(user)}><Pencil size={17}/></button><button className="danger-icon" aria-label={`Delete ${user.email}`} onClick={()=>{setError('');setNotice('');setDialog({type:'delete',user});}}><Trash2 size={17}/></button></div></td></tr>)}</tbody></table>{!visibleUsers.length&&<div className="admin-empty"><UserRound/><h3>No users found</h3><p>Try a different search.</p></div>}</div>}
    </section>
    {dialog&&<div className="modal-backdrop" onMouseDown={closeDialog}><div className="modal admin-modal" onMouseDown={event=>event.stopPropagation()}><button className="modal-close" onClick={closeDialog} aria-label="Close"><X/></button>{dialog.type==='delete'?<div className="admin-delete-confirm"><AlertTriangle/><span className="kicker">PERMANENT ACTION</span><h2>Delete this user?</h2><p>This will permanently delete <strong>{dialog.user.email}</strong> and may also remove their related account data. This cannot be undone.</p>{error&&<p className="form-error">{error}</p>}<div><button className="secondary" onClick={closeDialog} disabled={working}>Cancel</button><button className="admin-danger-button" onClick={deleteUser} disabled={working}>{working?'Deleting…':'Delete user'}</button></div></div>:<form className="admin-user-form" onSubmit={saveUser}><span className="kicker">{dialog.type==='create'?'CREATE USER':'EDIT USER'}</span><h2>{dialog.type==='create'?'Add a new user':'Update profile'}</h2><div className="admin-form-grid"><label>Email<input type="email" required value={form.email} disabled={dialog.type==='edit'} onChange={event=>setForm(current=>({...current,email:event.target.value}))}/></label>{dialog.type==='create'&&<label>Temporary password<input type="password" required minLength="8" value={form.password} onChange={event=>setForm(current=>({...current,password:event.target.value}))}/></label>}<label>First name<input required value={form.firstName} onChange={event=>setForm(current=>({...current,firstName:event.target.value}))}/></label><label>Last name<input required value={form.lastName} onChange={event=>setForm(current=>({...current,lastName:event.target.value}))}/></label><label>Username<input required pattern="[A-Za-z0-9_-]{3,30}" value={form.username} onChange={event=>setForm(current=>({...current,username:event.target.value}))}/></label><label>Birthdate<input type="date" required value={form.birthdate} onChange={event=>setForm(current=>({...current,birthdate:event.target.value}))}/></label><label>Phone number<input value={form.phoneNumber} onChange={event=>setForm(current=>({...current,phoneNumber:event.target.value}))}/></label><label>Gender<select value={form.gender} onChange={event=>setForm(current=>({...current,gender:event.target.value}))}><option value="">Not specified</option><option value="M">Male</option><option value="F">Female</option><option value="other">Other</option></select></label></div>{error&&<p className="form-error">{error}</p>}<div className="admin-form-actions"><button type="button" className="secondary" onClick={closeDialog} disabled={working}>Cancel</button><button className="primary" disabled={working}>{working?'Saving…':dialog.type==='create'?'Create user':'Save changes'}</button></div></form>}</div></div>}
  </main>;
}
