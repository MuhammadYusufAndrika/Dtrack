package com.fleetvisionai

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.fleetvisionai.api.RetrofitClient
import com.fleetvisionai.models.TripInfo
import com.fleetvisionai.utils.RouteHelper
import kotlinx.coroutines.launch
import org.osmdroid.config.Configuration
import org.osmdroid.tileprovider.tilesource.TileSourceFactory
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.MapView
import org.osmdroid.views.overlay.Marker
import org.osmdroid.views.overlay.Polyline

/**
 * Trip Saya — setara halaman web /driver/trips:
 * daftar trip + detail peta (rute rencana + jejak aktual) + Estimasi/Ditempuh/Sisa/Durasi.
 */
class TripsActivity : AppCompatActivity() {

    private lateinit var rvTrips: RecyclerView
    private lateinit var tvCount: TextView
    private lateinit var detailCard: View
    private lateinit var tvDetailTitle: TextView
    private lateinit var tvDetailStats: TextView
    private lateinit var tvDetailLegend: TextView
    private lateinit var mapDetail: MapView
    private val adapter = TripAdapter { trip -> showDetail(trip) }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_trips)
        Configuration.getInstance().userAgentValue = packageName

        rvTrips = findViewById(R.id.rv_trips)
        tvCount = findViewById(R.id.tv_trips_count)
        detailCard = findViewById(R.id.card_trip_detail)
        tvDetailTitle = findViewById(R.id.tv_detail_title)
        tvDetailStats = findViewById(R.id.tv_detail_stats)
        tvDetailLegend = findViewById(R.id.tv_detail_legend)
        mapDetail = findViewById(R.id.map_detail)
        mapDetail.setTileSource(TileSourceFactory.MAPNIK)
        mapDetail.setMultiTouchControls(true)

        rvTrips.layoutManager = LinearLayoutManager(this)
        rvTrips.adapter = adapter
        loadTrips()
    }

    override fun onResume() {
        super.onResume()
        mapDetail.onResume()
    }

    override fun onPause() {
        super.onPause()
        mapDetail.onPause()
    }

    private fun loadTrips() {
        lifecycleScope.launch {
            try {
                val email = FleetVisionApp.instance.getUserEmail()
                val drivers = RetrofitClient.apiService.getDrivers()
                val mine = drivers.data?.find { it.email == email }?.id
                val res = RetrofitClient.apiService.getTrips()
                val list = (res.data ?: emptyList()).filter { it.driverId == mine }
                    .sortedByDescending { it.id }
                adapter.submit(list)
                tvCount.text = "${list.size} perjalanan"
            } catch (e: Exception) {
                Toast.makeText(this@TripsActivity, "Gagal memuat: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun showDetail(trip: TripInfo) {
        detailCard.visibility = View.VISIBLE
        val route = if (!trip.origin.isNullOrEmpty() || !trip.destination.isNullOrEmpty()) {
            "${trip.origin ?: "Titik awal"} → ${trip.destination ?: "Tujuan"}"
        } else {
            "Trip manual #${trip.id}"
        }
        tvDetailTitle.text = "Trip #${trip.id} · $route"
        tvDetailStats.text = "Memuat…"
        lifecycleScope.launch {
            try {
                val res = RetrofitClient.apiService.getTrip(trip.id)
                val detail = res.data?.trip
                val path = res.data?.path
                    ?.mapNotNull { p ->
                        val a = p.latitude
                        val b = p.longitude
                        if (a != null && b != null) GeoPoint(a, b) else null
                    } ?: emptyList()
                if (detail == null) {
                    tvDetailStats.text = "Trip tidak ditemukan."
                    return@launch
                }
                val traveled = detail.totalDistanceKm?.takeIf { it > 0 }
                    ?: detail.distanceKm ?: 0.0
                val last = path.lastOrNull()
                val sisa = if (last != null && detail.destLatitude != null && detail.destLongitude != null) {
                    RouteHelper.haversineKm(last.latitude, last.longitude, detail.destLatitude, detail.destLongitude)
                } else null
                tvDetailStats.text = "Estimasi: ${RouteHelper.formatKm(detail.plannedDistanceKm)} · " +
                        "Jalan: ${String.format("%.2f km", traveled)} · " +
                        "Sisa: ${if (sisa != null) RouteHelper.formatKm(sisa) else "-"} · ${detail.status}"

                drawDetailMap(detail, path)
                val snapped = if (path.size > 1) RouteHelper.matchRoadTrail(path) else null
                if (snapped != null) {
                    drawPolyline(snapped, 0xFF22C55E.toInt())
                    tvDetailLegend.text = "Biru putus-putus: rencana · Hijau: jejak aktual (${path.size} titik, mengikuti jalan)"
                } else {
                    tvDetailLegend.text = "Biru putus-putus: rencana · Hijau: jejak aktual (${path.size} titik)"
                }
            } catch (e: Exception) {
                tvDetailStats.text = "Gagal memuat detail."
            }
        }
    }

    private suspend fun drawDetailMap(detail: TripInfo, path: List<GeoPoint>) {
        mapDetail.overlays.clear()
        val oLat = detail.startLatitude
        val oLng = detail.startLongitude
        val dLat = detail.destLatitude
        val dLng = detail.destLongitude
        if (oLat != null && oLng != null) {
            addMarker(GeoPoint(oLat, oLng), detail.origin ?: "Titik awal")
        }
        if (dLat != null && dLng != null) {
            addMarker(GeoPoint(dLat, dLng), detail.destination ?: "Tujuan")
        }
        // Garis rencana biru putus-putus (OSRM, fallback lurus)
        if (oLat != null && oLng != null && dLat != null && dLng != null) {
            val plan = RouteHelper.fetchRoadRoute(oLat, oLng, dLat, dLng)
                ?: RouteHelper.straightLine(oLat, oLng, dLat, dLng)
            drawPolyline(plan, 0xFF2563EB.toInt())
        }
        if (path.size > 1) {
            drawPolyline(path, 0xFF22C55E.toInt())
        }
        val all = mutableListOf<GeoPoint>()
        if (oLat != null && oLng != null) all.add(GeoPoint(oLat, oLng))
        if (dLat != null && dLng != null) all.add(GeoPoint(dLat, dLng))
        all.addAll(path)
        if (all.size > 1) {
            mapDetail.zoomToBoundingBox(
                org.osmdroid.util.BoundingBox.fromGeoPoints(all), false, 60
            )
        } else if (all.size == 1) {
            mapDetail.controller.setZoom(14.0)
            mapDetail.controller.setCenter(all[0])
        }
        mapDetail.invalidate()
    }

    private fun drawPolyline(points: List<GeoPoint>, color: Int) {
        val line = Polyline()
        line.setPoints(points)
        line.color = color
        line.width = 8f
        mapDetail.overlays.add(line)
    }

    private fun addMarker(p: GeoPoint, title: String) {
        val m = Marker(mapDetail)
        m.position = p
        m.title = title
        mapDetail.overlays.add(m)
    }

    private class TripAdapter(private val onClick: (TripInfo) -> Unit) :
        RecyclerView.Adapter<TripAdapter.Holder>() {

        private var items: List<TripInfo> = emptyList()

        fun submit(list: List<TripInfo>) {
            items = list
            notifyDataSetChanged()
        }

        class Holder(v: View) : RecyclerView.ViewHolder(v) {
            val title: TextView = v.findViewById(R.id.tv_item_title)
            val sub: TextView = v.findViewById(R.id.tv_item_sub)
            val badge: TextView = v.findViewById(R.id.tv_item_badge)
        }

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): Holder {
            val v = LayoutInflater.from(parent.context).inflate(R.layout.item_trip, parent, false)
            return Holder(v)
        }

        override fun getItemCount(): Int = items.size

        override fun onBindViewHolder(h: Holder, position: Int) {
            val t = items[position]
            h.title.text = if (!t.origin.isNullOrEmpty() || !t.destination.isNullOrEmpty()) {
                "${t.origin ?: "Titik awal"} → ${t.destination ?: "Tujuan"}"
            } else {
                "Trip manual #${t.id}"
            }
            h.sub.text = "${t.status} · ${RouteHelper.formatKm(t.distanceKm ?: t.totalDistanceKm)}"
            h.badge.text = "#${t.id}"
            h.itemView.setOnClickListener { onClick(t) }
        }
    }
}