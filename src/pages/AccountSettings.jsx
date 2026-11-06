import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, Link2, LogOut, RefreshCw, Unlink } from 'lucide-react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { profileDefaults } from '../utils';

export function AccountSettings({ navigate, user, session, profile, onProfileChanged }) {
  const defaults = profileDefaults(user, profile);
  const [values, setValues] = useState({ firstName: defaults.firstName, lastName: defaults.lastName, birthday: defaults.birthdate, username: defaults.username, gender: defaults.gender, phoneNumber: defaults.phoneNumber });
  const [editing, setEditing] = useState(false), [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [notice, setNotice] = useState(''), [error, setError] = useState('');
  const [youtube, setYoutube] = useState({ loading: true, working: false, connected: false, lastSyncedAt: null, followedCreators: 0, message: '', error: '' });
  const youtubeCallbackHandled = useRef(false);
  const logout = async () => { if (supabase) await supabase.auth.signOut(); navigate('home'); };

  useEffect(() => {
    let active = true;
    async function loadProfile() {
      if (!isSupabaseConfigured) { setError('Supabase is not configured. Profile changes cannot be saved.'); setLoading(false); return; }
      const userResult = await supabase.from('users').select('user_id, first_name, last_name, birthdate, username, gender, phone_number, email, avatar_url').eq('user_id', user.id).maybeSingle();
      if (!active) return;
      if (userResult.error) setError(userResult.error.message || 'Your profile could not be loaded.');
      const row = userResult.data || {};
      setValues(current => ({ firstName: row.first_name ?? current.firstName, lastName: row.last_name ?? current.lastName, birthday: row.birthdate ?? current.birthday, username: row.username ?? current.username, gender: row.gender ?? current.gender, phoneNumber: row.phone_number ?? current.phoneNumber }));
      setLoading(false);
    }
    loadProfile();
    return () => { active = false; };
  }, [user.id]);

  const invokeYouTube = async body => {
    const { data, error: functionError } = await supabase.functions.invoke('youtube-sync', { body });
    if (functionError) {
      let message = functionError.message || 'The YouTube connection could not be updated.';
      try { const details = await functionError.context?.json(); message = details?.error || message; } catch { /* The function did not return JSON. */ }
      throw new Error(message);
    }
    if (data?.error) throw new Error(data.error);
    return data;
  };
  const applyYouTubeStatus = data => setYoutube(current => ({ ...current, loading: false, working: false, connected: Boolean(data?.connected), lastSyncedAt: data?.lastSyncedAt || null, followedCreators: Number(data?.followedCreators || 0), error: '' }));

  useEffect(() => {
    let active = true;
    invokeYouTube({ action: 'status' }).then(data => { if (active) applyYouTubeStatus(data); }).catch(statusError => { if (active) setYoutube(current => ({ ...current, loading: false, error: statusError.message })); });
    return () => { active = false; };
  }, [user.id]);

  useEffect(() => {
    if (youtubeCallbackHandled.current || new URLSearchParams(window.location.search).get('auth') !== 'youtube') return;
    youtubeCallbackHandled.current = true;
    setYoutube(current => ({ ...current, loading: false, working: true, message: 'Importing your YouTube subscriptions…', error: '' }));
    const providerToken = session?.provider_token;
    if (!providerToken) {
      setYoutube(current => ({ ...current, working: false, message: '', error: 'Google did not return a YouTube access token. Please connect YouTube again.' }));
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }
    invokeYouTube({ action: 'sync', providerToken, providerRefreshToken: session?.provider_refresh_token || null }).then(data => {
      applyYouTubeStatus(data);
      setYoutube(current => ({ ...current, message: `YouTube connected. Matched ${data.matchedCreators} of ${data.totalSubscriptions} subscriptions to creators on Rate My Creator.` }));
    }).catch(syncError => setYoutube(current => ({ ...current, working: false, message: '', error: syncError.message }))).finally(() => window.history.replaceState({}, document.title, window.location.pathname));
  }, [session?.provider_refresh_token, session?.provider_token]);

  const connectYouTube = async () => {
    setYoutube(current => ({ ...current, working: true, message: '', error: '' }));
    const { error: oauthError } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { scopes: 'https://www.googleapis.com/auth/youtube.readonly', redirectTo: `${window.location.origin}/?auth=youtube`, queryParams: { access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', login_hint: user.email || '' } } });
    if (oauthError) setYoutube(current => ({ ...current, working: false, error: oauthError.message || 'YouTube authorization could not be started.' }));
  };
  const syncYouTube = async () => {
    setYoutube(current => ({ ...current, working: true, message: '', error: '' }));
    try {
      const data = await invokeYouTube({ action: 'sync' }); applyYouTubeStatus(data);
      setYoutube(current => ({ ...current, message: `Sync complete. Matched ${data.matchedCreators} of ${data.totalSubscriptions} subscriptions.` }));
    } catch (syncError) { setYoutube(current => ({ ...current, working: false, error: syncError.message })); }
  };
  const disconnectYouTube = async () => {
    if (!window.confirm('Disconnect YouTube and remove follows that were imported from YouTube?')) return;
    setYoutube(current => ({ ...current, working: true, message: '', error: '' }));
    try {
      const data = await invokeYouTube({ action: 'disconnect' }); applyYouTubeStatus(data);
      setYoutube(current => ({ ...current, message: 'YouTube was disconnected. Manually followed creators were not changed.' }));
    } catch (disconnectError) { setYoutube(current => ({ ...current, working: false, error: disconnectError.message })); }
  };

  const save = async () => {
    setSaving(true); setError(''); setNotice('');
    const savedUsername = values.username.trim();
    if (!values.firstName.trim() || !values.lastName.trim() || !values.birthday || !savedUsername) { setError('First name, last name, username, and birthdate are required.'); setSaving(false); return; }
    if (!/^[A-Za-z0-9_-]{3,30}$/.test(savedUsername)) { setError('Username must be 3–30 characters using letters, numbers, underscores, or hyphens.'); setSaving(false); return; }
    const payload = { user_id: user.id, first_name: values.firstName.trim(), last_name: values.lastName.trim(), birthdate: values.birthday, username: savedUsername, gender: values.gender || null, phone_number: values.phoneNumber.trim() || null, email: user.email, avatar_url: profile?.avatar_url || user.user_metadata?.avatar_url || user.user_metadata?.picture || null };
    const { data, error: saveError } = await supabase.from('users').upsert(payload, { onConflict: 'user_id' }).select('user_id, first_name, last_name, birthdate, phone_number, email, gender, username, avatar_url').single();
    if (saveError) setError(saveError.code === '23505' ? 'That username is already taken.' : saveError.message || 'Your profile could not be saved.');
    else { onProfileChanged?.(data); setEditing(false); setNotice('Your profile was saved.'); }
    setSaving(false);
  };
  const birthdayMaxValue = new Date().toISOString().slice(0, 10);
  const field = (label, key, type = 'text') => <div className="setting-row" key={key}><label htmlFor={`profile-${key}`}>{label}</label>{editing ? <input id={`profile-${key}`} type={type} {...(key === 'birthday' ? { max: birthdayMaxValue } : {})} value={values[key]} onChange={event => setValues(current => ({ ...current, [key]: event.target.value }))} disabled={loading || saving} /> : <span>{values[key] || 'Not provided'}</span>}</div>;
  const genderField = <div className="setting-row" key="gender"><label htmlFor="profile-gender">Gender</label>{editing ? <select id="profile-gender" value={values.gender} onChange={event => setValues(current => ({ ...current, gender: event.target.value }))} disabled={loading || saving}><option value="">Prefer not to say</option><option value="M">M</option><option value="F">F</option><option value="other">Other</option></select> : <span>{values.gender || 'Not provided'}</span>}</div>;

  return <main className="page settings-page"><button className="back" onClick={() => navigate('dashboard')}><ArrowLeft size={17}/> Dashboard</button><div className="settings-head"><div><h1>Account settings</h1><p>View and edit your account information.</p></div></div>{loading&&<p role="status">Loading your profile…</p>}{error&&<p className="form-error" role="alert">{error}</p>}{notice&&<div className="save-note" role="status"><Check/> {notice}</div>}<section className="panel settings-form"><div className="settings-panel-head"><h2 className="settings-section-title">Account information</h2>{!editing&&<button className="secondary" disabled={loading || !isSupabaseConfigured} onClick={() => (setError(''), setNotice(''), setEditing(true))}>Edit profile</button>}</div>{field('Username','username')}<div className="setting-row"><label>Email address</label><span>{user.email || 'Not provided'} <small className="email-readonly"> · Not editable here</small></span></div><h2 className="settings-section-title personal-section-title">Personal information</h2><div className="setting-pair">{field('First name','firstName')}{field('Last name','lastName')}</div>{field('Birthday','birthday','date')}{field('Phone number','phoneNumber','tel')}{genderField}{editing&&<div className="settings-actions"><button className="secondary" disabled={saving} onClick={() => setEditing(false)}>Cancel</button><button className="primary" disabled={saving || !isSupabaseConfigured} onClick={save}>{saving?'Saving…':'Save changes'}</button></div>}</section><section className="panel youtube-settings"><div><h2>YouTube subscriptions</h2><p>Connect YouTube to follow matching creators automatically. Rate My Creator can read your subscriptions but cannot edit your YouTube account.</p>{youtube.loading ? <small>Checking connection…</small> : youtube.connected ? <small>Connected · {youtube.followedCreators} imported creator{youtube.followedCreators === 1 ? '' : 's'}{youtube.lastSyncedAt ? ` · Last synced ${new Date(youtube.lastSyncedAt).toLocaleString()}` : ''}</small> : <small>Not connected</small>}{youtube.message&&<div className="youtube-notice" role="status"><Check size={17}/> {youtube.message}</div>}{youtube.error&&<p className="form-error" role="alert">{youtube.error}</p>}</div><div className="youtube-actions">{youtube.connected ? <><button className="secondary" disabled={youtube.working} onClick={syncYouTube}><RefreshCw size={17}/>{youtube.working?'Syncing…':'Sync now'}</button><button className="disconnect-button" disabled={youtube.working} onClick={disconnectYouTube}><Unlink size={17}/>Disconnect</button></> : <button className="primary" disabled={youtube.loading || youtube.working} onClick={connectYouTube}><Link2 size={17}/>{youtube.working?'Connecting…':'Connect YouTube'}</button>}</div></section><button className="logout" onClick={logout}><LogOut size={17}/> Log out</button></main>;
}
