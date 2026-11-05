import { useEffect, useState } from 'react';
import { ArrowLeft, Check, LogOut } from 'lucide-react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { profileDefaults } from '../utils';

export function AccountSettings({ navigate, user, profile, onProfileChanged }) {
  const defaults = profileDefaults(user, profile);
  const [values, setValues] = useState({ firstName: defaults.firstName, lastName: defaults.lastName, birthday: defaults.birthdate, username: defaults.username, gender: defaults.gender, phoneNumber: defaults.phoneNumber });
  const [editing, setEditing] = useState(false), [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [notice, setNotice] = useState(''), [error, setError] = useState('');
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
  const save = async () => {
    setSaving(true); setError(''); setNotice('');
    const savedUsername = values.username.trim();
    if (!values.firstName.trim() || !values.lastName.trim() || !values.birthday || !savedUsername) {
      setError('First name, last name, username, and birthdate are required.');
      setSaving(false);
      return;
    }
    if (!/^[A-Za-z0-9_-]{3,30}$/.test(savedUsername)) {
      setError('Username must be 3–30 characters using letters, numbers, underscores, or hyphens.');
      setSaving(false);
      return;
    }
    const payload = { user_id: user.id, first_name: values.firstName.trim(), last_name: values.lastName.trim(), birthdate: values.birthday, username: savedUsername, gender: values.gender || null, phone_number: values.phoneNumber.trim() || null, email: user.email, avatar_url: profile?.avatar_url || user.user_metadata?.avatar_url || user.user_metadata?.picture || null };
    const { data, error: saveError } = await supabase.from('users').upsert(payload, { onConflict: 'user_id' }).select('user_id, first_name, last_name, birthdate, phone_number, email, gender, username, avatar_url').single();
    if (saveError) setError(saveError.code === '23505' ? 'That username is already taken.' : saveError.message || 'Your profile could not be saved.');
    else { onProfileChanged?.(data); setEditing(false); setNotice('Your profile was saved.'); }
    setSaving(false);
  };
  const birthdayMaxValue = new Date().toISOString().slice(0, 10);
  const field = (label, key, type = 'text') => <div className="setting-row" key={key}><label htmlFor={`profile-${key}`}>{label}</label>{editing ? <input id={`profile-${key}`} type={type} {...(key === 'birthday' ? { max: birthdayMaxValue } : {})} value={values[key]} onChange={event => setValues(current => ({ ...current, [key]: event.target.value }))} disabled={loading || saving} /> : <span>{values[key] || 'Not provided'}</span>}</div>;
  const genderField = <div className="setting-row" key="gender"><label htmlFor="profile-gender">Gender</label>{editing ? <select id="profile-gender" value={values.gender} onChange={event => setValues(current => ({ ...current, gender: event.target.value }))} disabled={loading || saving}><option value="">Prefer not to say</option><option value="M">M</option><option value="F">F</option><option value="other">Other</option></select> : <span>{values.gender || 'Not provided'}</span>}</div>;
  return <main className="page settings-page"><button className="back" onClick={() => navigate('dashboard')}><ArrowLeft size={17}/> Dashboard</button><div className="settings-head"><div><h1>Account settings</h1><p>View and edit your account information.</p></div></div>{loading&&<p role="status">Loading your profile…</p>}{error&&<p className="form-error" role="alert">{error}</p>}{notice&&<div className="save-note" role="status"><Check/> {notice}</div>}<section className="panel settings-form"><div className="settings-panel-head"><h2 className="settings-section-title">Account information</h2>{!editing&&<button className="secondary" disabled={loading || !isSupabaseConfigured} onClick={() => (setError(''), setNotice(''), setEditing(true))}>Edit profile</button>}</div>{field('Username','username')}<div className="setting-row"><label>Email address</label><span>{user.email || 'Not provided'} <small className="email-readonly"> · Not editable here</small></span></div><h2 className="settings-section-title personal-section-title">Personal information</h2><div className="setting-pair">{field('First name','firstName')}{field('Last name','lastName')}</div>{field('Birthday','birthday','date')}{field('Phone number','phoneNumber','tel')}{genderField}{editing&&<div className="settings-actions"><button className="secondary" disabled={saving} onClick={() => setEditing(false)}>Cancel</button><button className="primary" disabled={saving || !isSupabaseConfigured} onClick={save}>{saving?'Saving…':'Save changes'}</button></div>}</section><button className="logout" onClick={logout}><LogOut size={17}/> Log out</button></main>;
}
