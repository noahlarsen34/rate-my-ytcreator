import { useState } from 'react';
import { Play, ArrowLeft, ShieldCheck, Eye, EyeOff, ChevronRight } from 'lucide-react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

function GoogleIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.06H12v3.9h5.38a4.6 4.6 0 0 1-2 3.02v2.53h3.24c1.9-1.75 2.98-4.33 2.98-7.39Z"/><path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.62-2.38l-3.24-2.53c-.9.6-2.05.96-3.38.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.61A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.39 13.92A6.02 6.02 0 0 1 6.08 12c0-.67.11-1.32.31-1.92V7.47H3.04A10 10 0 0 0 2 12c0 1.61.39 3.14 1.04 4.53l3.35-2.61Z"/><path fill="#EA4335" d="M12 5.95c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.63 9.63 0 0 0 12 2a10 10 0 0 0-8.96 5.47l3.35 2.61C7.18 7.71 9.39 5.95 12 5.95Z"/></svg>;
}

export function AccountSignIn({ type, navigate, requiresAuth = false }) {
  const signup = type === 'signup';
  const [show, setShow] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState(''), [submitting, setSubmitting] = useState(false);
  const signInWithGoogle = async () => {
    setError(''); setNotice('');
    if (!isSupabaseConfigured) { setError('Supabase is not configured. Add the project variables and restart the app.'); return; }
    setSubmitting(true);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({ provider:'google', options:{ redirectTo:`${window.location.origin}/?auth=callback` } });
    if (oauthError) { setError(oauthError.message); setSubmitting(false); }
  };
  const submit = async e => {
    e.preventDefault(); setError(''); setNotice('');
    if (!e.currentTarget.checkValidity()) { setError('Please complete every required field.'); return; }
    if (!isSupabaseConfigured) { setError('Supabase is not configured. Add the project variables and restart the app.'); return; }
    setSubmitting(true);
    const form = new FormData(e.currentTarget), email = form.get('email'), password = form.get('password');
    if (signup && password !== form.get('confirmPassword')) { setError('Passwords do not match.'); setSubmitting(false); return; }
    if (signup) {
      const { data, error: signupError } = await supabase.auth.signUp({ email, password, options:{ emailRedirectTo:`${window.location.origin}/?auth=callback`, data:{ username:form.get('username').trim() } } });
      if (signupError) setError(signupError.message);
      else if (!data.session) setNotice('Check your email to confirm your account, then return here to log in. If no email arrives, this address may already be linked to an account; try Continue with Google or log in with your existing method.');
      // SIGNED_IN is handled centrally so guarded navigation can resume.
    } else {
      const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
      if (loginError) setError(loginError.message);
    }
    setSubmitting(false);
  };
  return <main className="auth-page"><section className="auth-side"><button className="brand light" onClick={() => navigate('home')}><span className="brand-mark"><Play fill="white"/></span>Rate My <b>Creator</b></button><div><span className="kicker">JOIN THE COMMUNITY</span><h1>Your opinion helps shape the feed.</h1><p>Rate creators, save your favorites, and help people choose better content.</p></div><div className="auth-quote">“Finally, one place to see whether a channel is actually worth my time.”<span>— Community member</span></div></section><section className="auth-form"><div className="form-wrap"><button className="back" onClick={() => navigate('home')}><ArrowLeft size={17}/> Back home</button><h2>{signup ? 'Create your account' : 'Welcome back'}</h2><p>{requiresAuth ? 'Log in to continue where you left off.' : signup ? 'Start rating creators in just a minute.' : 'Log in to continue to your dashboard.'}</p>{requiresAuth&&<p className="auth-required" role="status"><ShieldCheck size={17}/> You need an account to access that page.</p>}<button type="button" className="google-button" onClick={signInWithGoogle} disabled={submitting}><GoogleIcon/> Continue with Google</button><div className="auth-divider"><span>or continue with email</span></div><form onSubmit={submit} noValidate><label>Email address<input name="email" required type="email" autoComplete="email" placeholder="alex@example.com"/></label>{signup && <label>Username<input name="username" required autoComplete="username" placeholder="alexreviews"/></label>}<label>Password<div className="password"><input name="password" required minLength={signup ? 8 : undefined} type={show?'text':'password'} autoComplete={signup?'new-password':'current-password'} placeholder="At least 8 characters"/><button type="button" onClick={() => setShow(!show)} aria-label={show?'Hide password':'Show password'}>{show?<EyeOff/>:<Eye/>}</button></div></label>{signup && <label>Confirm password<input name="confirmPassword" required minLength="8" type={show?'text':'password'} autoComplete="new-password" placeholder="Re-enter your password"/></label>}{error&&<p className="form-error" role="alert">{error}</p>}{notice&&<p className="form-notice" role="status">{notice}</p>}<button className="primary full" disabled={submitting}>{submitting?'Please wait…':signup?'Create account':'Log in'} {!submitting&&<ChevronRight size={18}/>}</button></form><p className="switch">{signup?'Already have an account?':'New here?'} <button onClick={() => navigate(signup?'login':'signup')}>{signup?'Log in':'Create an account'}</button></p></div></section></main>;
}
