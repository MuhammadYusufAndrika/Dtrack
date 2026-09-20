import { useEffect, useState, useRef, useCallback } from 'react';
import DriverLayout from '../../Layouts/DriverLayout';
import StatCard from '../../Components/StatCard';
import PageHeader from '../../Components/PageHeader';
import { MapContainer, Marker, Popup, useMap } from 'react-leaflet';
import MapTiles from '../../Components/MapTiles';
import L from 'leaflet';
import { Truck, Route, Activity, Clock, MapPin, Navigation, Play, Square, Camera, Shield, Cigarette, Phone, User } from 'lucide-react';

function resolveAiHttp() {
    const envUrl = import.meta.env?.VITE_AI_SERVICE_URL;
    if (envUrl) return envUrl.replace(/\/$/, '');
    const { protocol, hostname } = window.location;
    if (protocol === 'https:') return `https://${hostname}/ai`;
    return `http://${hostname}:5000`;
}
function resolveAiWs() {
    const envWs = import.meta.env?.VITE_AI_SERVICE_WS;
    if (envWs) return envWs;
    const { protocol, hostname } = window.location;
    if (protocol === 'https:') return `wss://${hostname}/ai/inference/stream`;
    return `ws://${hostname}:5000/inference/stream`;
}
const AI_SERVICE_HTTP = resolveAiHttp();
const AI_SERVICE_WS = resolveAiWs();
// Kirim 2 FPS (500ms) biar admin mulus. Jangan <400ms — AI YOLO/Mediapipe ~500ms, nanti antre.
const AI_SEND_MS = Number(import.meta.env?.VITE_AI_SEND_MS) || 500;

const vehicleIcon = L.divIcon({ className: '', html: '<div style="width:36px;height:36px;background:linear-gradient(135deg,#22c55e,#06b6d4);border:3px solid #fff;border-radius:14px;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 24px rgba(34,197,94,0.5);font-size:16px;">🚛</div>', iconSize: [36, 36], iconAnchor: [18, 18] });

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

const AI_INITIAL = { face_detected: false, seatbelt: false, smoking: false, phone: false, looking_away: false, head_pose: { yaw: 0, pitch: 0, roll: 0 } };

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
                        body: JSON.stringify({ vehicle_id: driver.vehicle.id, latitude: gpsPos.lat, longitude: gpsPos.lng, speed: Math.round(gpsPos.speed * 3.6), heading: Math.round(gpsPos.heading), accuracy: Math.round(gpsPos.accuracy) }),
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
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } });
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
                aiFrameInterval.current = setInterval(() => captureAndSendFrame(stream), AI_SEND_MS);
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
                // Auto-reconnect 3 detik kalau trip masih jalan (penting di hosting / sinyal jelek)
                setTimeout(() => {
                    if (aiWsRef.current === ws) {
                        aiWsRef.current = null;
                        if (streamRef.current) startAiWebSocket(streamRef.current);
                    }
                }, 3000);
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
        // Backpressure: skip frame kalau WS masih antre >256KB (cegah delay menumpuk;
        // inference ~1 detik sedangkan kirim tiap 500ms — antrean bikin tayangan basi)
        try {
            if (aiWsRef.current.bufferedAmount > 256 * 1024) return;
        } catch {}

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        // Cap 640x480 biar hemat bandwidth tapi tidak pecah di admin
        const vw = video.videoWidth || 640;
        const vh = video.videoHeight || 480;
        const scale = Math.min(1, 640 / vw);
        canvas.width = Math.round(vw * scale);
        canvas.height = Math.round(vh * scale);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        const base64 = dataUrl.split(',')[1];

        try {
            aiWsRef.current.send(JSON.stringify({
                frame: base64,
                vehicle_id: vehicleIdRef.current,
            }));
        } catch {}
    }, []);

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
        return <DriverLayout><div className="glass rounded-3xl text-center py-14 px-6"><p className="text-4xl mb-3">👤</p><p className="text-dark-500 font-semibold">Belum ada profil driver</p><p className="text-dark-500 text-sm mt-1">Hubungi admin untuk menautkan akun ini.</p></div></DriverLayout>;
    }

    const tracking = tripState === 'tracking';
    const busy = tripState === 'starting' || tripState === 'ending';

    return (
        <DriverLayout>
            <div className="space-y-5">
                <PageHeader
                    eyebrow="Driver Console"
                    title={`Halo, ${driver.name.split(' ')[0]} 👋`}
                    description={tracking ? `Trip #${activeTrip?.id} sedang berjalan — GPS & kamera AI aktif.` : 'Siap jalan? Mulai trip untuk mengaktifkan GPS & AI monitoring.'}
                    action={
                        tripState === 'idle' && driver.vehicle ? (
                            <button onClick={handleStartTrip} className="btn-glow flex items-center gap-2 px-6 py-3 rounded-2xl text-white text-sm font-bold">
                                <Play className="w-4 h-4" /> Mulai Trip
                            </button>
                        ) : busy ? (
                            <div className="flex items-center gap-2.5 px-6 py-3 rounded-2xl glass-strong text-sm text-dark-700">
                                <span className="w-4 h-4 border-2 border-success-500 border-t-transparent rounded-full animate-spin" />
                                {tripState === 'starting' ? 'Memulai trip…' : 'Mengakhiri trip…'}
                            </div>
                        ) : tracking ? (
                            <button onClick={handleEndTrip} className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-danger-600 to-rose-500 hover:brightness-110 text-white text-sm font-bold transition-all shadow-[0_8px_28px_rgba(239,68,68,0.45)]">
                                <Square className="w-4 h-4" /> Selesaikan Trip
                            </button>
                        ) : null
                    }
                />

                {gpsError && <div className="glass rounded-2xl !border-danger-500/30 p-3.5 text-sm text-danger-500 animate-fade-up">⚠️ {gpsError}</div>}
                {aiError && <div className="glass rounded-2xl !border-warning-500/30 p-3.5 text-sm text-warning-500 animate-fade-up">📷 {aiError}</div>}

                {tracking ? (
                    <div className="relative overflow-hidden rounded-3xl p-[1.5px] bg-gradient-to-r from-success-500 via-accent-500 to-primary-500 animate-fade-up">
                        <div className="rounded-3xl bg-white/90 backdrop-blur-xl px-5 sm:px-7 py-5 flex flex-col sm:flex-row items-center gap-5">
                            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-success-500">
                                <span className="w-2.5 h-2.5 rounded-full bg-success-400 animate-pulse" /> Live Trip
                            </div>
                            <div className="font-display text-4xl sm:text-5xl font-bold tabular-nums text-dark-900 tracking-tight">{fmt(elapsed)}</div>
                            <div className="flex items-center gap-6 sm:ml-auto text-center">
                                <div><p className="font-display text-xl font-bold text-dark-900 tabular-nums">{gpsPos ? Math.round(gpsPos.speed * 3.6) : 0}<span className="text-xs text-dark-400 font-sans font-medium"> km/h</span></p><p className="text-[10px] uppercase tracking-widest text-dark-500 font-bold">Speed</p></div>
                                <div className="w-px h-10 bg-dark-200/70" />
                                <div><p className="font-display text-xl font-bold text-dark-900 tabular-nums">{distance.toFixed(2)}<span className="text-xs text-dark-400 font-sans font-medium"> km</span></p><p className="text-[10px] uppercase tracking-widest text-dark-500 font-bold">Jarak</p></div>
                                <div className="w-px h-10 bg-dark-200/70" />
                                <div><p className="font-display text-xl font-bold text-dark-900 font-mono">{driver.vehicle?.plate_number}</p><p className="text-[10px] uppercase tracking-widest text-dark-500 font-bold">Unit</p></div>
                            </div>
                        </div>
                    </div>
                ) : (
                    !driver.vehicle && (
                        <div className="glass rounded-2xl p-5 flex items-center gap-4 animate-fade-up">
                            <span className="text-3xl">🚛</span>
                            <div><p className="text-sm font-bold text-dark-900">Belum ada kendaraan</p><p className="text-xs text-dark-400">Minta admin untuk assign unit sebelum mulai trip.</p></div>
                        </div>
                    )
                )}

                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3.5">
                    <StatCard icon={Truck} label="Unit" value={driver.vehicle?.plate_number || '—'} accent="blue" delay="delay-1" />
                    <StatCard icon={Activity} label="Status" value={tracking ? 'On Trip' : driver.status || 'Siaga'} accent={tracking ? 'green' : 'cyan'} delay="delay-1" />
                    <StatCard icon={Clock} label="Durasi" value={tracking ? fmt(elapsed) : '—'} accent="violet" delay="delay-2" />
                    <StatCard icon={Navigation} label="Speed" value={tracking && gpsPos ? `${Math.round(gpsPos.speed * 3.6)} km/h` : '—'} accent="cyan" delay="delay-2" />
                    <StatCard icon={MapPin} label="Jarak" value={tracking ? `${distance.toFixed(2)} km` : '—'} accent="amber" delay="delay-3" />
                    <StatCard icon={Camera} label="AI Cam" value={cameraActive ? 'Aktif' : 'Mati'} accent={cameraActive ? 'green' : 'red'} delay="delay-3" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                    <div className="lg:col-span-2 glass rounded-3xl overflow-hidden">
                        <div className="px-5 py-4 border-b border-dark-200/60 flex items-center justify-between">
                            <h2 className="text-sm font-bold text-dark-900 flex items-center gap-2"><Route className="w-4 h-4 text-primary-500" /> {tracking ? 'Peta Live' : 'Posisi Terakhir'}</h2>
                            {tracking && <span className="flex items-center gap-1.5 text-[11px] font-bold text-success-500"><span className="w-1.5 h-1.5 rounded-full bg-success-400 animate-pulse" /> LIVE</span>}
                        </div>
                        <div className="h-[380px]">
                            <MapContainer center={gpsPos ? [gpsPos.lat, gpsPos.lng] : [-6.2088, 106.8456]} zoom={15} className="h-full w-full z-0" zoomControl={false}>
                                <MapTiles />
                                {gpsPos && <MapUpdater position={[gpsPos.lat, gpsPos.lng]} />}
                                {gpsPos && <Marker position={[gpsPos.lat, gpsPos.lng]} icon={vehicleIcon}><Popup><div className="text-sm"><p className="font-bold">{Math.round(gpsPos.speed * 3.6)} km/h</p><p className="font-mono text-xs">{gpsPos.lat.toFixed(5)}, {gpsPos.lng.toFixed(5)}</p></div></Popup></Marker>}
                            </MapContainer>
                        </div>
                        {tracking && gpsPos && (
                            <div className="px-5 py-3.5 border-t border-dark-200/60 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                                <InfoMini label="Latitude" value={gpsPos.lat.toFixed(6)} mono />
                                <InfoMini label="Longitude" value={gpsPos.lng.toFixed(6)} mono />
                                <InfoMini label="Akurasi" value={gpsPos.accuracy < 1 ? '<1 m' : `${Math.round(gpsPos.accuracy)} m`} />
                                <InfoMini label="Heading" value={`${Math.round(gpsPos.heading)}°`} />
                            </div>
                        )}
                    </div>
                    <div className="space-y-4">
                        <div className="glass rounded-3xl p-5">
                            <h3 className="text-xs font-bold uppercase tracking-widest text-dark-400 mb-4">Profil Driver</h3>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-success-500 to-accent-600 flex items-center justify-center font-display font-bold text-white text-lg">{driver.name[0]}</div>
                                <div className="min-w-0"><p className="text-sm font-bold text-dark-900 truncate">{driver.name}</p><p className="text-xs text-dark-400 truncate">{driver.email}</p></div>
                            </div>
                            <div className="space-y-2.5">
                                <InfoRow label="Telepon" value={driver.phone || '—'} />
                                <InfoRow label="SIM" value={driver.license_number || '—'} />
                                <InfoRow label="Unit" value={driver.vehicle ? `${driver.vehicle.plate_number} · ${driver.vehicle.brand}` : '—'} />
                            </div>
                        </div>
                        {tracking && (
                            <div className="rounded-3xl p-[1.5px] bg-gradient-to-br from-primary-500/50 to-accent-500/30">
                                <div className="rounded-3xl bg-white/90 p-5">
                                    <h3 className="text-xs font-bold uppercase tracking-widest text-dark-400 mb-3">Kondisi AI</h3>
                                    <div className="grid grid-cols-2 gap-2">
                                        <AiMini label="Seatbelt" ok={aiResults.seatbelt} warn={aiResults.face_detected && !aiResults.seatbelt} />
                                        <AiMini label="Fokus" ok={!aiResults.looking_away} warn={aiResults.looking_away} />
                                        <AiMini label="No Rokok" ok={!aiResults.smoking} warn={aiResults.smoking} />
                                        <AiMini label="No HP" ok={!aiResults.phone} warn={aiResults.phone} />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {tracking && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        <div className="glass rounded-3xl overflow-hidden">
                            <div className="px-5 py-4 border-b border-dark-200/60 flex items-center justify-between">
                                <h3 className="text-sm font-bold text-dark-900 flex items-center gap-2"><Camera className="w-4 h-4 text-accent-400" /> Kamera Driver</h3>
                                {cameraActive ? (
                                    <span className="flex items-center gap-1.5 text-[11px] font-bold text-success-500"><span className="w-1.5 h-1.5 rounded-full bg-success-400 animate-pulse" /> Streaming</span>
                                ) : (
                                    <span className="text-[11px] text-dark-500">Mati</span>
                                )}
                            </div>
                            <div className="relative bg-black" style={{ minHeight: '240px' }}>
                                <video ref={videoRef} className="w-full h-auto" style={{ transform: 'scaleX(-1)' }} muted playsInline />
                                <canvas ref={canvasRef} className="hidden" />
                                {!cameraActive && (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <p className="text-dark-500 text-sm">Kamera aktif saat trip berjalan</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="glass rounded-3xl overflow-hidden">
                            <div className="px-5 py-4 border-b border-dark-200/60 flex items-center justify-between">
                                <h3 className="text-sm font-bold text-dark-900 flex items-center gap-2"><Shield className="w-4 h-4 text-accent-400" /> Deteksi AI</h3>
                                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${aiStatus === 'connected' ? 'bg-success-500/15 text-success-500' : aiStatus === 'error' ? 'bg-danger-500/15 text-danger-500' : 'bg-dark-100/70 text-dark-500'}`}>
                                    {aiStatus === 'connected' ? '● Terhubung' : aiStatus === 'error' ? '● Error' : '○ Siaga'}
                                </span>
                            </div>
                            <div className="p-5">
                                <div className="grid grid-cols-2 gap-2.5">
                                    <AiIndicator icon={User} label="Wajah" active={aiResults.face_detected} />
                                    <AiIndicator icon={Shield} label="Seatbelt" active={aiResults.seatbelt} danger={aiResults.seatbelt === false && aiResults.face_detected} />
                                    <AiIndicator icon={Cigarette} label="Tanpa Rokok" active={!aiResults.smoking} danger={aiResults.smoking} />
                                    <AiIndicator icon={Phone} label="Tanpa HP" active={!aiResults.phone} danger={aiResults.phone} />
                                    <AiIndicator icon={Navigation} label="Fokus Depan" active={!aiResults.looking_away} danger={aiResults.looking_away} />
                                </div>
                                <div className="mt-4 pt-4 border-t border-dark-200/60 grid grid-cols-3 gap-2 text-xs">
                                    <div className="glass rounded-xl px-3 py-2 text-center"><p className="text-dark-500 text-[10px] uppercase font-bold">Rokok</p><p className="text-dark-900 font-bold">{aiResults.smoking ? 'Ya' : 'Tidak'}</p></div>
                                    <div className="glass rounded-xl px-3 py-2 text-center"><p className="text-dark-500 text-[10px] uppercase font-bold">Yaw</p><p className="text-dark-900 font-bold">{aiResults.head_pose?.yaw?.toFixed(0) || 0}°</p></div>
                                    <div className="glass rounded-xl px-3 py-2 text-center"><p className="text-dark-500 text-[10px] uppercase font-bold">Pitch</p><p className="text-dark-900 font-bold">{aiResults.head_pose?.pitch?.toFixed(0) || 0}°</p></div>
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
        <div className="flex justify-between items-center gap-3">
            <span className="text-xs text-dark-500">{label}</span>
            <span className="text-xs font-semibold text-dark-800 text-right truncate">{value}</span>
        </div>
    );
}

function InfoMini({ label, value, mono }) {
    return (
        <div><p className="text-[10px] uppercase tracking-wider text-dark-500 font-bold">{label}</p><p className={`text-xs font-semibold text-dark-900 ${mono ? 'font-mono' : ''}`}>{value}</p></div>
    );
}

function AiMini({ label, ok, warn }) {
    return (
        <div className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-[11px] font-bold border ${warn ? 'bg-danger-500/10 border-danger-500/30 text-danger-500' : ok ? 'bg-success-500/10 border-success-500/25 text-success-500' : 'bg-dark-100/60 border-dark-200/60 text-dark-500'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${warn ? 'bg-danger-400' : ok ? 'bg-success-400' : 'bg-dark-500'}`} />{label}
        </div>
    );
}

function AiIndicator({ icon: Icon, label, active, danger }) {
    return (
        <div className={`flex items-center gap-2 p-3 rounded-xl border transition-all ${danger ? 'bg-danger-500/10 border-danger-500/30 shadow-[0_0_20px_rgba(239,68,68,0.2)]' : active ? 'bg-success-500/10 border-success-500/25' : 'bg-dark-100/60 border-dark-200/60'}`}>
            <Icon className={`w-4 h-4 flex-shrink-0 ${danger ? 'text-danger-500' : active ? 'text-success-500' : 'text-dark-500'}`} />
            <span className={`text-xs font-semibold ${danger ? 'text-danger-500' : active ? 'text-success-500' : 'text-dark-500'}`}>{label}</span>
        </div>
    );
}
