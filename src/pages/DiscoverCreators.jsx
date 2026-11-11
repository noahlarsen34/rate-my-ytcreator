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
  const categories = useMemo(() => ['All', ...new Set(creators.map(c => c.category))], [creators]);
  const filtered = useMemo(() => creators.filter(c => (selected.includes('All') || selected.includes(c.category)) && (`${c.name} ${c.topic} ${c.category}`).toLowerCase().includes(query.toLowerCase())), [creators, query, selected]);
  const toggle = cat => setSelected(cat === 'All' ? ['All'] : (selected.includes(cat) ? (selected.filter(x => x !== cat).length ? selected.filter(x => x !== cat) : ['All']) : [...selected.filter(x => x !== 'All'), cat]));

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
      const statuses = Object.fromEntries((connectionsResult.data || []).map(connection => [connection.user_id, connection.direction === 'connected' ? 'connected' : connection.direction === 'sent' ? 'request_sent' : 'request_received']));
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

  return <main className="page discover-page"><div className="page-heading"><span className="kicker">DISCOVER</span><h1>{searchType === 'creators' ? 'Find your next favorite creator' : 'Find people you know'}</h1><p>{searchType === 'creators' ? 'Explore honest community ratings across every kind of content.' : 'Search by username and send a connection request.'}</p></div>
    <SearchBox value={query} setValue={setQuery} placeholder={searchType === 'creators' ? 'Search creators or users' : 'Search usernames'} ariaLabel={searchType === 'creators' ? 'Search creators or users' : 'Search people'} />
    <div className="discover-search-tabs" role="tablist" aria-label="Search type">
      <button type="button" role="tab" aria-selected={searchType === 'creators'} className={searchType === 'creators' ? 'active' : ''} onClick={() => setSearchType('creators')}><Search size={16}/> Creators</button>
      <button type="button" role="tab" aria-selected={searchType === 'people'} className={searchType === 'people' ? 'active' : ''} onClick={() => setSearchType('people')}><UsersRound size={16}/> People</button>
  const filtered = useMemo(() => creators
    .filter(c => (selected.includes('All') || selected.includes(c.category)) && (`${c.name} ${c.topic} ${c.category}`).toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => {
      const aCount = Number.isFinite(a.subscriberCount) ? a.subscriberCount : null;
      const bCount = Number.isFinite(b.subscriberCount) ? b.subscriberCount : null;
      if (aCount == null && bCount == null) return a.name.localeCompare(b.name);
      if (aCount == null) return 1;
      if (bCount == null) return -1;
      return bCount - aCount;
    }), [creators, query, selected]);
  const toggle = cat => setSelected(cat === 'All' ? ['All'] : (selected.includes(cat) ? (selected.filter(x => x !== cat).length ? selected.filter(x => x !== cat) : ['All']) : [...selected.filter(x => x !== 'All'), cat]));
  return <main className="page"><div className="page-heading"><span className="kicker">DISCOVER</span><h1>Find your next favorite creator</h1><p>Explore honest community ratings across every kind of content.</p></div>
    <SearchBox value={query} setValue={setQuery} />
    <div className="browse-layout"><aside className="filters"><div className="filter-title"><SlidersHorizontal size={18} /> Filter by topic</div>{categories.map(cat => <label key={cat}><input type="checkbox" checked={selected.includes(cat)} onChange={() => toggle(cat)} /><span>{cat}</span><small>{cat === 'All' ? creators.length : creators.filter(c => c.category === cat).length}</small></label>)}</aside>
      <section className="results"><div className="results-head"><b>{filtered.length} creators</b><span>Most subscribers first</span></div>{filtered.length ? filtered.map(c => <CreatorCard key={c.id} creator={c} navigate={navigate} wide />) : <div className="empty"><Search size={36}/><h3>No creators found</h3><p>Try another name, topic, or remove a filter.</p><button className="secondary" onClick={() => {setQuery('');setSelected(['All']);}}>Clear search</button></div>}</section>
    </div>
    {searchType === 'creators' ? <div className="browse-layout"><aside className="filters"><div className="filter-title"><SlidersHorizontal size={18} /> Filter by topic</div>{categories.map(cat => <label key={cat}><input type="checkbox" checked={selected.includes(cat)} onChange={() => toggle(cat)} /><span>{cat}</span><small>{cat === 'All' ? creators.length : creators.filter(c => c.category === cat).length}</small></label>)}</aside>
      <section className="results"><div className="results-head"><b>{filtered.length} creators</b><span>Highest rated first</span></div>{filtered.length ? [...filtered].sort((a,b) => b.score-a.score).map(c => <CreatorCard key={c.id} creator={c} navigate={navigate} wide />) : <div className="empty"><Search size={36}/><h3>No creators found</h3><p>Try another name, topic, or remove a filter.</p><button className="secondary" onClick={() => {setQuery('');setSelected(['All']);}}>Clear search</button></div>}</section>
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
