import { useState, useEffect, useRef, useCallback } from 'react';
import { apiFetch } from '../../utils/api';
import AdminLayout from '../../Layouts/AdminLayout';
import { PageLoader } from '../../Components/LoadingSpinner';
import StatusBadge from '../../Components/StatusBadge';
import { User, Truck, Phone, Mail, FileText, Camera, AlertTriangle, Shield, Eye, Navigation, RefreshCw, Link2, Link2Off } from 'lucide-react';

const AI_SERVICE_HOST = window.location.hostname;
const AI_SERVICE_URL = `http://${AI_SERVICE_HOST}:5000`;

const AI_INITIAL = { face_detected: false, seatbelt: false, fatigue: false, phone: false, looking_away: false, eye_closed: 0, head_pose: { yaw: 0, pitch: 0, roll: 0 } };

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
    const frameInterval = useRef(null);
    const cameraFrameUrl = useRef(null);

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
        const key = driver.vehicle.vehicle_id;
        try {
            const res = await fetch(`${AI_SERVICE_URL}/inference/frame/${key}`);
            if (res.ok) {
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                if (cameraFrameUrl.current) URL.revokeObjectURL(cameraFrameUrl.current);
                cameraFrameUrl.current = url;
                setCameraFrame(url);
                setCameraError('');

                // Also pull AI result from the frames endpoint (fallback for when
                // WebSocket broadcast is not yet available)
                const framesRes = await fetch(`${AI_SERVICE_URL}/inference/frames`);
                if (framesRes.ok) {
                    const data = await framesRes.json();
                    const vResult = data.vehicles?.[key];
                    if (vResult?.result) {
                        setAiResult(mapStatusToAiResult(vResult.result));
                    }
                }
            } else if (res.status === 404) {
                setCameraError('No live camera feed available');
            }
        } catch {
            setCameraError('AI service unreachable');
        }
    }, [driver?.vehicle?.vehicle_id]);

    useEffect(() => {
        if (!driver?.vehicle?.vehicle_id) return;
        fetchFrame();
        frameInterval.current = setInterval(fetchFrame, 2000);
        return () => {
            if (frameInterval.current) clearInterval(frameInterval.current);
            if (cameraFrameUrl.current) URL.revokeObjectURL(cameraFrameUrl.current);
        };
    }, [driver?.vehicle?.vehicle_id, fetchFrame]);

    if (loading) return <AdminLayout><PageLoader /></AdminLayout>;
    if (!driver) return <AdminLayout><div className="text-center py-12 text-dark-400">Driver not found</div></AdminLayout>;

    return (
        <AdminLayout>
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center"><User className="w-7 h-7 text-white" /></div>
                    <div><h1 className="text-2xl font-bold text-dark-50">{driver.name}</h1><StatusBadge status={driver.status} /></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InfoBox icon={Mail} label="Email" value={driver.email} />
                    <InfoBox icon={Phone} label="Phone" value={driver.phone} />
                    <InfoBox icon={FileText} label="License" value={driver.license_number} />
                    <InfoBox icon={Truck} label="Vehicle" value={driver.vehicle?.plate_number || 'None'} />
                </div>

                {/* Vehicle Assignment Panel */}
                <div className="rounded-xl bg-dark-800/50 border border-dark-700/50 p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <Link2 className="w-4 h-4 text-primary-400" />
                        <h3 className="text-sm font-semibold text-dark-100">Vehicle Assignment</h3>
                        {driver.vehicle && (
                            <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-success-500/20 text-success-400">
                                Assigned: {driver.vehicle.plate_number}
                            </span>
                        )}
                    </div>

                    {assignError && (
                        <p className="text-xs text-danger-400 mb-2">{assignError}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-3">
                        <select
                            id="vehicle-assign-select"
                            value={selectedVehicleId}
                            onChange={(e) => setSelectedVehicleId(e.target.value)}
                            className="flex-1 min-w-[180px] rounded-lg bg-dark-700 border border-dark-600 text-dark-100 text-sm px-3 py-2 focus:outline-none focus:border-primary-500"
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
                            className="px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-500 disabled:opacity-40 text-white text-sm font-medium transition-colors flex items-center gap-2"
                        >
                            <Link2 className="w-3.5 h-3.5" />
                            {assigning ? 'Saving...' : 'Assign'}
                        </button>

                        {driver.vehicle && (
                            <button
                                id="btn-unassign-vehicle"
                                onClick={() => handleAssign(null)}
                                disabled={assigning}
                                className="px-4 py-2 rounded-lg bg-dark-600 hover:bg-dark-500 disabled:opacity-40 text-dark-300 hover:text-white text-sm font-medium transition-colors flex items-center gap-2"
                            >
                                <Link2Off className="w-3.5 h-3.5" />
                                Unassign
                            </button>
                        )}
                    </div>
                </div>

                {/* Live Camera + AI Behavior Detection Panel */}
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
                    <div className="rounded-xl bg-dark-800/50 border border-dark-700/50 overflow-hidden">
                        <div className="p-4 border-b border-dark-700/50 flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-dark-100 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4" /> AI Behavior Detection
                            </h3>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${aiResult ? 'bg-success-500/20 text-success-400' : 'bg-dark-600 text-dark-400'}`}>
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
        <div className="rounded-xl bg-dark-800/50 border border-dark-700/50 p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary-500/10 flex items-center justify-center"><Icon className="w-5 h-5 text-primary-400" /></div>
            <div><p className="text-xs text-dark-400">{label}</p><p className="text-sm font-semibold text-dark-100">{value}</p></div>
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
