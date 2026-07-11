package com.fleetvisionai

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.fleetvisionai.api.RetrofitClient
import com.google.android.material.button.MaterialButton
import com.google.android.material.textfield.TextInputEditText
import com.google.android.material.textfield.TextInputLayout
import com.google.android.material.textview.MaterialTextView
import kotlinx.coroutines.launch

class LoginActivity : AppCompatActivity() {

    private lateinit var tilEmail: TextInputLayout
    private lateinit var tilPassword: TextInputLayout
    private lateinit var etEmail: TextInputEditText
    private lateinit var etPassword: TextInputEditText
    private lateinit var btnLogin: MaterialButton
    private lateinit var progressBar: android.widget.ProgressBar
    private lateinit var tvError: MaterialTextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val existingToken = RetrofitClient.getAuthToken()
        if (!existingToken.isNullOrEmpty()) {
            navigateToMain()
            return
        }

        setContentView(R.layout.activity_login)
        initViews()
        setupClickListeners()
    }

    private fun initViews() {
        tilEmail = findViewById(R.id.til_email)
        tilPassword = findViewById(R.id.til_password)
        etEmail = findViewById(R.id.et_email)
        etPassword = findViewById(R.id.et_password)
        btnLogin = findViewById(R.id.btn_login)
        progressBar = findViewById(R.id.progress_bar)
        tvError = findViewById(R.id.tv_error)
    }

    private fun setupClickListeners() {
        btnLogin.setOnClickListener {
            val email = etEmail.text.toString().trim()
            val password = etPassword.text.toString().trim()

            if (email.isEmpty()) {
                tilEmail.error = "Email is required"
                return@setOnClickListener
            }
            if (password.isEmpty()) {
                tilPassword.error = "Password is required"
                return@setOnClickListener
            }

            tilEmail.error = null
            tilPassword.error = null
            performLogin(email, password)
        }
    }

    private fun performLogin(email: String, password: String) {
        setLoading(true)
        showError(null)

        lifecycleScope.launch {
            try {
                val response = RetrofitClient.apiService.login(
                    mapOf("email" to email, "password" to password)
                )

                if (response.success && response.data != null) {
                    val token = response.data["token"]
                    if (!token.isNullOrEmpty()) {
                        RetrofitClient.setAuthToken(token)

                        FleetVisionApp.preferences.edit()
                            .putString("user_email", email)
                            .apply()

                        navigateToMain()
                    } else {
                        showError("Login failed: no token received")
                        setLoading(false)
                    }
                } else {
                    showError(response.message.ifEmpty { "Invalid credentials" })
                    setLoading(false)
                }
            } catch (e: Exception) {
                showError("Connection error: ${e.message}")
                setLoading(false)
            }
        }
    }

    private fun navigateToMain() {
        startActivity(Intent(this, MainActivity::class.java))
        finish()
    }

    private fun setLoading(loading: Boolean) {
        btnLogin.isEnabled = !loading
        progressBar.visibility = if (loading) View.VISIBLE else View.GONE
        btnLogin.text = if (loading) "" else getString(R.string.login)
    }

    private fun showError(message: String?) {
        if (message != null) {
            tvError.text = message
            tvError.visibility = View.VISIBLE
        } else {
            tvError.visibility = View.GONE
        }
    }
}
