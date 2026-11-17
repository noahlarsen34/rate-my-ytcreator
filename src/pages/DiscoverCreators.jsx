import { useEffect, useMemo, useState } from 'react';
import { Search, SlidersHorizontal, UserRound, UsersRound } from 'lucide-react';
import { CreatorCard, SearchBox } from '../components/shared';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

const matchesTopic = (creator, topic) => creator.category === topic
  || `${creator.topic || ''} ${creator.name || ''}`.toLowerCase().includes(topic.toLowerCase());

export function DiscoverCreators({ navigate, query, setQuery, creators, user }) {
  const [selected, setSelected] = useState(['All']);
  const [sortBy, setSortBy] = useState('rating-high');
  const [searchType, setSearchType] = useState('creators');
  const [peopleState, setPeopleState] = useState({ loading: false, people: [], statuses: {}, error: '' });
  const [workingId, setWorkingId] = useState(null);
  const [actionError, setActionError] = useState('');
  const [creatorPickerOpen, setCreatorPickerOpen] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [currentPage, setCurrentPage] = useState(1);
  const categories = useMemo(() => ['All', ...new Set(creators.map(creator => creator.category).filter(Boolean))], [creators]);
  const topics = useMemo(() => categories.filter(topic => topic !== 'All'), [categories]);
  const filtered = useMemo(() => creators
    .filter(creator => (selected.includes('All') || selected.some(topic => matchesTopic(creator, topic)))
      && (`${creator.name} ${creator.topic} ${creator.category}`).toLowerCase().includes(query.toLowerCase()))
    .sort((first, second) => {
      if (sortBy === 'rating-high') return second.score - first.score;
      if (sortBy === 'rating-low') return first.score - second.score;
      const firstCount = Number.isFinite(first.subscriberCount) ? first.subscriberCount : null;
      const secondCount = Number.isFinite(second.subscriberCount) ? second.subscriberCount : null;
      if (firstCount == null && secondCount == null) return first.name.localeCompare(second.name);
      if (firstCount == null) return 1;
      if (secondCount == null) return -1;
      return secondCount - firstCount;
    }), [creators, query, selected, sortBy]);
  const pageSize = 30;
  const pageCount = Math.ceil(filtered.length / pageSize);
  const visibleCreators = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const pageGroupStart = Math.floor((currentPage - 1) / 15) * 15 + 1;
  const pageGroupEnd = Math.min(pageGroupStart + 14, pageCount);
  useEffect(() => { setCurrentPage(1); }, [query, selected, sortBy]);
  const suggestions = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return [];
    return creators.filter(creator => `${creator.name} ${creator.handle || ''} ${creator.topic} ${creator.category}`.toLowerCase().includes(term)).slice(0, 8);
  }, [creators, query]);
  const chooseCreator = creator => {
    setQuery(creator.name);
    setCreatorPickerOpen(false);
    setActiveSuggestionIndex(-1);
  };
  const handleCreatorSearchKeyDown = event => {
    if (searchType !== 'creators' || !creatorPickerOpen || !suggestions.length) {
      if (event.key === 'Escape') setCreatorPickerOpen(false);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveSuggestionIndex(index => (index + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveSuggestionIndex(index => index <= 0 ? suggestions.length - 1 : index - 1);
    } else if (event.key === 'Enter' && activeSuggestionIndex >= 0) {
      event.preventDefault();
      chooseCreator(suggestions[activeSuggestionIndex]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setCreatorPickerOpen(false);
      setActiveSuggestionIndex(-1);
    }
  };
  const toggle = category => setSelected(category === 'All'
    ? ['All']
    : (selected.includes(category)
      ? (selected.filter(item => item !== category).length ? selected.filter(item => item !== category) : ['All'])
      : [...selected.filter(item => item !== 'All'), category]));

  useEffect(() => {
    let active = true;
    const term = query.trim().replace(/^@/, '');
    if (searchType !== 'people' || !user?.id || term.length < 2 || !isSupabaseConfigured) {
      setPeopleState({ loading: false, people: [], statuses: {}, error: '' });
      return () => { active = false; };
    }
    setPeopleState(current => ({ ...current, loading: true, error: '' }));
    Promise.all([
      supabase.rpc('search_people', { p_query: term }),
      supabase.rpc('get_my_user_connections')
    ]).then(([peopleResult, connectionsResult]) => {
      if (!active) return;
      if (peopleResult.error || connectionsResult.error) {
        setPeopleState({ loading: false, people: [], statuses: {}, error: 'People search is temporarily unavailable. Please try again later.' });
        return;
      }
      const statuses = Object.fromEntries((connectionsResult.data || []).map(connection => [
        connection.user_id,
        connection.direction === 'connected' ? 'connected' : connection.direction === 'sent' ? 'request_sent' : 'request_received'
      ]));
      setPeopleState({ loading: false, people: peopleResult.data || [], statuses, error: '' });
    }).catch(() => {
      if (active) setPeopleState({ loading: false, people: [], statuses: {}, error: 'People search is temporarily unavailable. Please try again later.' });
    });
    return () => { active = false; };
  }, [query, searchType, user?.id]);

  const updateConnection = async person => {
    if (!user) { navigate('login'); return; }
    if (workingId) return;
    const status = peopleState.statuses[person.user_id] || 'available';
    if (status === 'connected') return;
    setWorkingId(person.user_id);
    setActionError('');
    const result = status === 'request_received'
      ? await supabase.rpc('respond_user_connection_request', { p_requester_id: person.user_id, p_accept: true })
      : status === 'request_sent'
        ? await supabase.rpc('cancel_user_connection_request', { p_recipient_id: person.user_id })
        : await supabase.rpc('send_user_connection_request', { p_recipient_id: person.user_id });
    setWorkingId(null);
    if (result.error) { setActionError('Your connection request could not be updated. Please try again.'); return; }
    const nextStatus = status === 'request_received' ? 'connected' : status === 'request_sent' ? 'available' : 'request_sent';
    setPeopleState(current => ({ ...current, statuses: { ...current.statuses, [person.user_id]: nextStatus } }));
  };

  const peopleDescription = !user
    ? 'Log in to search for people and send connection requests.'
    : query.trim().length < 2
      ? 'Enter at least 2 characters to search usernames.'
      : '';

  return <main className={`page discover-page ${searchType === 'people' ? 'people-mode' : ''}`}>
    <div className="page-heading">
      <span className="kicker">DISCOVER</span>
      <h1>{searchType === 'creators' ? 'Find your next favorite creator' : 'Find people you know'}</h1>
      <p>{searchType === 'creators' ? 'Explore honest community ratings across every kind of content.' : 'Search by username and send a connection request.'}</p>
    </div>
    <div className="discover-search-wrap" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setCreatorPickerOpen(false); }}>
      <SearchBox compact={searchType === 'people'} value={query} setValue={value => { setQuery(value); setCreatorPickerOpen(true); setActiveSuggestionIndex(-1); }} onKeyDown={handleCreatorSearchKeyDown} combobox={searchType === 'creators'} expanded={searchType === 'creators' && creatorPickerOpen && suggestions.length > 0} controls="discover-creator-suggestions" activeDescendant={activeSuggestionIndex >= 0 ? `discover-creator-suggestion-${activeSuggestionIndex}` : undefined} placeholder={searchType === 'creators' ? 'Search creators or users' : 'Search usernames'} ariaLabel={searchType === 'creators' ? 'Search creators or users' : 'Search people'} />
      {searchType === 'creators' && creatorPickerOpen && suggestions.length > 0 && <div className="discover-creator-suggestions" id="discover-creator-suggestions" role="listbox" aria-label="Creator suggestions">
        {suggestions.map((creator, index) => <button type="button" role="option" id={`discover-creator-suggestion-${index}`} aria-selected={index === activeSuggestionIndex} key={creator.id} onMouseDown={event => event.preventDefault()} onMouseEnter={() => setActiveSuggestionIndex(index)} onClick={() => chooseCreator(creator)}>
          <span className="creator-suggestion-avatar">{creator.initials}</span><span><b>{creator.name}</b><small>{creator.handle} · {creator.topic}</small></span>
        </button>)}
      </div>}
    </div>
    <div className="discover-search-tabs" role="tablist" aria-label="Search type">
      <button type="button" role="tab" aria-selected={searchType === 'creators'} className={searchType === 'creators' ? 'active' : ''} onClick={() => setSearchType('creators')}><Search size={16}/> Creators</button>
      <button type="button" role="tab" aria-selected={searchType === 'people'} className={searchType === 'people' ? 'active' : ''} onClick={() => setSearchType('people')}><UsersRound size={16}/> People</button>
    </div>
    {searchType === 'creators' ? <div className="browse-layout">
      <aside className="filters"><div className="filter-title"><SlidersHorizontal size={18} /> Filter by topic</div><label><input type="checkbox" checked={selected.includes('All')} onChange={() => toggle('All')} /><span>All</span><small>{creators.length}</small></label>{topics.map(topic => <label key={topic}><input type="checkbox" checked={selected.includes(topic)} onChange={() => toggle(topic)} /><span>{topic}</span><small>{creators.filter(creator => matchesTopic(creator, topic)).length}</small></label>)}</aside>
      <section className="results"><div className="results-head"><b>{filtered.length} creators</b><label>Sort by <select value={sortBy} onChange={event => setSortBy(event.target.value)} aria-label="Sort creators"><option value="rating-high">Most positively reviewed</option><option value="rating-low">Most negatively reviewed</option><option value="subscribers-high">Most subscribed</option><option value="subscribers-low">Least subscribed</option></select></label></div>{filtered.length ? <>{visibleCreators.map(creator => <CreatorCard key={creator.id} creator={creator} navigate={navigate} wide />)}{pageCount > 1 && <nav className="creator-pagination" aria-label="Creator result pages">{pageGroupStart > 1 && <button type="button" aria-label={`Previous page group, pages ${pageGroupStart - 15} to ${pageGroupStart - 1}`} onClick={() => { setCurrentPage(pageGroupStart - 1); document.querySelector('.results')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>‹</button>}{Array.from({ length: pageGroupEnd - pageGroupStart + 1 }, (_, index) => pageGroupStart + index).map(page => <button type="button" key={page} className={page === currentPage ? 'active' : ''} aria-current={page === currentPage ? 'page' : undefined} onClick={() => { setCurrentPage(page); document.querySelector('.results')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>{page}</button>)}{pageGroupEnd < pageCount && <button type="button" aria-label={`Next page group, starting at page ${pageGroupEnd + 1}`} onClick={() => { setCurrentPage(pageGroupEnd + 1); document.querySelector('.results')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>{pageGroupEnd + 1}+</button>}</nav>}</> : <div className="empty"><Search size={36}/><h3>No creators found</h3><p>Try another name, topic, or remove a filter.</p><button className="secondary" onClick={() => {setQuery('');setSelected(['All']);}}>Clear search</button></div>}</section>
    </div> : <section className="people-results" aria-live="polite">
      {peopleDescription ? <div className="empty"><UserRound size={36}/><h3>{user ? 'Search for a username' : 'Log in to find people'}</h3><p>{peopleDescription}</p>{!user&&<button className="primary" onClick={() => navigate('login')}>Log in</button>}</div>
        : peopleState.loading ? <p className="people-search-status" role="status">Searching people…</p>
          : peopleState.error ? <div className="empty" role="alert"><h3>People search unavailable</h3><p>{peopleState.error}</p></div>
            : peopleState.people.length ? <><div className="results-head"><b>{peopleState.people.length} people</b><span>Searchable profiles</span></div>{actionError&&<p className="form-error" role="alert">{actionError}</p>}{peopleState.people.map(person => {
              const status = peopleState.statuses[person.user_id] || 'available';
              const label = status === 'connected' ? 'Connected' : status === 'request_sent' ? 'Request sent' : status === 'request_received' ? 'Accept request' : 'Connect';
              return <article className="person-result" key={person.user_id}>
                <button type="button" className="person-result-profile" onClick={() => navigate('user-profile', person.user_id)}>
                  <span className="person-result-avatar">{person.avatar_url ? <img src={person.avatar_url} alt="" referrerPolicy="no-referrer"/> : <UserRound size={21}/>}</span>
                  <span><b>@{person.username}</b><small>Rate My Creator member</small></span>
                </button>
                <div className="person-result-actions">
                  {status === 'request_received'&&<button type="button" className="text-button" disabled={workingId === person.user_id} onClick={async () => {
                    setWorkingId(person.user_id); setActionError('');
                    const { error } = await supabase.rpc('respond_user_connection_request', { p_requester_id: person.user_id, p_accept: false });
                    setWorkingId(null);
                    if (error) setActionError('This request could not be declined. Please try again.');
                    else setPeopleState(current => ({ ...current, statuses: { ...current.statuses, [person.user_id]: 'available' } }));
                  }}>Decline</button>}
                  <button type="button" className={status === 'available' || status === 'request_received' ? 'primary small' : 'secondary'} disabled={workingId === person.user_id || status === 'connected'} onClick={() => updateConnection(person)}>{workingId === person.user_id ? 'Please wait…' : label}</button>
                </div>
              </article>;
            })}</>
              : <div className="empty"><UsersRound size={36}/><h3>No people found</h3><p>Try another username. Only accounts that appear in People search are listed.</p></div>}
    </section>}
  </main>;
}
