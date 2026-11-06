import { useState } from 'react';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { creators } from '../data/creators';
import { RangeField } from '../components/shared';

export function RateCreator({ navigate, selectedId, submitReview }) {
  const [wordCount,setWordCount]=useState(0), [submitting,setSubmitting]=useState(false), [error,setError]=useState(''), [values,setValues]=useState({truth:'3',profanity:'1',substance:'1'});
  const submit=async e=>{
    e.preventDefault();
    setSubmitting(true);
    setError('');
    const form = new FormData(e.currentTarget);
    const creatorId = form.get('creator');

    try {
      await submitReview({ creatorId, overallRating:Number(values.truth), profanity:Number(values.profanity), substanceUse:Number(values.substance), ageLevel:form.get('ageLevel'), reviewText:form.get('review'), biasText:form.get('bias'), usesAi:form.get('usesAi') });
      navigate('profile', creatorId);
    } catch (submitError) {
      setError(submitError.message || 'Your rating could not be submitted. Please try again.');
      setSubmitting(false);
    }
  };
  return <main className="page rating-page"><button className="back" onClick={()=>navigate(selectedId?'profile':'dashboard',selectedId)}><ArrowLeft size={17}/> Back</button><div className="form-heading"><span className="kicker">SHARE YOUR EXPERIENCE</span><h1>Rate a content creator</h1><p>Be honest, specific, and respectful. All fields are required.</p></div><form className="rating-form" onSubmit={submit}><section className="panel"><h2>About the creator</h2><label>Content creator<select name="creator" required defaultValue={selectedId || ''}><option value="" disabled>Choose a creator</option>{creators.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Your review <span>{wordCount}/150 words</span><textarea name="review" required rows="6" placeholder="What stands out about this creator? What should new viewers know?" onChange={e=>{const words=e.target.value.trim().split(/\s+/).filter(Boolean);if(words.length<=150)setWordCount(words.length);else e.target.value=words.slice(0,150).join(' ')}}/></label><label>Any biases to disclose?<input name="bias" required placeholder="Example: I have followed this creator for 2 years"/></label></section><section className="panel"><h2>Content ratings</h2><RangeField label="Truthfulness" low="Misleading" high="Highly reliable" value={values.truth} set={v=>setValues({...values,truth:v})}/><label>Overall age-appropriateness<select name="ageLevel" required><option value="">Select an age range</option><option value="All ages">All ages</option><option>8+</option><option>13+</option><option>16+</option><option>18+</option></select></label><RangeField label="Profanity" low="None" high="Very frequent" value={values.profanity} set={v=>setValues({...values,profanity:v})}/><RangeField label="Substance use / mention" low="Never" high="Every video" value={values.substance} set={v=>setValues({...values,substance:v})}/><label>Does the creator use AI?<select name="usesAi" required><option value="">Choose one</option><option>Yes</option><option>No</option><option>Unsure</option></select></label></section>{error && <p className="submit-error" role="alert">{error}</p>}<button className="primary submit-rating" disabled={submitting}>{submitting ? 'Submitting…' : <>Submit rating <ChevronRight size={18}/></>}</button></form></main>;
}
