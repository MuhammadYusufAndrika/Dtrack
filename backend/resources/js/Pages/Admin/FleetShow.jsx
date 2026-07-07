import { useState, useEffect } from 'react';
import { apiFetch } from '../../utils/api';
import AdminLayout from '../../Layouts/AdminLayout';
import { PageLoader } from '../../Components/LoadingSpinner';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

const vehicleIcon = L.divIcon({ className: '', html: '<div style="width:32px;height:32px;background:#3b82f6;border:2px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.4);font-size:14px;">🚛</div>', iconSize: [32, 32], iconAnchor: [16, 16] });

export default function FleetShow({ id }) {
    const [vehicle, setVehicle] = useState(null);
    const [loading, setLoading] = useState(true);

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
            </div>
        </AdminLayout>
    );
}

function InfoBox({ label, value }) {
    return <div className="rounded-xl bg-dark-800/50 border border-dark-700/50 p-4"><p className="text-xs text-dark-400">{label}</p><p className="text-sm font-semibold text-dark-100 mt-0.5">{value}</p></div>;
}
