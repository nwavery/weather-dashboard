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
- Correct handling of date display across different timezones.
- Auto-refreshing data every minute.
- Responsive design that works on both desktop and mobile.

## Default Locations

Starts with:
- El Reno, OK (Central Time)
- Philadelphia, PA (Eastern Time)

(These can be changed by the user at runtime.)

## Technologies Used

- HTML5
- CSS3
- JavaScript (ES6+)
- Open-Meteo API (Weather & Geocoding)
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

## License

This project is open source and available under the MIT License. 
