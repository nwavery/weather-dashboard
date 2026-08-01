package com.weatherglance.data

import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/** Minimal blocking JSON GET shared by the Open-Meteo and Google Pollen clients. */
internal object Http {
    fun getJson(urlStr: String): JSONObject {
        val conn = (URL(urlStr).openConnection() as HttpURLConnection).apply {
            connectTimeout = 10_000
            readTimeout = 10_000
            requestMethod = "GET"
            setRequestProperty("Accept", "application/json")
        }
        try {
            val code = conn.responseCode
            val stream = if (code in 200..299) conn.inputStream else conn.errorStream
            val text = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
            if (code !in 200..299) throw RuntimeException("HTTP $code")
            return JSONObject(text)
        } finally {
            conn.disconnect()
        }
    }
}
