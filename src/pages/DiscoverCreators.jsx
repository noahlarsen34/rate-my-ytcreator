import { useMemo, useState } from 'react';
import { SlidersHorizontal, Search } from 'lucide-react';
import { SearchBox, CreatorCard } from '../components/shared';

export function DiscoverCreators({ navigate, query, setQuery, creators }) {
  const [selected, setSelected] = useState(['All']);
  const categories = useMemo(() => ['All', ...new Set(creators.map(c => c.category))], [creators]);
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
  </main>;
}
