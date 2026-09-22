import { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, Marker, Popup, useMap } from 'react-leaflet';
import MapTiles from '../../Components/MapTiles';
import L from 'leaflet';
import { Search, Truck, MapPin, Gauge, Clock, ArrowLeft, Loader2, Radar, ShieldCheck, Zap, Navigation } from 'lucide-react';

const vehicleIcon = L.divIcon({
    className: '',
    html: '<div style="width:44px;height:44px;background:linear-gradient(135deg,#2563eb,#06b6d4);border:3px solid #fff;border-radius:16px;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 28px rgba(37,99,235,0.6);font-size:20px;">🚛</div>',
    iconSize: [44, 44],
    iconAnchor: [22, 22],
});

const activeVehicleIcon = L.divIcon({
    className: '',
    html: '<div style="width:48px;height:48px;background:linear-gradient(135deg,#22c55e,#06b6d4);border:3px solid #fff;border-radius:16px;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 32px rgba(34,197,94,0.7);font-size:22px;animation:pulse 2s infinite;">🚛</div>',
    iconSize: [48, 48],
    iconAnchor: [24, 24],
});

function MapUpdater({ location }) {
    const map = useMap();
    const hasFitted = useRef(false);

    useEffect(() => {
        if (location && !hasFitted.current) {
            map.setView([location.latitude, location.longitude], 15);
            hasFitted.current = true;
        }
    }, [location, map]);

    useEffect(() => {
        if (location) {
            map.setView([location.latitude, location.longitude], map.getZoom());
        }
    }, [location, map]);

    return null;
}

function formatTimestamp(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    return d.toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
}

const samplePlates = ['B-1234-ABC', 'D-5678-XYZ', 'L-9012-DEF'];

export default function Track() {
    const [plateNumber, setPlateNumber] = useState('');
    const [vehicle, setVehicle] = useState(null);
    const [liveLocation, setLiveLocation] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [hasSearched, setHasSearched] = useState(false);
    const [wsConnected, setWsConnected] = useState(false);
    const echoChannel = useRef(null);
    const pollRef = useRef(null);

    const searchVehicle = useCallback(async (plate) => {
        const trimmed = (plate || '').trim().toUpperCase();
        if (!trimmed) return;

        setLoading(true);
        setError('');
        setVehicle(null);
        setLiveLocation(null);
        setHasSearched(true);

        try {
            const res = await fetch(`/api/public/track/${encodeURIComponent(trimmed)}`);
            const json = await res.json();

            if (json.success && json.data) {
                setVehicle(json.data);
                if (json.data.latest_location) {
                    setLiveLocation(json.data.latest_location);
                }
                subscribeToVehicle(json.data.id);
            } else {
                setError(json.message || 'Kendaraan tidak ditemukan.');
            }
        } catch {
            setError('Gagal terhubung ke server.');
        } finally {
            setLoading(false);
        }
    }, []);

    const subscribeToVehicle = useCallback((vehicleId) => {
        if (!window.Echo) return;

        if (echoChannel.current) {
            window.Echo.leave(echoChannel.current);
        }

        const channelName = `vehicle.${vehicleId}`;
        window.Echo.channel(channelName)
            .listen('.location.updated', (data) => {
                setLiveLocation({
                    latitude: data.latitude,
                    longitude: data.longitude,
                    speed: data.speed,
                    heading: data.heading,
                    timestamp: data.timestamp,
                });
            })
            .subscribed(() => {
                setWsConnected(true);
            })
            .error(() => {
                setWsConnected(false);
            });

        echoChannel.current = channelName;
    }, []);

    useEffect(() => {
        return () => {
            if (echoChannel.current && window.Echo) {
                window.Echo.leave(echoChannel.current);
            }
            if (pollRef.current) {
                clearInterval(pollRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (!vehicle) return;

        pollRef.current = setInterval(async () => {
            try {
                const res = await fetch(`/api/public/track/${encodeURIComponent(vehicle.plate_number)}`);
                const json = await res.json();
                if (json.success && json.data?.latest_location) {
                    setLiveLocation(json.data.latest_location);
                }
            } catch {}
        }, 10000);

        return () => clearInterval(pollRef.current);
    }, [vehicle]);

    const handleSubmit = (e) => {
        e.preventDefault();
        searchVehicle(plateNumber);
    };

    const reset = () => { setHasSearched(false); setVehicle(null); setLiveLocation(null); setPlateNumber(''); setError(''); };

    return (
        <div className="min-h-screen relative overflow-x-hidden">
            <div className="fixed inset-0 pointer-events-none">
                <div className="orb orb-blue w-[520px] h-[520px] -top-48 left-1/4" />
                <div className="orb orb-cyan w-[380px] h-[380px] top-40 -right-32" />
                <div className="orb orb-violet w-[320px] h-[320px] bottom-0 -left-24" />
            </div>

            <div className="sticky top-0 z-50 glass !rounded-none border-x-0 border-t-0">
                <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
                    <button onClick={reset} className="flex items-center gap-2.5 flex-shrink-0">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary-500 via-violet-500 to-accent-500 flex items-center justify-center shadow-[0_8px_28px_rgba(59,130,246,0.5)]">
                            <Truck className="w-5 h-5 text-white" />
                        </div>
                        <div className="text-left hidden sm:block">
                            <h1 className="font-display text-sm font-bold text-dark-900 leading-tight">FleetVision</h1>
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gradient">Live Tracking</p>
                        </div>
                    </button>

                    {hasSearched && !error ? (
                        <form onSubmit={handleSubmit} className="flex-1 max-w-md ml-auto">
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
                                    <input
                                        type="text"
                                        value={plateNumber}
                                        onChange={(e) => setPlateNumber(e.target.value)}
                                        placeholder="Nomor plat lain…"
                                        className="input-glass w-full rounded-xl pl-10 pr-4 py-2.5 text-sm text-dark-900 placeholder-dark-300"
                                    />
                                </div>
                                <button type="submit" disabled={loading || !plateNumber.trim()}
                                    className="btn-glow px-5 py-2.5 rounded-xl text-white text-sm font-bold flex items-center gap-2 disabled:opacity-50">
                                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                                    <span className="hidden sm:inline">Lacak</span>
                                </button>
                            </div>
                        </form>
                    ) : (
                        <div className="ml-auto flex items-center gap-2">
                            <span className={`flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-full border ${wsConnected ? 'bg-success-500/10 border-success-500/30 text-success-500' : 'bg-dark-100/60 border-dark-200/70 text-dark-500'}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${wsConnected ? 'bg-success-400 animate-pulse' : 'bg-dark-500'}`} />
                                {wsConnected ? 'Live' : 'Siap'}
                            </span>
                            <a href="/login" className="hidden sm:inline-flex text-xs font-semibold px-4 py-2 rounded-xl glass glass-hover text-dark-900">Masuk</a>
                        </div>
                    )}
                </div>
            </div>

            <div className="relative max-w-7xl mx-auto px-4 py-6">
                {!hasSearched ? (
                    <div className="grid lg:grid-cols-2 gap-10 items-center min-h-[72vh] py-8">
                        <div className="animate-fade-up">
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] px-3.5 py-1.5 rounded-full bg-success-500/10 border border-success-500/25 text-success-500">
                                <Radar className="w-3.5 h-3.5 animate-pulse" /> Live GPS · Update 5 detik
                            </span>
                            <h2 className="font-display text-4xl sm:text-5xl font-bold leading-[1.05] text-dark-900 mt-5">
                                Lacak armadamu<br /><span className="text-gradient">secara real-time.</span>
                            </h2>
                            <p className="text-dark-400 mt-4 max-w-md leading-relaxed">
                                Masukkan nomor plat kendaraan untuk melihat posisi, kecepatan, dan status perjalanan langsung di peta tanpa perlu login.
                            </p>
                            <form onSubmit={handleSubmit} className="mt-7">
                                <div className="glass-strong rounded-2xl p-2 flex flex-col sm:flex-row gap-2 max-w-md shadow-[0_20px_60px_rgba(37,99,235,0.25)]">
                                    <div className="relative flex-1">
                                        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 w-5 h-5 text-primary-600" />
                                        <input
                                            type="text"
                                            value={plateNumber}
                                            onChange={(e) => setPlateNumber(e.target.value)}
                                            placeholder="Contoh: B-1234-ABC"
                                            className="w-full bg-transparent pl-11 pr-4 py-3.5 text-[15px] font-semibold uppercase tracking-wide text-dark-900 placeholder-dark-300 placeholder:normal-case placeholder:font-normal placeholder:tracking-normal focus:outline-none"
                                        />
                                    </div>
                                    <button type="submit" disabled={loading || !plateNumber.trim()}
                                        className="btn-glow px-7 py-3.5 rounded-xl text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 min-w-[132px]">
                                        {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Mencari…</> : <><Navigation className="w-4 h-4" /> Lacak</>}
                                    </button>
                                </div>
                            </form>
                            <div className="flex flex-wrap items-center gap-2 mt-4">
                                <span className="text-[11px] text-dark-500 font-medium">Coba:</span>
                                {samplePlates.map((p) => (
                                    <button key={p} onClick={() => { setPlateNumber(p); searchVehicle(p); }}
                                        className="text-[11px] font-mono font-semibold px-3 py-1.5 rounded-lg bg-dark-100/60 border border-dark-200/70 text-dark-500 hover:text-primary-600 hover:border-primary-500/50 hover:bg-primary-500/10 transition-all">
                                        {p}
                                    </button>
                                ))}
                            </div>
                            <div className="grid grid-cols-3 gap-3 mt-8 max-w-md">
                                {[
                                    { icon: Zap, title: 'Real-time', desc: 'WebSocket live' },
                                    { icon: ShieldCheck, title: 'Akurat', desc: 'GPS presisi' },
                                    { icon: Clock, title: 'Riwayat', desc: 'Timestamp detail' },
                                ].map(({ icon: Icon, title, desc }) => (
                                    <div key={title} className="glass rounded-2xl p-3.5 text-center">
                                        <Icon className="w-5 h-5 text-primary-500 mx-auto mb-1.5" />
                                        <p className="text-xs font-bold text-dark-900">{title}</p>
                                        <p className="text-[10px] text-dark-500">{desc}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="relative animate-fade-up delay-2 hidden lg:block">
                            <div className="glass-strong rounded-3xl overflow-hidden shadow-[0_24px_64px_rgba(15,23,42,0.15)] border border-dark-200/70">
                                <div className="h-[440px]">
                                    <MapContainer center={[-6.2088, 106.8456]} zoom={12} className="h-full w-full z-0" zoomControl={false} dragging={false} scrollWheelZoom={false}>
                                        <MapTiles />
                                        <Marker position={[-6.2088, 106.8456]} icon={vehicleIcon} />
                                        <Marker position={[-6.22, 106.86]} icon={activeVehicleIcon} />
                                    </MapContainer>
                                </div>
                                <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
                                    <span className="glass-strong rounded-xl px-3 py-2 text-[11px] font-bold text-dark-900 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-success-400 animate-pulse" /> 2 unit terpantau
                                    </span>
                                    <span className="glass-strong rounded-xl px-3 py-2 text-[11px] font-mono text-dark-600">Jakarta · ID</span>
                                </div>
                                <div className="absolute bottom-4 left-4 right-4 glass-strong rounded-2xl p-4 flex items-center gap-3 animate-float">
                                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-success-500 to-accent-500 flex items-center justify-center text-xl flex-shrink-0">🚛</div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-bold text-dark-900 font-mono">B-1234-ABC · <span className="text-success-500">62 km/h</span></p>
                                        <p className="text-[11px] text-dark-400">Jl. Sudirman · 2 detik lalu</p>
                                    </div>
                                    <Gauge className="w-5 h-5 text-primary-500 flex-shrink-0" />
                                </div>
                            </div>
                        </div>
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center animate-fade-up">
                        <div className="glass rounded-3xl p-10 max-w-sm w-full">
                            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-danger-500/30 to-danger-600/10 border border-danger-500/30 flex items-center justify-center mb-5 mx-auto text-4xl">🔍</div>
                            <h2 className="font-display text-xl font-bold text-dark-900 mb-2">Kendaraan tak ditemukan</h2>
                            <p className="text-dark-400 text-sm mb-6">{error}</p>
                            <button onClick={reset}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl glass glass-hover text-sm font-semibold text-dark-900">
                                <ArrowLeft className="w-4 h-4" /> Coba plat lain
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4 animate-fade-up">
                        {vehicle && (
                            <div className="glass-strong rounded-2xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center gap-4 shadow-[0_20px_60px_rgba(2,6,23,0.5)]">
                                <div className="flex items-center gap-3.5">
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 ${vehicle.is_driving ? 'bg-gradient-to-br from-success-500 to-accent-500 shadow-[0_8px_28px_rgba(34,197,94,0.5)] animate-pulse-ring' : 'bg-dark-100 border border-dark-200/70'}`}>
                                        🚛
                                    </div>
                                    <div>
                                        <p className="font-display text-lg font-bold text-dark-900 font-mono tracking-wide">{vehicle.plate_number}</p>
                                        <p className="text-xs text-dark-400">{vehicle.brand} {vehicle.model} · {vehicle.year}</p>
                                    </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-2.5 lg:ml-auto">
                                    <span className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-dark-100/60 border border-dark-200/70 text-xs font-bold text-dark-900 tabular-nums">
                                        <Gauge className="w-3.5 h-3.5 text-primary-600" /> {liveLocation?.speed ?? 0} km/h
                                    </span>
                                    <span className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-dark-100/60 border border-dark-200/70 text-xs text-dark-500">
                                        <Clock className="w-3.5 h-3.5 text-dark-400" /> {formatTimestamp(liveLocation?.timestamp)}
                                    </span>
                                    <span className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border ${vehicle.is_driving ? 'bg-success-500/15 border-success-500/30 text-success-500' : 'bg-dark-100/60 border-dark-200/70 text-dark-400'}`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${vehicle.is_driving ? 'bg-success-400 animate-pulse' : 'bg-dark-500'}`} />
                                        {vehicle.is_driving ? 'Bergerak' : 'Berhenti'}
                                    </span>
                                    <button onClick={reset} className="flex items-center gap-1.5 px-3 py-2 rounded-xl glass glass-hover text-xs font-semibold text-dark-700">
                                        <ArrowLeft className="w-3.5 h-3.5" /> Lainnya
                                    </button>
                                </div>
                            </div>
                        )}

                        {liveLocation ? (
                            <div className="relative rounded-3xl overflow-hidden border border-dark-200/70 shadow-[0_24px_64px_rgba(15,23,42,0.15)]">
                                <div className="h-[calc(100vh-280px)] min-h-[420px]">
                                    <MapContainer center={[liveLocation.latitude, liveLocation.longitude]} zoom={15} className="h-full w-full z-0" zoomControl={true}>
                                        <MapTiles />
                                        <MapUpdater location={liveLocation} />
                                        <Marker position={[liveLocation.latitude, liveLocation.longitude]} icon={vehicle.is_driving ? activeVehicleIcon : vehicleIcon}>
                                            <Popup>
                                                <div className="text-sm min-w-[170px]">
                                                    <p className="font-bold text-base font-mono">{vehicle.plate_number}</p>
                                                    <p className="opacity-70">{vehicle.brand} {vehicle.model}</p>
                                                    <hr className="my-1.5 opacity-20" />
                                                    <p>Kecepatan: <strong>{liveLocation.speed ?? 0} km/h</strong></p>
                                                    <p className="font-mono text-xs">{Number(liveLocation.latitude).toFixed(6)}, {Number(liveLocation.longitude).toFixed(6)}</p>
                                                </div>
                                            </Popup>
                                        </Marker>
                                    </MapContainer>
                                </div>
                                <div className="absolute bottom-4 left-4 right-4 sm:right-auto glass-strong rounded-2xl px-4 py-3 flex items-center gap-4 text-xs">
                                    <div><p className="text-dark-500 text-[10px] uppercase tracking-wider font-bold">Latitude</p><p className="font-mono font-bold text-dark-900">{Number(liveLocation.latitude).toFixed(5)}</p></div>
                                    <div className="w-px h-8 bg-white/10" />
                                    <div><p className="text-dark-500 text-[10px] uppercase tracking-wider font-bold">Longitude</p><p className="font-mono font-bold text-dark-900">{Number(liveLocation.longitude).toFixed(5)}</p></div>
                                    <div className="w-px h-8 bg-white/10 hidden sm:block" />
                                    <div className="hidden sm:block"><p className="text-dark-500 text-[10px] uppercase tracking-wider font-bold">Update</p><p className="font-bold text-success-500 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-success-400 animate-pulse" />{wsConnected ? 'Live WS' : 'Polling 10s'}</p></div>
                                </div>
                            </div>
                        ) : (
                            <div className="glass rounded-3xl flex flex-col items-center justify-center min-h-[420px] p-10 text-center">
                                <div className="w-20 h-20 rounded-3xl bg-dark-100/70 border border-dark-200/70 flex items-center justify-center mb-5 animate-float">
                                    <MapPin className="w-10 h-10 text-dark-500" />
                                </div>
                                <p className="text-dark-900 font-semibold">Belum ada data lokasi</p>
                                <p className="text-dark-500 text-sm mt-1 max-w-xs">Lokasi akan muncul otomatis saat kendaraan memulai perjalanan.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
