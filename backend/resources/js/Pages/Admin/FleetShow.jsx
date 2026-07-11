import { useState, useEffect, useRef, useCallback } from 'react';
import { apiFetch } from '../../utils/api';
import AdminLayout from '../../Layouts/AdminLayout';
import { PageLoader } from '../../Components/LoadingSpinner';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { Camera, AlertTriangle, Shield, Eye, Phone, User, Navigation, RefreshCw } from 'lucide-react';

const AI_SERVICE_HOST = window.location.hostname;
const AI_SERVICE_URL = `http://${AI_SERVICE_HOST}:5000`;

const vehicleIcon = L.divIcon({ className: '', html: '<div style="width:32px;height:32px;background:#3b82f6;border:2px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.4);font-size:14px;">🚛</div>', iconSize: [32, 32], iconAnchor: [16, 16] });

export default function FleetShow({ id }) {
    const [vehicle, setVehicle] = useState(null);
    const [loading, setLoading] = useState(true);
    const [cameraFrame, setCameraFrame] = useState(null);
    const [aiResult, setAiResult] = useState(null);
    const [cameraError, setCameraError] = useState('');
    const frameInterval = useRef(null);

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
        try {
            const plate = vehicle.plate_number;
            const res = await fetch(`${AI_SERVICE_URL}/inference/frame/${plate}`);
            if (res.ok) {
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                setCameraFrame(prev => { if (prev) URL.revokeObjectURL(prev); return url; });
                setCameraError('');

                const framesRes = await fetch(`${AI_SERVICE_URL}/inference/frames`);
                if (framesRes.ok) {
                    const data = await framesRes.json();
                    const vResult = data.vehicles?.[plate];
                    if (vResult?.result) setAiResult(vResult.result);
                }
            } else if (res.status === 404) {
                setCameraError('No live camera feed available');
            }
        } catch {
            setCameraError('AI service unreachable');
        }
    }, [vehicle]);

    useEffect(() => {
        if (!vehicle) return;
        fetchFrame();
        frameInterval.current = setInterval(fetchFrame, 2000);
        return () => {
            if (frameInterval.current) clearInterval(frameInterval.current);
            if (cameraFrame) URL.revokeObjectURL(cameraFrame);
        };
    }, [vehicle, fetchFrame]);

    if (loading) return <AdminLayout><PageLoader /></AdminLayout>;
    if (!vehicle) return <AdminLayout><div className="text-center py-12 text-dark-400">Vehicle not found</div></AdminLayout>;

    const loc = vehicle.latest_location;
    const center = loc ? [loc.latitude, loc.longitude] : [-6.2088, 106.8456];

    return (
        <AdminLayout>
            <div className="space-y-6">
                <div><h1 className="text-2xl font-bold text-dark-50">{vehicle.plate_number}</h1><p className="text-sm text-dark-400 mt-1">{vehicle.brand} {vehicle.model}</p></div>
                <div className="h-[400px] rounded-xl overflow-hidden border border-dark-700/50">
                    <MapContainer center={center} zoom={15} className="h-full w-full z-0" zoomControl={false}>
                        <TileLayer attribution='&copy; <a href="https://carto.com/">CARTO</a>' url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
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
                    <div className="rounded-xl bg-dark-800/50 border border-dark-700/50 overflow-hidden">
                        <div className="p-4 border-b border-dark-700/50 flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-dark-100 flex items-center gap-2">
                                <Camera className="w-4 h-4" /> Live Camera
                            </h3>
                            <button onClick={fetchFrame} className="text-dark-400 hover:text-dark-200 transition-colors">
                                <RefreshCw className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="relative bg-dark-900" style={{ minHeight: '240px' }}>
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
                    <div className="rounded-xl bg-dark-800/50 border border-dark-700/50 overflow-hidden">
                        <div className="p-4 border-b border-dark-700/50 flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-dark-100 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4" /> AI Behavior Detection
                            </h3>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${cameraFrame && aiResult ? 'bg-success-500/20 text-success-400' : 'bg-dark-600 text-dark-400'}`}>
                                {cameraFrame && aiResult ? 'Active' : 'No Data'}
                            </span>
                        </div>
                        <div className="p-4">
                            {aiResult ? (
                                <>
                                    <div className="grid grid-cols-2 gap-3">
                                        <AiIndicator icon={User} label="Face Detected" active={aiResult.face_detected} />
                                        <AiIndicator icon={Shield} label="Seatbelt On" active={aiResult.seatbelt} danger={!aiResult.seatbelt && aiResult.face_detected} />
                                        <AiIndicator icon={Eye} label="Eyes Open" active={aiResult.eye_closed < 0.5} danger={aiResult.eye_closed >= 0.7} />
                                        <AiIndicator icon={AlertTriangle} label="No Fatigue" active={!aiResult.fatigue} danger={aiResult.fatigue} />
                                        <AiIndicator icon={Phone} label="No Phone" active={!aiResult.phone} danger={aiResult.phone} />
                                        <AiIndicator icon={Navigation} label="Looking Ahead" active={!aiResult.looking_away} danger={aiResult.looking_away} />
                                    </div>
                                    <div className="mt-3 pt-3 border-t border-dark-700/50">
                                        <div className="grid grid-cols-3 gap-2 text-xs">
                                            <div><span className="text-dark-400">Eye Closure:</span> <span className="text-dark-200 font-medium">{((aiResult.eye_closed || 0) * 100).toFixed(0)}%</span></div>
                                            <div><span className="text-dark-400">Yaw:</span> <span className="text-dark-200 font-medium">{aiResult.head_pose?.yaw?.toFixed(0) || 0}°</span></div>
                                            <div><span className="text-dark-400">Pitch:</span> <span className="text-dark-200 font-medium">{aiResult.head_pose?.pitch?.toFixed(0) || 0}°</span></div>
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
    return <div className="rounded-xl bg-dark-800/50 border border-dark-700/50 p-4"><p className="text-xs text-dark-400">{label}</p><p className="text-sm font-semibold text-dark-100 mt-0.5">{value}</p></div>;
}

function AiIndicator({ icon: Icon, label, active, danger }) {
    return (
        <div className={`flex items-center gap-2 p-2.5 rounded-lg border transition-colors ${danger ? 'bg-danger-500/10 border-danger-500/30' : active ? 'bg-success-500/10 border-success-500/30' : 'bg-dark-700/30 border-dark-600/30'}`}>
            <Icon className={`w-4 h-4 ${danger ? 'text-danger-400' : active ? 'text-success-400' : 'text-dark-400'}`} />
            <span className={`text-xs font-medium ${danger ? 'text-danger-400' : active ? 'text-success-400' : 'text-dark-400'}`}>{label}</span>
        </div>
    );
}
