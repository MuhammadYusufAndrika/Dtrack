import { useState, useEffect, useCallback, useRef } from 'react';
import AdminLayout from '../../Layouts/AdminLayout';
import { PageLoader } from '../../Components/LoadingSpinner';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';

const vehicleIcon = L.divIcon({ className: '', html: '<div style="width:28px;height:28px;background:#3b82f6;border:2px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.4);font-size:12px;">🚛</div>', iconSize: [28, 28], iconAnchor: [14, 14] });

function Updater({ vehicles, locations }) {
    const map = useMap();
    useEffect(() => {
        if (vehicles.length > 0) {
            const first = vehicles.find((v) => locations[v.id]);
            if (first && locations[first.id]) map.setView([locations[first.id].latitude, locations[first.id].longitude], 12);
        }
    }, [vehicles.length > 0]);
    return null;
}

export default function Fleet() {
    const [vehicles, setVehicles] = useState([]);
    const [locations, setLocations] = useState({});
    const [loading, setLoading] = useState(true);
    const intervalRef = useRef(null);

    const fetchData = useCallback(async () => {
        try {
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
            const vRes = await fetch('/api/vehicles', { headers });
            const vJson = await vRes.json();
            if (vJson.success) {
                setVehicles(vJson.data);
                const locs = {};
                await Promise.all(vJson.data.map(async (v) => {
                    try {
                        const lRes = await fetch(`/api/vehicles/${v.id}/locations`, { headers });
                        const lJson = await lRes.json();
                        if (lJson.success && lJson.data.length > 0) locs[v.id] = lJson.data[lJson.data.length - 1];
                    } catch {}
                }));
                setLocations({ ...locs });
            }
        } catch {}
    }, []);

    useEffect(() => { fetchData().finally(() => setLoading(false)); intervalRef.current = setInterval(fetchData, 10000); return () => clearInterval(intervalRef.current); }, []);

    if (loading) return <AdminLayout><PageLoader /></AdminLayout>;

    return (
        <AdminLayout>
            <div className="space-y-6">
                <div><h1 className="text-2xl font-bold text-dark-50">Fleet</h1><p className="text-sm text-dark-400 mt-1">{vehicles.length} vehicles</p></div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                        <div className="h-[500px] rounded-xl overflow-hidden border border-dark-700/50">
                            <MapContainer center={[-6.2088, 106.8456]} zoom={12} className="h-full w-full z-0" zoomControl={false}>
                                <TileLayer attribution='&copy; <a href="https://carto.com/">CARTO</a>' url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
                                <Updater vehicles={vehicles} locations={locations} />
                                {vehicles.map((v) => locations[v.id] && (
                                    <Marker key={v.id} position={[locations[v.id].latitude, locations[v.id].longitude]} icon={vehicleIcon}>
                                        <Popup><div className="text-sm text-dark-900"><p className="font-semibold">{v.plate_number}</p><p>Speed: {locations[v.id].speed ?? '—'} km/h</p></div></Popup>
                                    </Marker>
                                ))}
                            </MapContainer>
                        </div>
                    </div>
                    <div className="space-y-3 max-h-[500px] overflow-y-auto">
                        {vehicles.map((v) => (
                            <div key={v.id} className="rounded-xl bg-dark-800/50 border border-dark-700/50 p-4">
                                <p className="text-sm font-semibold text-dark-100">{v.plate_number}</p>
                                <p className="text-xs text-dark-400">{v.brand} {v.model}</p>
                                {locations[v.id] && <p className="text-xs text-primary-400 mt-1">{locations[v.id].speed ?? 0} km/h</p>}
                                {!locations[v.id] && <p className="text-xs text-dark-500 mt-1">No location</p>}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}
