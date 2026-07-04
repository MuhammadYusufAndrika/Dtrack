import { useState, useEffect } from 'react';
import AdminLayout from '../../Layouts/AdminLayout';
import { PageLoader } from '../../Components/LoadingSpinner';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

const vehicleIcon = L.divIcon({ className: '', html: '<div style="width:32px;height:32px;background:#3b82f6;border:2px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.4);font-size:14px;">🚛</div>', iconSize: [32, 32], iconAnchor: [16, 16] });

export default function FleetShow({ id }) {
    const [vehicle, setVehicle] = useState(null);
    const [locations, setLocations] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
            try {
                const [vRes, lRes] = await Promise.all([
                    fetch(`/api/vehicles/${id}`, { headers }),
                    fetch(`/api/vehicles/${id}/locations`, { headers }),
                ]);
                const vJson = await vRes.json();
                const lJson = await lRes.json();
                if (vJson.success) setVehicle(vJson.data);
                if (lJson.success) setLocations(lJson.data);
            } catch {}
            setLoading(false);
        })();
    }, [id]);

    if (loading) return <AdminLayout><PageLoader /></AdminLayout>;
    if (!vehicle) return <AdminLayout><div className="text-center py-12 text-dark-400">Vehicle not found</div></AdminLayout>;

    const lastLoc = locations[locations.length - 1];
    const center = lastLoc ? [lastLoc.latitude, lastLoc.longitude] : [-6.2088, 106.8456];

    return (
        <AdminLayout>
            <div className="space-y-6">
                <div><h1 className="text-2xl font-bold text-dark-50">{vehicle.plate_number}</h1><p className="text-sm text-dark-400 mt-1">{vehicle.brand} {vehicle.model}</p></div>
                <div className="h-[400px] rounded-xl overflow-hidden border border-dark-700/50">
                    <MapContainer center={center} zoom={15} className="h-full w-full z-0" zoomControl={false}>
                        <TileLayer attribution='&copy; <a href="https://carto.com/">CARTO</a>' url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
                        {lastLoc && <Marker position={[lastLoc.latitude, lastLoc.longitude]} icon={vehicleIcon}><Popup><div className="text-sm text-dark-900"><p className="font-semibold">{vehicle.plate_number}</p><p>Speed: {lastLoc.speed ?? '—'} km/h</p></div></Popup></Marker>}
                    </MapContainer>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <InfoBox label="Plate" value={vehicle.plate_number} />
                    <InfoBox label="Brand" value={vehicle.brand} />
                    <InfoBox label="Model" value={vehicle.model} />
                    <InfoBox label="Status" value={vehicle.status} />
                </div>
            </div>
        </AdminLayout>
    );
}

function InfoBox({ label, value }) {
    return <div className="rounded-xl bg-dark-800/50 border border-dark-700/50 p-4"><p className="text-xs text-dark-400">{label}</p><p className="text-sm font-semibold text-dark-100 mt-0.5">{value}</p></div>;
}
