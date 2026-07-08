import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { apiFetch } from '../../utils/api';
import AdminLayout from '../../Layouts/AdminLayout';
import { PageLoader } from '../../Components/LoadingSpinner';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
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
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-dark-50">Fleet Live Map</h1>
                        <p className="text-sm text-dark-400 mt-1">
                            {vehicles.length} vehicles &mdash; {totalActive} with location
                        </p>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-dark-800/60 border border-dark-700/50">
                        <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-success-400 animate-pulse' : 'bg-yellow-400'}`} />
                        <span className="text-xs text-dark-300">{wsConnected ? 'Live' : 'Polling'}</span>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Map */}
                    <div className="lg:col-span-2">
                        <div className="h-[540px] rounded-xl overflow-hidden border border-dark-700/50 shadow-lg">
                            <MapContainer
                                center={[-6.2088, 106.8456]}
                                zoom={12}
                                className="h-full w-full z-0"
                                zoomControl={true}
                            >
                                <TileLayer
                                    attribution='&copy; <a href="https://carto.com/">CARTO</a>'
                                    url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                                />
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
                    <div className="space-y-3 max-h-[540px] overflow-y-auto pr-1">
                        {vehiclesWithLiveLocation.length === 0 && (
                            <p className="text-dark-400 text-sm text-center py-8">No vehicles found.</p>
                        )}
                        {vehiclesWithLiveLocation.map((v) => (
                            <div
                                key={v.id}
                                className={`rounded-xl border p-4 transition-all ${
                                    v.is_live
                                        ? 'bg-success-500/5 border-success-500/30'
                                        : 'bg-dark-800/50 border-dark-700/50'
                                }`}
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <p className="text-sm font-semibold text-dark-100">{v.plate_number}</p>
                                    {v.is_live && (
                                        <span className="flex items-center gap-1 text-xs text-success-400">
                                            <span className="w-1.5 h-1.5 rounded-full bg-success-400 animate-pulse" />
                                            Live
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-dark-400">{v.brand} {v.model}</p>
                                {v.latest_location ? (
                                    <div className="mt-2 space-y-0.5">
                                        <p className="text-xs text-primary-400 font-medium">
                                            {v.latest_location.speed ?? 0} km/h
                                        </p>
                                        <p className="text-xs text-dark-500">
                                            {Number(v.latest_location.latitude).toFixed(5)}, {Number(v.latest_location.longitude).toFixed(5)}
                                        </p>
                                    </div>
                                ) : (
                                    <p className="text-xs text-dark-500 mt-2">No location data</p>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}
