import { useState, useMemo } from 'react';
import { Search, ChevronUp, ChevronDown, Inbox } from 'lucide-react';

export default function DataTable({ columns, data, keyExtractor, searchable, searchKeys, searchPlaceholder, pageSize = 15 }) {
    const [search, setSearch] = useState('');
    const [sortKey, setSortKey] = useState(null);
    const [sortDir, setSortDir] = useState('asc');
    const [page, setPage] = useState(0);

    const filtered = useMemo(() => {
        if (!search) return data;
        return data.filter((row) =>
            (searchKeys || columns.map((c) => c.key)).some((key) => {
                const val = typeof key === 'function' ? key(row) : row[key];
                return val != null && String(val).toLowerCase().includes(search.toLowerCase());
            })
        );
    }, [data, search, searchKeys, columns]);

    const sorted = useMemo(() => {
        if (!sortKey) return filtered;
        return [...filtered].sort((a, b) => {
            const aVal = a[sortKey];
            const bVal = b[sortKey];
            if (aVal == null) return 1;
            if (bVal == null) return -1;
            const cmp = typeof aVal === 'string' ? aVal.localeCompare(bVal) : aVal - bVal;
            return sortDir === 'asc' ? cmp : -cmp;
        });
    }, [filtered, sortKey, sortDir]);

    const pages = Math.ceil(sorted.length / pageSize);
    const paged = sorted.slice(page * pageSize, (page + 1) * pageSize);

    return (
        <div className="space-y-4">
            {searchable && (
                <div className="relative max-w-xs">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" />
                    <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                        placeholder={searchPlaceholder || 'Search...'}
                        className="input-glass w-full rounded-xl pl-10 pr-4 py-2.5 text-sm text-dark-900 placeholder-dark-300" />
                </div>
            )}
            <div className="glass rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-primary-100/80 bg-gradient-to-r from-primary-50/90 via-violet-50/60 to-accent-50/70">
                            {columns.map((col) => (
                                <th key={col.key} className={`px-5 py-3.5 text-left text-[11px] font-bold text-dark-500 uppercase tracking-wider ${col.sortable ? 'cursor-pointer hover:text-primary-600 select-none' : ''}`}
                                    onClick={() => {
                                        if (!col.sortable) return;
                                        if (sortKey === col.key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
                                        else { setSortKey(col.key); setSortDir('asc'); }
                                    }}>
                                    <div className="flex items-center gap-1">
                                        {col.header}
                                        {sortKey === col.key && (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-dark-200/50">
                        {paged.map((row) => (
                            <tr key={keyExtractor(row)} className="hover:bg-primary-500/[0.06] transition-colors group">
                                {columns.map((col) => (
                                    <td key={col.key} className="px-5 py-3.5 text-sm">{col.render ? col.render(row) : <span className="text-dark-600">{String(row[col.key] ?? '')}</span>}</td>
                                ))}
                            </tr>
                        ))}
                        {paged.length === 0 && (
                            <tr><td colSpan={columns.length} className="px-4 py-14 text-center">
                                <span className="inline-flex w-12 h-12 rounded-2xl bg-primary-50 border border-primary-100 items-center justify-center mb-3">
                                    <Inbox className="w-6 h-6 text-primary-400" />
                                </span>
                                <p className="text-dark-500 text-sm font-semibold">Tidak ada data</p>
                                <p className="text-dark-300 text-xs mt-0.5">Coba ubah kata kunci pencarian</p>
                            </td></tr>
                        )}
                    </tbody>
                </table>
            </div>
            </div>
            {pages > 1 && (
                <div className="flex items-center justify-between text-sm text-dark-400 px-1">
                    <span className="text-xs">{sorted.length} total</span>
                    <div className="flex gap-1.5">
                        {Array.from({ length: pages }, (_, i) => (
                            <button key={i} onClick={() => setPage(i)}
                                className={`min-w-8 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${page === i ? 'btn-glow text-white shadow-[0_6px_16px_rgba(37,99,235,0.35)]' : 'glass text-dark-400 hover:text-primary-600 hover:border-primary-500/40'}`}>
                                {i + 1}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
