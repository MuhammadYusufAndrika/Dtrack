import { useState, useEffect } from 'react';
import { MapContainer, Marker, Popup, Polyline, useMap, useMapEvents } from 'react-leaflet';
import MapTiles from '../../Components/MapTiles';
import L from 'leaflet';
import { apiFetch } from '../../utils/api';
import { haversineKm, formatKm } from '../../utils/route';
import AdminLayout from '../../Layouts/AdminLayout';
import DataTable from '../../Components/DataTable';
import StatusBadge from '../../Components/StatusBadge';
import TripDetail from '../../Components/TripDetail';
import PageHeader from '../../Components/PageHeader';
import { PageLoader } from '../../Components/LoadingSpinner';
import { Route, Truck, User, MapPin, Plus, X, Navigation, Search, Loader2, Crosshair, Eye } from 'lucide-react';

const emptyForm = {
    vehicle_id: '', driver_id: '', origin: '', destination: '',
    start_latitude: '', start_longitude: '', dest_latitude: '', dest_longitude: '',
    planned_distance_km: '',
};

const originIcon = L.divIcon({ className: '', html: '<div style="width:34px;height:34px;background:linear-gradient(135deg,#22c55e,#06b6d4);border:3px solid #fff;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:15px;">📍</div>', iconSize: [34, 34], iconAnchor: [17, 17] });
const destIcon = L.divIcon({ className: '', html: '<div style="width:34px;height:34px;background:linear-gradient(135deg,#f59e0b,#ef4444);border:3px solid #fff;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:15px;">🎯</div>', iconSize: [34, 34], iconAnchor: [17, 17] });

// Terima koma ala Indonesia ("-6,2088") -> "-6.2088"
const parseCoord = (v) => {
    if (v === '' || v == null) return null;
    const n = Number(String(v).trim().replace(',', '.'));
    return Number.isFinite(n) ? n : null;
};

function ClickCatcher({ onPick }) {
    useMapEvents({ click(e) { onPick(e.latlng.lat, e.latlng.lng); } });
    return null;
}

function FlyTo({ target }) {
    const map = useMap();
    useEffect(() => {
        if (target) map.flyTo([target.lat, target.lng], 12, { duration: 1 });
    }, [target?.key]); // eslint-disable-line react-hooks/exhaustive-deps
    return null;
}

export default function Trips() {
    const [trips, setTrips] = useState([]);
    const [vehicles, setVehicles] = useState([]);
    const [drivers, setDrivers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');
    const [pickTarget, setPickTarget] = useState('origin'); // titik mana yg diisi klik/search
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [mapFocus, setMapFocus] = useState(null);
    const [detailId, setDetailId] = useState(null);

    const loadTrips = () => {
        apiFetch('/api/trips')
            .then((r) => r.json()).then((j) => { if (j.success) setTrips(j.data); })
            .catch(() => {});
    };

    useEffect(() => {
        Promise.all([
            apiFetch('/api/trips').then((r) => r.json()),
            apiFetch('/api/vehicles').then((r) => r.json()).catch(() => ({})),
            apiFetch('/api/drivers').then((r) => r.json()).catch(() => ({})),
        ]).then(([t, v, d]) => {
            if (t?.success) setTrips(t.data);
            if (v?.success) setVehicles(v.data);
            if (d?.success) setDrivers(d.data);
        }).catch(() => {}).finally(() => setLoading(false));
    }, []);

    if (loading) return <AdminLayout><PageLoader /></AdminLayout>;

    const filtered = filter === 'all' ? trips : trips.filter((t) => t.status === filter);

    const set = (k, v) => setForm((f) => {
        const next = { ...f, [k]: v };
        // Estimasi otomatis saat keempat koordinat valid
        if (['start_latitude', 'start_longitude', 'dest_latitude', 'dest_longitude'].includes(k)) {
            const est = haversineKm(
                parseCoord(next.start_latitude), parseCoord(next.start_longitude),
                parseCoord(next.dest_latitude), parseCoord(next.dest_longitude)
            );
            if (est != null) next.planned_distance_km = est.toFixed(1);
        }
        return next;
    });

    const applyPickedPoint = (lat, lng, name) => {
        const key = pickTarget === 'origin' ? ['start_latitude', 'start_longitude', 'origin'] : ['dest_latitude', 'dest_longitude', 'destination'];
        setForm((f) => {
            const next = { ...f, [key[0]]: lat.toFixed(5), [key[1]]: lng.toFixed(5) };
            if (name && !next[key[2]]) next[key[2]] = name;
            const est = haversineKm(
                parseCoord(next.start_latitude), parseCoord(next.start_longitude),
                parseCoord(next.dest_latitude), parseCoord(next.dest_longitude)
            );
            if (est != null) next.planned_distance_km = est.toFixed(1);
            return next;
        });
        setMapFocus({ lat, lng, key: Date.now() });
    };

    const handleMapPick = (lat, lng) => applyPickedPoint(lat, lng, null);

    // Varian query: "PT DAHANA" jarang terindeks OSM, tapi "Dahana Subang" ketemu.
    const queryVariants = (q) => {
        const v = [q];
        const stripped = q.replace(/^(pt\.?|cv\.?|ud\.?|tbk\.?|pd\.?)\s+/i, '').trim();
        if (stripped && stripped !== q) v.push(stripped);
        if (!/indonesia/i.test(q)) v.push(`${q}, Indonesia`);
        if (stripped && stripped !== q && !/indonesia/i.test(stripped)) v.push(`${stripped}, Indonesia`);
        return [...new Set(v)];
    };

    const searchNominatim = async (query) => {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&accept-language=id&q=${encodeURIComponent(query)}`);
        if (!res.ok) return [];
        const json = await res.json();
        return (Array.isArray(json) ? json : []).map((r) => ({ ...r, _source: 'OSM' }));
    };

    const searchPhoton = async (query) => {
        try {
            const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=6&lang=en`);
            if (!res.ok) return [];
            const json = await res.json();
            return (json?.features || []).map((f) => {
                const p = f.properties || {};
                const [lon, lat] = f.geometry?.coordinates || [];
                if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
                const bits = [p.name, p.street, p.city || p.county, p.state, p.country].filter(Boolean);
                return {
                    place_id: `photon-${p.osm_type || 'x'}-${p.osm_id || `${lat},${lon}`}`,
                    display_name: bits.join(', ') || p.name || query,
                    lat: String(lat),
                    lon: String(lon),
                    _source: 'Photon',
                };
            }).filter(Boolean);
        } catch {
            return [];
        }
    };

    const handleSearch = async (e) => {
        e?.preventDefault();
        const q = searchQuery.trim();
        if (!q || searching) return;
        setSearching(true);
        setSearchResults([]);
        setFormError('');
        try {
            const variants = queryVariants(q);
            const [nomLists, photonLists] = await Promise.all([
                Promise.all(variants.map((v) => searchNominatim(v).catch(() => []))),
                Promise.all([q, ...variants.slice(1, 2)].map((v) => searchPhoton(v))),
            ]);
            const seen = new Set();
            const merged = [];
            // Nominatim dulu (urut varian), lalu Photon sebagai pelengkap
            [...nomLists.flat(), ...photonLists.flat()].forEach((r) => {
                const key = r.place_id ?? `${r.lat},${r.lon}`;
                if (seen.has(key)) return;
                seen.add(key);
                merged.push(r);
            });
            setSearchResults(merged.slice(0, 10));
            if (merged.length === 0) setFormError('Tidak ketemu. Coba tambah nama kota (cth: Dahana Subang) atau klik langsung di peta — data OSM gratis tidak selengkap Google untuk nama perusahaan.');
        } catch {
            setFormError('Gagal mencari lokasi, periksa koneksi lalu coba lagi.');
        } finally {
            setSearching(false);
        }
    };

    const pickSearchResult = (r) => {
        const lat = Number(r.lat);
        const lng = Number(r.lon);
        const shortName = String(r.display_name || '').split(',').slice(0, 2).join(',').trim();
        applyPickedPoint(lat, lng, shortName);
        setSearchResults([]);
        setSearchQuery(shortName);
    };

    const serverError = (json) => {
        if (json?.errors) {
            const first = Object.values(json.errors)[0];
            if (Array.isArray(first) && first[0]) return first[0];
        }
        return json?.message || 'Gagal membuat trip.';
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        setFormError('');
        if (!form.vehicle_id || !form.driver_id) { setFormError('Pilih kendaraan & driver.'); return; }
        const sLat = parseCoord(form.start_latitude);
        const sLng = parseCoord(form.start_longitude);
        const dLat = parseCoord(form.dest_latitude);
        const dLng = parseCoord(form.dest_longitude);
        if ((form.start_latitude !== '' || form.start_longitude !== '') && (sLat == null || sLng == null)) { setFormError('Koordinat titik awal tidak valid. Klik di peta atau pakai format -6.2088 (koma juga boleh).'); return; }
        if (sLat != null && (sLat < -90 || sLat > 90)) { setFormError('Lat awal harus antara -90 dan 90. Sepertinya lat/lng tertukar — lat itu yang kecil (cth. -6.2), lng yang besar (cth. 106.8).'); return; }
        if (sLng != null && (sLng < -180 || sLng > 180)) { setFormError('Lng awal harus antara -180 dan 180.'); return; }
        if ((form.dest_latitude !== '' || form.dest_longitude !== '') && (dLat == null || dLng == null)) { setFormError('Koordinat tujuan tidak valid. Klik di peta atau pakai format -6.2088.'); return; }
        if (dLat != null && (dLat < -90 || dLat > 90)) { setFormError('Lat tujuan harus antara -90 dan 90. Sepertinya lat/lng tertukar — lat itu yang kecil (cth. -6.2), lng yang besar (cth. 106.8).'); return; }
        if (dLng != null && (dLng < -180 || dLng > 180)) { setFormError('Lng tujuan harus antara -180 dan 180.'); return; }
        setSaving(true);
        try {
            const payload = {
                vehicle_id: Number(form.vehicle_id),
                driver_id: Number(form.driver_id),
                origin: form.origin || null,
                destination: form.destination || null,
                start_latitude: sLat,
                start_longitude: sLng,
                dest_latitude: dLat,
                dest_longitude: dLng,
                planned_distance_km: form.planned_distance_km === '' ? null : Number(String(form.planned_distance_km).replace(',', '.')),
            };
            const res = await apiFetch('/api/trips', { method: 'POST', body: JSON.stringify(payload) });
            const json = await res.json();
            if (!json.success) { setFormError(serverError(json)); return; }
            setShowForm(false);
            setForm(emptyForm);
            setSearchQuery('');
            setSearchResults([]);
            loadTrips();
        } catch {
            setFormError('Tidak dapat terhubung ke server.');
        } finally {
            setSaving(false);
        }
    };

    const inputCls = 'input-glass w-full rounded-xl px-3.5 py-2.5 text-sm text-dark-900 placeholder-dark-300';
    const oLat = parseCoord(form.start_latitude);
    const oLng = parseCoord(form.start_longitude);
    const dLat = parseCoord(form.dest_latitude);
    const dLng = parseCoord(form.dest_longitude);
    const previewLine = oLat != null && oLng != null && dLat != null && dLng != null
        ? [[oLat, oLng], [dLat, dLng]] : [];

    const columns = [
        { key: 'id', header: 'Trip', render: (t) => (
            <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary-500/10 flex items-center justify-center"><Route className="w-4 h-4 text-primary-400" /></div>
                <div><p className="font-medium text-dark-900">Trip #{t.id}</p><p className="text-xs text-dark-400">{t.start_time ? new Date(t.start_time).toLocaleDateString() : ''}</p></div>
            </div>
        )},
        { key: 'vehicle', header: 'Vehicle', render: (t) => t.vehicle ? <div className="flex items-center gap-2"><Truck className="w-3.5 h-3.5 text-dark-400" /><span className="text-sm text-dark-700">{t.vehicle.plate_number}</span></div> : <span className="text-sm text-dark-500">N/A</span> },
        { key: 'driver', header: 'Driver', render: (t) => t.driver ? <div className="flex items-center gap-2"><User className="w-3.5 h-3.5 text-dark-400" /><span className="text-sm text-dark-700">{t.driver.name}</span></div> : <span className="text-sm text-dark-500">N/A</span> },
        { key: 'route', header: 'Rute', render: (t) => (
            <div className="text-sm">
                <p className="text-dark-900 font-medium">{t.origin || '—'} <span className="text-dark-400">→</span> {t.destination || '—'}</p>
                <p className="text-xs text-dark-400 flex items-center gap-1"><Navigation className="w-3 h-3" />Estimasi {formatKm(t.planned_distance_km)}</p>
            </div>
        )},
        { key: 'distance_km', header: 'Jarak', render: (t) => <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-dark-400" /><span className="text-sm text-dark-700">{formatKm(t.distance_km)}</span></div>, sortable: true },
        { key: 'status', header: 'Status', render: (t) => <StatusBadge status={t.status} />, sortable: true },
        { key: 'end_time', header: 'Duration', render: (t) => {
            if (!t.end_time) return <span className="text-sm text-success-500 font-semibold">In progress</span>;
            const mins = Math.round((new Date(t.end_time) - new Date(t.start_time)) / 60000);
            return <span className="text-sm text-dark-700">{Math.floor(mins / 60)}h {mins % 60}m</span>;
        }},
        { key: 'aksi', header: 'Aksi', render: (t) => (
            <button onClick={() => setDetailId(t.id)}
                className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl glass glass-hover text-dark-900">
                <Eye className="w-3.5 h-3.5" /> History
            </button>
        )},
    ];

    return (
        <AdminLayout>
            <div className="space-y-6">
                <PageHeader
                    eyebrow="Operations"
                    title="Riwayat Trip"
                    description={`${trips.length} perjalanan tercatat.`}
                    action={
                    <div className="flex items-center gap-2">
                        <button onClick={() => { setShowForm(true); setFormError(''); setSearchResults([]); }}
                            className="btn-glow flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-xs font-bold">
                            <Plus className="w-4 h-4" /> Buat Trip
                        </button>
                        <div className="flex rounded-xl border border-dark-200/60 overflow-hidden glass">
                            {['all', 'PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].map((s) => (
                                <button key={s} onClick={() => setFilter(s)}
                                    className={`px-3 py-2 text-xs font-bold transition-all ${filter === s ? 'btn-glow text-white' : 'text-dark-400 hover:text-dark-900'}`}>
                                    {s === 'all' ? 'Semua' : s === 'IN_PROGRESS' ? 'Aktif' : s === 'PLANNED' ? 'Terjadwal' : s.charAt(0) + s.slice(1).toLowerCase()}
                                </button>
                            ))}
                        </div>
                    </div>
                    }
                />
                <DataTable columns={columns} data={filtered} keyExtractor={(t) => t.id} searchable searchKeys={['id', 'origin', 'destination']} searchPlaceholder="Cari trip / rute..." />

                {showForm && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowForm(false)}>
                        <div className="glass-strong rounded-3xl w-full max-w-2xl max-h-[92vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-display text-lg font-bold text-dark-900">Buat Trip + Rute</h3>
                                <button onClick={() => setShowForm(false)} className="p-2 rounded-xl glass glass-hover"><X className="w-4 h-4" /></button>
                            </div>
                            {formError && <div className="p-3 rounded-xl bg-danger-500/10 border border-danger-500/30 text-sm text-danger-500 mb-4">⚠️ {formError}</div>}
                            <form onSubmit={handleCreate} className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-semibold uppercase tracking-wider text-dark-400 mb-1.5">Kendaraan</label>
                                        <select value={form.vehicle_id} onChange={(e) => set('vehicle_id', e.target.value)} required className={inputCls}>
                                            <option value="">— Pilih —</option>
                                            {vehicles.map((v) => <option key={v.id} value={v.id}>{v.plate_number} · {v.brand}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold uppercase tracking-wider text-dark-400 mb-1.5">Driver</label>
                                        <select value={form.driver_id} onChange={(e) => set('driver_id', e.target.value)} required className={inputCls}>
                                            <option value="">— Pilih —</option>
                                            {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-semibold uppercase tracking-wider text-dark-400 mb-1.5">Titik awal</label>
                                        <input value={form.origin} onChange={(e) => set('origin', e.target.value)} placeholder="cth: Jakarta" className={inputCls} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold uppercase tracking-wider text-dark-400 mb-1.5">Tujuan</label>
                                        <input value={form.destination} onChange={(e) => set('destination', e.target.value)} placeholder="cth: Surabaya" className={inputCls} />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wider text-dark-400 mb-1.5">
                                        Cari lokasi <span className="normal-case font-normal">(ketik nama kota/alamat, lalu klik hasil)</span>
                                    </label>
                                    <div className="flex gap-2">
                                        <div className="flex rounded-xl border border-dark-200/60 overflow-hidden glass">
                                            {[{ v: 'origin', l: '📍 Awal' }, { v: 'dest', l: '🎯 Tujuan' }].map((o) => (
                                                <button type="button" key={o.v} onClick={() => setPickTarget(o.v)}
                                                    className={`px-3 py-2.5 text-xs font-bold transition-all ${pickTarget === o.v ? 'btn-glow text-white' : 'text-dark-400'}`}>
                                                    {o.l}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="relative flex-1">
                                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
                                            <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                                                onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(e); }}
                                                placeholder="cth: Surabaya, Pelabuhan Balikpapan…" className={`${inputCls} pl-10`} />
                                        </div>
                                        <button type="button" onClick={handleSearch} disabled={searching || !searchQuery.trim()}
                                            className="btn-glow px-4 rounded-xl text-white text-xs font-bold disabled:opacity-50 flex items-center gap-1.5">
                                            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Cari
                                        </button>
                                    </div>
                                    {searchResults.length > 0 && (
                                        <div className="mt-2 rounded-xl border border-dark-200/60 overflow-hidden max-h-44 overflow-y-auto">
                                            {searchResults.map((r, i) => (
                                                <button type="button" key={`${r.place_id}-${i}`} onClick={() => pickSearchResult(r)}
                                                    className="w-full text-left px-3.5 py-2.5 text-xs hover:bg-primary-500/10 transition-colors border-b border-dark-200/40 last:border-0">
                                                    <p className="font-semibold text-dark-900 truncate">
                                                        {String(r.display_name).split(',').slice(0, 3).join(',')}
                                                        {r._source && <span className="ml-1.5 text-[9px] font-bold uppercase tracking-wider text-dark-400 border border-dark-200/60 rounded px-1">{r._source}</span>}
                                                    </p>
                                                    <p className="font-mono text-dark-400">{Number(r.lat).toFixed(5)}, {Number(r.lon).toFixed(5)}</p>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    <p className="text-[11px] text-dark-400 mt-1.5 flex items-center gap-1">
                                        <Crosshair className="w-3 h-3" />
                                        Atau <strong>klik langsung di peta</strong> — titik {pickTarget === 'origin' ? 'awal 📍' : 'tujuan 🎯'} yang akan terisi.
                                    </p>
                                </div>

                                <div className="rounded-2xl overflow-hidden border border-dark-200/60">
                                    <div className="h-[280px]">
                                        <MapContainer center={[-2.5489, 118.0149]} zoom={5} className="h-full w-full z-0">
                                            <MapTiles />
                                            <ClickCatcher onPick={handleMapPick} />
                                            <FlyTo target={mapFocus} />
                                            {oLat != null && oLng != null && (
                                                <Marker position={[oLat, oLng]} icon={originIcon}>
                                                    <Popup><div className="text-sm"><p className="font-bold">📍 {form.origin || 'Titik awal'}</p></div></Popup>
                                                </Marker>
                                            )}
                                            {dLat != null && dLng != null && (
                                                <Marker position={[dLat, dLng]} icon={destIcon}>
                                                    <Popup><div className="text-sm"><p className="font-bold">🎯 {form.destination || 'Tujuan'}</p></div></Popup>
                                                </Marker>
                                            )}
                                            {previewLine.length === 2 && <Polyline positions={previewLine} pathOptions={{ color: '#2563eb', weight: 3, opacity: 0.8, dashArray: '8 6' }} />}
                                        </MapContainer>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-semibold uppercase tracking-wider text-dark-400 mb-1.5">Lat awal</label>
                                        <input value={form.start_latitude} onChange={(e) => set('start_latitude', e.target.value)} inputMode="decimal" placeholder="-6,2088" className={`${inputCls} font-mono`} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold uppercase tracking-wider text-dark-400 mb-1.5">Lng awal</label>
                                        <input value={form.start_longitude} onChange={(e) => set('start_longitude', e.target.value)} inputMode="decimal" placeholder="106,8456" className={`${inputCls} font-mono`} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-semibold uppercase tracking-wider text-dark-400 mb-1.5">Lat tujuan</label>
                                        <input value={form.dest_latitude} onChange={(e) => set('dest_latitude', e.target.value)} inputMode="decimal" placeholder="-7,2575" className={`${inputCls} font-mono`} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold uppercase tracking-wider text-dark-400 mb-1.5">Lng tujuan</label>
                                        <input value={form.dest_longitude} onChange={(e) => set('dest_longitude', e.target.value)} inputMode="decimal" placeholder="112,7521" className={`${inputCls} font-mono`} />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wider text-dark-400 mb-1.5">Estimasi jarak (km) — otomatis</label>
                                    <input value={form.planned_distance_km} onChange={(e) => setForm((f) => ({ ...f, planned_distance_km: e.target.value }))} inputMode="decimal" placeholder="otomatis dari peta" className={`${inputCls} font-mono`} />
                                    <p className="text-[11px] text-dark-400 mt-1">Garis lurus haversine. Untuk antar-pulau (mis. Jawa → Kalimantan) ini estimasi udara; jarak jalan sebenarnya lebih jauh.</p>
                                </div>
                                <button type="submit" disabled={saving} className="btn-glow w-full py-3 rounded-xl text-white text-sm font-bold disabled:opacity-60">
                                    {saving ? 'Menyimpan…' : 'Simpan Trip Terjadwal'}
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {detailId && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setDetailId(null)}>
                        <div className="glass-strong rounded-3xl w-full max-w-3xl max-h-[92vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-display text-lg font-bold text-dark-900">History Perjalanan</h3>
                                <button onClick={() => setDetailId(null)} className="p-2 rounded-xl glass glass-hover"><X className="w-4 h-4" /></button>
                            </div>
                            <TripDetail tripId={detailId} fetchFn={(url, opts) => apiFetch(url, opts)} />
                        </div>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}
