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
import com.fleetvisionai.models.AlertInfo
import kotlinx.coroutines.launch
import java.time.OffsetDateTime
import java.time.format.DateTimeFormatter

/**
 * Alert Saya — setara halaman web /driver/alerts.
 * Ketuk alert untuk menandai dibaca.
 */
class AlertsActivity : AppCompatActivity() {

    private lateinit var rvAlerts: RecyclerView
    private lateinit var tvEmpty: TextView
    private val adapter = AlertAdapter { alert -> markRead(alert) }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_alerts)
        rvAlerts = findViewById(R.id.rv_alerts)
        tvEmpty = findViewById(R.id.tv_alerts_empty)
        rvAlerts.layoutManager = LinearLayoutManager(this)
        rvAlerts.adapter = adapter
        loadAlerts()
    }

    private fun loadAlerts() {
        lifecycleScope.launch {
            try {
                val res = RetrofitClient.apiService.getAlerts()
                val list = (res.data ?: emptyList()).sortedByDescending { it.id }
                adapter.submit(list)
                tvEmpty.visibility = if (list.isEmpty()) View.VISIBLE else View.GONE
            } catch (e: Exception) {
                Toast.makeText(this@AlertsActivity, "Gagal memuat: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun markRead(alert: AlertInfo) {
        if (alert.isRead == true) return
        lifecycleScope.launch {
            try {
                RetrofitClient.apiService.markAlertRead(alert.id)
                loadAlerts()
            } catch (e: Exception) {
                Toast.makeText(this@AlertsActivity, "Gagal menandai: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private class AlertAdapter(private val onClick: (AlertInfo) -> Unit) :
        RecyclerView.Adapter<AlertAdapter.Holder>() {

        private var items: List<AlertInfo> = emptyList()

        fun submit(list: List<AlertInfo>) {
            items = list
            notifyDataSetChanged()
        }

        class Holder(v: View) : RecyclerView.ViewHolder(v) {
            val dot: View = v.findViewById(R.id.v_severity)
            val msg: TextView = v.findViewById(R.id.tv_alert_msg)
            val time: TextView = v.findViewById(R.id.tv_alert_time)
        }

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): Holder {
            val v = LayoutInflater.from(parent.context).inflate(R.layout.item_alert, parent, false)
            return Holder(v)
        }

        override fun getItemCount(): Int = items.size

        override fun onBindViewHolder(h: Holder, position: Int) {
            val a = items[position]
            h.msg.text = a.message ?: "-"
            h.msg.alpha = if (a.isRead == true) 0.6f else 1f
            h.time.text = formatTime(a.createdAt)
            val color = when (a.severity) {
                "CRITICAL" -> 0xFFEF4444.toInt()
                "HIGH" -> 0xFFF59E0B.toInt()
                else -> 0xFF3B82F6.toInt()
            }
            (h.dot.background as? android.graphics.drawable.GradientDrawable)?.setColor(color)
                ?: h.dot.setBackgroundColor(color)
            h.itemView.setOnClickListener { onClick(a) }
        }

        private fun formatTime(iso: String?): String {
            if (iso.isNullOrEmpty()) return ""
            return try {
                OffsetDateTime.parse(iso).format(DateTimeFormatter.ofPattern("dd MMM HH:mm"))
            } catch (e: Exception) {
                iso
            }
        }
    }
}
