import { useMemo, useState } from 'react';
import { SlidersHorizontal, Search } from 'lucide-react';
import { SearchBox, CreatorCard } from '../components/shared';

export function DiscoverCreators({ navigate, query, setQuery, creators }) {
  const [selected, setSelected] = useState(['All']);
  const [sortBy, setSortBy] = useState('rating-high');
  const categories = useMemo(() => ['All', ...new Set(creators.map(c => c.category))], [creators]);
  const filtered = useMemo(() => {
    const matches = creators.filter(c => (selected.includes('All') || selected.includes(c.category)) && (`${c.name} ${c.topic} ${c.category}`).toLowerCase().includes(query.toLowerCase()));
    const sorters = {
      'rating-high': (a, b) => b.score - a.score,
      'rating-low': (a, b) => a.score - b.score,
      'subscribers-high': (a, b) => (b.subscriberCount ?? -1) - (a.subscriberCount ?? -1),
      'subscribers-low': (a, b) => {
        if (a.subscriberCount == null) return b.subscriberCount == null ? 0 : 1;
        if (b.subscriberCount == null) return -1;
        return a.subscriberCount - b.subscriberCount;
      }
    };
    return matches.sort(sorters[sortBy]);
  }, [creators, query, selected, sortBy]);
  const toggle = cat => setSelected(cat === 'All' ? ['All'] : (selected.includes(cat) ? (selected.filter(x => x !== cat).length ? selected.filter(x => x !== cat) : ['All']) : [...selected.filter(x => x !== 'All'), cat]));
  return <main className="page"><div className="page-heading"><span className="kicker">DISCOVER</span><h1>Find your next favorite creator</h1><p>Explore honest community ratings across every kind of content.</p></div>
    <SearchBox value={query} setValue={setQuery} />
    <div className="browse-layout"><aside className="filters"><div className="filter-title"><SlidersHorizontal size={18} /> Filter by topic</div>{categories.map(cat => <label key={cat}><input type="checkbox" checked={selected.includes(cat)} onChange={() => toggle(cat)} /><span>{cat}</span><small>{cat === 'All' ? creators.length : creators.filter(c => c.category === cat).length}</small></label>)}</aside>
      <section className="results"><div className="results-head"><b>{filtered.length} creators</b><label>Sort by <select value={sortBy} onChange={event => setSortBy(event.target.value)} aria-label="Sort creators"><option value="rating-high">Most positively reviewed</option><option value="rating-low">Most negatively reviewed</option><option value="subscribers-high">Most subscribed</option><option value="subscribers-low">Least subscribed</option></select></label></div>{filtered.length ? filtered.map(c => <CreatorCard key={c.id} creator={c} navigate={navigate} wide />) : <div className="empty"><Search size={36}/><h3>No creators found</h3><p>Try another name, topic, or remove a filter.</p><button className="secondary" onClick={() => {setQuery('');setSelected(['All']);}}>Clear search</button></div>}</section>
    </div>
  </main>;
}
