import { useEffect, useState, useRef, useCallback } from 'react';
import DriverLayout from '../../Layouts/DriverLayout';
import StatCard from '../../Components/StatCard';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Truck, Route, Activity, Clock, MapPin, Navigation, Play, Square, Camera, AlertTriangle, Shield, Eye, Phone, User } from 'lucide-react';

const AI_SERVICE_HOST = window.location.hostname;
const AI_SERVICE_WS = `ws://${AI_SERVICE_HOST}:5000/inference/stream`;
const AI_SERVICE_HTTP = `http://${AI_SERVICE_HOST}:5000`;

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

const AI_INITIAL = { face_detected: false, seatbelt: false, fatigue: false, phone: false, looking_away: false, eye_closed: 0, head_pose: { yaw: 0, pitch: 0, roll: 0 } };

export default function DriverDashboard() {
    const [driver, setDriver] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTrip, setActiveTrip] = useState(null);
    const [tripState, setTripState] = useState('idle');
    const [gpsPos, setGpsPos] = useState(null);
    const [elapsed, setElapsed] = useState(0);
    const [distance, setDistance] = useState(0);
    const [gpsError, setGpsError] = useState('');

    const [aiResults, setAiResults] = useState(AI_INITIAL);
    const [aiStatus, setAiStatus] = useState('idle');
    const [aiError, setAiError] = useState('');
    const [cameraActive, setCameraActive] = useState(false);

    const watchId = useRef(null);
    const lastPos = useRef(null);
    const locInterval = useRef(null);
    const timerInterval = useRef(null);
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const aiWsRef = useRef(null);
    const aiFrameInterval = useRef(null);
    const streamRef = useRef(null);
    // Always-current vehicle_id ref so captureAndSendFrame never uses a stale closure value
    const vehicleIdRef = useRef('unknown');

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
                if (myDriver) {
                    setDriver(myDriver);
                    vehicleIdRef.current = myDriver.vehicle?.vehicle_id || 'unknown';
                }

                if (myDriver) {
                    const tRes = await fetch('/api/trips', { headers });
                    const tJson = await tRes.json();
                    const ongoing = tJson.data?.find((t) => t.driver_id === myDriver.id && t.status === 'IN_PROGRESS');
                    if (ongoing) {
                        setActiveTrip(ongoing);
                        setTripState('tracking');
                        startGpsTracking();
                        startCamera();
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

    // Keep vehicleIdRef in sync whenever driver state changes
    useEffect(() => {
        if (driver?.vehicle?.vehicle_id) {
            vehicleIdRef.current = driver.vehicle.vehicle_id;
        }
    }, [driver?.vehicle?.vehicle_id]);

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

    const startGpsTracking = useCallback(() => {
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
    }, []);

    const stopGpsTracking = useCallback(() => {
        if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
    }, []);

    const startCamera = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 320, height: 240 } });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play();
            }
            setCameraActive(true);
            startAiWebSocket(stream);
        } catch (err) {
            setAiError('Camera access denied: ' + err.message);
        }
    }, []);

    const stopCamera = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
        if (videoRef.current) videoRef.current.srcObject = null;
        setCameraActive(false);
        stopAiWebSocket();
    }, []);

    const startAiWebSocket = useCallback((stream) => {
        try {
            const ws = new WebSocket(AI_SERVICE_WS);
            aiWsRef.current = ws;

            ws.onopen = () => {
                setAiStatus('connected');
                setAiError('');
                captureAndSendFrame(stream);
                aiFrameInterval.current = setInterval(() => captureAndSendFrame(stream), 1000);
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.result) {
                        setAiResults(data.result);
                    } else if (data.error) {
                        setAiError(data.error);
                    }
                } catch {}
            };

            ws.onerror = () => {
                setAiStatus('error');
                setAiError('AI service connection failed — make sure the AI service is running on port 5000');
            };

            ws.onclose = () => {
                setAiStatus('disconnected');
                if (aiFrameInterval.current) clearInterval(aiFrameInterval.current);
            };
        } catch (err) {
            setAiStatus('error');
            setAiError('Failed to connect to AI service: ' + err.message);
        }
    }, []);

    const stopAiWebSocket = useCallback(() => {
        if (aiFrameInterval.current) clearInterval(aiFrameInterval.current);
        if (aiWsRef.current) {
            aiWsRef.current.close();
            aiWsRef.current = null;
        }
        setAiStatus('idle');
        setAiResults(AI_INITIAL);
    }, []);

    const captureAndSendFrame = useCallback((stream) => {
        if (!videoRef.current || !canvasRef.current || !aiWsRef.current || aiWsRef.current.readyState !== WebSocket.OPEN) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        canvas.width = video.videoWidth || 320;
        canvas.height = video.videoHeight || 240;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
        const base64 = dataUrl.split(',')[1];

        try {
            aiWsRef.current.send(JSON.stringify({
                frame: base64,
                // Always use the ref so we never send 'unknown' due to a stale closure
                vehicle_id: vehicleIdRef.current,
            }));
        } catch {}
    }, []); // no driver dependency — vehicleIdRef is always current

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

            const startRes = await fetch(`/api/trips/${tripJson.data.id}`, {
                method: 'PATCH', headers,
                body: JSON.stringify({ action: 'start' }),
            });
            const startJson = await startRes.json();
            if (!startJson.success) { setGpsError(startJson.message); setTripState('idle'); return; }
            setActiveTrip(startJson.data);

            startGpsTracking();
            setTripState('tracking');
            setGpsError('');
            startCamera();
        } catch (err) {
            setGpsError(err.message || 'Failed to start trip');
            setTripState('idle');
        }
    }, [driver, startGpsTracking, startCamera]);

    const handleEndTrip = useCallback(async () => {
        if (!activeTrip || !gpsPos) return;
        setTripState('ending');
        const token = localStorage.getItem('token');
        const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' };

        try {
            stopGpsTracking();
            if (locInterval.current) clearInterval(locInterval.current);
            stopCamera();

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
    }, [activeTrip, gpsPos, distance, stopGpsTracking, stopCamera]);

    useEffect(() => {
        return () => {
            stopGpsTracking();
            if (locInterval.current) clearInterval(locInterval.current);
            if (timerInterval.current) clearInterval(timerInterval.current);
            stopCamera();
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
                {aiError && <div className="rounded-xl bg-warning-500/10 border border-warning-500/30 p-3 text-sm text-warning-400">{aiError}</div>}

                <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                    <StatCard icon={Truck} label="Vehicle" value={driver.vehicle?.plate_number || 'None'} />
                    <StatCard icon={Activity} label="Status" value={tripState === 'tracking' ? 'On Trip' : driver.status || 'Idle'} />
                    <StatCard icon={Clock} label="Elapsed" value={tripState === 'tracking' ? fmt(elapsed) : '—'} />
                    <StatCard icon={Navigation} label="Speed" value={tripState === 'tracking' && gpsPos ? `${Math.round(gpsPos.speed * 3.6)} km/h` : '—'} />
                    <StatCard icon={MapPin} label="Distance" value={tripState === 'tracking' ? `${distance.toFixed(2)} km` : '—'} />
                    <StatCard icon={Camera} label="AI Camera" value={cameraActive ? 'Active' : 'Off'} />
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

                {/* Camera + AI Panel */}
                {tripState === 'tracking' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Camera Feed */}
                        <div className="rounded-xl bg-dark-800/50 border border-dark-700/50 overflow-hidden">
                            <div className="p-4 border-b border-dark-700/50 flex items-center justify-between">
                                <h3 className="text-sm font-semibold text-dark-100 flex items-center gap-2">
                                    <Camera className="w-4 h-4" /> Driver Camera
                                </h3>
                                {cameraActive ? (
                                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-success-400 animate-pulse" /><span className="text-xs text-success-400">Streaming</span></span>
                                ) : (
                                    <span className="text-xs text-dark-400">Inactive</span>
                                )}
                            </div>
                            <div className="relative bg-dark-900" style={{ minHeight: '240px' }}>
                                <video ref={videoRef} className="w-full h-auto" style={{ transform: 'scaleX(-1)' }} muted playsInline />
                                <canvas ref={canvasRef} className="hidden" />
                                {!cameraActive && (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <p className="text-dark-500 text-sm">Camera activates when trip starts</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* AI Detection Results */}
                        <div className="rounded-xl bg-dark-800/50 border border-dark-700/50 overflow-hidden">
                            <div className="p-4 border-b border-dark-700/50 flex items-center justify-between">
                                <h3 className="text-sm font-semibold text-dark-100 flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4" /> AI Behavior Detection
                                </h3>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${aiStatus === 'connected' ? 'bg-success-500/20 text-success-400' : aiStatus === 'error' ? 'bg-danger-500/20 text-danger-400' : 'bg-dark-600 text-dark-400'}`}>
                                    {aiStatus === 'connected' ? 'Connected' : aiStatus === 'error' ? 'Error' : 'Idle'}
                                </span>
                            </div>
                            <div className="p-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <AiIndicator icon={User} label="Face Detected" active={aiResults.face_detected} />
                                    <AiIndicator icon={Shield} label="Seatbelt On" active={aiResults.seatbelt} danger={aiResults.seatbelt === false && aiResults.face_detected} />
                                    <AiIndicator icon={Eye} label="Eyes Open" active={aiResults.eye_closed < 0.5} danger={aiResults.eye_closed >= 0.7} />
                                    <AiIndicator icon={AlertTriangle} label="No Fatigue" active={!aiResults.fatigue} danger={aiResults.fatigue} />
                                    <AiIndicator icon={Phone} label="No Phone" active={!aiResults.phone} danger={aiResults.phone} />
                                    <AiIndicator icon={Navigation} label="Looking Ahead" active={!aiResults.looking_away} danger={aiResults.looking_away} />
                                </div>
                                <div className="mt-3 pt-3 border-t border-dark-700/50">
                                    <div className="grid grid-cols-3 gap-2 text-xs">
                                        <div><span className="text-dark-400">Eye Closure:</span> <span className="text-dark-200 font-medium">{(aiResults.eye_closed * 100).toFixed(0)}%</span></div>
                                        <div><span className="text-dark-400">Yaw:</span> <span className="text-dark-200 font-medium">{aiResults.head_pose?.yaw?.toFixed(0) || 0}°</span></div>
                                        <div><span className="text-dark-400">Pitch:</span> <span className="text-dark-200 font-medium">{aiResults.head_pose?.pitch?.toFixed(0) || 0}°</span></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
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

function AiIndicator({ icon: Icon, label, active, danger }) {
    return (
        <div className={`flex items-center gap-2 p-2.5 rounded-lg border transition-colors ${danger ? 'bg-danger-500/10 border-danger-500/30' : active ? 'bg-success-500/10 border-success-500/30' : 'bg-dark-700/30 border-dark-600/30'}`}>
            <Icon className={`w-4 h-4 ${danger ? 'text-danger-400' : active ? 'text-success-400' : 'text-dark-400'}`} />
            <span className={`text-xs font-medium ${danger ? 'text-danger-400' : active ? 'text-success-400' : 'text-dark-400'}`}>{label}</span>
        </div>
    );
}
