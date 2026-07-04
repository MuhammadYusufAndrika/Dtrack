import { useEffect, useState, useRef, useCallback } from 'react';
import DriverLayout from '../../Layouts/DriverLayout';
import StatCard from '../../Components/StatCard';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Truck, Route, Activity, Clock, MapPin, Navigation, Play, Square } from 'lucide-react';

const vehicleIcon = L.divIcon({ className: '', html: '<div style="width:32px;height:32px;background:#3b82f6;border:2px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.4);font-size:14px;">🚛</div>', iconSize: [32, 32], iconAnchor: [16, 16] });

function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function MapUpdater({ position }) {
    const map = useMap();
    useEffect(() => {
        if (position) map.flyTo(position, map.getZoom(), { duration: 1 });
    }, [position]);
    return null;
}

export default function DriverDashboard() {
    const [driver, setDriver] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTrip, setActiveTrip] = useState(null);
    const [tripState, setTripState] = useState('idle');
    const [gpsPos, setGpsPos] = useState(null);
    const [elapsed, setElapsed] = useState(0);
    const [distance, setDistance] = useState(0);
    const [gpsError, setGpsError] = useState('');

    const watchId = useRef(null);
    const lastPos = useRef(null);
    const locInterval = useRef(null);
    const timerInterval = useRef(null);

    useEffect(() => {
        (async () => {
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
            try {
                const meRes = await fetch('/api/auth/me', { headers });
                const meJson = await meRes.json();
                const email = meJson.data?.email;
                if (!email) return;

                const dRes = await fetch('/api/drivers', { headers });
                const dJson = await dRes.json();
                const myDriver = dJson.data?.find((d) => d.email === email);
                if (myDriver) setDriver(myDriver);

                if (myDriver) {
                    const tRes = await fetch('/api/trips', { headers });
                    const tJson = await tRes.json();
                    const ongoing = tJson.data?.find((t) => t.driver_id === myDriver.id && t.status === 'ACTIVE');
                    if (ongoing) {
                        setActiveTrip(ongoing);
                        setTripState('tracking');
                        watchId.current = navigator.geolocation.watchPosition(
                            (p) => {
                                const newPos = { lat: p.coords.latitude, lng: p.coords.longitude, speed: p.coords.speed ?? 0, heading: p.coords.heading ?? 0, accuracy: p.coords.accuracy ?? 0 };
                                setGpsPos(newPos);
                                if (lastPos.current) setDistance((prev) => prev + haversine(lastPos.current.lat, lastPos.current.lng, newPos.lat, newPos.lng));
                                lastPos.current = { lat: newPos.lat, lng: newPos.lng };
                            },
                            (err) => setGpsError(`GPS error: ${err.message}`),
                            { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 }
                        );
                    }
                }
            } catch {}
            setLoading(false);
        })();
    }, []);

    useEffect(() => {
        if (tripState === 'tracking' && activeTrip) {
            const start = new Date(activeTrip.start_time).getTime();
            timerInterval.current = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
        }
        return () => { if (timerInterval.current) clearInterval(timerInterval.current); };
    }, [tripState, activeTrip]);

    useEffect(() => {
        if (tripState === 'tracking' && driver?.vehicle && gpsPos) {
            locInterval.current = setInterval(async () => {
                try {
                    await fetch('/api/location', {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json', Accept: 'application/json' },
                        body: JSON.stringify({ vehicle_id: driver.vehicle.id, latitude: gpsPos.lat, longitude: gpsPos.lng, speed: Math.round(gpsPos.speed), heading: Math.round(gpsPos.heading), accuracy: Math.round(gpsPos.accuracy) }),
                    });
                } catch {}
            }, 5000);
        }
        return () => { if (locInterval.current) clearInterval(locInterval.current); };
    }, [tripState, gpsPos, driver?.vehicle]);

    const handleStartTrip = useCallback(async () => {
        if (!driver?.vehicle) return;
        setTripState('starting');
        const token = localStorage.getItem('token');
        const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' };

        try {
            const pos = await new Promise((resolve, reject) =>
                navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 })
            );
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;

            const tripRes = await fetch('/api/trips', {
                method: 'POST', headers,
                body: JSON.stringify({ vehicle_id: driver.vehicle.id, driver_id: driver.id, start_latitude: lat, start_longitude: lng }),
            });
            const tripJson = await tripRes.json();
            if (!tripJson.success) { setGpsError(tripJson.message); setTripState('idle'); return; }
            setActiveTrip(tripJson.data);

            watchId.current = navigator.geolocation.watchPosition(
                (p) => {
                    const newPos = { lat: p.coords.latitude, lng: p.coords.longitude, speed: p.coords.speed ?? 0, heading: p.coords.heading ?? 0, accuracy: p.coords.accuracy ?? 0 };
                    setGpsPos(newPos);
                    if (lastPos.current) setDistance((prev) => prev + haversine(lastPos.current.lat, lastPos.current.lng, newPos.lat, newPos.lng));
                    lastPos.current = { lat: newPos.lat, lng: newPos.lng };
                },
                (err) => setGpsError(`GPS error: ${err.message}`),
                { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 }
            );
            setTripState('tracking');
            setGpsError('');
        } catch (err) {
            setGpsError(err.message || 'Failed to start trip');
            setTripState('idle');
        }
    }, [driver]);

    const handleEndTrip = useCallback(async () => {
        if (!activeTrip || !gpsPos) return;
        setTripState('ending');
        const token = localStorage.getItem('token');
        const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' };

        try {
            if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
            if (locInterval.current) clearInterval(locInterval.current);

            await fetch(`/api/trips/${activeTrip.id}`, {
                method: 'PATCH', headers,
                body: JSON.stringify({ action: 'end', end_latitude: gpsPos.lat, end_longitude: gpsPos.lng, total_distance_km: Math.round(distance * 100) / 100 }),
            });

            setTripState('idle');
            setActiveTrip(null);
            setGpsPos(null);
            setDistance(0);
            setElapsed(0);
            lastPos.current = null;
        } catch (err) {
            setGpsError(err.message || 'Failed to end trip');
            setTripState('tracking');
        }
    }, [activeTrip, gpsPos, distance]);

    useEffect(() => {
        return () => {
            if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
            if (locInterval.current) clearInterval(locInterval.current);
            if (timerInterval.current) clearInterval(timerInterval.current);
        };
    }, []);

    const fmt = (sec) => {
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = sec % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    if (loading) {
        return <DriverLayout><div className="flex items-center justify-center h-[60vh]"><div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /></div></DriverLayout>;
    }

    if (!driver) {
        return <DriverLayout><div className="text-center py-12"><p className="text-dark-400">No driver profile linked to this account.</p></div></DriverLayout>;
    }

    return (
        <DriverLayout>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div><h1 className="text-2xl font-bold text-dark-50">My Dashboard</h1><p className="text-dark-400 text-sm mt-1">Welcome back, {driver.name}</p></div>
                    {tripState === 'idle' && driver.vehicle && (
                        <button onClick={handleStartTrip} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-sm font-semibold transition-colors">
                            <Play className="w-4 h-4" /> Start Trip
                        </button>
                    )}
                    {(tripState === 'starting' || tripState === 'ending') && (
                        <div className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-dark-700 text-dark-300 text-sm">
                            <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                            {tripState === 'starting' ? 'Starting trip...' : 'Ending trip...'}
                        </div>
                    )}
                    {tripState === 'tracking' && (
                        <button onClick={handleEndTrip} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-danger-600 hover:bg-danger-500 text-white text-sm font-semibold transition-colors">
                            <Square className="w-4 h-4" /> End Trip
                        </button>
                    )}
                </div>

                {gpsError && <div className="rounded-xl bg-danger-500/10 border border-danger-500/30 p-3 text-sm text-danger-400">{gpsError}</div>}

                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <StatCard icon={Truck} label="Vehicle" value={driver.vehicle?.plate_number || 'None'} />
                    <StatCard icon={Activity} label="Status" value={tripState === 'tracking' ? 'On Trip' : driver.status || 'Idle'} />
                    <StatCard icon={Clock} label="Elapsed" value={tripState === 'tracking' ? fmt(elapsed) : '—'} />
                    <StatCard icon={Navigation} label="Speed" value={tripState === 'tracking' && gpsPos ? `${Math.round(gpsPos.speed * 3.6)} km/h` : '—'} />
                    <StatCard icon={MapPin} label="Distance" value={tripState === 'tracking' ? `${distance.toFixed(2)} km` : '—'} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                        <div className="rounded-xl bg-dark-800/50 border border-dark-700/50 overflow-hidden">
                            <div className="p-4 border-b border-dark-700/50 flex items-center justify-between">
                                <h2 className="text-sm font-semibold text-dark-100">{tripState === 'tracking' ? 'Live Tracking' : 'Current Location'}</h2>
                                {tripState === 'tracking' && <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-success-400 animate-pulse" /><span className="text-xs text-success-400">Live</span></span>}
                            </div>
                            <div className="h-[400px]">
                                <MapContainer center={[-6.2088, 106.8456]} zoom={15} className="h-full w-full z-0" zoomControl={false}>
                                    <TileLayer attribution='&copy; <a href="https://carto.com/">CARTO</a>' url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
                                    {gpsPos && <MapUpdater position={[gpsPos.lat, gpsPos.lng]} />}
                                    {gpsPos && <Marker position={[gpsPos.lat, gpsPos.lng]} icon={vehicleIcon}><Popup><div className="text-sm"><p>Speed: {Math.round(gpsPos.speed * 3.6)} km/h</p></div></Popup></Marker>}
                                </MapContainer>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div className="rounded-xl bg-dark-800/50 border border-dark-700/50 p-4">
                            <h3 className="text-sm font-semibold text-dark-100 mb-3">Driver Info</h3>
                            <div className="space-y-3">
                                <InfoRow label="Name" value={driver.name} />
                                <InfoRow label="Email" value={driver.email} />
                                <InfoRow label="Phone" value={driver.phone || '—'} />
                                <InfoRow label="License" value={driver.license_number || '—'} />
                            </div>
                        </div>
                        <div className="rounded-xl bg-dark-800/50 border border-dark-700/50 p-4">
                            <h3 className="text-sm font-semibold text-dark-100 mb-3">Vehicle Info</h3>
                            {driver.vehicle ? (
                                <div className="space-y-3">
                                    <InfoRow label="Plate" value={driver.vehicle.plate_number} />
                                    <InfoRow label="Brand" value={driver.vehicle.brand} />
                                    <InfoRow label="Model" value={driver.vehicle.model} />
                                </div>
                            ) : <p className="text-sm text-dark-400">No vehicle assigned</p>}
                        </div>
                        {tripState === 'tracking' && gpsPos && (
                            <div className="rounded-xl bg-dark-800/50 border border-dark-700/50 p-4">
                                <h3 className="text-sm font-semibold text-dark-100 mb-3">GPS Data</h3>
                                <div className="space-y-2 text-xs">
                                    <InfoRow label="Latitude" value={gpsPos.lat.toFixed(6)} />
                                    <InfoRow label="Longitude" value={gpsPos.lng.toFixed(6)} />
                                    <InfoRow label="Accuracy" value={gpsPos.accuracy < 1 ? '<1 m' : `${Math.round(gpsPos.accuracy)} m`} />
                                    <InfoRow label="Heading" value={`${Math.round(gpsPos.heading)}°`} />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </DriverLayout>
    );
}

function InfoRow({ label, value }) {
    return (
        <div className="flex justify-between items-center">
            <span className="text-xs text-dark-400">{label}</span>
            <span className="text-xs font-medium text-dark-200">{value}</span>
        </div>
    );
}
