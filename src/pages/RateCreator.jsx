import { useMemo, useRef, useState } from 'react';
import { ArrowLeft, ChevronRight, Search, Star } from 'lucide-react';
import { RangeField } from '../components/shared';

export function RateCreator({ navigate, selectedId, submitReview, creators }) {
  const selectedCreator = creators.find(creator => creator.id === selectedId);
  const [selectedCreatorId, setSelectedCreatorId] = useState(selectedCreator?.id || '');
  const [creatorQuery, setCreatorQuery] = useState(selectedCreator?.name || '');
  const [creatorPickerOpen, setCreatorPickerOpen] = useState(false);
  const [overallRating, setOverallRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [wordCount, setWordCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [values, setValues] = useState({ profanity: '1', substance: '1' });
  const creatorSearchRef = useRef(null);
  const filteredCreators = useMemo(() => {
    const search = creatorQuery.trim().toLowerCase();
    return creators.filter(creator => !search || `${creator.name} ${creator.handle} ${creator.topic}`.toLowerCase().includes(search));
  }, [creatorQuery, creators]);

  const submit = async event => {
    event.preventDefault();
    if (!selectedCreatorId) {
      setError('Search for and select a creator before submitting.');
      creatorSearchRef.current?.focus();
      setCreatorPickerOpen(true);
      return;
    }
    if (!overallRating) {
      setError('Choose a star rating before submitting.');
      return;
    }

    setSubmitting(true);
    setError('');
    const form = new FormData(event.currentTarget);

    try {
      await submitReview({
        creatorId: selectedCreatorId,
        overallRating,
        profanity: Number(values.profanity),
        substanceUse: Number(values.substance),
        ageLevel: form.get('ageLevel'),
        reviewText: form.get('review'),
        biasText: form.get('bias') || '',
        usesAi: form.get('usesAi')
      });
      navigate('profile', selectedCreatorId);
    } catch (submitError) {
      setError(submitError.message || 'Your rating could not be submitted. Please try again.');
      setSubmitting(false);
    }
  };

  const chooseCreator = creator => {
    setSelectedCreatorId(creator.id);
    setCreatorQuery(creator.name);
    setCreatorPickerOpen(false);
    setError('');
  };

  return <main className="page rating-page">
    <button className="back" onClick={() => navigate(selectedId ? 'profile' : 'dashboard', selectedId)}><ArrowLeft size={17}/> Back</button>
    <div className="form-heading">
      <span className="kicker">SHARE YOUR EXPERIENCE</span>
      <h1>Rate a content creator</h1>
      <p>Share an honest, specific review to help viewers decide what to watch.</p>
    </div>

    <form className="rating-form" onSubmit={submit}>
      <section className="panel review-basics">
        <label className="creator-search-label" htmlFor="creator-search">Content creator</label>
        <div className="creator-search">
          <Search size={19} aria-hidden="true" />
          <input
            ref={creatorSearchRef}
            id="creator-search"
            type="search"
            value={creatorQuery}
            placeholder="Search creators by name or topic"
            autoComplete="off"
            role="combobox"
            aria-autocomplete="list"
            aria-haspopup="listbox"
            aria-expanded={creatorPickerOpen && filteredCreators.length > 0}
            aria-label="Search for a content creator"
            aria-controls="creator-search-results"
            onFocus={() => setCreatorPickerOpen(true)}
            onBlur={() => setCreatorPickerOpen(false)}
            onChange={event => {
              setCreatorQuery(event.target.value);
              setSelectedCreatorId('');
              setCreatorPickerOpen(true);
              setError('');
            }}
            onKeyDown={event => {
              if (event.key === 'Escape') setCreatorPickerOpen(false);
              if (event.key === 'Enter' && creatorPickerOpen && filteredCreators.length) {
                event.preventDefault();
                chooseCreator(filteredCreators[0]);
              }
            }}
          />
          {creatorPickerOpen && <div className="creator-search-results" id="creator-search-results" role="listbox" aria-label="Creator search results">
            {filteredCreators.length ? filteredCreators.slice(0, 8).map(creator => <button type="button" role="option" aria-selected={creator.id === selectedCreatorId} key={creator.id} onMouseDown={event => event.preventDefault()} onClick={() => chooseCreator(creator)}>
              <span className="creator-search-avatar">{creator.initials}</span>
              <span><b>{creator.name}</b><small>{creator.handle} · {creator.topic}</small></span>
            </button>) : <p>No creators match that search.</p>}
          </div>}
        </div>
        {selectedCreatorId && <p className="selected-creator">Reviewing: <b>{creators.find(creator => creator.id === selectedCreatorId)?.name}</b></p>}

        <div className="overall-rating" role="group" aria-label="Overall creator rating">
          <div><h2>Your overall rating</h2><p>How would you rate this creator overall?</p></div>
          <div className="star-rating" onMouseLeave={() => setHoveredRating(0)}>
            {[1, 2, 3, 4, 5].map(star => {
              const displayedRating = hoveredRating || overallRating;
              const fillPercent = displayedRating >= star ? 100 : displayedRating >= star - 0.5 ? 50 : 0;
              return <button
                type="button"
                key={star}
                aria-label={`${star - 0.5} or ${star} stars; click the left half for ${star - 0.5}, right half for ${star}`}
                aria-pressed={overallRating === star || overallRating === star - 0.5}
                className={`star-rating-star ${fillPercent ? 'active' : ''}`}
                onMouseMove={event => {
                  const bounds = event.currentTarget.getBoundingClientRect();
                  setHoveredRating(event.clientX - bounds.left < bounds.width / 2 ? star - 0.5 : star);
                }}
                onFocus={() => setHoveredRating(overallRating || star)}
                onBlur={() => setHoveredRating(0)}
                onClick={event => {
                  const bounds = event.currentTarget.getBoundingClientRect();
                  const value = event.detail === 0 || event.clientX - bounds.left >= bounds.width / 2 ? star : star - 0.5;
                  setOverallRating(value);
                  setError('');
                }}
              >
                <Star className="star-outline" size={38} />
                <Star className="star-fill" size={38} fill="currentColor" style={{ clipPath: `inset(0 ${100 - fillPercent}% 0 0)` }} />
              </button>;
            })}
          </div>
          <span className="star-rating-value" aria-live="polite">{overallRating ? `${overallRating} out of 5 stars` : 'Select a rating'}</span>
        </div>
      </section>

      <section className="panel">
        <h2>Your review</h2>
        <label className="review-text-label"><span className="field-label">What should new viewers know?</span><span className="word-count">{wordCount}/150 words</span>
          <textarea name="review" required rows="6" placeholder="What stands out about this creator? Share a specific example or experience." onChange={event => {
            const words = event.target.value.trim().split(/\s+/).filter(Boolean);
            if (words.length <= 150) setWordCount(words.length);
            else {
              event.target.value = words.slice(0, 150).join(' ');
              setWordCount(150);
            }
          }}/>
        </label>
        <label className="bias-question">Any recurring sponsors or viewpoints viewers should know about?
          <small>For example, repeated brand sponsorships or a consistent ideological perspective. Leave blank if nothing stands out.</small>
          <textarea name="bias" rows="3" placeholder="Share any patterns you have noticed (optional)" />
        </label>
      </section>

      <section className="panel">
        <h2>Content details</h2>
        <label>Overall age-appropriateness<select name="ageLevel" required defaultValue=""><option value="" disabled>Select an age range</option><option value="All ages">All ages</option><option>8+</option><option>13+</option><option>16+</option><option>18+</option></select></label>
        <RangeField label="Profanity" low="None" high="Very frequent" value={values.profanity} set={value => setValues(current => ({ ...current, profanity: value }))}/>
        <div className="rating-range-field">
          <RangeField label="How often does the content show or discuss alcohol, drugs, or vaping?" low="Never" high="Very often" value={values.substance} set={value => setValues(current => ({ ...current, substance: value }))}/>
          <p className="field-help">Count videos that show or talk about these substances.</p>
        </div>
        <label>Does the creator use AI?<select name="usesAi" required defaultValue=""><option value="" disabled>Choose one</option><option>Yes</option><option>No</option><option>Unsure</option></select></label>
      </section>

      {error && <p className="submit-error" role="alert">{error}</p>}
      <button className="primary submit-rating" disabled={submitting || creators.length === 0}>{submitting ? 'Submitting...' : <>Submit review <ChevronRight size={18}/></>}</button>
    </form>
  </main>;
}
