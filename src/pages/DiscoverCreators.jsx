import { useEffect, useMemo, useState } from 'react';
import { Search, SlidersHorizontal, UserRound, UsersRound, Check, X, RefreshCw } from 'lucide-react';
import { CreatorCard, SearchBox } from '../components/shared';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { recordUserSearch } from '../lib/searchHistory';

const matchesTopic = (creator, topic) => creator.category === topic
  || `${creator.topic || ''} ${creator.name || ''}`.toLowerCase().includes(topic.toLowerCase());

export function DiscoverCreators({ navigate, query, setQuery, creators, user, initialSearchType = 'creators' }) {
  const [selected, setSelected] = useState(['All']);
  const [sortBy, setSortBy] = useState('rating-high');
  const [searchType, setSearchType] = useState(initialSearchType);
  const [peopleState, setPeopleState] = useState({ loading: false, people: [], statuses: {}, error: '' });
  const [recentSearches, setRecentSearches] = useState([]);
  const [recentSearchesOpen, setRecentSearchesOpen] = useState(false);
  const [workingId, setWorkingId] = useState(null);
  const [actionError, setActionError] = useState('');
  const [familyConnections, setFamilyConnections] = useState({ loading: false, items: [], error: '', workingId: null });
  const [creatorPickerOpen, setCreatorPickerOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const categories = useMemo(() => ['All', ...new Set(creators.map(creator => creator.category))], [creators]);
  const topics = useMemo(() => [...new Set([
    ...creators.map(creator => creator.category),
    'Gaming', 'Music', 'Vlog', 'Comedy', 'Educational'
  ])], [creators]);
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
      const metricSorts = {
        'substance-high': ['substance', -1], 'substance-low': ['substance', 1],
        'profanity-high': ['profanity', -1], 'profanity-low': ['profanity', 1],
        'reviews-high': ['reviews', -1], 'reviews-low': ['reviews', 1]
      };
      if (metricSorts[sortBy]) {
        const [metric, direction] = metricSorts[sortBy];
        const a = Number.isFinite(first[metric]) ? first[metric] : null;
        const b = Number.isFinite(second[metric]) ? second[metric] : null;
        if (a == null && b != null) return 1;
        if (b == null && a != null) return -1;
        if (a !== b) return (a - b) * direction;
      }
      if (sortBy === 'age-youngest' || sortBy === 'age-oldest') {
        const ages = ['All ages', 'Under 8', '8+', '13+', '16+', '18+'];
        const a = ages.indexOf(first.audience), b = ages.indexOf(second.audience);
        if (a < 0 && b >= 0) return 1;
        if (b < 0 && a >= 0) return -1;
        if (a !== b) return (a - b) * (sortBy === 'age-youngest' ? 1 : -1);
      }
      if (sortBy === 'ai-yes' || sortBy === 'ai-no') {
        const preferred = sortBy === 'ai-yes' ? 'Yes' : 'No';
        if ((first.ai === preferred) !== (second.ai === preferred)) return first.ai === preferred ? -1 : 1;
      }
      const firstCount = Number.isFinite(first.subscriberCount) ? first.subscriberCount : null;
      const secondCount = Number.isFinite(second.subscriberCount) ? second.subscriberCount : null;
      if (firstCount == null && secondCount == null) return first.name.localeCompare(second.name);
      if (firstCount == null) return 1;
      if (secondCount == null) return -1;
      return sortBy === 'subscribers-low' ? firstCount - secondCount : secondCount - firstCount;
    }), [creators, query, selected, sortBy]);
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
    void recordUserSearch(creator.name);
    setQuery(creator.name);
    setCreatorPickerOpen(false);
    setActiveSuggestionIndex(-1);
  };
  const openRecentSearches = async () => {
    if (searchType !== 'creators' || !user?.id || !isSupabaseConfigured) return;
    setRecentSearchesOpen(true);
    const { data, error } = await supabase.from('user_search_history').select('search').order('searched_at', { ascending: false }).limit(3);
    if (!error) setRecentSearches((data || []).map(row => row.search).filter(Boolean));
  };
  const selectRecentSearch = search => {
    setRecentSearchesOpen(false);
    setCreatorPickerOpen(false);
    void recordUserSearch(search);
    setQuery(search);
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

  useEffect(() => {
    let active = true;
    if (searchType !== 'people' || !user?.id || !isSupabaseConfigured) {
      setFamilyConnections({ loading: false, items: [], error: '', workingId: null });
      return () => { active = false; };
    }
    setFamilyConnections(current => ({ ...current, loading: true, error: '' }));
    supabase.rpc('get_my_user_connections').then(({ data, error }) => {
      if (!active) return;
      setFamilyConnections({ loading: false, items: error ? [] : data || [], error: error ? 'Your connections could not be loaded.' : '', workingId: null });
    }).catch(() => {
      if (active) setFamilyConnections({ loading: false, items: [], error: 'Your connections could not be loaded.', workingId: null });
    });
    return () => { active = false; };
  }, [searchType, user?.id]);

  const updateFamilyConnection = async (connection, action) => {
    if (familyConnections.workingId) return;
    setFamilyConnections(current => ({ ...current, workingId: connection.user_id, error: '' }));
    const result = connection.direction === 'received'
      ? await supabase.rpc('respond_user_connection_request', { p_requester_id: connection.user_id, p_accept: action === 'accept' })
      : await supabase.rpc('cancel_user_connection_request', { p_recipient_id: connection.user_id });
    if (result.error) {
      setFamilyConnections(current => ({ ...current, workingId: null, error: 'That connection request could not be updated. Please try again.' }));
      return;
    }
    setFamilyConnections(current => ({ ...current, workingId: null, items: current.items.filter(item => item.user_id !== connection.user_id || (action === 'accept' && item.direction === 'received')).map(item => item.user_id === connection.user_id ? { ...item, direction: 'connected', status: 'accepted' } : item) }));
    setPeopleState(current => ({ ...current, statuses: { ...current.statuses, [connection.user_id]: action === 'accept' ? 'connected' : 'available' } }));
  };

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
    const { data: connectionItems, error: connectionError } = await supabase.rpc('get_my_user_connections');
    if (!connectionError) setFamilyConnections(current => ({ ...current, items: connectionItems || [] }));
  };

  const peopleDescription = !user
    ? 'Log in to search for people and send connection requests.'
    : query.trim().length < 2
      ? 'Enter at least 2 characters to search usernames.'
      : '';

  return <main className={`page discover-page ${searchType === 'people' ? 'people-mode' : ''}`}>
    <div className="page-heading">
      <span className="kicker">DISCOVER</span>
      <h1>{searchType === 'creators' ? 'Check a creator before you watch' : 'Connect with family and friends'}</h1>
      <p>{searchType === 'creators' ? 'Explore community ratings and content insights to make informed viewing choices.' : 'Parents and teens can connect to share creator subscriptions and review them together.'}</p>
    </div>
    <div className="discover-search-wrap" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) { setCreatorPickerOpen(false); setRecentSearchesOpen(false); } }}>
      <SearchBox compact={searchType === 'people'} value={query} setValue={value => { setQuery(value); setCreatorPickerOpen(true); setActiveSuggestionIndex(-1); setRecentSearchesOpen(false); }} onFocus={openRecentSearches} onSubmit={() => { setRecentSearchesOpen(false); void recordUserSearch(query); setCreatorPickerOpen(false); }} onKeyDown={handleCreatorSearchKeyDown} combobox={searchType === 'creators'} expanded={searchType === 'creators' && creatorPickerOpen && suggestions.length > 0} controls="discover-creator-suggestions" activeDescendant={activeSuggestionIndex >= 0 ? `discover-creator-suggestion-${activeSuggestionIndex}` : undefined} placeholder={searchType === 'creators' ? 'Search content creators' : 'Search usernames'} ariaLabel={searchType === 'creators' ? 'Search content creators' : 'Search people'} />
      {searchType === 'creators' && recentSearchesOpen && !query.trim() && recentSearches.length > 0 && <div className="recent-searches-dropdown" role="listbox" aria-label="Recent searches"><span className="recent-searches-heading">Recent searches</span>{recentSearches.map((search, index) => <button type="button" role="option" key={`${search}-${index}`} onMouseDown={event => event.preventDefault()} onClick={() => selectRecentSearch(search)}><Search size={15}/><span>{search}</span></button>)}</div>}
      {searchType === 'creators' && creatorPickerOpen && suggestions.length > 0 && <div className="discover-creator-suggestions" id="discover-creator-suggestions" role="listbox" aria-label="Creator suggestions">
        {suggestions.map((creator, index) => <button type="button" role="option" id={`discover-creator-suggestion-${index}`} aria-selected={index === activeSuggestionIndex} key={creator.id} onMouseDown={event => event.preventDefault()} onMouseEnter={() => setActiveSuggestionIndex(index)} onClick={() => chooseCreator(creator)}>
          <span className="creator-suggestion-avatar">{creator.initials}</span><span><b>{creator.name}</b><small>{creator.handle} · {creator.topic}</small></span>
        </button>)}
      </div>}
    </div>
    {searchType === 'creators' ? <div className="browse-layout">
      <section className="results"><div className="results-head"><b>{filtered.length} creators</b><button type="button" className="secondary" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(open => !open)}><SlidersHorizontal size={16}/> Filters{selected.filter(topic => topic !== 'All').length + (sortBy !== 'rating-high' ? 1 : 0) > 0 ? ` (${selected.filter(topic => topic !== 'All').length + (sortBy !== 'rating-high' ? 1 : 0)})` : ''}</button></div>{filtersOpen&&<div className="panel discover-filter-panel"><div className="panel-head"><h2><SlidersHorizontal size={18}/> Find creators by</h2><button type="button" className="text-button" onClick={() => {setSelected(['All']);setSortBy('rating-high');}}>Reset</button></div><label>Sort by<select value={sortBy} onChange={event => setSortBy(event.target.value)}><option value="rating-high">Most positively reviewed</option><option value="rating-low">Most negatively reviewed</option><option value="substance-high">Most substance use reported</option><option value="substance-low">Least substance use reported</option><option value="profanity-high">Most profanity reported</option><option value="profanity-low">Least profanity reported</option><option value="age-youngest">Youngest age rating</option><option value="age-oldest">Oldest age rating</option><option value="ai-yes">AI use reported: Yes</option><option value="ai-no">AI use reported: No</option><option value="reviews-high">Most reviews</option><option value="reviews-low">Fewest reviews</option><option value="subscribers-high">Most subscribed</option><option value="subscribers-low">Least subscribed</option></select></label><div className="discover-filter-topics"><b>Topics</b><label><input type="checkbox" checked={selected.includes('All')} onChange={() => toggle('All')}/> All topics</label>{topics.map(topic=><label key={topic}><input type="checkbox" checked={selected.includes(topic)} onChange={()=>toggle(topic)}/> {topic}</label>)}</div><small>Review filters rank creators by community review averages and reported answers.</small></div>}{filtered.length ? filtered.map(creator => <CreatorCard key={creator.id} creator={creator} navigate={navigate} wide />) : <div className="empty"><Search size={36}/><h3>No creators found</h3><p>Try another name, topic, or remove a filter.</p><button className="secondary" onClick={() => {setQuery('');setSelected(['All']);}}>Clear search</button></div>}</section>
      <aside className="filters"><div className="filter-title"><SlidersHorizontal size={18} /> Filter by topic</div><label><input type="checkbox" checked={selected.includes('All')} onChange={() => toggle('All')} /><span>All</span><small>{creators.length}</small></label>{topics.map(topic => <label key={topic}><input type="checkbox" checked={selected.includes(topic)} onChange={() => toggle(topic)} /><span>{topic}</span><small>{creators.filter(creator => matchesTopic(creator, topic)).length}</small></label>)}</aside>
      <section className="results"><div className="results-head"><b>{filtered.length} creators</b><label>Sort by <select value={sortBy} onChange={event => setSortBy(event.target.value)} aria-label="Sort creators"><option value="rating-high">Most positively reviewed</option><option value="rating-low">Most negatively reviewed</option><option value="substance-high">Most substance use reported</option><option value="substance-low">Least substance use reported</option><option value="profanity-high">Most profanity reported</option><option value="profanity-low">Least profanity reported</option><option value="age-youngest">Youngest age rating</option><option value="age-oldest">Oldest age rating</option><option value="ai-yes">AI use: Yes</option><option value="ai-no">AI use: No</option><option value="reviews-high">Most reviews</option><option value="reviews-low">Fewest reviews</option><option value="subscribers-high">Most subscribed</option><option value="subscribers-low">Least subscribed</option></select></label></div>{filtered.length ? <>{visibleCreators.map(creator => <CreatorCard key={creator.id} creator={creator} navigate={navigate} wide />)}{pageCount > 1 && <nav className="creator-pagination" aria-label="Creator result pages">{pageGroupStart > 1 && <button type="button" aria-label={`Previous page group, pages ${pageGroupStart - 15} to ${pageGroupStart - 1}`} onClick={() => { setCurrentPage(pageGroupStart - 1); document.querySelector('.results')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>‹</button>}{Array.from({ length: pageGroupEnd - pageGroupStart + 1 }, (_, index) => pageGroupStart + index).map(page => <button type="button" key={page} className={page === currentPage ? 'active' : ''} aria-current={page === currentPage ? 'page' : undefined} onClick={() => { setCurrentPage(page); document.querySelector('.results')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>{page}</button>)}{pageGroupEnd < pageCount && <button type="button" aria-label={`Next page group, starting at page ${pageGroupEnd + 1}`} onClick={() => { setCurrentPage(pageGroupEnd + 1); document.querySelector('.results')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>{pageGroupEnd + 1}+</button>}</nav>}</> : <div className="empty"><Search size={36}/><h3>No creators found</h3><p>Try another name, topic, or remove a filter.</p><button className="secondary" onClick={() => {setQuery('');setSelected(['All']);}}>Clear search</button></div>}</section>
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
    {searchType === 'people'&&<section className="panel family-connections-panel"><div className="panel-head"><h2><UsersRound size={19}/> Your connections and requests</h2>{user&&<button type="button" className="text-button" onClick={() => { setFamilyConnections(current => ({ ...current, loading: true })); supabase.rpc('get_my_user_connections').then(({ data, error }) => setFamilyConnections({ loading: false, items: data || [], error: error ? 'Your connections could not be loaded.' : '', workingId: null })); }} disabled={familyConnections.loading}><RefreshCw size={15} className={familyConnections.loading ? 'spin' : ''}/> Refresh</button>}</div>
      {!user ? <p className="dashboard-empty">Log in to see your connections and requests.</p>
        : familyConnections.loading ? <p className="dashboard-empty" role="status">Loading connections…</p>
          : familyConnections.error ? <p className="dashboard-empty" role="alert">{familyConnections.error}</p>
            : familyConnections.items.length ? <div className="family-connection-list">{familyConnections.items.map(connection => <div className="family-connection-row" key={connection.user_id}>
              <button type="button" className="person-result-profile" onClick={() => navigate('user-profile', connection.user_id)}><span className="person-result-avatar">{connection.avatar_url ? <img src={connection.avatar_url} alt="" referrerPolicy="no-referrer"/> : <UserRound size={20}/>}</span><span><b>@{connection.username}</b><small>{connection.direction === 'connected' ? 'Connected' : connection.direction === 'received' ? 'Request received' : 'Request sent'}</small></span></button>
              <div className="person-result-actions">{connection.direction === 'received' ? <><button type="button" className="primary small" disabled={familyConnections.workingId === connection.user_id} onClick={() => updateFamilyConnection(connection, 'accept')}>{familyConnections.workingId === connection.user_id ? 'Please wait…' : <><Check size={15}/> Accept</>}</button><button type="button" className="text-button" disabled={familyConnections.workingId === connection.user_id} onClick={() => updateFamilyConnection(connection, 'decline')}><X size={15}/> Decline</button></> : connection.direction === 'sent' ? <button type="button" className="secondary" disabled={familyConnections.workingId === connection.user_id} onClick={() => updateFamilyConnection(connection, 'cancel')}>{familyConnections.workingId === connection.user_id ? 'Please wait…' : 'Cancel request'}</button> : <span className="connection-status">Connected</span>}</div>
            </div>)}</div>
              : <p className="dashboard-empty">No connections or requests yet. Search for a username above to get started.</p>}
    </section>}
    {searchType === 'people'&&<section className="panel family-connect-guide" aria-label="How family connections work"><h2>Share creator subscriptions with a parent</h2><ol><li>Your teen creates an account and allows their profile to appear in People search in Account settings.</li><li>Search for their username and send a connection request.</li><li>They accept the request. You can then view the creators they follow on Rate My Creator, including channels they choose to import from YouTube.</li></ol><p>Connections share creator subscriptions only. They do not show watch history or individual videos watched.</p></section>}
  </main>;
}
