import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Link } from '@inertiajs/react';
import { apiFetch } from '../../utils/api';
import AdminLayout from '../../Layouts/AdminLayout';
import PageHeader from '../../Components/PageHeader';
import { PageLoader } from '../../Components/LoadingSpinner';
import { MapContainer, Marker, Popup, useMap } from 'react-leaflet';
import MapTiles from '../../Components/MapTiles';
import L from 'leaflet';

const vehicleIcon = L.divIcon({
    className: '',
    html: '<div style="width:32px;height:32px;background:#3b82f6;border:3px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 12px rgba(59,130,246,0.6);font-size:14px;">🚛</div>',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
});

const activeVehicleIcon = L.divIcon({
    className: '',
    html: '<div style="width:36px;height:36px;background:#22c55e;border:3px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 16px rgba(34,197,94,0.7);font-size:15px;animation:pulse 2s infinite;">🚛</div>',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
});

function Updater({ vehicles }) {
    const map = useMap();
    const hasFitted = useRef(false);
    useEffect(() => {
        if (hasFitted.current) return;
        const located = vehicles.filter((v) => v.latest_location);
        if (located.length > 0) {
            const bounds = L.latLngBounds(
                located.map((v) => [v.latest_location.latitude, v.latest_location.longitude])
            );
            map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
            hasFitted.current = true;
        }
    }, [vehicles]);
    return null;
}

export default function Fleet() {
    const [vehicles, setVehicles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [liveLocations, setLiveLocations] = useState({}); // { vehicle_id: { latitude, longitude, speed, heading, timestamp } }
    const [wsConnected, setWsConnected] = useState(false);
    const intervalRef = useRef(null);
    const echoChannels = useRef([]);

    const fetchData = useCallback(async () => {
        try {
            const vRes = await apiFetch('/api/vehicles');
            const vJson = await vRes.json();
            if (vJson.success) {
                setVehicles(vJson.data);
                // Seed initial live locations from API response
                setLiveLocations((prev) => {
                    const next = { ...prev };
                    vJson.data.forEach((v) => {
                        // Always refresh from API if vehicle is actively driving,
                        // or seed initial position if no entry exists yet.
                        if (v.latest_location && (v.is_driving || !next[v.id])) {
                            next[v.id] = v.latest_location;
                        }
                    });
                    return next;
                });
            }
        } catch {}
    }, []);

    // Subscribe to WebSocket channels for each vehicle
    const subscribeToVehicles = useCallback((vehicleList) => {
        if (!window.Echo) return;

        // Unsubscribe from old channels
        echoChannels.current.forEach((ch) => window.Echo.leave(ch));
        echoChannels.current = [];

        vehicleList.forEach((vehicle) => {
            const channelName = `vehicle.${vehicle.id}`;
            window.Echo.channel(channelName)
                .listen('.location.updated', (data) => {
                    setLiveLocations((prev) => ({
                        ...prev,
                        [data.vehicle_id]: {
                            latitude: data.latitude,
                            longitude: data.longitude,
                            speed: data.speed,
                            heading: data.heading,
                            timestamp: data.timestamp,
                        },
                    }));
                })
                .subscribed(() => {
                    setWsConnected(true);
                });
            echoChannels.current.push(channelName);
        });
    }, []);

    useEffect(() => {
        fetchData().finally(() => setLoading(false));
        intervalRef.current = setInterval(fetchData, 10000);
        return () => {
            clearInterval(intervalRef.current);
            // Cleanup WebSocket channels
            echoChannels.current.forEach((ch) => window.Echo?.leave(ch));
        };
    }, []);

    // When vehicles load, subscribe to their WebSocket channels
    useEffect(() => {
        if (vehicles.length > 0) {
            subscribeToVehicles(vehicles);
        }
    }, [vehicles.length]);

    // Clean up liveLocations for vehicles that no longer have an active session AND no API location
    useEffect(() => {
        if (vehicles.length === 0) return;
        setLiveLocations((prev) => {
            const next = { ...prev };
            let changed = false;
            vehicles.forEach((v) => {
                if (!v.is_driving && !v.latest_location && next[v.id]) {
                    delete next[v.id];
                    changed = true;
                }
            });
            return changed ? next : prev;
        });
    }, [vehicles]);

    // Merge API vehicle data with live WebSocket locations
    // is_live: based on backend's active driving session; liveLocations provides real-time position
    const vehiclesWithLiveLocation = useMemo(() => vehicles.map((v) => ({
        ...v,
        latest_location: liveLocations[v.id] || v.latest_location,
        is_live: v.is_driving,
    })), [vehicles, liveLocations]);

    const activeVehicles = vehiclesWithLiveLocation.filter((v) => v.latest_location);
    const totalActive = activeVehicles.length;

    if (loading) return <AdminLayout><PageLoader /></AdminLayout>;

    return (
        <AdminLayout>
            <div className="space-y-6">
                {/* Header */}
                <PageHeader
                    eyebrow="Fleet Monitoring"
                    title="Fleet Live Map"
                    description={`${vehicles.length} unit — ${totalActive} dengan lokasi terkini.`}
                    action={
                        <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl glass text-xs font-semibold text-dark-700">
                            <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-success-400 animate-pulse' : 'bg-warning-400'}`} />
                            {wsConnected ? 'Live WebSocket' : 'Polling 10s'}
                        </div>
                    }
                />

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                    {/* Map */}
                    <div className="lg:col-span-2">
                        <div className="h-[540px] rounded-3xl overflow-hidden border border-dark-200/70 shadow-[0_24px_64px_rgba(15,23,42,0.15)]">
                            <MapContainer
                                center={[-6.2088, 106.8456]}
                                zoom={12}
                                className="h-full w-full z-0"
                                zoomControl={true}
                            >
                                <MapTiles />
                                <Updater vehicles={vehiclesWithLiveLocation} />
                                {vehiclesWithLiveLocation.map((v) =>
                                    v.latest_location ? (
                                        <Marker
                                            key={v.id}
                                            position={[v.latest_location.latitude, v.latest_location.longitude]}
                                            icon={v.is_live ? activeVehicleIcon : vehicleIcon}
                                        >
                                            <Popup>
                                                <div className="text-sm text-dark-900 min-w-[140px]">
                                                    <p className="font-bold text-base">{v.plate_number}</p>
                                                    <p className="text-dark-600">{v.brand} {v.model}</p>
                                                    <hr className="my-1" />
                                                    <p>Speed: <strong>{v.latest_location.speed ?? '—'} km/h</strong></p>
                                                    <p>Lat: {Number(v.latest_location.latitude).toFixed(6)}</p>
                                                    <p>Lng: {Number(v.latest_location.longitude).toFixed(6)}</p>
                                                    {v.latest_location.timestamp && (
                                                        <p className="text-xs text-dark-400 mt-1">
                                                            {new Date(v.latest_location.timestamp).toLocaleTimeString()}
                                                        </p>
                                                    )}
                                                    <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-semibold ${v.is_live ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                                        {v.is_live ? '🟢 Live' : '⏱ Last Known'}
                                                    </span>
                                                </div>
                                            </Popup>
                                        </Marker>
                                    ) : null
                                )}
                            </MapContainer>
                        </div>
                    </div>

                    {/* Vehicle List Sidebar */}
                    <div className="space-y-2.5 max-h-[540px] overflow-y-auto pr-1">
                        {vehiclesWithLiveLocation.length === 0 && (
                            <div className="glass rounded-2xl text-center py-10"><p className="text-3xl mb-2">🚛</p><p className="text-dark-400 text-sm">Belum ada kendaraan.</p></div>
                        )}
                        {vehiclesWithLiveLocation.map((v) => (
                            <Link
                                key={v.id}
                                href={`/admin/fleet/${v.id}`}
                                className={`block rounded-2xl border p-4 transition-all glass-hover ${
                                    v.is_live
                                        ? '!border-success-500/30 bg-success-500/[0.06]'
                                        : 'glass'
                                }`}
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <p className="text-sm font-bold text-dark-900 font-mono tracking-wide">{v.plate_number}</p>
                                    {v.is_live && (
                                        <span className="flex items-center gap-1 text-[11px] font-bold text-success-500">
                                            <span className="w-1.5 h-1.5 rounded-full bg-success-400 animate-pulse" />
                                            LIVE
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-dark-400">{v.brand} {v.model}</p>
                                {v.latest_location ? (
                                    <div className="mt-2.5 flex items-center gap-3">
                                        <p className="text-xs text-primary-600 font-bold tabular-nums">
                                            {v.latest_location.speed ?? 0} km/h
                                        </p>
                                        <p className="text-[11px] text-dark-500 font-mono">
                                            {Number(v.latest_location.latitude).toFixed(5)}, {Number(v.latest_location.longitude).toFixed(5)}
                                        </p>
                                    </div>
                                ) : (
                                    <p className="text-[11px] text-dark-600 mt-2">Belum ada data lokasi</p>
                                )}
                            </Link>
                        ))}
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}
