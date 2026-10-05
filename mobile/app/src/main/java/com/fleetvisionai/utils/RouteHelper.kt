package com.fleetvisionai.utils

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import org.osmdroid.util.GeoPoint
import java.net.HttpURLConnection
import java.net.URL
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.sqrt

/** Samakan logika peta web (utils/route.js): OSRM + fallback garis lurus. */
object RouteHelper {

    fun haversineKm(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Double {
        val r = 6371.0
        val dLat = Math.toRadians(lat2 - lat1)
        val dLon = Math.toRadians(lon2 - lon1)
        val a = sin(dLat / 2) * sin(dLat / 2) +
                cos(Math.toRadians(lat1)) * cos(Math.toRadians(lat2)) *
                sin(dLon / 2) * sin(dLon / 2)
        return r * 2 * atan2(sqrt(a), sqrt(1 - a))
    }

    fun formatKm(km: Double?): String {
        if (km == null || km.isNaN()) return "-"
        return if (km >= 1) String.format("%.1f km", km) else String.format("%d m", (km * 1000).toInt())
    }

    fun straightLine(oLat: Double, oLng: Double, dLat: Double, dLng: Double): List<GeoPoint> =
        listOf(GeoPoint(oLat, oLng), GeoPoint(dLat, dLng))

    /** Garis rute jalan via OSRM (gratis). Null bila gagal -> pakai straightLine. */
    suspend fun fetchRoadRoute(oLat: Double, oLng: Double, dLat: Double, dLng: Double): List<GeoPoint>? =
        withContext(Dispatchers.IO) {
            try {
                val url = URL(
                    "https://router.project-osrm.org/route/v1/driving/" +
                            "$oLng,$oLat;$dLng,$dLat?overview=full&geometries=geojson"
                )
                val conn = (url.openConnection() as HttpURLConnection).apply {
                    connectTimeout = 6000
                    readTimeout = 6000
                    requestMethod = "GET"
                }
                if (conn.responseCode != 200) return@withContext null
                val body = conn.inputStream.bufferedReader().use { it.readText() }
                conn.disconnect()
                val routes = JSONObject(body).optJSONArray("routes") ?: return@withContext null
                if (routes.length() == 0) return@withContext null
                val roadKm = routes.getJSONObject(0).optDouble("distance", -1.0) / 1000.0
                val straightKm = haversineKm(oLat, oLng, dLat, dLng)
                // Tolak rute tak wajar (antar-pulau): >1.5x garis lurus
                if (roadKm > 0 && straightKm > 0 && roadKm > straightKm * 1.5) return@withContext null
                val coords = routes.getJSONObject(0)
                    .getJSONObject("geometry").getJSONArray("coordinates")
                val pts = mutableListOf<GeoPoint>()
                for (i in 0 until coords.length()) {
                    val c = coords.getJSONArray(i)
                    pts.add(GeoPoint(c.getDouble(1), c.getDouble(0)))
                }
                if (pts.size > 1) pts else null
            } catch (e: Exception) {
                null
            }
        }

    /** Tempelkan jejak GPS ke jalan (OSRM map matching). Null bila gagal. */
    suspend fun matchRoadTrail(points: List<GeoPoint>): List<GeoPoint>? =
        withContext(Dispatchers.IO) {
            try {
                if (points.size < 2) return@withContext null
                var pts = points
                if (pts.size > 100) {
                    val step = (pts.size + 99) / 100
                    pts = pts.filterIndexed { i, _ -> i % step == 0 }
                    if (pts.last() != points.last()) pts = pts + points.last()
                }
                val coords = pts.joinToString(";") { "${it.longitude},${it.latitude}" }
                val radiuses = pts.joinToString(";") { "50" }
                val url = URL(
                    "https://router.project-osrm.org/match/v1/driving/$coords" +
                            "?overview=full&geometries=geojson&radiuses=$radiuses&tidy=true"
                )
                val conn = (url.openConnection() as HttpURLConnection).apply {
                    connectTimeout = 8000
                    readTimeout = 8000
                    requestMethod = "GET"
                }
                if (conn.responseCode != 200) return@withContext null
                val body = conn.inputStream.bufferedReader().use { it.readText() }
                conn.disconnect()
                val json = JSONObject(body)
                if (json.optString("code") != "Ok") return@withContext null
                val all = mutableListOf<GeoPoint>()
                val matchings = json.getJSONArray("matchings")
                for (m in 0 until matchings.length()) {
                    val c = matchings.getJSONObject(m).getJSONObject("geometry").getJSONArray("coordinates")
                    for (i in 0 until c.length()) {
                        if (i > 0 || all.isEmpty()) {
                            val p = c.getJSONArray(i)
                            all.add(GeoPoint(p.getDouble(1), p.getDouble(0)))
                        }
                    }
                }
                if (all.size > 1) all else null
            } catch (e: Exception) {
                null
            }
        }
}
