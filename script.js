// Location settings
const LOCATIONS = {
    elReno: {
        name: "El Reno, OK",
        latitude: 35.5205,
        longitude: -97.9588,
        timeZone: 'America/Chicago', // Central Time
        elementIds: {
            time: "current-time",
            temp: "current-temp-elreno",
            icon: "weather-icon-elreno",
            description: "weather-description-elreno",
            lastUpdated: "last-updated-elreno",
            feelsLike: "feels-like-elreno",
            humidity: "humidity-elreno",
            wind: "wind-elreno",
            uv: "uv-elreno",
            dewpoint: "dewpoint-elreno",
            sunrise: "sunrise-elreno",
            sunset: "sunset-elreno",
            historical: "historical-elreno",
            alerts: "alerts-elreno",
            card: "card-elreno"
        }
    },
    philadelphia: {
        name: "Philadelphia, PA",
        latitude: 39.9484,
        longitude: -75.2284,
        timeZone: 'America/New_York', // Eastern Time
        elementIds: {
            time: "current-time-philly",
            temp: "current-temp-philly",
            icon: "weather-icon-philly",
            description: "weather-description-philly",
            lastUpdated: "last-updated-philly",
            feelsLike: "feels-like-philly",
            humidity: "humidity-philly",
            wind: "wind-philly",
            uv: "uv-philly",
            dewpoint: "dewpoint-philly",
            sunrise: "sunrise-philly",
            sunset: "sunset-philly",
            historical: "historical-philly",
            alerts: "alerts-philly",
            card: "card-philly"
        }
    }
};

const REFRESH_INTERVAL = 60000; // 1 minute in milliseconds
// Unit is fixed to imperial (Fahrenheit)
const UNIT = 'imperial';

// DOM elements for El Reno
const elRenoTimeElement = document.getElementById(LOCATIONS.elReno.elementIds.time);
const elRenoTempElement = document.getElementById(LOCATIONS.elReno.elementIds.temp);
const elRenoIconElement = document.getElementById(LOCATIONS.elReno.elementIds.icon);
const elRenoDescElement = document.getElementById(LOCATIONS.elReno.elementIds.description);
const elRenoLastUpdatedElement = document.getElementById(LOCATIONS.elReno.elementIds.lastUpdated);
const elRenoFeelsLikeElement = document.getElementById(LOCATIONS.elReno.elementIds.feelsLike);
const elRenoHumidityElement = document.getElementById(LOCATIONS.elReno.elementIds.humidity);
const elRenoWindElement = document.getElementById(LOCATIONS.elReno.elementIds.wind);
const elRenoUvElement = document.getElementById(LOCATIONS.elReno.elementIds.uv);
const elRenoDewpointElement = document.getElementById(LOCATIONS.elReno.elementIds.dewpoint);
const elRenoSunriseElement = document.getElementById(LOCATIONS.elReno.elementIds.sunrise);
const elRenoSunsetElement = document.getElementById(LOCATIONS.elReno.elementIds.sunset);
const elRenoHistoricalElement = document.getElementById(LOCATIONS.elReno.elementIds.historical);
const elRenoAlertsElement = document.getElementById(LOCATIONS.elReno.elementIds.alerts);
const elRenoCardElement = document.getElementById(LOCATIONS.elReno.elementIds.card);

// DOM elements for Philadelphia
const phillyTimeElement = document.getElementById(LOCATIONS.philadelphia.elementIds.time);
const phillyTempElement = document.getElementById(LOCATIONS.philadelphia.elementIds.temp);
const phillyIconElement = document.getElementById(LOCATIONS.philadelphia.elementIds.icon);
const phillyDescElement = document.getElementById(LOCATIONS.philadelphia.elementIds.description);
const phillyLastUpdatedElement = document.getElementById(LOCATIONS.philadelphia.elementIds.lastUpdated);
const phillyFeelsLikeElement = document.getElementById(LOCATIONS.philadelphia.elementIds.feelsLike);
const phillyHumidityElement = document.getElementById(LOCATIONS.philadelphia.elementIds.humidity);
const phillyWindElement = document.getElementById(LOCATIONS.philadelphia.elementIds.wind);
const phillyUvElement = document.getElementById(LOCATIONS.philadelphia.elementIds.uv);
const phillyDewpointElement = document.getElementById(LOCATIONS.philadelphia.elementIds.dewpoint);
const phillySunriseElement = document.getElementById(LOCATIONS.philadelphia.elementIds.sunrise);
const phillySunsetElement = document.getElementById(LOCATIONS.philadelphia.elementIds.sunset);
const phillyHistoricalElement = document.getElementById(LOCATIONS.philadelphia.elementIds.historical);
const phillyAlertsElement = document.getElementById(LOCATIONS.philadelphia.elementIds.alerts);
const phillyCardElement = document.getElementById(LOCATIONS.philadelphia.elementIds.card);

// Function to update the current time
function updateTime() {
    const now = new Date();
    
    // Update El Reno time (Central Time)
    const elRenoTimeString = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
        timeZone: LOCATIONS.elReno.timeZone
    });
    elRenoTimeElement.textContent = elRenoTimeString;
    
    // Update Philadelphia time (Eastern Time)
    const phillyTimeString = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
        timeZone: LOCATIONS.philadelphia.timeZone
    });
    phillyTimeElement.textContent = phillyTimeString;
}

// Format temperature with correct units (always Fahrenheit)
function formatTemperature(temp) {
    let formattedTemp = Math.round(temp);
    return `${formattedTemp}°F`;
}

// Function to get temperature color class
function getTempClass(temp) {
    if (temp < 32) return 'cold';
    if (temp < 50) return 'cool';
    if (temp < 70) return 'mild';
    if (temp < 85) return 'warm';
    return 'hot';
}

// Function to create wind direction arrow
function getWindDirection(degrees) {
    const directions = ['↓ N', '↙ NE', '← E', '↖ SE', '↑ S', '↗ SW', '→ W', '↘ NW'];
    // Round to nearest 45 degrees
    const index = Math.round(degrees / 45) % 8;
    return directions[index];
}

// WMO Weather interpretation codes (for icons and descriptions)
// https://open-meteo.com/en/docs
const weatherCodes = {
    0: { description: "Clear sky", icon: "01d", animation: null },
    1: { description: "Mainly clear", icon: "01d", animation: null },
    2: { description: "Partly cloudy", icon: "02d", animation: "cloudy" },
    3: { description: "Overcast", icon: "04d", animation: "cloudy" },
    45: { description: "Fog", icon: "50d", animation: "cloudy" },
    48: { description: "Depositing rime fog", icon: "50d", animation: "cloudy" },
    51: { description: "Light drizzle", icon: "09d", animation: "rain" },
    53: { description: "Moderate drizzle", icon: "09d", animation: "rain" },
    55: { description: "Dense drizzle", icon: "09d", animation: "rain" },
    56: { description: "Light freezing drizzle", icon: "09d", animation: "rain" },
    57: { description: "Dense freezing drizzle", icon: "09d", animation: "rain" },
    61: { description: "Slight rain", icon: "10d", animation: "rain" },
    63: { description: "Moderate rain", icon: "10d", animation: "rain" },
    65: { description: "Heavy rain", icon: "10d", animation: "rain" },
    66: { description: "Light freezing rain", icon: "13d", animation: "rain" },
    67: { description: "Heavy freezing rain", icon: "13d", animation: "rain" },
    71: { description: "Slight snow fall", icon: "13d", animation: "snow" },
    73: { description: "Moderate snow fall", icon: "13d", animation: "snow" },
    75: { description: "Heavy snow fall", icon: "13d", animation: "snow" },
    77: { description: "Snow grains", icon: "13d", animation: "snow" },
    80: { description: "Slight rain showers", icon: "09d", animation: "rain" },
    81: { description: "Moderate rain showers", icon: "09d", animation: "rain" },
    82: { description: "Violent rain showers", icon: "09d", animation: "rain" },
    85: { description: "Slight snow showers", icon: "13d", animation: "snow" },
    86: { description: "Heavy snow showers", icon: "13d", animation: "snow" },
    95: { description: "Thunderstorm", icon: "11d", animation: "rain" },
    96: { description: "Thunderstorm with slight hail", icon: "11d", animation: "rain" },
    99: { description: "Thunderstorm with heavy hail", icon: "11d", animation: "rain" }
};

// Function to add weather animation
function addWeatherAnimation(cardElement, animationType) {
    // Clear any existing animations
    removeWeatherAnimations(cardElement);
    
    if (!animationType) return;
    
    if (animationType === 'rain') {
        const rainContainer = document.createElement('div');
        rainContainer.className = 'rain-animation';
        
        // Create 20 rain drops with random positions and speeds
        for (let i = 0; i < 20; i++) {
            const raindrop = document.createElement('div');
            raindrop.className = 'rain-drop';
            raindrop.style.left = `${Math.random() * 100}%`;
            raindrop.style.animationDuration = `${0.8 + Math.random() * 0.4}s`;
            raindrop.style.animationDelay = `${Math.random() * 2}s`;
            rainContainer.appendChild(raindrop);
        }
        
        cardElement.appendChild(rainContainer);
    } else if (animationType === 'snow') {
        const snowContainer = document.createElement('div');
        snowContainer.className = 'snow-animation';
        
        // Create 30 snowflakes
        for (let i = 0; i < 30; i++) {
            const snowflake = document.createElement('div');
            snowflake.className = 'snow-flake';
            snowflake.style.left = `${Math.random() * 100}%`;
            snowflake.style.animationDuration = `${2 + Math.random() * 3}s`;
            snowflake.style.animationDelay = `${Math.random() * 2}s`;
            snowContainer.appendChild(snowflake);
        }
        
        cardElement.appendChild(snowContainer);
    } else if (animationType === 'cloudy') {
        const cloudyContainer = document.createElement('div');
        cloudyContainer.className = 'cloudy-animation';
        
        // Create 3 clouds
        for (let i = 0; i < 3; i++) {
            const cloud = document.createElement('div');
            cloud.className = 'cloud';
            cloud.style.top = `${20 + i * 30}%`;
            cloud.style.animationDelay = `${i * -5}s`;
            cloudyContainer.appendChild(cloud);
        }
        
        cardElement.appendChild(cloudyContainer);
    }
}

// Function to remove weather animations
function removeWeatherAnimations(cardElement) {
    const animations = cardElement.querySelectorAll('.rain-animation, .snow-animation, .cloudy-animation');
    animations.forEach(anim => anim.remove());
}

// Function to fetch weather data from Open-Meteo API
async function fetchWeatherData(location, elements) {
    try {
        // Fetch current weather, hourly forecast, and daily data
        const response = await fetch(
            `https://api.open-meteo.com/v1/forecast?` +
            `latitude=${location.latitude}&longitude=${location.longitude}&` +
            `current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,uv_index,dew_point_2m&` + 
            `hourly=temperature_2m,weather_code&` +
            `daily=temperature_2m_max,temperature_2m_min,weather_code,sunrise,sunset&` +
            `temperature_unit=fahrenheit&` +
            `wind_speed_unit=mph&` +
            `timezone=${location.timeZone}&` +
            `forecast_days=6`
        );
        
        if (!response.ok) {
            throw new Error('Weather data could not be fetched');
        }
        
        const data = await response.json();
        
        // Get current weather data
        const temperature = data.current.temperature_2m;
        const feelsLike = data.current.apparent_temperature;
        const humidity = data.current.relative_humidity_2m;
        const windSpeed = data.current.wind_speed_10m;
        const windDirection = data.current.wind_direction_10m;
        const uvIndex = data.current.uv_index;
        const weatherCode = data.current.weather_code;
        const dewpoint = data.current.dew_point_2m;
        
        // Get sunrise/sunset times
        const sunrise = data.daily.sunrise[0].split('T')[1].substring(0, 5);
        const sunset = data.daily.sunset[0].split('T')[1].substring(0, 5);
        
        // Get temperature extremes for the day
        const maxTemp = data.daily.temperature_2m_max[0];
        const minTemp = data.daily.temperature_2m_min[0];
        
        // Update DOM elements with current weather data
        elements.temp.textContent = formatTemperature(temperature);
        elements.feelsLike.textContent = `Feels like: ${formatTemperature(feelsLike)}`;
        
        // Get weather description and icon
        const weather = weatherCodes[weatherCode] || { description: "Unknown", icon: "50d", animation: null };
        
        // Update weather icon
        elements.icon.innerHTML = `<img src="https://openweathermap.org/img/wn/${weather.icon}@2x.png" alt="Weather icon">`;
        
        // Add weather animation
        addWeatherAnimation(elements.card, weather.animation);
        
        // Update additional metrics
        elements.humidity.textContent = `${humidity}%`;
        elements.wind.textContent = `${Math.round(windSpeed)} mph ${getWindDirection(windDirection)}`;
        elements.uv.textContent = `UV: ${Math.round(uvIndex)}`;
        elements.dewpoint.textContent = formatTemperature(dewpoint);
        
        // Update daily forecast
        updateDailyForecast(data.daily, elements.dailyForecast, location.timeZone);
        
        // Update hourly forecast
        updateHourlyForecast(data.hourly, elements.hourlyForecast);
        
        // Update card temperature class based on temperature
        const tempClass = getTempClass(temperature);
        elements.card.className = 'card ' + tempClass;
        
        // Update historical comparison
        const historicalDiff = Math.round(temperature - ((maxTemp + minTemp) / 2));
        const compareSymbol = historicalDiff > 0 ? '↑' : historicalDiff < 0 ? '↓' : '↔';
        elements.historical.textContent = `vs. Historical: ${compareSymbol} ${Math.abs(historicalDiff)}° ${historicalDiff === 0 ? '(average)' : historicalDiff > 0 ? 'warmer' : 'cooler'}`;
        
        // Update last updated time with correct time zone
        const now = new Date();
        const localTimeString = now.toLocaleTimeString('en-US', {
            timeZone: location.timeZone
        });
        elements.lastUpdated.textContent = `Last updated: ${localTimeString}`;
        
    } catch (error) {
        console.error(`Error fetching weather data for ${location.name}:`, error);
        elements.temp.textContent = 'Unable to fetch temperature';
        elements.description.textContent = 'Check your internet connection';
    }
}

// Function to update daily forecast
function updateDailyForecast(dailyData, forecastElement, timeZone) {
    if (!dailyData || !forecastElement) return;
    
    // Clear existing forecast
    forecastElement.innerHTML = '';
    
    // Get today's date at midnight in the location's timezone
    const today = new Date();
    const todayStr = today.toLocaleDateString('en-US', { timeZone });
    
    // Find today's index in the data
    let startIndex = 0;
    for (let i = 0; i < dailyData.time.length; i++) {
        const date = new Date(dailyData.time[i]);
        const dateStr = date.toLocaleDateString('en-US', { timeZone });
        if (dateStr === todayStr) {
            startIndex = i;
            break;
        }
    }
    
    // Display 5 days of forecast starting from today
    for (let i = 0; i < 5; i++) {
        const dataIndex = startIndex + i;
        if (dataIndex >= dailyData.time.length) break;
        
        const date = new Date(dailyData.time[dataIndex]);
        const maxTemp = dailyData.temperature_2m_max[dataIndex-1];
        const minTemp = dailyData.temperature_2m_min[dataIndex-1];
        const weatherCode = dailyData.weather_code[dataIndex-1];
        
        // Get formatted date (e.g., "Mon 4")
        const formattedDate = date.toLocaleDateString('en-US', {
            weekday: 'short',
            day: 'numeric',
            timeZone
        });
        
        // Get weather icon and description
        const weather = weatherCodes[weatherCode] || { description: "Unknown", icon: "50d" };
        
        // Create daily forecast item
        const dailyItem = document.createElement('div');
        dailyItem.className = 'daily-item';
        dailyItem.innerHTML = `
            <div class="daily-date">${formattedDate}</div>
            <div class="daily-icon">
                <img src="https://openweathermap.org/img/wn/${weather.icon}.png" alt="${weather.description}">
            </div>
            <div class="daily-temp">${formatTemperature(maxTemp)}/${formatTemperature(minTemp)}</div>
        `;
        
        forecastElement.appendChild(dailyItem);
    }
}

// Function to update hourly forecast
function updateHourlyForecast(hourlyData, forecastElement) {
    if (!hourlyData || !forecastElement) return;
    
    // Clear existing forecast
    forecastElement.innerHTML = '';
    
    // Get the current hour
    const now = new Date();
    const currentHour = now.getHours();
    
    // Display exactly 6 forecast blocks
    let blocksAdded = 0;
    let hourOffset = 1;
    
    while (blocksAdded < 6) {
        const index = currentHour + hourOffset;
        
        // Make sure we don't go beyond the available data
        if (index >= hourlyData.time.length) break;
        
        const time = hourlyData.time[index];
        const temp = hourlyData.temperature_2m[index];
        const weatherCode = hourlyData.weather_code[index];
        
        // Get formatted time (e.g., "3 PM")
        const formattedTime = new Date(time).toLocaleTimeString('en-US', {
            hour: 'numeric',
            hour12: true
        });
        
        // Get weather icon and description
        const weather = weatherCodes[weatherCode] || { description: "Unknown", icon: "50d" };
        
        // Create hourly forecast item
        const hourlyItem = document.createElement('div');
        hourlyItem.className = 'hourly-item';
        hourlyItem.innerHTML = `
            <div class="hourly-time">${formattedTime}</div>
            <div class="hourly-icon">
                <img src="https://openweathermap.org/img/wn/${weather.icon}.png" alt="${weather.description}">
            </div>
            <div class="hourly-temp">${formatTemperature(temp)}</div>
        `;
        
        forecastElement.appendChild(hourlyItem);
        
        // Increment counters
        blocksAdded++;
        hourOffset += 2; // Every other hour
    }
}

// Function to refresh weather data for both locations
function refreshWeatherData() {
    // El Reno weather elements
    const elRenoElements = {
        temp: elRenoTempElement,
        icon: elRenoIconElement,
        lastUpdated: elRenoLastUpdatedElement,
        feelsLike: elRenoFeelsLikeElement,
        humidity: elRenoHumidityElement,
        wind: elRenoWindElement,
        uv: elRenoUvElement,
        dewpoint: elRenoDewpointElement,
        sunrise: elRenoSunriseElement,
        sunset: elRenoSunsetElement,
        historical: elRenoHistoricalElement,
        alerts: elRenoAlertsElement,
        card: elRenoCardElement,
        hourlyForecast: document.getElementById('hourly-forecast-elreno'),
        dailyForecast: document.getElementById('daily-forecast-elreno')
    };
    
    // Philadelphia weather elements
    const phillyElements = {
        temp: phillyTempElement,
        icon: phillyIconElement,
        lastUpdated: phillyLastUpdatedElement,
        feelsLike: phillyFeelsLikeElement,
        humidity: phillyHumidityElement,
        wind: phillyWindElement,
        uv: phillyUvElement,
        dewpoint: phillyDewpointElement,
        sunrise: phillySunriseElement,
        sunset: phillySunsetElement,
        historical: phillyHistoricalElement,
        alerts: phillyAlertsElement,
        card: phillyCardElement,
        hourlyForecast: document.getElementById('hourly-forecast-philly'),
        dailyForecast: document.getElementById('daily-forecast-philly')
    };
    
    // Fetch weather for both locations
    fetchWeatherData(LOCATIONS.elReno, elRenoElements);
    fetchWeatherData(LOCATIONS.philadelphia, phillyElements);
}

// Function to initialize the app
function initApp() {
    // Initial time update
    updateTime();
    
    // Initial weather data fetch
    refreshWeatherData();
    
    // Set up intervals for updates
    setInterval(updateTime, 1000); // Update time every second
    setInterval(refreshWeatherData, REFRESH_INTERVAL); // Update weather every minute
}

// Start the app when the page loads
window.addEventListener('load', initApp); 