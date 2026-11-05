import { useState } from 'react';
import { Play, UserRound, ChevronRight, LogOut } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { profileDefaults } from '../utils';

export function CompleteProfile({ user, profile, onComplete, onLogout, initialError = '' }) {
  const [values, setValues] = useState(() => profileDefaults(user, profile));
  const [saving, setSaving] = useState(false), [error, setError] = useState(initialError);
  const avatarUrl = profile?.avatar_url || user?.user_metadata?.avatar_url || user?.user_metadata?.picture;
  const maxBirthdate = new Date().toISOString().slice(0, 10);
  const update = (key, value) => setValues(current => ({ ...current, [key]: value }));
  const submit = async event => {
    event.preventDefault();
    setError('');
    if (!event.currentTarget.checkValidity()) {
      setError('Please complete every required field.');
      return;
    }
    setSaving(true);
    const payload = {
      user_id: user.id,
      first_name: values.firstName.trim(),
      last_name: values.lastName.trim(),
      birthdate: values.birthdate,
      username: values.username.trim(),
      phone_number: values.phoneNumber.trim() || null,
      gender: values.gender || null,
      email: user.email,
      avatar_url: avatarUrl || null,
    };
    const { data, error: saveError } = await supabase.from('users').upsert(payload, { onConflict: 'user_id' }).select('user_id, first_name, last_name, birthdate, phone_number, email, gender, username, avatar_url').single();
    if (saveError) {
      if (saveError.code === '23505') setError('That username is already taken. Please choose another one.');
      else setError(saveError.message || 'Your profile could not be saved. Please try again.');
      setSaving(false);
      return;
    }
    onComplete(data);
  };
  return <main className="onboarding-page"><section className="onboarding-card"><button className="brand onboarding-brand" type="button" disabled><span className="brand-mark"><Play fill="white"/></span>Rate My <b>Creator</b></button><div className="onboarding-heading">{avatarUrl ? <img src={avatarUrl} alt="" referrerPolicy="no-referrer"/> : <span className="onboarding-avatar"><UserRound/></span>}<div><span className="kicker">ONE LAST STEP</span><h1>Complete your profile</h1><p>Tell us a little more before you start rating creators.</p></div></div><form className="onboarding-form" onSubmit={submit} noValidate><div className="onboarding-grid"><label>First name<input required autoComplete="given-name" value={values.firstName} onChange={event => update('firstName', event.target.value)} /></label><label>Last name<input required autoComplete="family-name" value={values.lastName} onChange={event => update('lastName', event.target.value)} /></label></div><label>Username<input required minLength="3" maxLength="30" pattern="[A-Za-z0-9_-]+" autoComplete="username" value={values.username} onChange={event => update('username', event.target.value)} /><small>3–30 characters; letters, numbers, underscores, and hyphens.</small></label><label>Birthdate<input required type="date" autoComplete="bday" max={maxBirthdate} value={values.birthdate} onChange={event => update('birthdate', event.target.value)} /></label><label>Email address<input type="email" value={user.email || ''} readOnly/><small>Your sign-in email cannot be changed here.</small></label><div className="onboarding-grid optional"><label>Phone number <span>Optional</span><input type="tel" autoComplete="tel" value={values.phoneNumber} onChange={event => update('phoneNumber', event.target.value)} /></label><label>Gender <span>Optional</span><select value={values.gender} onChange={event => update('gender', event.target.value)}><option value="">Prefer not to say</option><option value="M">M</option><option value="F">F</option><option value="other">Other</option></select></label></div>{error&&<p className="form-error" role="alert">{error}</p>}<button className="primary full" disabled={saving}>{saving ? 'Saving…' : <>Save and continue <ChevronRight size={18}/></>}</button></form><button className="onboarding-logout" type="button" onClick={onLogout}><LogOut size={16}/> Log out</button></section></main>;
}
