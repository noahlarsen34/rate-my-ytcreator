import { useEffect, useState } from 'react';
import { ArrowLeft, Check, LogOut } from 'lucide-react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

export function AccountSettings({ navigate, user, onUsernameChanged }) {
  const metadata = user?.user_metadata || {};
  const metadataName = metadata.full_name || metadata.name || '';
  const [values, setValues] = useState({ firstName: metadata.given_name || metadataName.split(/\s+/)[0] || '', lastName: metadata.family_name || metadataName.split(/\s+/).slice(1).join(' ') || '', birthday: metadata.birthday || '', username: metadata.username || '', gender: '', phoneNumber: '' });
  const [editing, setEditing] = useState(false), [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [notice, setNotice] = useState(''), [error, setError] = useState('');
  const logout = async () => { if (supabase) await supabase.auth.signOut(); navigate('home'); };
  useEffect(() => {
    let active = true;
    async function loadProfile() {
      if (!isSupabaseConfigured) { setError('Supabase is not configured. Profile changes cannot be saved.'); setLoading(false); return; }
      const userResult = await supabase.from('users').select('first_name, last_name, birthdate, username, gender, phone_number, email').eq('user_id', user.id).maybeSingle();
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
    const { error: saveError } = await supabase.from('users').upsert({ user_id: user.id, first_name: values.firstName.trim(), last_name: values.lastName.trim(), birthdate: values.birthday || null, username: savedUsername || null, gender: values.gender || null, phone_number: values.phoneNumber.trim() || null }, { onConflict: 'user_id' });
    if (saveError) setError(saveError.message || 'Your profile could not be saved.');
    else { onUsernameChanged?.(savedUsername); setEditing(false); setNotice('Your profile was saved.'); }
    setSaving(false);
  };
  const birthdayMax = new Date();
  birthdayMax.setFullYear(birthdayMax.getFullYear() - 5);
  const birthdayMaxValue = `${birthdayMax.getFullYear()}-${String(birthdayMax.getMonth() + 1).padStart(2, '0')}-${String(birthdayMax.getDate()).padStart(2, '0')}`;
  const field = (label, key, type = 'text') => <div className="setting-row" key={key}><label htmlFor={`profile-${key}`}>{label}</label>{editing ? <input id={`profile-${key}`} type={type} {...(key === 'birthday' ? { max: birthdayMaxValue } : {})} value={values[key]} onChange={event => setValues(current => ({ ...current, [key]: event.target.value }))} disabled={loading || saving} /> : <span>{values[key] || 'Not provided'}</span>}</div>;
  const genderField = <div className="setting-row" key="gender"><label htmlFor="profile-gender">Gender</label>{editing ? <select id="profile-gender" value={values.gender} onChange={event => setValues(current => ({ ...current, gender: event.target.value }))} disabled={loading || saving}><option value="">Select gender</option><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option><option value="Prefer Not to Say">Prefer Not to Say</option></select> : <span>{values.gender || 'Not provided'}</span>}</div>;
  return <main className="page settings-page"><button className="back" onClick={() => navigate('dashboard')}><ArrowLeft size={17}/> Dashboard</button><div className="settings-head"><div><h1>Account settings</h1><p>View and edit your account information.</p></div></div>{loading&&<p role="status">Loading your profile…</p>}{error&&<p className="form-error" role="alert">{error}</p>}{notice&&<div className="save-note" role="status"><Check/> {notice}</div>}<section className="panel settings-form"><div className="settings-panel-head"><h2 className="settings-section-title">Account information</h2>{!editing&&<button className="secondary" disabled={loading || !isSupabaseConfigured} onClick={() => (setError(''), setNotice(''), setEditing(true))}>Edit profile</button>}</div>{field('Username','username')}<div className="setting-row"><label>Email address</label><span>{user.email || 'Not provided'} <small className="email-readonly"> · Not editable here</small></span></div><h2 className="settings-section-title personal-section-title">Personal information</h2><div className="setting-pair">{field('First name','firstName')}{field('Last name','lastName')}</div>{field('Birthday','birthday','date')}{field('Phone number','phoneNumber','tel')}{genderField}{editing&&<div className="settings-actions"><button className="secondary" disabled={saving} onClick={() => setEditing(false)}>Cancel</button><button className="primary" disabled={saving || !isSupabaseConfigured} onClick={save}>{saving?'Saving…':'Save changes'}</button></div>}</section><button className="logout" onClick={logout}><LogOut size={17}/> Log out</button></main>;
}
