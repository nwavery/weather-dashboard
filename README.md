# Weather Dashboard

A real-time weather dashboard that displays current conditions and forecasts for multiple locations. Built with HTML, CSS, and JavaScript using the Open-Meteo API.

## Features

- Real-time weather data for multiple locations
- Current temperature with "feels like" temperature
- Weather conditions with animated icons
- Hourly forecast (next 10 hours)
- 4-day forecast
- Additional metrics:
  - Humidity
  - Dew point
  - Wind speed and direction
  - UV index
- Auto-refreshing data every minute
- Responsive design that works on both desktop and mobile
- Weather animations for rain and snow conditions

## Locations

Currently configured for:
- El Reno, OK (Central Time)
- Philadelphia, PA (Eastern Time)

## Technologies Used

- HTML5
- CSS3
- JavaScript (ES6+)
- Open-Meteo API
- Font Awesome icons
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

To add or modify locations, update the `LOCATIONS` object in `script.js` with the desired coordinates and timezone.

## License

This project is open source and available under the MIT License. 