package com.fleetvisionai

import android.app.AlertDialog
import android.os.Bundle
import android.view.LayoutInflater
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.fleetvisionai.api.RetrofitClient
import com.fleetvisionai.models.ChatBody
import com.fleetvisionai.models.ChatMessage
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.time.OffsetDateTime
import java.time.format.DateTimeFormatter

/**
 * Chat Admin — setara halaman web /driver/chat:
 * kirim laporan, polling 5 detik, hapus pesan sendiri, hapus riwayat.
 */
class ChatActivity : AppCompatActivity() {

    private lateinit var llMessages: LinearLayout
    private lateinit var svChat: ScrollView
    private lateinit var etMessage: EditText
    private lateinit var btnSend: Button
    private var pollJob: Job? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_chat)
        llMessages = findViewById(R.id.ll_messages)
        svChat = findViewById(R.id.sv_chat)
        etMessage = findViewById(R.id.et_message)
        btnSend = findViewById(R.id.btn_send)

        btnSend.setOnClickListener { sendMessage() }
        findViewById<Button>(R.id.btn_clear_chat).setOnClickListener { confirmClear() }
        loadMessages(markRead = true)
    }

    override fun onResume() {
        super.onResume()
        pollJob?.cancel()
        pollJob = lifecycleScope.launch {
            while (isActive) {
                delay(5000L)
                loadMessages(markRead = false)
            }
        }
    }

    override fun onPause() {
        super.onPause()
        pollJob?.cancel()
        pollJob = null
    }

    private fun loadMessages(markRead: Boolean) {
        lifecycleScope.launch {
            try {
                val res = RetrofitClient.apiService.getChat()
                if (res.success) {
                    renderMessages(res.data ?: emptyList())
                    if (markRead) {
                        try { RetrofitClient.apiService.markChatRead() } catch (e: Exception) { }
                    }
                }
            } catch (e: Exception) {
                // polling diam-diam; kirim yang menampilkan error
            }
        }
    }

    private fun renderMessages(list: List<ChatMessage>) {
        llMessages.removeAllViews()
        if (list.isEmpty()) {
            val tv = TextView(this).apply {
                text = getString(R.string.chat_empty)
                setTextColor(ContextCompat.getColor(this@ChatActivity, R.color.text_secondary))
                textSize = 13f
                gravity = android.view.Gravity.CENTER
                setPadding(16, 48, 16, 48)
            }
            llMessages.addView(tv)
            return
        }
        val inflater = LayoutInflater.from(this)
        for (m in list.sortedBy { it.id }) {
            val row = inflater.inflate(R.layout.item_chat_message, llMessages, false)
            val body = row.findViewById<TextView>(R.id.tv_msg_body)
            val time = row.findViewById<TextView>(R.id.tv_msg_time)
            val del = row.findViewById<Button>(R.id.btn_delete_msg)
            val mine = m.senderRole == "driver"
            body.text = m.body ?: ""
            time.text = formatTime(m.createdAt)
            if (mine) {
                body.setBackgroundResource(R.drawable.bubble_mine)
                body.setTextColor(ContextCompat.getColor(this, android.R.color.white))
                time.setTextColor(ContextCompat.getColor(this, R.color.text_hint))
                del.visibility = android.view.View.VISIBLE
                del.setOnClickListener { confirmDelete(m.id) }
                (row as LinearLayout).gravity = android.view.Gravity.END
            } else {
                body.setBackgroundResource(R.drawable.bubble_theirs)
                body.setTextColor(ContextCompat.getColor(this, R.color.text_primary))
                del.visibility = android.view.View.GONE
                (row as LinearLayout).gravity = android.view.Gravity.START
            }
            llMessages.addView(row)
        }
        svChat.post { svChat.fullScroll(ScrollView.FOCUS_DOWN) }
    }

    private fun sendMessage() {
        val body = etMessage.text.toString().trim()
        if (body.isEmpty()) return
        btnSend.isEnabled = false
        lifecycleScope.launch {
            try {
                val res = RetrofitClient.apiService.sendChat(ChatBody(body))
                if (res.success) {
                    etMessage.text.clear()
                    loadMessages(markRead = false)
                } else {
                    Toast.makeText(this@ChatActivity, res.message.ifEmpty { "Gagal mengirim" }, Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Toast.makeText(this@ChatActivity, "Tidak terhubung: ${e.message}", Toast.LENGTH_SHORT).show()
            }
            btnSend.isEnabled = true
        }
    }

    private fun confirmDelete(id: Int) {
        AlertDialog.Builder(this)
            .setMessage(getString(R.string.chat_delete_confirm))
            .setPositiveButton(getString(R.string.delete)) { _, _ -> deleteMessage(id) }
            .setNegativeButton(getString(R.string.cancel), null)
            .show()
    }

    private fun deleteMessage(id: Int) {
        lifecycleScope.launch {
            try {
                RetrofitClient.apiService.deleteChat(id)
                loadMessages(markRead = false)
            } catch (e: Exception) {
                Toast.makeText(this@ChatActivity, "Gagal menghapus", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun confirmClear() {
        AlertDialog.Builder(this)
            .setMessage(getString(R.string.chat_clear_confirm))
            .setPositiveButton(getString(R.string.delete)) { _, _ ->
                lifecycleScope.launch {
                    try {
                        RetrofitClient.apiService.clearChat()
                        loadMessages(markRead = false)
                    } catch (e: Exception) {
                        Toast.makeText(this@ChatActivity, "Gagal menghapus riwayat", Toast.LENGTH_SHORT).show()
                    }
                }
            }
            .setNegativeButton(getString(R.string.cancel), null)
            .show()
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
