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
            dailyForecast: 'daily-forecast-elreno', // Added for element helper
            errorDisplay: 'error-display-elreno' // Added for error messages
        }
    },
    salem: { // Changed from philadelphia
        name: "Salem, WI", // Changed name
        latitude: 42.5686, // Changed latitude
        longitude: -88.108417, // Changed longitude
        timeZone: 'America/Chicago', // Changed timeZone
        elementIds: {
            time: "current-time-salem", // Changed ID
            temp: "current-temp-salem", // Changed ID
            icon: "weather-icon-salem", // Changed ID
            // description: "weather-description-philly", // Kept commented
            lastUpdated: "last-updated-salem", // Changed ID
            feelsLike: "feels-like-salem", // Changed ID
            humidity: "humidity-salem", // Changed ID
            wind: "wind-salem", // Changed ID
            uv: "uv-salem", // Changed ID
            dewpoint: "dewpoint-salem", // Changed ID
            // sunrise: "sunrise-philly", // Kept commented
            // sunset: "sunset-philly", // Kept commented
            historical: "historical-salem", // Changed ID
            // alerts: "alerts-philly", // Kept commented
            card: "card-salem", // Changed ID
            nameDisplay: "location-name-salem", // Added for editing
            nameInput: "location-input-salem", // Added for editing
            editButton: "edit-btn-salem", // Added for editing
            hourlyForecast: 'hourly-forecast-salem', // Added for element helper
            dailyForecast: 'daily-forecast-salem', // Added for element helper
            errorDisplay: 'error-display-salem' // Added for error messages
        }
    }
};

const REFRESH_INTERVAL = 60000; // 1 minute in milliseconds
// Unit is fixed to imperial (Fahrenheit)
const UNIT = 'imperial';
let WEATHER_CODES = {}; // Will be loaded from JSON

// DOM elements for El Reno (REMOVED - Now handled dynamically)
// const elRenoTimeElement = ...;
// ... all other specific const declarations ...

// DOM elements for Philadelphia (REMOVED - Now handled dynamically)
// const phillyTimeElement = ...;
// ... all other specific const declarations ...

function createLocationCardHTML(locationKey, locationData) {
    const ids = locationData.elementIds;
    return `
        <div class=\"card\" id=\"${ids.card}\" data-location-key=\"${locationKey}\">
            <div class=\"time-section\">
                <h2>
                    <span class=\"location-name\" id=\"${ids.nameDisplay}\">${locationData.name}</span>
                    <input type=\"text\" class=\"location-input\" id=\"${ids.nameInput}\" style=\"display: none;\">
                    <button class=\"edit-location-btn\" id=\"${ids.editButton}\" data-location-key=\"${locationKey}\" title=\"Edit Location\">✏️</button>
                </h2>
                <div id=\"${ids.time}\" class=\"display-value\">Loading...</div>
            </div>
            <div class=\"weather-section\">
                <div class=\"temp-and-icon\">
                    <div class=\"temp-display\">
                        <div id=\"${ids.icon}\"></div>
                        <div id=\"${ids.temp}\" class=\"display-value\">Loading...</div>
                    </div>
                    <div class=\"temp-details\">
                        <span id=\"${ids.feelsLike}\" class=\"feels-like\">Feels like: --</span>
                        <span id=\"${ids.historical}\" class=\"historical\">vs. Historical: --</span>
                    </div>
                </div>
                <div class=\"daily-forecast\">
                    <div id=\"${ids.dailyForecast}\" class=\"daily-forecast-container\">
                        <div class=\"daily-item-placeholder\">Loading daily forecast...</div>
                    </div>
                </div>
            </div>
            <div class=\"extra-metrics\">
                <div class=\"metric\"><i class=\"fas fa-tint\"></i> <span id=\"${ids.humidity}\">--</span></div>
                <div class=\"metric\"><i class=\"fas fa-water\"></i> <span id=\"${ids.dewpoint}\">--</span></div>
                <div class=\"metric\"><i class=\"fas fa-wind\"></i> <span id=\"${ids.wind}\">--</span></div>
                <div class=\"metric\"><i class=\"fas fa-sun\"></i> <span id=\"${ids.uv}\">--</span></div>
            </div>
            <div class=\"hourly-forecast\">
                <div id=\"${ids.hourlyForecast}\" class=\"hourly-forecast-container\">
                    <div class=\"hourly-item-placeholder\">Loading hourly forecast...</div>
                </div>
            </div>
            <div class=\"error-display\" id=\"${ids.errorDisplay}\" style=\"display: none;\"><!-- For error messages --></div>
            <div class=\"alerts-container\">
                <!-- <div id=\"${ids.alerts}\" class=\"alerts\"></div> --> <!-- Alerts not fully implemented yet -->
            </div>
            <div class=\"refresh-info\">
                <p>Auto-refreshes every minute</p>
                <div id=\"${ids.lastUpdated}\">Last updated: -</div>
            </div>
        </div>
    `;
}

// Helper function to get elements for a specific location
function getElementsForLocation(locationKey) {
    const locationConfig = LOCATIONS[locationKey];
    if (!locationConfig || !locationConfig.elementIds) {
        console.error("Could not find config or element IDs for location key:", locationKey);
        return null;
    }

    const elements = {};
    const cardElement = document.getElementById(locationConfig.elementIds.card) || document.querySelector(`.card[data-location-key="${locationKey}"]`);

    if (!cardElement) {
        console.error(`Card element not found for location key: ${locationKey}`);
        return null;
    }
    elements.card = cardElement;

    const getElementByIdOrClass = (idKey, queryClassSuffix) => {
        const elementId = locationConfig.elementIds[idKey];
        if (elementId) {
            const el = document.getElementById(elementId);
            if (el) return el;
        }
        // Fallback to class query within the card if queryClassSuffix is provided
        if (queryClassSuffix) {
            return cardElement.querySelector(`.${idKey.replace(/([A-Z])/g, '-$1').toLowerCase()}${queryClassSuffix || ''}`);
        }
        return null;
    };

    for (const idKey in locationConfig.elementIds) {
        elements[idKey] = getElementByIdOrClass(idKey);
        if (!elements[idKey] && idKey !== 'alerts' && idKey !== 'errorDisplay') { // Allow alerts and errorDisplay to be missing initially
            console.warn(`Element with ID '${locationConfig.elementIds[idKey]}' or class for key '${idKey}' not found for ${locationKey}.`);
        }
    }
    
    // Ensure errorDisplay element is specifically looked for by its ID if not found by general logic
    if (!elements.errorDisplay && locationConfig.elementIds.errorDisplay) {
        elements.errorDisplay = document.getElementById(locationConfig.elementIds.errorDisplay);
    }

    // Validate essential elements
    const requiredElementKeys = ['time', 'temp', 'icon', 'lastUpdated', 'feelsLike', 'humidity', 'wind', 'uv', 'dewpoint', 'historical', 'card', 'hourlyForecast', 'dailyForecast', 'nameDisplay', 'nameInput', 'editButton'];
    for (const reqKey of requiredElementKeys) {
        if (!elements[reqKey]) {
            console.error(`Missing required element '${reqKey}' (expected ID: ${locationConfig.elementIds[reqKey]}) for location ${locationKey}. This may break functionality.`);
            // Optionally, handle this more gracefully in the UI, e.g., by disabling the card or showing a specific error on it.
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

// Function to add weather animation
function addWeatherAnimation(cardElement, animationType) {
    removeWeatherAnimations(cardElement);
    if (!animationType) return;
    
    const container = document.createElement('div');
    container.className = `${animationType}-animation`;

    let count = 0;
    let particleClass = '';

    if (animationType === 'rain') {
        count = 20;
        particleClass = 'rain-drop';
    } else if (animationType === 'snow') {
        count = 30;
        particleClass = 'snow-flake';
    } else if (animationType === 'cloudy') {
        count = 3;
        particleClass = 'cloud';
    }

    for (let i = 0; i < count; i++) {
        const particle = document.createElement('div');
        particle.className = particleClass;
        if (animationType === 'rain') {
            particle.style.left = `${Math.random() * 100}%`;
            particle.style.animationDuration = `${0.8 + Math.random() * 0.4}s`;
            particle.style.animationDelay = `${Math.random() * 2}s`;
        } else if (animationType === 'snow') {
            particle.style.left = `${Math.random() * 100}%`;
            particle.style.animationDuration = `${2 + Math.random() * 3}s`;
            particle.style.animationDelay = `${Math.random() * 2}s`;
        } else if (animationType === 'cloudy') {
            particle.style.top = `${20 + i * 30}%`;
            particle.style.animationDelay = `${i * -5}s`;
        }
        container.appendChild(particle);
    }
    cardElement.appendChild(container);
}

// Function to remove weather animations
function removeWeatherAnimations(cardElement) {
    const animations = cardElement.querySelectorAll('.rain-animation, .snow-animation, .cloudy-animation');
    animations.forEach(anim => anim.remove());
}

function displayErrorOnCard(locationKey, message) {
    const elements = getElementsForLocation(locationKey);
    if (elements && elements.errorDisplay) {
        elements.errorDisplay.textContent = message;
        elements.errorDisplay.style.display = 'block';
        // Optionally hide other elements or clear the card
        if (elements.temp) elements.temp.textContent = 'Error';
        if (elements.icon) elements.icon.innerHTML = '';
        // etc. for other elements you want to clear/hide
    } else if (elements && elements.card) {
        // Fallback if errorDisplay element is not found, but card is
        const errorP = document.createElement('p');
        errorP.className = 'error-message-fallback';
        errorP.textContent = message;
        // Clear card and append error or prepend error
        elements.card.innerHTML = ''; // Example: clear card
        elements.card.appendChild(errorP);
    } else {
        console.error(`Cannot display error on card for ${locationKey}: card or error display element not found. Error: ${message}`);
    }
}

function clearErrorOnCard(locationKey) {
    const elements = getElementsForLocation(locationKey);
    if (elements && elements.errorDisplay) {
        elements.errorDisplay.textContent = '';
        elements.errorDisplay.style.display = 'none';
    }
}

// Function to fetch weather data from Open-Meteo API
async function fetchWeatherData(locationKey) {
    const location = LOCATIONS[locationKey];
    const elements = getElementsForLocation(locationKey);

    if (!location || !elements) {
        console.error("Missing location data or elements for key:", locationKey);
        displayErrorOnCard(locationKey, "Configuration error for this location.");
        return;
    }
    
    clearErrorOnCard(locationKey); // Clear previous errors
    if(elements.temp) elements.temp.textContent = "Loading..."; // Show loading state

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
            throw new Error(`API Error: ${response.statusText} (${response.status})`);
        }

        const data = await response.json();

        if (!data || !data.current || !data.daily || !data.hourly) {
             throw new Error("Incomplete weather data from API.");
        }

        // Get current weather data
        const weather_code = data.current.weather_code;
        const weatherInfo = WEATHER_CODES[String(weather_code)] || { description: "Unknown", icon: "50d", animation: null };

        // Get temperature extremes for the day
        const maxTemp = data.daily.temperature_2m_max[0];
        const minTemp = data.daily.temperature_2m_min[0];

        // Update DOM elements with current weather data
        elements.temp.textContent = formatTemperature(data.current.temperature_2m);
        elements.feelsLike.textContent = `Feels like: ${formatTemperature(data.current.apparent_temperature)}`;
        elements.icon.innerHTML = `<img src="https://openweathermap.org/img/wn/${weatherInfo.icon}@2x.png" alt="${weatherInfo.description}" title="${weatherInfo.description}">`;

        addWeatherAnimation(elements.card, weatherInfo.animation);

        elements.humidity.textContent = `${data.current.relative_humidity_2m}%`;
        elements.wind.textContent = `${Math.round(data.current.wind_speed_10m)} mph ${getWindDirection(data.current.wind_direction_10m)}`;
        elements.uv.textContent = `UV: ${Math.round(data.current.uv_index)}`;
        elements.dewpoint.textContent = formatTemperature(data.current.dew_point_2m);

        updateDailyForecast(data.daily, elements.dailyForecast, location.timeZone);
        updateHourlyForecast(data.hourly, elements.hourlyForecast, location.timeZone);

        const tempClass = getTempClass(data.current.temperature_2m);
        elements.card.className = `card ${tempClass}`;
        elements.card.dataset.locationKey = locationKey;

        const historicalDiff = Math.round(data.current.temperature_2m - ((maxTemp + minTemp) / 2));
        const compareSymbol = historicalDiff > 0 ? '↑' : historicalDiff < 0 ? '↓' : '↔';
        elements.historical.textContent = `vs. Hist: ${compareSymbol} ${Math.abs(historicalDiff)}° ${historicalDiff === 0 ? '' : historicalDiff > 0 ? 'warmer' : 'cooler'}`;

        const now = new Date();
        const localTimeString = now.toLocaleTimeString('en-US', {
            timeZone: location.timeZone,
            hour: 'numeric',
            minute: '2-digit'
        });
        elements.lastUpdated.textContent = `Updated: ${localTimeString}`;

    } catch (error) {
        console.error(`Error updating weather data for ${location.name} (${locationKey}):`, error);
        displayErrorOnCard(locationKey, `Weather Error: ${error.message}`);
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
        let weatherInfo = { description: "Unknown", icon: "50d" };

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

            weatherInfo = WEATHER_CODES[String(weatherCode)] || { description: "Unknown", icon: "50d" };

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
                <img src="https://openweathermap.org/img/wn/${weatherInfo.icon}.png" alt="${weatherInfo.description}" title="${weatherInfo.description}">
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
        const weatherInfo = WEATHER_CODES[String(weatherCode)] || { description: "Unknown", icon: "50d" };

        // Create hourly forecast item
        const hourlyItem = document.createElement('div');
        hourlyItem.className = 'hourly-item';
        hourlyItem.innerHTML = `
            <div class="hourly-time">${formattedTime}</div>
            <div class="hourly-icon">
                <img src="https://openweathermap.org/img/wn/${weatherInfo.icon}.png" alt="${weatherInfo.description}" title="${weatherInfo.description}">
            </div>
            <div class="hourly-temp">${formatTemperature(temp)}</div>
        `;

        forecastElement.appendChild(hourlyItem);
    }
}

// Function to fetch weather data for a single location
async function updateWeatherForLocation(locationKey) {
    console.log(`Updating weather for ${LOCATIONS[locationKey]?.name || locationKey}`);
    await fetchWeatherData(locationKey);
}

// Function to refresh weather data for ALL locations
async function refreshAllWeatherData() {
    console.log("Refreshing weather for all locations...");
    for (const key in LOCATIONS) {
        await updateWeatherForLocation(key); // Ensure updates happen sequentially or handle promises if parallel
    }
}

// --- Location Editing Functions ---

// Geocode city name using Open-Meteo Geocoding API
async function geocodeCity(cityName) {
    if (!cityName || typeof cityName !== 'string' || cityName.trim().length === 0) {
        console.error("Invalid city name for geocoding.");
        return null;
    }
    try {
        const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName.trim())}&count=1&language=en&format=json`);
        if (!response.ok) throw new Error(`Geocoding API Error: ${response.statusText}`);
        const data = await response.json();
        if (data && data.results && data.results.length > 0) {
            const result = data.results[0];
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
            console.warn(`Geocoding for "${cityName}" found no results.`);
            return null; // City not found
        }
    } catch (error) {
        console.error(`Error geocoding "${cityName}":`, error);
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
             displayErrorOnCard(locationKey, "City name cannot be empty.");
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
        await updateWeatherForLocation(locationKey);

    } else {
        // Geocoding failed
        displayErrorOnCard(locationKey, `Could not find "${newCityName}". Try again.`);
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

async function loadWeatherCodes() {
    try {
        const response = await fetch('weatherCodes.json');
        if (!response.ok) throw new Error(`HTTP error ${response.status}`);
        WEATHER_CODES = await response.json();
        console.log("Weather codes loaded successfully.");
    } catch (error) {
        console.error("Fatal Error: Could not load weather codes. Weather information will be incomplete.", error);
        // Display a global error or on all cards if possible
        for (const key in LOCATIONS) {
            displayErrorOnCard(key, "Critical: Weather codes failed to load.");
        }
    }
}

async function initApp() {
    await loadWeatherCodes(); // Wait for codes to load

    const cardsContainer = document.querySelector('.cards-container');
    if (!cardsContainer) {
        console.error("Fatal: Could not find .cards-container element in the DOM.");
        return;
    }
    cardsContainer.innerHTML = ''; // Clear any static content

    for (const key in LOCATIONS) {
        const cardHTML = createLocationCardHTML(key, LOCATIONS[key]);
        cardsContainer.insertAdjacentHTML('beforeend', cardHTML);
    }

    updateTime();
    await refreshAllWeatherData(); 
    setInterval(updateTime, 1000);
    setInterval(refreshAllWeatherData, REFRESH_INTERVAL);

    document.querySelectorAll('.edit-location-btn').forEach(button => {
        const locationKey = button.dataset.locationKey;
        if (LOCATIONS[locationKey]) {
            const elements = getElementsForLocation(locationKey);
            if (elements && elements.nameDisplay) {
                elements.nameDisplay.textContent = LOCATIONS[locationKey].name;
            }
            button.addEventListener('click', handleEditClick);
        } else {
            console.warn(`Edit button found for non-existent location key: ${locationKey}`);
        }
    });
}

window.addEventListener('DOMContentLoaded', initApp);
window.addEventListener('DOMContentLoaded', initApp); // Use DOMContentLoaded