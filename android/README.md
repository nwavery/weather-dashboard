# WeatherGlance (Android)

A small native **Kotlin** weather app with a **2×2 home-screen widget** built on
**Jetpack Glance**. It reuses the web dashboard's data source (Open-Meteo —
keyless, global) and the same WMO weather-code → condition mapping.

<p align="center"><em>App: current conditions for a searched/located city &nbsp;·&nbsp; Widget: 2×2 glanceable tile</em></p>

## Features

- **2×2 Glance widget** — big temperature, condition emoji + label, location,
  today's H/L, and "updated" time, on a **weather-reactive sky gradient** that
  changes with the condition and day/night (clear, cloudy, fog, rain, snow,
  storm × day/night).
- **App** — search any city (Open-Meteo geocoding) or **use device location**
  (framework `LocationManager`, no Play Services), °C/°F toggle, pull-fresh.
- **Auto-refresh** — `WorkManager` refreshes every 30 min; tapping the widget's
  ⟳ refreshes on demand; tapping the tile opens the app.
- **No API keys, minimal deps** — networking is plain `HttpURLConnection` +
  `org.json` (both on-platform), so there's nothing to pin or leak.

## Requirements

- **Android Studio** (Koala/Ladybug or newer) with **JDK 17**
- Android SDK Platform 34
- A device/emulator on **Android 8.0 (API 26)+**

## Run it

1. **Open the `android/` folder** in Android Studio (`File ▸ Open` → pick
   `android`). Let Gradle sync — Android Studio provides the Gradle wrapper jar
   automatically. *(CLI alternative: `cd android && gradle wrapper --gradle-version 8.7`
   then `./gradlew installDebug`.)*
2. Press **Run ▶** to install the app, then open it once so it fetches weather.
3. **Add the widget:** long-press the home screen → **Widgets** → *WeatherGlance*
   → drag the **2×2** tile onto the home screen.

## How it's wired

```
app/src/main/java/com/weatherglance/
  MainActivity.kt            Compose host + location-permission flow
  WeatherViewModel.kt        UI state (search, units, refresh)
  ui/WeatherScreen.kt        Compose screen + sky gradient
  ui/Theme.kt                Material 3 dark theme
  data/
    OpenMeteo.kt             keyless forecast + geocoding client
    WeatherRepository.kt     fetch → cache → push to widgets
    PrefsStore.kt            active place + units (SharedPreferences)
    DeviceLocation.kt        last-known location + reverse geocode
    Models.kt                Place / Weather
  weather/
    WeatherCodes.kt          WMO code → emoji + description + bucket
    Sky.kt                   bucket + day/night → gradient drawable
    Format.kt                °C/°F + wind formatting
  widget/
    WeatherWidget.kt         GlanceAppWidget (the 2×2 UI)
    WeatherWidgetReceiver.kt provider; schedules work on enable/disable
    WidgetUpdater.kt         writes display strings into Glance state
    RefreshAction.kt         ⟳ tap → refresh
    WidgetRefreshWorker.kt   periodic + one-shot refresh
res/drawable/sky_*.xml       the eight condition gradients
res/xml/weather_widget_info.xml  2×2 widget metadata
```

## Notes

- The default location is Oklahoma City (matching the web app's fallback) until
  you search or grant location.
- Periodic widget updates honor Android's 15-minute minimum; the system may
  batch them to save battery.
