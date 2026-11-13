import { useEffect, useMemo, useState } from 'react';
import { Search, SlidersHorizontal, UserRound, UsersRound } from 'lucide-react';
import { CreatorCard, SearchBox } from '../components/shared';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

export function DiscoverCreators({ navigate, query, setQuery, creators, user }) {
  const [selected, setSelected] = useState(['All']);
  const [searchType, setSearchType] = useState('creators');
  const [peopleState, setPeopleState] = useState({ loading: false, people: [], statuses: {}, error: '' });
  const [workingId, setWorkingId] = useState(null);
  const [actionError, setActionError] = useState('');
  const categories = useMemo(() => ['All', ...new Set(creators.map(creator => creator.category))], [creators]);
  const filtered = useMemo(() => creators
    .filter(creator => (selected.includes('All') || selected.includes(creator.category))
      && (`${creator.name} ${creator.topic} ${creator.category}`).toLowerCase().includes(query.toLowerCase()))
    .sort((first, second) => {
      if (sortBy === 'rating-high') return second.score - first.score;
      if (sortBy === 'rating-low') return first.score - second.score;
      const firstCount = Number.isFinite(first.subscriberCount) ? first.subscriberCount : null;
      const secondCount = Number.isFinite(second.subscriberCount) ? second.subscriberCount : null;
      if (firstCount == null && secondCount == null) return first.name.localeCompare(second.name);
      if (firstCount == null) return 1;
      if (secondCount == null) return -1;
      return sortBy === 'subscribers-high' ? secondCount - firstCount : firstCount - secondCount;
    }), [creators, query, selected, sortBy]);
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

  return <main className="page discover-page">
    <div className="page-heading">
      <span className="kicker">DISCOVER</span>
      <h1>{searchType === 'creators' ? 'Find your next favorite creator' : 'Find people you know'}</h1>
      <p>{searchType === 'creators' ? 'Explore honest community ratings across every kind of content.' : 'Search by username and send a connection request.'}</p>
    </div>
    <SearchBox value={query} setValue={setQuery} placeholder={searchType === 'creators' ? 'Search creators or users' : 'Search usernames'} ariaLabel={searchType === 'creators' ? 'Search creators or users' : 'Search people'} />
    <div className="discover-search-tabs" role="tablist" aria-label="Search type">
      <button type="button" role="tab" aria-selected={searchType === 'creators'} className={searchType === 'creators' ? 'active' : ''} onClick={() => setSearchType('creators')}><Search size={16}/> Creators</button>
      <button type="button" role="tab" aria-selected={searchType === 'people'} className={searchType === 'people' ? 'active' : ''} onClick={() => setSearchType('people')}><UsersRound size={16}/> People</button>
    </div>
    {searchType === 'creators' ? <div className="browse-layout">
      <aside className="filters"><div className="filter-title"><SlidersHorizontal size={18} /> Filter by topic</div>{categories.map(category => <label key={category}><input type="checkbox" checked={selected.includes(category)} onChange={() => toggle(category)} /><span>{category}</span><small>{category === 'All' ? creators.length : creators.filter(creator => creator.category === category).length}</small></label>)}</aside>
      <section className="results"><div className="results-head"><b>{filtered.length} creators</b><label>Sort by <select value={sortBy} onChange={event => setSortBy(event.target.value)} aria-label="Sort creators"><option value="rating-high">Most positively reviewed</option><option value="rating-low">Most negatively reviewed</option><option value="subscribers-high">Most subscribed</option><option value="subscribers-low">Least subscribed</option></select></label></div>{filtered.length ? filtered.map(creator => <CreatorCard key={creator.id} creator={creator} navigate={navigate} wide />) : <div className="empty"><Search size={36}/><h3>No creators found</h3><p>Try another name, topic, or remove a filter.</p><button className="secondary" onClick={() => {setQuery('');setSelected(['All']);}}>Clear search</button></div>}</section>
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
