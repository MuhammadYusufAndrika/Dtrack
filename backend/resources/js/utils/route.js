/**
 * Util rute bersama: estimasi haversine + garis rute OSRM (gratis, tanpa key).
 *
 * Catatan Jawa -> Kalimantan (lewat laut): OSRM driving sering gagal /
 * memutar jauh karena tidak ada jalan. Kalau gagal, pakai garis lurus
 * (fallback) agar peta tetap menampilkan jalurnya.
 */

export function haversineKm(lat1, lon1, lat2, lon2) {
    if ([lat1, lon1, lat2, lon2].some((v) => v == null || Number.isNaN(Number(v)))) return null;
    const R = 6371;
    const dLat = ((Number(lat2) - Number(lat1)) * Math.PI) / 180;
    const dLon = ((Number(lon2) - Number(lon1)) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((Number(lat1) * Math.PI) / 180) *
            Math.cos((Number(lat2) * Math.PI) / 180) *
            Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatKm(km) {
    if (km == null || Number.isNaN(Number(km))) return '—';
    const n = Number(km);
    return n >= 1 ? `${n.toFixed(1)} km` : `${Math.round(n * 1000)} m`;
}

/**
 * Ambil garis rute jalan via OSRM public. Return array [[lat,lng],...] atau null.
 * Pakai hanya untuk tampilan; jangan dianggap jarak resmi (lihat planned_distance_km).
 */
export async function fetchRoadRoute(origin, dest, timeoutMs = 6000) {
    try {
        if (!origin || !dest) return null;
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), timeoutMs);
        const url =
            `https://router.project-osrm.org/route/v1/driving/` +
            `${origin.lng},${origin.lat};${dest.lng},${dest.lat}` +
            `?overview=full&geometries=geojson`;
        const res = await fetch(url, { signal: ctrl.signal });
        clearTimeout(t);
        if (!res.ok) return null;
        const json = await res.json();
        const route = json?.routes?.[0];
        const coords = route?.geometry?.coordinates;
        if (!Array.isArray(coords) || coords.length < 2) return null;
        // Tolak rute jalan yang tidak wajar (mis. antar-pulau lewat laut):
        // kalau jarak OSRM > 1.5x garis lurus, peta pakai garis lurus saja.
        const roadKm = Number(route?.distance) / 1000;
        const straightKm = haversineKm(origin.lat, origin.lng, dest.lat, dest.lng);
        if (Number.isFinite(roadKm) && straightKm && roadKm > straightKm * 1.5) return null;
        return coords.map(([lng, lat]) => [lat, lng]);
    } catch {
        return null;
    }
}

/** Garis lurus origin -> dest (fallback saat OSRM gagal, mis. rute antar-pulau). */
export function straightLine(origin, dest) {
    if (!origin || !dest) return [];
    return [
        [Number(origin.lat), Number(origin.lng)],
        [Number(dest.lat), Number(dest.lng)],
    ];
}
