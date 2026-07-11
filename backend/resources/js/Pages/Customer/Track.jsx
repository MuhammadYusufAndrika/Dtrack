import { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Search, Truck, MapPin, Gauge, Clock, ArrowLeft, Loader2 } from 'lucide-react';

const vehicleIcon = L.divIcon({
    className: '',
    html: '<div style="width:40px;height:40px;background:#3b82f6;border:3px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 16px rgba(59,130,246,0.6);font-size:18px;">🚛</div>',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
});

const activeVehicleIcon = L.divIcon({
    className: '',
    html: '<div style="width:44px;height:44px;background:#22c55e;border:3px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 20px rgba(34,197,94,0.7);font-size:20px;animation:pulse 2s infinite;">🚛</div>',
    iconSize: [44, 44],
    iconAnchor: [22, 22],
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
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
}

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

    return (
        <div className="min-h-screen bg-dark-950">
            {/* Header */}
            <div className="bg-dark-900/80 backdrop-blur-md border-b border-dark-700/50 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
                            <Truck className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-sm font-bold text-dark-50 leading-tight">FleetVision</h1>
                            <p className="text-[10px] text-dark-400 leading-tight">Vehicle Tracking</p>
                        </div>
                    </div>

                    {/* Search Form */}
                    <form onSubmit={handleSubmit} className="flex-1 max-w-md ml-auto">
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" />
                                <input
                                    type="text"
                                    value={plateNumber}
                                    onChange={(e) => setPlateNumber(e.target.value)}
                                    placeholder="Masukkan nomor plat (contoh: ABC-1234)"
                                    className="w-full bg-dark-800 border border-dark-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-dark-100 placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500/50 transition-all"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={loading || !plateNumber.trim()}
                                className="px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white text-sm font-semibold transition-all flex items-center gap-2"
                            >
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                                Lacak
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-7xl mx-auto px-4 py-6">
                {!hasSearched ? (
                    /* Landing state */
                    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                        <div className="w-24 h-24 rounded-3xl bg-dark-800/60 border border-dark-700/50 flex items-center justify-center mb-6">
                            <MapPin className="w-12 h-12 text-primary-400" />
                        </div>
                        <h2 className="text-2xl font-bold text-dark-50 mb-2">Lacak Kendaraan</h2>
                        <p className="text-dark-400 max-w-sm mb-8">
                            Masukkan nomor plat kendaraan untuk melihat lokasi secara real-time
                        </p>
                        <form onSubmit={handleSubmit} className="w-full max-w-sm">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={plateNumber}
                                    onChange={(e) => setPlateNumber(e.target.value)}
                                    placeholder="Nomor plat kendaraan"
                                    className="flex-1 bg-dark-800 border border-dark-700 rounded-xl px-4 py-3 text-sm text-dark-100 placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500/50 transition-all"
                                />
                                <button
                                    type="submit"
                                    disabled={!plateNumber.trim()}
                                    className="px-6 py-3 rounded-xl bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white text-sm font-semibold transition-all"
                                >
                                    Lacak
                                </button>
                            </div>
                        </form>
                    </div>
                ) : error ? (
                    /* Error state */
                    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                        <div className="w-20 h-20 rounded-2xl bg-danger-500/10 border border-danger-500/30 flex items-center justify-center mb-6">
                            <Truck className="w-10 h-10 text-danger-400" />
                        </div>
                        <h2 className="text-xl font-bold text-dark-50 mb-2">Tidak Ditemukan</h2>
                        <p className="text-dark-400 mb-6">{error}</p>
                        <button
                            onClick={() => { setHasSearched(false); setError(''); setPlateNumber(''); }}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-dark-800 border border-dark-700 text-sm text-dark-300 hover:bg-dark-700 transition-all"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Coba Lagi
                        </button>
                    </div>
                ) : (
                    /* Tracking view */
                    <div className="space-y-4">
                        {/* Vehicle Info Bar */}
                        {vehicle && (
                            <div className="bg-dark-800/60 border border-dark-700/50 rounded-xl p-4">
                                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${vehicle.is_driving ? 'bg-success-500/10' : 'bg-dark-700'}`}>
                                            <Truck className={`w-5 h-5 ${vehicle.is_driving ? 'text-success-400' : 'text-dark-400'}`} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-dark-50">{vehicle.plate_number}</p>
                                            <p className="text-xs text-dark-400">{vehicle.brand} {vehicle.model} &middot; {vehicle.year}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4 sm:ml-auto text-xs">
                                        <div className="flex items-center gap-1.5">
                                            <Gauge className="w-3.5 h-3.5 text-dark-400" />
                                            <span className="text-dark-300">{liveLocation?.speed ?? 0} km/h</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <Clock className="w-3.5 h-3.5 text-dark-400" />
                                            <span className="text-dark-300">{formatTimestamp(liveLocation?.timestamp)}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <span className={`w-2 h-2 rounded-full ${vehicle.is_driving ? 'bg-success-400 animate-pulse' : 'bg-dark-500'}`} />
                                            <span className={`font-medium ${vehicle.is_driving ? 'text-success-400' : 'text-dark-400'}`}>
                                                {vehicle.is_driving ? 'Bergerak' : 'Berhenti'}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${vehicle.status === 'active' ? 'bg-success-500/10 text-success-400' : 'bg-dark-700 text-dark-400'}`}>
                                                {vehicle.status === 'active' ? 'Aktif' : vehicle.status}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Map */}
                        {liveLocation ? (
                            <div className="h-[calc(100vh-220px)] min-h-[400px] rounded-xl overflow-hidden border border-dark-700/50 shadow-lg">
                                <MapContainer
                                    center={[liveLocation.latitude, liveLocation.longitude]}
                                    zoom={15}
                                    className="h-full w-full z-0"
                                    zoomControl={true}
                                >
                                    <TileLayer
                                        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
                                        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                                    />
                                    <MapUpdater location={liveLocation} />
                                    <Marker
                                        position={[liveLocation.latitude, liveLocation.longitude]}
                                        icon={vehicle.is_driving ? activeVehicleIcon : vehicleIcon}
                                    >
                                        <Popup>
                                            <div className="text-sm text-dark-900 min-w-[160px]">
                                                <p className="font-bold text-base">{vehicle.plate_number}</p>
                                                <p className="text-dark-600">{vehicle.brand} {vehicle.model}</p>
                                                <hr className="my-1" />
                                                <p>Speed: <strong>{liveLocation.speed ?? 0} km/h</strong></p>
                                                <p>Lat: {Number(liveLocation.latitude).toFixed(6)}</p>
                                                <p>Lng: {Number(liveLocation.longitude).toFixed(6)}</p>
                                            </div>
                                        </Popup>
                                    </Marker>
                                </MapContainer>
                            </div>
                        ) : (
                            /* No location data */
                            <div className="flex flex-col items-center justify-center min-h-[400px] bg-dark-800/30 rounded-xl border border-dark-700/50">
                                <MapPin className="w-12 h-12 text-dark-600 mb-4" />
                                <p className="text-dark-400 text-sm">Belum ada data lokasi untuk kendaraan ini</p>
                                <p className="text-dark-500 text-xs mt-1">Lokasi akan muncul saat kendaraan sedang dalam perjalanan</p>
                            </div>
                        )}

                        {/* Back button */}
                        <button
                            onClick={() => { setHasSearched(false); setVehicle(null); setLiveLocation(null); setPlateNumber(''); }}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-dark-800 border border-dark-700 text-sm text-dark-300 hover:bg-dark-700 transition-all"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Lacak Kendaraan Lain
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
