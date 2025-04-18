// Location settings
let LOCATIONS = { // Changed to let to allow modification
    elReno: {
        name: "El Reno, OK",
        latitude: 35.5205,
        longitude: -97.9588,
        timeZone: 'America/Chicago', // Central Time
        elementIds: {
            time: "current-time",
            temp: "current-temp-elreno",
            icon: "weather-icon-elreno",
            // description: "weather-description-elreno", // Description is now handled by weather code
            lastUpdated: "last-updated-elreno",
            feelsLike: "feels-like-elreno",
            humidity: "humidity-elreno",
            wind: "wind-elreno",
            uv: "uv-elreno",
            dewpoint: "dewpoint-elreno",
            // sunrise: "sunrise-elreno", // No longer separate elements
            // sunset: "sunset-elreno", // No longer separate elements
            historical: "historical-elreno",
            // alerts: "alerts-elreno", // Alert handling not implemented yet
            card: "card-elreno",
            nameDisplay: "location-name-elreno", // Added for editing
            nameInput: "location-input-elreno", // Added for editing
            editButton: "edit-btn-elreno", // Added for editing
            hourlyForecast: 'hourly-forecast-elreno', // Added for element helper
            dailyForecast: 'daily-forecast-elreno' // Added for element helper
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
            // description: "weather-description-philly",
            lastUpdated: "last-updated-philly",
            feelsLike: "feels-like-philly",
            humidity: "humidity-philly",
            wind: "wind-philly",
            uv: "uv-philly",
            dewpoint: "dewpoint-philly",
            // sunrise: "sunrise-philly",
            // sunset: "sunset-philly",
            historical: "historical-philly",
            // alerts: "alerts-philly",
            card: "card-philly",
            nameDisplay: "location-name-philly", // Added for editing
            nameInput: "location-input-philly", // Added for editing
            editButton: "edit-btn-philly", // Added for editing
            hourlyForecast: 'hourly-forecast-philly', // Added for element helper
            dailyForecast: 'daily-forecast-philly' // Added for element helper
        }
    }
};

const REFRESH_INTERVAL = 60000; // 1 minute in milliseconds
// Unit is fixed to imperial (Fahrenheit)
const UNIT = 'imperial';

// DOM elements for El Reno (REMOVED - Now handled dynamically)
// const elRenoTimeElement = ...;
// ... all other specific const declarations ...

// DOM elements for Philadelphia (REMOVED - Now handled dynamically)
// const phillyTimeElement = ...;
// ... all other specific const declarations ...

// Helper function to get elements for a specific location
function getElementsForLocation(locationKey) {
    const ids = LOCATIONS[locationKey]?.elementIds;
    if (!ids) {
        console.error("Could not find element IDs for location key:", locationKey);
        return null;
    }
    const elements = {};
    for (const key in ids) {
        elements[key] = document.getElementById(ids[key]);
        if (!elements[key] && key !== 'alerts') { // Allow alerts element to be missing
             console.warn(`Element with ID '${ids[key]}' not found for ${locationKey}.`);
        }
    }
    // Add card element by data attribute as fallback/primary method
    if (!elements.card) {
        elements.card = document.querySelector(`.card[data-location-key="${locationKey}"]`);
         if (!elements.card) {
             console.error(`Card element not found for location key: ${locationKey}`);
             return null; // Critical element missing
         }
    }
     // Add name display/input/button by class within the card as fallback/primary method
    if (!elements.nameDisplay) {
         elements.nameDisplay = elements.card?.querySelector('.location-name');
    }
     if (!elements.nameInput) {
         elements.nameInput = elements.card?.querySelector('.location-input');
    }
     if (!elements.editButton) {
         elements.editButton = elements.card?.querySelector('.edit-location-btn');
    }

    // Validate essential elements needed for updates
    const required = ['time', 'temp', 'icon', 'lastUpdated', 'feelsLike', 'humidity', 'wind', 'uv', 'dewpoint', 'historical', 'card', 'hourlyForecast', 'dailyForecast'];
    for (const req of required) {
        if (!elements[req]) {
             console.error(`Missing required element '${req}' (ID: ${ids?.[req]}) for location ${locationKey}`);
             // Optionally return null or a partial object depending on robustness needs
        }
    }

    return elements;
}

// Function to update the current time for all locations
function updateTime() {
    const now = new Date();

    for (const key in LOCATIONS) {
        const location = LOCATIONS[key];
        const elements = getElementsForLocation(key); // Get elements dynamically

        if (elements && elements.time) {
             const timeString = now.toLocaleTimeString('en-US', {
                 hour: '2-digit',
                 minute: '2-digit',
                 second: '2-digit',
                 hour12: true,
                 timeZone: location.timeZone
             });
            elements.time.textContent = timeString;
        }
    }
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
async function fetchWeatherData(locationKey) { // Takes locationKey now
    const location = LOCATIONS[locationKey];
    const elements = getElementsForLocation(locationKey);

    if (!location || !elements) {
        console.error("Missing location data or elements for key:", locationKey);
        return; // Exit if essential parts are missing
    }

    // Ensure required elements for display exist before fetching
     const requiredElements = ['temp', 'icon', 'lastUpdated', 'feelsLike', 'humidity', 'wind', 'uv', 'dewpoint', 'historical', 'card', 'hourlyForecast', 'dailyForecast'];
     for (const elKey of requiredElements) {
         if (!elements[elKey]) {
             console.error(`Cannot fetch weather for ${location.name}: Missing element ${elKey}`);
             // Potentially update UI to show an error state for this card
             elements.card.innerHTML = `<p class="error">Error: UI element '${elKey}' missing.</p>`;
             return;
         }
     }


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
            throw new Error(`Weather data fetch failed: ${response.statusText} (status code: ${response.status})`);
        }

        const data = await response.json();

        if (!data || !data.current || !data.daily || !data.hourly) {
             throw new Error("Incomplete weather data received from API.");
        }

        // Get current weather data
        const temperature = data.current.temperature_2m;
        const feelsLike = data.current.apparent_temperature;
        const humidity = data.current.relative_humidity_2m;
        const windSpeed = data.current.wind_speed_10m;
        const windDirection = data.current.wind_direction_10m;
        const uvIndex = data.current.uv_index;
        const weatherCode = data.current.weather_code;
        const dewpoint = data.current.dew_point_2m;

        // Get sunrise/sunset times (No longer updating specific elements)
        // const sunrise = data.daily.sunrise[0].split('T')[1].substring(0, 5);
        // const sunset = data.daily.sunset[0].split('T')[1].substring(0, 5);

        // Get temperature extremes for the day
        const maxTemp = data.daily.temperature_2m_max[0];
        const minTemp = data.daily.temperature_2m_min[0];

        // Update DOM elements with current weather data
        elements.temp.textContent = formatTemperature(temperature);
        elements.feelsLike.textContent = `Feels like: ${formatTemperature(feelsLike)}`;

        // Get weather description and icon
        const weather = weatherCodes[weatherCode] || { description: "Unknown", icon: "50d", animation: null };
        elements.icon.innerHTML = `<img src="https://openweathermap.org/img/wn/${weather.icon}@2x.png" alt="${weather.description}" title="${weather.description}">`; // Add title attribute


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
        updateHourlyForecast(data.hourly, elements.hourlyForecast, location.timeZone); // Pass timezone


        // Update card temperature class based on temperature
        const tempClass = getTempClass(temperature);
        // Be careful when replacing class names, preserve base 'card' class
        elements.card.className = `card ${tempClass}`;
        elements.card.dataset.locationKey = locationKey; // Ensure key is present


        // Update historical comparison
        const historicalDiff = Math.round(temperature - ((maxTemp + minTemp) / 2));
        const compareSymbol = historicalDiff > 0 ? '↑' : historicalDiff < 0 ? '↓' : '↔';
        elements.historical.textContent = `vs. Hist: ${compareSymbol} ${Math.abs(historicalDiff)}° ${historicalDiff === 0 ? '' : historicalDiff > 0 ? ' warmer' : ' cooler'}`; // Shortened text

        // Update last updated time with correct time zone
        const now = new Date();
        const localTimeString = now.toLocaleTimeString('en-US', {
            timeZone: location.timeZone,
            hour: 'numeric',
            minute: '2-digit'
        });
        elements.lastUpdated.textContent = `Updated: ${localTimeString}`; // Shortened text

    } catch (error) {
        console.error(`Error updating weather data for ${location.name} (${locationKey}):`, error);
        // Display error on the specific card
        if (elements && elements.card) {
             elements.card.innerHTML = `<p class="error">Could not load weather data. ${error.message}</p>`;
        } else {
             // Fallback if card element isn't available
             alert(`Error loading weather for ${location.name}. Please check console.`);
        }
    }
}

// Function to update daily forecast
function updateDailyForecast(dailyData, forecastElement, timeZone) {
    if (!dailyData || !forecastElement) return;
    
    forecastElement.innerHTML = '';
    
    // Display 5 days of forecast starting from the beginning of the received daily data
    const displayDays = 5;
    for (let i = 0; i < displayDays && i < dailyData.time.length; i++) {
        const dataIndex = i; // Process directly from index 0 of the daily data array
        
        let formattedDateFinal = '?? ???';
        let maxTemp = '--';
        let minTemp = '--';
        let weatherCode = null;
        let weather = { description: "Unknown", icon: "50d" };

        try {
            // --- Date Formatting for Display ---
            const itemDateStr = dailyData.time[dataIndex]; // "YYYY-MM-DD"
            if (!itemDateStr || itemDateStr.length < 10) throw new Error("Invalid date string from API");
            
            const itemYear = parseInt(itemDateStr.substring(0, 4));
            const itemMonth = parseInt(itemDateStr.substring(5, 7)) - 1; // JS month 0-based
            const itemDay = parseInt(itemDateStr.substring(8, 10));

            if (isNaN(itemYear) || isNaN(itemMonth) || isNaN(itemDay)) {
                 throw new Error("Failed to parse date components");
            }

            // Create a date object representing NOON UTC for that day to avoid timezone shifts
            const dateObjectForDay = new Date(Date.UTC(itemYear, itemMonth, itemDay, 12, 0, 0));

            // Use Intl.DateTimeFormat to format this instant correctly for the target timezone
            const dateFormatter = new Intl.DateTimeFormat('en-US', {
                timeZone: timeZone,
                weekday: 'short',
                day: 'numeric'
            });
            formattedDateFinal = dateFormatter.format(dateObjectForDay);

            // --- Get Weather Data (Using correct dataIndex) ---
            maxTemp = dailyData.temperature_2m_max[dataIndex];
            minTemp = dailyData.temperature_2m_min[dataIndex];
            weatherCode = dailyData.weather_code[dataIndex];

            weather = weatherCodes[weatherCode] || { description: "Unknown", icon: "50d" };

        } catch(e) {
            console.error(`Error processing daily forecast item (dataIndex: ${dataIndex}, date: ${dailyData.time[dataIndex]}):`, e);
        }
        
        const formattedMaxTemp = (typeof maxTemp === 'number' && !isNaN(maxTemp)) ? formatTemperature(maxTemp) : '--';
        const formattedMinTemp = (typeof minTemp === 'number' && !isNaN(minTemp)) ? formatTemperature(minTemp) : '--';

        const dailyItem = document.createElement('div');
        dailyItem.className = 'daily-item';
        dailyItem.innerHTML = `
            <div class="daily-date">${formattedDateFinal}</div>
            <div class="daily-icon">
                <img src="https://openweathermap.org/img/wn/${weather.icon}.png" alt="${weather.description}" title="${weather.description}">
            </div>
            <div class="daily-temp">${formattedMaxTemp}/${formattedMinTemp}</div>
        `;
        
        forecastElement.appendChild(dailyItem);
    }
}

// Function to update hourly forecast
function updateHourlyForecast(hourlyData, forecastElement, timeZone) { // Added timeZone param
    if (!hourlyData || !forecastElement) return;

    // Clear existing forecast
    forecastElement.innerHTML = '';

    // Get the current hour in the location's timezone
    const now = new Date();
    // Find the index of the *next* full hour in the hourly data
    let startIndex = -1;
    const nowInZone = new Date(now.toLocaleString('en-US', { timeZone: timeZone }));
    const currentHourStartTimestamp = new Date(nowInZone);
    currentHourStartTimestamp.setMinutes(0, 0, 0);


    for (let i = 0; i < hourlyData.time.length; i++) {
        const hourlyTimestamp = new Date(hourlyData.time[i]);
        if (hourlyTimestamp >= currentHourStartTimestamp) {
            startIndex = i;
            break;
        }
    }

    if (startIndex === -1) {
        console.warn("Could not find current hour in hourly forecast data.");
        return; // Cannot proceed
    }


    // Display 6 forecast blocks (next hour, +3h, +5h, +7h, +9h, +11h)
    const offsets = [1, 3, 5, 7, 9, 11]; // Hours from the *start* index
    for (let i = 0; i < offsets.length; i++) {
        const index = startIndex + offsets[i];

        // Make sure we don't go beyond the available data
        if (index >= hourlyData.time.length) break;

        const time = hourlyData.time[index];
        const temp = hourlyData.temperature_2m[index];
        const weatherCode = hourlyData.weather_code[index];

        // Get formatted time (e.g., "3 PM") in the correct timezone
        const formattedTime = new Date(time).toLocaleTimeString('en-US', {
            hour: 'numeric',
            hour12: true,
            timeZone: timeZone // Use the location's timezone
        });

        // Get weather icon and description
        const weather = weatherCodes[weatherCode] || { description: "Unknown", icon: "50d" };

        // Create hourly forecast item
        const hourlyItem = document.createElement('div');
        hourlyItem.className = 'hourly-item';
        hourlyItem.innerHTML = `
            <div class="hourly-time">${formattedTime}</div>
            <div class="hourly-icon">
                <img src="https://openweathermap.org/img/wn/${weather.icon}.png" alt="${weather.description}" title="${weather.description}">
            </div>
            <div class="hourly-temp">${formatTemperature(temp)}</div>
        `;

        forecastElement.appendChild(hourlyItem);
    }
}

// Function to fetch weather data for a single location
async function updateWeatherForLocation(locationKey) {
    console.log(`Updating weather for ${locationKey}`);
    await fetchWeatherData(locationKey);
}

// Function to refresh weather data for ALL locations
function refreshAllWeatherData() {
    console.log("Refreshing weather for all locations...");
    for (const key in LOCATIONS) {
        updateWeatherForLocation(key);
    }
}

// --- Location Editing Functions ---

// Geocode city name using Open-Meteo Geocoding API
async function geocodeCity(cityName) {
    if (!cityName || typeof cityName !== 'string' || cityName.trim().length === 0) {
        console.error("Invalid city name provided for geocoding.");
        return null;
    }
    try {
        const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName.trim())}&count=1&language=en&format=json`);
        if (!response.ok) {
            throw new Error(`Geocoding API request failed: ${response.statusText}`);
        }
        const data = await response.json();
        if (data && data.results && data.results.length > 0) {
            const result = data.results[0];
            // Construct a display name, preferring city/town/village + admin1/country
            let displayName = result.name;
             if (result.admin1 && result.country_code && result.admin1 !== result.name) {
                 displayName += `, ${result.admin1}`;
             } else if (result.country && result.country !== result.name) {
                 displayName += `, ${result.country}`;
             }

            return {
                name: displayName, // Use formatted name
                latitude: result.latitude,
                longitude: result.longitude,
                timeZone: result.timezone // Get timezone from geocoding result
            };
        } else {
            console.warn(`Geocoding failed for "${cityName}": No results found.`);
            return null; // City not found
        }
    } catch (error) {
        console.error(`Error during geocoding for "${cityName}":`, error);
        return null; // API error
    }
}


// Handle click on the edit button
function handleEditClick(event) {
    const button = event.currentTarget; // Use currentTarget for the element the listener is attached to
    const locationKey = button.dataset.locationKey;
    const elements = getElementsForLocation(locationKey);

    if (!elements || !elements.nameDisplay || !elements.nameInput || !elements.editButton) {
        console.error("Missing elements for editing location:", locationKey);
        return;
    }

    elements.nameDisplay.style.display = 'none';
    elements.nameInput.style.display = 'inline-block'; // Or 'block'
    elements.nameInput.value = LOCATIONS[locationKey].name; // Pre-fill with current name
    elements.nameInput.focus();
    elements.nameInput.select(); // Select text for easy replacement

    elements.editButton.textContent = '💾'; // Change icon to Save (Disk emoji)
    elements.editButton.removeEventListener('click', handleEditClick); // Remove old listener
    elements.editButton.addEventListener('click', handleSaveClick); // Add save listener
    // Add listener for Enter key press on input
    elements.nameInput.addEventListener('keypress', handleInputKeyPress);
}

// Handle click on the save button
async function handleSaveClick(event) {
    const button = event.currentTarget;
    const locationKey = button.dataset.locationKey;
    const elements = getElementsForLocation(locationKey);

    if (!elements || !elements.nameDisplay || !elements.nameInput || !elements.editButton) {
        console.error("Missing elements for saving location:", locationKey);
        return; // Should not happen if edit worked, but safety check
    }

    const newCityName = elements.nameInput.value.trim();
    const oldCityName = LOCATIONS[locationKey].name;

    // Remove keypress listener immediately
    elements.nameInput.removeEventListener('keypress', handleInputKeyPress);


    if (!newCityName || newCityName === oldCityName) {
        // If name is empty or unchanged, just revert UI
        elements.nameInput.style.display = 'none';
        elements.nameDisplay.style.display = 'inline-block'; // Or 'block'
        elements.editButton.textContent = '✏️'; // Back to Edit icon
        elements.editButton.removeEventListener('click', handleSaveClick); // Remove save listener
        elements.editButton.addEventListener('click', handleEditClick); // Re-add edit listener
        if (!newCityName) {
             alert("City name cannot be empty.");
             elements.nameDisplay.textContent = oldCityName; // Ensure old name is displayed
        }
        return;
    }

    // Show loading indicator? (Optional)
    elements.editButton.textContent = '⏳'; // Hourglass
    elements.editButton.disabled = true; // Disable button during processing
    elements.nameInput.disabled = true;

    // Geocode the new city name
    const newLocationData = await geocodeCity(newCityName);

    if (newLocationData) {
        // Update successful
        LOCATIONS[locationKey] = {
            ...LOCATIONS[locationKey], // Keep existing elementIds
            name: newLocationData.name,
            latitude: newLocationData.latitude,
            longitude: newLocationData.longitude,
            timeZone: newLocationData.timeZone
        };

        // Update UI
        elements.nameDisplay.textContent = newLocationData.name;
        elements.nameInput.style.display = 'none';
        elements.nameDisplay.style.display = 'inline-block'; // Or 'block'
        elements.editButton.textContent = '✏️'; // Back to Edit icon
        elements.editButton.disabled = false;
        elements.nameInput.disabled = false;

        // Remove save listener, add edit listener
        elements.editButton.removeEventListener('click', handleSaveClick);
        elements.editButton.addEventListener('click', handleEditClick);

        // Fetch new weather data for this location only
        updateWeatherForLocation(locationKey);

    } else {
        // Geocoding failed
        alert(`Could not find location data for "${newCityName}". Please try a different name.`);
        // Revert UI but keep input visible for correction
        elements.nameInput.style.display = 'inline-block'; // Or 'block'
        elements.nameDisplay.style.display = 'none';
        elements.editButton.textContent = '💾'; // Keep Save icon
        elements.editButton.disabled = false; // Re-enable button
        elements.nameInput.disabled = false;
        elements.nameInput.focus();
        elements.nameInput.select();
         // Keep save listener active, re-add keypress listener
         elements.nameInput.addEventListener('keypress', handleInputKeyPress);

    }
}

// Handle Enter key press in the input field
function handleInputKeyPress(event) {
    if (event.key === 'Enter') {
        event.preventDefault(); // Prevent default form submission (if any)
        const locationKey = event.target.closest('.card')?.dataset.locationKey; // Find key from parent card
        const elements = getElementsForLocation(locationKey);
         if (elements && elements.editButton) {
             handleSaveClick({ currentTarget: elements.editButton }); // Simulate save button click
         }
    }
}


// Function to initialize the app
function initApp() {
    // Initial time update
    updateTime();

    // Initial weather data fetch for all locations
    refreshAllWeatherData();

    // Set up intervals for updates
    setInterval(updateTime, 1000); // Update time every second
    setInterval(refreshAllWeatherData, REFRESH_INTERVAL); // Update weather every minute

    // Add event listeners to edit buttons
    const editButtons = document.querySelectorAll('.edit-location-btn');
    editButtons.forEach(button => {
        // Ensure the key exists before adding listener
        const locationKey = button.dataset.locationKey;
        if (LOCATIONS[locationKey]) {
             button.addEventListener('click', handleEditClick);
             // Set initial text content based on element IDs if available
             const elements = getElementsForLocation(locationKey);
             if (elements && elements.nameDisplay) {
                 elements.nameDisplay.textContent = LOCATIONS[locationKey].name;
             }
        } else {
             console.warn(`Edit button found for non-existent location key: ${locationKey}`);
        }
    });

    // Add listeners to initially hidden input fields (necessary for Enter key)
     // Note: This might be redundant if handleEditClick adds the listener,
     // but doesn't hurt if added once here. Revisit if causing issues.
     // document.querySelectorAll('.location-input').forEach(input => {
     //     input.addEventListener('keypress', handleInputKeyPress);
     // });
}

// Start the app when the DOM is fully loaded
window.addEventListener('DOMContentLoaded', initApp); // Use DOMContentLoaded 
