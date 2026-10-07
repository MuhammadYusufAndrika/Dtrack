import { useState, useEffect, useRef, useCallback } from 'react';
import { apiFetch } from '../../utils/api';
import { router } from '@inertiajs/react';
import AdminLayout from '../../Layouts/AdminLayout';
import PageHeader from '../../Components/PageHeader';
import { PageLoader } from '../../Components/LoadingSpinner';
import StatusBadge from '../../Components/StatusBadge';
import { User, Truck, Phone, Mail, FileText, Camera, AlertTriangle, Shield, Eye, Navigation, RefreshCw, Link2, Link2Off, Cigarette, Trash2 } from 'lucide-react';

// Hosting-ready: pakai VITE_AI_SERVICE_URL jika diset, kalau HTTPS pakai /ai (reverse proxy)
// biar tidak kena mixed-content + firewall port 5000. Fallback ke http://host:5000 untuk local.
function resolveAiBase() {
    const envUrl = import.meta.env?.VITE_AI_SERVICE_URL;
    if (envUrl) return envUrl.replace(/\/$/, '');
    const { protocol, hostname } = window.location;
    if (protocol === 'https:') return `https://${hostname}/ai`;
    return `http://${hostname}:5000`;
}
const AI_SERVICE_URL = resolveAiBase();
const LIVE_POLL_MS = Number(import.meta.env?.VITE_LIVE_POLL_MS) || 600;

const AI_INITIAL = { face_detected: false, seatbelt: false, fatigue: false, phone: false, smoking: false, looking_away: false, eye_closed: 0, head_pose: { yaw: 0, pitch: 0, roll: 0 } };

/**
 * Map a broadcast/backend status payload to the frontend aiResult shape.
 * The backend column is `phone_usage`; the frontend renders `phone`.
 */
function mapStatusToAiResult(status) {
    if (!status) return null;
    return {
        face_detected: status.face_detected ?? true,
        seatbelt:      status.seatbelt      ?? true,
        fatigue:       status.fatigue       ?? false,
        phone:         status.phone_usage   ?? status.phone ?? false,
        smoking:       status.smoking       ?? false,
        looking_away:  status.looking_away  ?? false,
        eye_closed:    status.eye_closed    ?? 0,
        head_pose:     status.head_pose     ?? { yaw: 0, pitch: 0, roll: 0 },
    };
}

export default function DriversShow({ id }) {
    const [driver, setDriver] = useState(null);
    const [loading, setLoading] = useState(true);

    // Vehicle assignment
    const [vehicles, setVehicles] = useState([]);
    const [selectedVehicleId, setSelectedVehicleId] = useState('');
    const [assigning, setAssigning] = useState(false);
    const [assignError, setAssignError] = useState('');

    const [cameraFrame, setCameraFrame] = useState(null);
    const [aiResult, setAiResult] = useState(null);
    const [cameraError, setCameraError] = useState('');
    const [deleting, setDeleting] = useState(false);
    const frameInterval = useRef(null);
    const cameraFrameUrl = useRef(null);
    const isFetchingFrame = useRef(false);
    const pollCount = useRef(0);

    const reloadDriver = useCallback(() => {
        return apiFetch(`/api/drivers/${id}`)
            .then((r) => r.json())
            .then((j) => { if (j.success) setDriver(j.data); });
    }, [id]);

    useEffect(() => {
        reloadDriver().finally(() => setLoading(false));
    }, [id]);
    // Fetch all vehicles so admin can pick one to assign
    useEffect(() => {
        apiFetch('/api/vehicles')
            .then((r) => r.json())
            .then((j) => { if (j.success) setVehicles(j.data); })
            .catch(() => {});
    }, []);

    const handleAssign = async (vehicleId) => {
        setAssigning(true);
        setAssignError('');
        try {
            const res = await apiFetch(`/api/drivers/${id}/assign-vehicle`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ vehicle_id: vehicleId ?? null }),
            });
            const json = await res.json();
            if (json.success) {
                setDriver(json.data);
                setSelectedVehicleId('');
                // Reset camera so it re-polls for the newly assigned vehicle
                setCameraFrame(null);
                setAiResult(null);
                setCameraError('');
            } else {
                setAssignError(json.message || 'Assignment failed');
            }
        } catch {
            setAssignError('Network error');
        } finally {
            setAssigning(false);
        }
    };

    const handleDelete = async () => {
        if (!driver) return;
        if (!window.confirm(`Hapus driver ${driver.name}? Akun login, trip, chat, dan datanya ikut terhapus. Kendaraan yang dipakai akan dilepas.`)) return;
        setDeleting(true);
        try {
            const res = await apiFetch(`/api/drivers/${id}`, { method: 'DELETE' });
            const json = await res.json();
            if (json.success) router.visit('/admin/drivers');
            else setAssignError(json.message || 'Gagal menghapus driver.');
        } catch {
            setAssignError('Network error');
        } finally {
            setDeleting(false);
        }
    };

    // Real-time AI results via Laravel Echo WebSocket broadcast
    useEffect(() => {
        if (!window.Echo) return;

        const channel = window.Echo.channel(`driver.${id}`);
        channel.listen('.driver.status.changed', (event) => {
            const mapped = mapStatusToAiResult(event.statusData ?? event);
            if (mapped) setAiResult(mapped);
        });

        return () => {
            window.Echo.leave(`driver.${id}`);
        };
    }, [id]);

    const fetchFrame = useCallback(async () => {
        if (!driver?.vehicle?.vehicle_id) return;
        // Jangan tumpuk request kalau network lambat (penyebab patah di hosting)
        if (isFetchingFrame.current) return;
        // Hemat bandwidth saat tab tidak terlihat
        if (document.hidden) return;
        isFetchingFrame.current = true;
        const key = driver.vehicle.vehicle_id;
        try {
            const res = await fetch(`${AI_SERVICE_URL}/inference/frame/${key}`, { cache: 'no-store' });
            if (res.ok) {
                // Ambil AI result dari header (1 RTT saja, tanpa fetch /frames tiap tick)
                const headerResult = res.headers.get('X-AI-Result');
                if (headerResult) {
                    try {
                        setAiResult(mapStatusToAiResult(JSON.parse(headerResult)));
                    } catch {}
                }
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                // Preload dulu baru swap — hilangkan kedip / frame hitam
                const img = new Image();
                img.onload = () => {
                    if (cameraFrameUrl.current) URL.revokeObjectURL(cameraFrameUrl.current);
                    cameraFrameUrl.current = url;
                    setCameraFrame(url);
                };
                img.onerror = () => URL.revokeObjectURL(url);
                img.src = url;
                setCameraError('');

                // Fallback /frames cukup tiap ~3 detik (tiap 5 tick), bukan tiap frame
                pollCount.current += 1;
                if (!headerResult && pollCount.current % 3 === 0) {
                    try {
                        const framesRes = await fetch(`${AI_SERVICE_URL}/inference/frames`, { cache: 'no-store' });
                        if (framesRes.ok) {
                            const data = await framesRes.json();
                            const vResult = data.vehicles?.[key];
                            if (vResult?.result) setAiResult(mapStatusToAiResult(vResult.result));
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
    }, [driver?.vehicle?.vehicle_id]);

    useEffect(() => {
        if (!driver?.vehicle?.vehicle_id) return;
        fetchFrame();
        frameInterval.current = setInterval(fetchFrame, LIVE_POLL_MS);
        return () => {
            if (frameInterval.current) clearInterval(frameInterval.current);
            if (cameraFrameUrl.current) {
                URL.revokeObjectURL(cameraFrameUrl.current);
                cameraFrameUrl.current = null;
            }
        };
    }, [driver?.vehicle?.vehicle_id, fetchFrame]);

    if (loading) return <AdminLayout><PageLoader /></AdminLayout>;
    if (!driver) return <AdminLayout><div className="text-center py-12 text-dark-400">Driver not found</div></AdminLayout>;

    return (
        <AdminLayout>
            <div className="space-y-6">
                <PageHeader
                    eyebrow="Driver Detail"
                    title={driver.name}
                    description={`${driver.email} — ${driver.vehicle?.plate_number || 'belum ada unit'}.`}
                    accent="violet"
                    action={<StatusBadge status={driver.status} />}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InfoBox icon={Mail} label="Email" value={driver.email} />
                    <InfoBox icon={Phone} label="Phone" value={driver.phone} />
                    <InfoBox icon={FileText} label="License" value={driver.license_number} />
                    <InfoBox icon={Truck} label="Vehicle" value={driver.vehicle?.plate_number || 'None'} />
                </div>

                {/* Vehicle Assignment Panel */}
                <div className="glass rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <Link2 className="w-4 h-4 text-violet-600" />
                        <h3 className="text-sm font-bold text-dark-900">Vehicle Assignment</h3>
                        {driver.vehicle && (
                            <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full bg-success-100 text-success-700 border border-success-200">
                                Assigned: {driver.vehicle.plate_number}
                            </span>
                        )}
                    </div>

                    {assignError && (
                        <p className="text-xs text-danger-500 mb-2">{assignError}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-3">
                        <select
                            id="vehicle-assign-select"
                            value={selectedVehicleId}
                            onChange={(e) => setSelectedVehicleId(e.target.value)}
                            className="flex-1 min-w-[180px] rounded-xl bg-white border border-violet-200/70 text-dark-900 text-sm px-3 py-2 focus:outline-none focus:border-violet-500"
                        >
                            <option value="">— Select a vehicle —</option>
                            {vehicles.map((v) => (
                                <option
                                    key={v.id}
                                    value={v.id}
                                    disabled={v.id === driver.vehicle?.id}
                                >
                                    {v.plate_number} &mdash; {v.brand} {v.model}
                                    {v.id === driver.vehicle?.id ? ' (current)' : ''}
                                </option>
                            ))}
                        </select>

                        <button
                            id="btn-assign-vehicle"
                            onClick={() => handleAssign(selectedVehicleId ? Number(selectedVehicleId) : null)}
                            disabled={assigning || !selectedVehicleId}
                            className="btn-glow px-4 py-2 rounded-xl disabled:opacity-40 text-white text-sm font-bold flex items-center gap-2"
                        >
                            <Link2 className="w-3.5 h-3.5" />
                            {assigning ? 'Saving...' : 'Assign'}
                        </button>

                        {driver.vehicle && (
                            <button
                                id="btn-unassign-vehicle"
                                onClick={() => handleAssign(null)}
                                disabled={assigning}
                                className="glass glass-hover px-4 py-2.5 rounded-xl disabled:opacity-40 text-violet-600 hover:text-violet-700 text-sm font-semibold flex items-center gap-2"
                            >
                                <Link2Off className="w-3.5 h-3.5" />
                                Unassign
                            </button>
                        )}
                    </div>
                </div>

                {/* Danger Zone */}
                <div className="glass tint-rose rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-dark-900">Hapus driver ini</p>
                        <p className="text-xs text-dark-400">Akun login, trip, chat, dan status ikut terhapus. Kendaraan dilepas.</p>
                    </div>
                    <button onClick={handleDelete} disabled={deleting}
                        className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-danger-100 border border-danger-200 text-danger-700 text-xs font-bold hover:bg-danger-500 hover:border-danger-500 hover:text-white transition-colors disabled:opacity-50 flex-shrink-0">
                        <Trash2 className="w-4 h-4" /> {deleting ? 'Menghapus…' : 'Hapus Driver'}
                    </button>
                </div>

                {/* Live Camera + AI Behavior Detection Panel */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Camera Feed */}
                    <div className="glass rounded-3xl overflow-hidden">
                        <div className="p-4 border-b border-violet-100/70 bg-gradient-to-r from-violet-50/60 via-transparent to-primary-50/50 flex items-center justify-between">
                            <h3 className="text-sm font-bold text-dark-900 flex items-center gap-2">
                                <Camera className="w-4 h-4 text-violet-600" /> Live Camera
                            </h3>
                            <button onClick={fetchFrame} className="text-dark-400 hover:text-violet-600 transition-colors">
                                <RefreshCw className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="relative bg-dark-100/50" style={{ minHeight: '240px' }}>
                            {!driver.vehicle ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                                    <Truck className="w-8 h-8 text-dark-600" />
                                    <p className="text-dark-500 text-sm">No vehicle assigned to this driver</p>
                                </div>
                            ) : cameraFrame ? (
                                <img src={cameraFrame} className="w-full h-auto" style={{ transform: 'scaleX(-1)' }} alt="Driver camera" />
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <p className="text-dark-500 text-sm">{cameraError || 'Waiting for camera feed...'}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* AI Detection Results */}
                    <div className="glass tint-violet rounded-3xl overflow-hidden">
                        <div className="p-4 border-b border-violet-100/70 bg-gradient-to-r from-violet-50/60 via-transparent to-primary-50/50 flex items-center justify-between">
                            <h3 className="text-sm font-bold text-dark-900 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-violet-600" /> AI Behavior Detection
                            </h3>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${aiResult ? 'bg-success-100 text-success-700 border-success-200' : 'bg-dark-100 text-dark-500 border-dark-200'}`}>
                                {aiResult ? 'Live' : 'No Data'}
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
                                        <AiIndicator icon={Cigarette} label="No Smoking" active={!aiResult.smoking} danger={aiResult.smoking} />
                                        <AiIndicator icon={Navigation} label="Looking Ahead" active={!aiResult.looking_away} danger={aiResult.looking_away} />
                                    </div>
                                    <div className="mt-3 pt-3 border-t border-dark-200/60">
                                        <div className="grid grid-cols-3 gap-2 text-xs">
                                            <div><span className="text-dark-400">Eye Closure:</span> <span className="text-dark-800 font-medium">{((aiResult.eye_closed || 0) * 100).toFixed(0)}%</span></div>
                                            <div><span className="text-dark-400">Yaw:</span> <span className="text-dark-800 font-medium">{aiResult.head_pose?.yaw?.toFixed(0) || 0}°</span></div>
                                            <div><span className="text-dark-400">Pitch:</span> <span className="text-dark-800 font-medium">{aiResult.head_pose?.pitch?.toFixed(0) || 0}°</span></div>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="text-center py-8 text-dark-500 text-sm">
                                    {!driver.vehicle
                                        ? 'Assign a vehicle to this driver to enable AI monitoring'
                                        : 'Waiting for AI detection data...'}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}

function InfoBox({ icon: Icon, label, value }) {
    return (
        <div className="glass rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center"><Icon className="w-5 h-5 text-violet-600" /></div>
            <div><p className="text-xs text-dark-400">{label}</p><p className="text-sm font-semibold text-dark-900">{value}</p></div>
        </div>
    );
}

function AiIndicator({ icon: Icon, label, active, danger }) {
    return (
        <div className={`flex items-center gap-2 p-2.5 rounded-lg border transition-colors ${danger ? 'bg-danger-100 border-danger-200' : active ? 'bg-success-100 border-success-200' : 'bg-dark-100/60 border-dark-200/60'}`}>
            <Icon className={`w-4 h-4 ${danger ? 'text-danger-600' : active ? 'text-success-600' : 'text-dark-400'}`} />
            <span className={`text-xs font-medium ${danger ? 'text-danger-700' : active ? 'text-success-700' : 'text-dark-400'}`}>{label}</span>
        </div>
    );
}
