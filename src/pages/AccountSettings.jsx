import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Camera, Check, Download, Link2, LogOut, RefreshCw, Search, Unlink, UserRound, X } from 'lucide-react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { profileDefaults } from '../utils';

export function AccountSettings({ navigate, user, session, profile, onProfileChanged, onAvatarUpload, avatarUrl, avatarUploading, avatarError, onCreatorsChanged }) {
  const defaults = profileDefaults(user, profile);
  const [values, setValues] = useState({ firstName: defaults.firstName, lastName: defaults.lastName, birthday: defaults.birthdate, username: defaults.username, gender: defaults.gender, phoneNumber: defaults.phoneNumber });
  const [editing, setEditing] = useState(false), [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [notice, setNotice] = useState(''), [error, setError] = useState('');
  const [youtube, setYoutube] = useState({ loading: true, working: false, connected: false, lastSyncedAt: null, followedCreators: 0, unmatchedCreators: null, message: '', error: '' });
  const [importer, setImporter] = useState({ open: false, loading: false, importing: false, channels: [], selected: new Set(), search: '', error: '' });
  const youtubeCallbackHandled = useRef(false);
  const avatarInputRef = useRef(null);
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
      setYoutube(current => ({ ...current, unmatchedCreators: Number(data.unmatchedCreators || 0), message: `YouTube connected. Matched ${data.matchedCreators} of ${data.totalSubscriptions} subscriptions and refreshed subscriber counts for ${Number(data.refreshedCreatorStats || 0)} creators.` }));
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
      setYoutube(current => ({ ...current, unmatchedCreators: Number(data.unmatchedCreators || 0), message: `Sync complete. Matched ${data.matchedCreators} of ${data.totalSubscriptions} subscriptions and refreshed subscriber counts for ${Number(data.refreshedCreatorStats || 0)} creators.` }));
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

  const openImporter = async () => {
    setImporter(current => ({ ...current, open: true, loading: true, channels: [], selected: new Set(), search: '', error: '' }));
    try {
      const data = await invokeYouTube({ action: 'list_unmatched' });
      setImporter(current => ({ ...current, loading: false, channels: data.channels || [] }));
      setYoutube(current => ({ ...current, unmatchedCreators: Number(data.unmatchedCreators || 0) }));
    } catch (importError) {
      setImporter(current => ({ ...current, loading: false, error: importError.message }));
    }
  };
  const toggleImportedChannel = channelId => setImporter(current => {
    const selected = new Set(current.selected);
    if (selected.has(channelId)) selected.delete(channelId); else selected.add(channelId);
    return { ...current, selected };
  });
  const visibleChannels = importer.channels.filter(channel => `${channel.title} ${channel.handle || ''}`.toLowerCase().includes(importer.search.trim().toLowerCase()));
  const selectVisibleChannels = () => setImporter(current => ({ ...current, selected: new Set([...current.selected, ...visibleChannels.map(channel => channel.channelId)]) }));
  const importSelectedChannels = async () => {
    if (!importer.selected.size) return;
    setImporter(current => ({ ...current, importing: true, error: '' }));
    try {
      const data = await invokeYouTube({ action: 'import', channelIds: [...importer.selected] });
      const status = await invokeYouTube({ action: 'status' });
      onCreatorsChanged?.();
      applyYouTubeStatus(status);
      setYoutube(current => ({ ...current, unmatchedCreators: Math.max(0, (current.unmatchedCreators ?? importer.channels.length) - data.importedCreators), message: `Imported ${data.importedCreators} creator${data.importedCreators === 1 ? '' : 's'} and followed ${data.followedCreators}.` }));
      setImporter({ open: false, loading: false, importing: false, channels: [], selected: new Set(), search: '', error: '' });
    } catch (importError) {
      setImporter(current => ({ ...current, importing: false, error: importError.message }));
    }
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

  return <main className="page settings-page"><button className="back" onClick={() => navigate('dashboard')}><ArrowLeft size={17}/> Dashboard</button><div className="settings-head"><div><h1>Account settings</h1><p>View and edit your account information.</p></div></div>{loading&&<p role="status">Loading your profile…</p>}{error&&<p className="form-error" role="alert">{error}</p>}{notice&&<div className="save-note" role="status"><Check/> {notice}</div>}<section className="panel settings-form"><div className="settings-panel-head"><h2 className="settings-section-title">Account information</h2>{!editing&&<button className="secondary" disabled={loading || !isSupabaseConfigured} onClick={() => (setError(''), setNotice(''), setEditing(true))}>Edit profile</button>}</div>{field('Username','username')}<div className="setting-row"><label>Email address</label><span>{user.email || 'Not provided'} <small className="email-readonly"> · Not editable here</small></span></div><div className="setting-row profile-picture-row"><label>Profile picture</label><div className="profile-picture-control"><input ref={avatarInputRef} className="visually-hidden" type="file" accept="image/*" aria-label="Choose a profile picture" onChange={event => { const file = event.currentTarget.files?.[0]; if (file) onAvatarUpload?.(file); event.currentTarget.value = ''; }}/><div className="settings-avatar-preview">{avatarUrl ? <img src={avatarUrl} alt="" referrerPolicy="no-referrer"/> : <UserRound size={20}/>}</div><button type="button" className="secondary" disabled={avatarUploading || !isSupabaseConfigured} onClick={() => avatarInputRef.current?.click()}><Camera size={16}/>{avatarUploading ? 'Uploading…' : 'Change picture'}</button>{avatarError&&<small className="form-error" role="alert">{avatarError}</small>}<small className="profile-picture-help">Select an image from your device or phone.</small></div></div><h2 className="settings-section-title personal-section-title">Personal information</h2><div className="setting-pair">{field('First name','firstName')}{field('Last name','lastName')}</div>{field('Birthday','birthday','date')}{field('Phone number','phoneNumber','tel')}{genderField}{editing&&<div className="settings-actions"><button className="secondary" disabled={saving} onClick={() => setEditing(false)}>Cancel</button><button className="primary" disabled={saving || !isSupabaseConfigured} onClick={save}>{saving?'Saving…':'Save changes'}</button></div>}</section><section className="panel youtube-settings"><div><h2>YouTube subscriptions</h2><p>Connect YouTube to follow matching creators automatically. Rate My Creator can read your subscriptions but cannot edit your YouTube account.</p>{youtube.loading ? <small>Checking connection…</small> : youtube.connected ? <small>Connected · {youtube.followedCreators} imported creator{youtube.followedCreators === 1 ? '' : 's'}{youtube.lastSyncedAt ? ` · Last synced ${new Date(youtube.lastSyncedAt).toLocaleString()}` : ''}</small> : <small>Not connected</small>}{youtube.message&&<div className="youtube-notice" role="status"><Check size={17}/> {youtube.message}</div>}{youtube.error&&<p className="form-error" role="alert">{youtube.error}</p>}</div><div className="youtube-actions">{youtube.connected ? <><button className="primary" disabled={youtube.working} onClick={openImporter}><Download size={17}/>Import subscriptions{youtube.unmatchedCreators !== null ? ` (${youtube.unmatchedCreators})` : ''}</button><button className="secondary" disabled={youtube.working} onClick={syncYouTube}><RefreshCw size={17}/>{youtube.working?'Syncing…':'Sync now'}</button><button className="disconnect-button" disabled={youtube.working} onClick={disconnectYouTube}><Unlink size={17}/>Disconnect</button></> : <button className="primary" disabled={youtube.loading || youtube.working} onClick={connectYouTube}><Link2 size={17}/>{youtube.working?'Connecting…':'Connect YouTube'}</button>}</div></section>{importer.open&&<div className="modal-backdrop subscription-import-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !importer.importing) setImporter(current => ({ ...current, open: false })); }}><section className="subscription-import-modal" role="dialog" aria-modal="true" aria-labelledby="subscription-import-title"><button className="subscription-import-close" aria-label="Close import screen" disabled={importer.importing} onClick={() => setImporter(current => ({ ...current, open: false }))}><X/></button><div className="subscription-import-heading"><span className="kicker">YOUTUBE SUBSCRIPTIONS</span><h2 id="subscription-import-title">Choose creators to import</h2><p>Only selected channels will be added to Rate My Creator and followed by your account.</p></div>{importer.loading?<div className="subscription-import-loading"><RefreshCw/> Loading your subscriptions…</div>:<><div className="subscription-import-toolbar"><label><Search size={18}/><input value={importer.search} onChange={event => setImporter(current => ({ ...current, search: event.target.value }))} placeholder="Search your subscriptions" aria-label="Search subscriptions"/></label><div><button className="text-button" onClick={selectVisibleChannels}>Select all visible</button><button className="text-button" onClick={() => setImporter(current => ({ ...current, selected: new Set() }))}>Clear</button></div></div><div className="subscription-import-summary"><span>{visibleChannels.length} available</span><strong>{importer.selected.size} selected</strong></div>{importer.error&&<p className="form-error" role="alert">{importer.error}</p>}<div className="subscription-channel-list">{visibleChannels.map(channel=><label className="subscription-channel" key={channel.channelId}><input type="checkbox" checked={importer.selected.has(channel.channelId)} onChange={() => toggleImportedChannel(channel.channelId)}/>{channel.thumbnailUrl?<img src={channel.thumbnailUrl} alt="" referrerPolicy="no-referrer"/>:<span className="subscription-channel-placeholder">{channel.title.slice(0,1)}</span>}<span><b>{channel.title}</b><small>{channel.handle || 'YouTube channel'}{channel.subscriberCount !== null ? ` · ${channel.subscriberCount.toLocaleString()} subscribers` : ''}</small></span></label>)}{!visibleChannels.length&&<div className="subscription-import-empty">{importer.channels.length?'No subscriptions match your search.':'All of your subscriptions are already available on Rate My Creator.'}</div>}</div><div className="subscription-import-footer"><button className="secondary" disabled={importer.importing} onClick={() => setImporter(current => ({ ...current, open: false }))}>Cancel</button><button className="primary" disabled={!importer.selected.size||importer.importing} onClick={importSelectedChannels}>{importer.importing?'Importing…':`Import selected (${importer.selected.size})`}</button></div></>}</section></div>}<button className="logout" onClick={logout}><LogOut size={17}/> Log out</button></main>;
}
