import { TileLayer } from 'react-leaflet';

/**
 * Tile layer peta terpusat — gratis, tanpa API key, aman untuk hosting.
 *
 * Default: Esri WorldStreetMap (bebas dipakai tanpa daftar key,
 * tampilan jalan bersih mirip CARTO light).
 *
 * Kalau nanti mau ganti provider cukup isi .env (tanpa ubah kode):
 *   VITE_MAP_TILES_URL=https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png
 *   VITE_MAP_ATTRIBUTION=&copy; OpenStreetMap contributors
 * atau CARTO pakai key:
 *   VITE_MAP_TILES_URL=https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?api_key=ISI_KEY
 */
const DEFAULT_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}';
const DEFAULT_ATTR =
    'Tiles &copy; <a href="https://www.esri.com/">Esri</a> &mdash; Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong), Esri (Thailand), TomTom';

export default function MapTiles() {
    const url = import.meta.env?.VITE_MAP_TILES_URL || DEFAULT_URL;
    const attribution = import.meta.env?.VITE_MAP_ATTRIBUTION || DEFAULT_ATTR;
    return <TileLayer attribution={attribution} url={url} maxZoom={19} />;
}
