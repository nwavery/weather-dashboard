# Weather Dashboard

A real-time weather dashboard that displays current conditions and forecasts for multiple locations. Built with HTML, CSS, and JavaScript using the Open-Meteo API.

## Features

- Real-time weather data for multiple locations.
- **Editable Locations:** Click the pencil icon (✏️) next to a location name to change it. The dashboard uses the Open-Meteo Geocoding API to find coordinates and timezone for the new city.
- Current temperature with "feels like" temperature.
- Weather conditions with icons (from OpenWeatherMap icon set) and subtle animations (rain, snow, clouds).
- Hourly forecast for the next ~12 hours.
- 5-day daily forecast (including the current day).
- Additional metrics:
  - Humidity
  - Dew point
  - Wind speed and direction
  - UV index
- Historical comparison (current temp vs. daily average).
- **Air quality & allergens:** US AQI, PM2.5, and ground-level ozone for every location (via Open-Meteo, keyless), plus tree/grass/weed **pollen** levels via the Google Pollen API (see [Pollen (Allergen) Data](#pollen-allergen-data)).
- Correct handling of date display across different timezones.
- Auto-refreshing data every minute.
- Responsive design that works on both desktop and mobile.

## Default Locations

Starts with:
- El Reno, OK (Central Time)
- Salem, WI (Central Time)

(These can be changed by the user at runtime.)

## Technologies Used

- HTML5
- CSS3
- JavaScript (ES6+)
- Open-Meteo API (Weather & Geocoding)
- Open-Meteo Air Quality API (AQI, PM2.5, ozone — keyless)
- Google Pollen API (tree/grass/weed pollen — optional, requires your own API key)
- OpenWeatherMap Icons (for visual representation)
- Font Awesome icons (for metrics)
- Google Fonts (Roboto)

## Setup

1. Clone the repository
2. Open `index.html` in a web browser
3. For development, use a local web server (e.g., `python -m http.server 8000`)

## API Data

The dashboard uses the Open-Meteo API to fetch:
- Current weather conditions
- Hourly forecasts
- Daily forecasts
- Temperature, humidity, wind, and other meteorological data

## Customization

Locations can now be edited directly in the browser by clicking the pencil icon next to the city name. Default locations can still be modified in the `LOCATIONS` object in `script.js` if needed.

## Pollen (Allergen) Data

Air-quality figures (US AQI, PM2.5, ozone) come from the keyless Open-Meteo Air Quality API and need no setup — they work for every location worldwide.

Pollen counts (tree, grass, weed) use the **Google Pollen API**, which covers the US and 65+ countries. Open-Meteo's pollen data is Europe-only, so Google is used to get pollen for US (and other) locations. To enable pollen:

1. Create a Google Cloud project, enable the **Pollen API**, and create an API key — restrict it to your site's domain/HTTP referrer. See Google's guide: <https://developers.google.com/maps/documentation/pollen/get-api-key>
2. Open the dashboard and paste the key into the **"Google Pollen API key"** field at the bottom of the page.

The key is stored only in your browser's `localStorage` — it is never committed to the repository or sent anywhere except Google. Responses are cached locally for ~6 hours to stay well within the free tier. Without a key, the dashboard still shows air quality; the pollen row simply prompts you to add a key.

## License

This project is open source and available under the MIT License. 
