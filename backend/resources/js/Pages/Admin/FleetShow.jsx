import { useState, useEffect, useRef, useCallback } from 'react';
import { apiFetch } from '../../utils/api';
import AdminLayout from '../../Layouts/AdminLayout';
import PageHeader from '../../Components/PageHeader';
import { PageLoader } from '../../Components/LoadingSpinner';
import { MapContainer, Marker, Popup } from 'react-leaflet';
import MapTiles from '../../Components/MapTiles';
import L from 'leaflet';
import { Camera, AlertTriangle, Shield, Cigarette, Phone, User, Navigation, RefreshCw } from 'lucide-react';

function resolveAiBase() {
    const envUrl = import.meta.env?.VITE_AI_SERVICE_URL;
    if (envUrl) return envUrl.replace(/\/$/, '');
    const { protocol, hostname } = window.location;
    if (protocol === 'https:') return `https://${hostname}/ai`;
    return `http://${hostname}:5000`;
}
const AI_SERVICE_URL = resolveAiBase();
const LIVE_POLL_MS = Number(import.meta.env?.VITE_LIVE_POLL_MS) || 600;

// Samakan bentuk payload ai-service (phone) dengan backend Laravel (phone_usage)
function normalizeAiResult(r) {
    if (!r) return null;
    return {
        face_detected: r.face_detected ?? true,
        seatbelt:      r.seatbelt      ?? true,
        smoking:       r.smoking       ?? false,
        phone:         r.phone         ?? r.phone_usage ?? false,
        looking_away:  r.looking_away  ?? false,
        head_pose:     r.head_pose     ?? { yaw: 0, pitch: 0, roll: 0 },
    };
}

const vehicleIcon = L.divIcon({ className: '', html: '<div style="width:32px;height:32px;background:#3b82f6;border:2px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.4);font-size:14px;">🚛</div>', iconSize: [32, 32], iconAnchor: [16, 16] });

export default function FleetShow({ id }) {
    const [vehicle, setVehicle] = useState(null);
    const [loading, setLoading] = useState(true);
    const [cameraFrame, setCameraFrame] = useState(null);
    const [aiResult, setAiResult] = useState(null);
    const [cameraError, setCameraError] = useState('');
    const frameInterval = useRef(null);
    const cameraFrameUrl = useRef(null);
    const isFetchingFrame = useRef(false);
    const pollCount = useRef(0);

    useEffect(() => {
        (async () => {
            try {
                const vRes = await apiFetch(`/api/vehicles/${id}`);
                const vJson = await vRes.json();
                if (vJson.success) setVehicle(vJson.data);
            } catch {}
            setLoading(false);
        })();
    }, [id]);

    const fetchFrame = useCallback(async () => {
        if (!vehicle) return;
        if (isFetchingFrame.current) return;
        if (document.hidden) return;
        isFetchingFrame.current = true;
        try {
            const key = vehicle.vehicle_id;
            const res = await fetch(`${AI_SERVICE_URL}/inference/frame/${key}`, { cache: 'no-store' });
            if (res.ok) {
                const headerResult = res.headers.get('X-AI-Result');
                if (headerResult) {
                    try {
                        setAiResult(normalizeAiResult(JSON.parse(headerResult)));
                    } catch {}
                }
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const img = new Image();
                img.onload = () => {
                    if (cameraFrameUrl.current) URL.revokeObjectURL(cameraFrameUrl.current);
                    cameraFrameUrl.current = url;
                    setCameraFrame(url);
                };
                img.onerror = () => URL.revokeObjectURL(url);
                img.src = url;
                setCameraError('');

                pollCount.current += 1;
                if (!headerResult && pollCount.current % 3 === 0) {
                    try {
                        const framesRes = await fetch(`${AI_SERVICE_URL}/inference/frames`, { cache: 'no-store' });
                        if (framesRes.ok) {
                            const data = await framesRes.json();
                            const vResult = data.vehicles?.[key];
                            if (vResult?.result) setAiResult(normalizeAiResult(vResult.result));
                        }
                    } catch {}
                }
            } else if (res.status === 404) {
                setCameraError('No live camera feed available');
            }
        } catch {
            setCameraError('AI service unreachable');
        } finally {
            isFetchingFrame.current = false;
        }
    }, [vehicle]);

    useEffect(() => {
        if (!vehicle) return;
        fetchFrame();
        frameInterval.current = setInterval(fetchFrame, LIVE_POLL_MS);
        return () => {
            if (frameInterval.current) clearInterval(frameInterval.current);
            if (cameraFrameUrl.current) {
                URL.revokeObjectURL(cameraFrameUrl.current);
                cameraFrameUrl.current = null;
            }
        };
    }, [vehicle, fetchFrame]);

    if (loading) return <AdminLayout><PageLoader /></AdminLayout>;
    if (!vehicle) return <AdminLayout><div className="text-center py-12 text-dark-400">Vehicle not found</div></AdminLayout>;

    const loc = vehicle.latest_location;
    const center = loc ? [loc.latitude, loc.longitude] : [-6.2088, 106.8456];

    return (
        <AdminLayout>
            <div className="space-y-6">
                <PageHeader eyebrow="Unit Detail" title={vehicle.plate_number} description={`${vehicle.brand} ${vehicle.model} — status ${vehicle.status}.`} />
                <div className="h-[400px] rounded-3xl overflow-hidden border border-dark-200/70 shadow-[0_24px_64px_rgba(15,23,42,0.15)]">
                    <MapContainer center={center} zoom={15} className="h-full w-full z-0" zoomControl={false}>
                        <MapTiles />
                        {loc && <Marker position={[loc.latitude, loc.longitude]} icon={vehicleIcon}><Popup><div className="text-sm text-dark-900"><p className="font-semibold">{vehicle.plate_number}</p><p>Speed: {loc.speed ?? '—'} km/h</p></div></Popup></Marker>}
                    </MapContainer>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <InfoBox label="Plate" value={vehicle.plate_number} />
                    <InfoBox label="Brand" value={vehicle.brand} />
                    <InfoBox label="Model" value={vehicle.model} />
                    <InfoBox label="Status" value={vehicle.status} />
                </div>

                {/* Live Camera + AI Panel */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Camera Feed */}
                    <div className="glass rounded-3xl overflow-hidden">
                        <div className="p-4 border-b border-dark-200/60 flex items-center justify-between">
                            <h3 className="text-sm font-bold text-dark-900 flex items-center gap-2">
                                <Camera className="w-4 h-4" /> Live Camera
                            </h3>
                            <button onClick={fetchFrame} className="text-dark-400 hover:text-dark-900 transition-colors">
                                <RefreshCw className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="relative bg-dark-100/50" style={{ minHeight: '240px' }}>
                            {cameraFrame ? (
                                <img src={cameraFrame} className="w-full h-auto" style={{ transform: 'scaleX(-1)' }} alt="Driver camera" />
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <p className="text-dark-500 text-sm">{cameraError || 'Waiting for camera feed...'}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* AI Detection Results */}
                    <div className="glass rounded-3xl overflow-hidden">
                        <div className="p-4 border-b border-dark-200/60 flex items-center justify-between">
                            <h3 className="text-sm font-bold text-dark-900 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4" /> AI Behavior Detection
                            </h3>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${cameraFrame && aiResult ? 'bg-success-500/15 text-success-500' : 'bg-dark-100 text-dark-500'}`}>
                                {cameraFrame && aiResult ? 'Active' : 'No Data'}
                            </span>
                        </div>
                        <div className="p-4">
                            {aiResult ? (
                                <>
                                    <div className="grid grid-cols-2 gap-3">
                                        <AiIndicator icon={User} label="Face Detected" active={aiResult.face_detected} />
                                        <AiIndicator icon={Shield} label="Seatbelt On" active={aiResult.seatbelt} danger={!aiResult.seatbelt && aiResult.face_detected} />
                                        <AiIndicator icon={Cigarette} label="No Smoking" active={!aiResult.smoking} danger={aiResult.smoking} />
                                        <AiIndicator icon={Phone} label="No Phone" active={!aiResult.phone} danger={aiResult.phone} />
                                        <AiIndicator icon={Navigation} label="Looking Ahead" active={!aiResult.looking_away} danger={aiResult.looking_away} />
                                    </div>
                                    <div className="mt-3 pt-3 border-t border-dark-200/60">
                                        <div className="grid grid-cols-3 gap-2 text-xs">
                                            <div><span className="text-dark-400">Smoking:</span> <span className="text-dark-800 font-medium">{aiResult.smoking ? 'Detected' : 'Clear'}</span></div>
                                            <div><span className="text-dark-400">Yaw:</span> <span className="text-dark-800 font-medium">{aiResult.head_pose?.yaw?.toFixed(0) || 0}°</span></div>
                                            <div><span className="text-dark-400">Pitch:</span> <span className="text-dark-800 font-medium">{aiResult.head_pose?.pitch?.toFixed(0) || 0}°</span></div>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="text-center py-8 text-dark-500 text-sm">
                                    {cameraFrame ? 'Processing...' : 'Start a trip to see AI detection results'}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}

function InfoBox({ label, value }) {
    return <div className="glass rounded-2xl p-4"><p className="text-[11px] font-bold uppercase tracking-wider text-dark-500">{label}</p><p className="text-sm font-bold text-dark-900 mt-1">{value}</p></div>;
}

function AiIndicator({ icon: Icon, label, active, danger }) {
    return (
        <div className={`flex items-center gap-2 p-2.5 rounded-lg border transition-colors ${danger ? 'bg-danger-500/10 border-danger-500/30' : active ? 'bg-success-500/10 border-success-500/30' : 'bg-dark-100/60 border-dark-200/60'}`}>
            <Icon className={`w-4 h-4 ${danger ? 'text-danger-500' : active ? 'text-success-500' : 'text-dark-400'}`} />
            <span className={`text-xs font-medium ${danger ? 'text-danger-500' : active ? 'text-success-500' : 'text-dark-400'}`}>{label}</span>
        </div>
    );
}
