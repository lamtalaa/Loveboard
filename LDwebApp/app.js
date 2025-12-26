const OPEN_METEO_WEATHER_URL = "https://api.open-meteo.com/v1/forecast";
const OPEN_METEO_GEO_URL = "https://geocoding-api.open-meteo.com/v1/search";
const UNSPLASH_ACCESS_KEY = "MJINNu4GwhlXbpGNgEgAqoswqv2I3HBs5E-ZbS1REwU";
const UNSPLASH_URL = "https://api.unsplash.com/photos/random";
const QUOTE_URL = "https://api.allorigins.win/raw?url=https%3A%2F%2Fzenquotes.io%2Fapi%2Fquotes";
const DEFAULT_PHOTO_A = "assets/placeholder-a.svg";
const DEFAULT_PHOTO_B = "assets/placeholder-b.svg";
const STORAGE_KEY = "wwan-settings";

const defaults = {
  personA: {
    name: "Yassine",
    city: "New York City",
    country: "USA",
    countryCode: "US",
    timeZone: "America/New_York",
  },
  personB: {
    name: "Nihal",
    city: "Meknes",
    country: "Morocco",
    countryCode: "MA",
    timeZone: "Africa/Casablanca",
  },
};

const state = {
  settings: { ...defaults },
  offsets: { personA: null, personB: null },
  weather: { A: null, B: null },
};

const elements = {
  nameA: document.getElementById("name-a"),
  nameB: document.getElementById("name-b"),
  labelA: document.getElementById("label-a"),
  labelB: document.getElementById("label-b"),
  timeA: document.getElementById("time-a"),
  timeB: document.getElementById("time-b"),
  cityA: document.getElementById("city-a"),
  cityB: document.getElementById("city-b"),
  diffBadge: document.getElementById("diff-badge"),
  diffBadgeSecondary: document.getElementById("diff-badge-secondary"),
  tempA: document.getElementById("temp-a"),
  tempB: document.getElementById("temp-b"),
  descA: document.getElementById("desc-a"),
  descB: document.getElementById("desc-b"),
  iconA: document.getElementById("icon-a"),
  iconB: document.getElementById("icon-b"),
  doingA: document.getElementById("doing-text-a"),
  doingB: document.getElementById("doing-text-b"),
  doingTitleA: document.getElementById("doing-title-a"),
  doingTitleB: document.getElementById("doing-title-b"),
  modal: document.getElementById("settings-modal"),
  modalOverlay: document.getElementById("modal-overlay"),
  openSettings: document.getElementById("open-settings"),
  closeSettings: document.getElementById("close-settings"),
  form: document.getElementById("settings-form"),
  inputCityA: document.getElementById("input-city-a"),
  inputCityB: document.getElementById("input-city-b"),
  cardA: document.getElementById("person-a"),
  cardB: document.getElementById("person-b"),
  suggestionA: document.getElementById("suggestion-a"),
  suggestionB: document.getElementById("suggestion-b"),
  photoA: document.getElementById("photo-a"),
  photoB: document.getElementById("photo-b"),
  quoteText: document.getElementById("quote-text"),
  quoteAuthor: document.getElementById("quote-author"),
  newQuote: document.getElementById("new-quote"),
};

const countryNames = typeof Intl.DisplayNames === "function"
  ? new Intl.DisplayNames(["en"], { type: "region" })
  : null;

// Weather-driven theme palette and overlays.
const themeMap = {
  clear: {
    bgStart: "#ffe6c9",
    bgEnd: "#fff6e9",
    accent: "#f0b88e",
    overlay: "sun",
  },
  clouds: {
    bgStart: "#e7e8f2",
    bgEnd: "#f6f6fb",
    accent: "#b8bdd7",
    overlay: "cloud",
  },
  rain: {
    bgStart: "#dde7f0",
    bgEnd: "#f1f6fb",
    accent: "#8fb3cf",
    overlay: "rain",
  },
  snow: {
    bgStart: "#eef5ff",
    bgEnd: "#fbfdff",
    accent: "#a6c6e8",
    overlay: "snow",
  },
  thunder: {
    bgStart: "#d7d0e5",
    bgEnd: "#f2edf9",
    accent: "#9b8cc4",
    overlay: "thunder",
  },
  mist: {
    bgStart: "#efe9e6",
    bgEnd: "#f9f5f2",
    accent: "#c7b3ac",
    overlay: "mist",
  },
};

function getWeatherMeta(code, isDay) {
  const mapping = [
    { codes: [0], condition: "clear", description: "Clear sky", emoji: isDay ? "☀️" : "🌙" },
    { codes: [1], condition: "clouds", description: "Mostly clear", emoji: isDay ? "🌤️" : "🌙" },
    { codes: [2], condition: "clouds", description: "Partly cloudy", emoji: "⛅️" },
    { codes: [3], condition: "clouds", description: "Overcast", emoji: "☁️" },
    { codes: [45, 48], condition: "mist", description: "Foggy", emoji: "🌫️" },
    { codes: [51, 53, 55], condition: "rain", description: "Light drizzle", emoji: "🌦️" },
    { codes: [61, 63, 65], condition: "rain", description: "Rain", emoji: "🌧️" },
    { codes: [66, 67], condition: "rain", description: "Freezing rain", emoji: "🌧️" },
    { codes: [71, 73, 75, 77], condition: "snow", description: "Snowy", emoji: "❄️" },
    { codes: [80, 81, 82], condition: "rain", description: "Rain showers", emoji: "🌧️" },
    { codes: [85, 86], condition: "snow", description: "Snow showers", emoji: "🌨️" },
    { codes: [95, 96, 99], condition: "thunder", description: "Thunderstorms", emoji: "⛈️" },
  ];

  const match = mapping.find((item) => item.codes.includes(code));
  return match || { condition: "clear", description: "Clear sky", emoji: isDay ? "☀️" : "🌙" };
}

function normalizeCountry(code, fallback) {
  if (!code) {
    return fallback || "";
  }
  if (countryNames) {
    return countryNames.of(code) || fallback || code;
  }
  return fallback || code;
}

function applyGlobalTheme() {
  const base = state.weather.A || state.weather.B;
  if (!base) {
    return;
  }

  const theme = themeMap[base.condition] || themeMap.clear;
  const root = document.documentElement.style;
  root.setProperty("--bg-start", theme.bgStart);
  root.setProperty("--bg-end", theme.bgEnd);
  root.setProperty("--accent", theme.accent);

  document.body.className = "";
  document.body.classList.add(`weather-${theme.overlay}`);
  if (base.isNight) {
    document.body.classList.add("weather-night");
  }
}

function setCardTheme(id, condition, isNight) {
  const card = id === "A" ? elements.cardA : elements.cardB;
  if (!card) {
    return;
  }
  card.classList.remove(
    "theme-clear",
    "theme-clouds",
    "theme-rain",
    "theme-snow",
    "theme-thunder",
    "theme-mist",
    "theme-night"
  );
  card.classList.add(`theme-${condition}`);
  if (isNight) {
    card.classList.add("theme-night");
  }
}

function loadSettings() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    return { ...defaults };
  }
  try {
    const parsed = JSON.parse(saved);
    return {
      personA: { ...defaults.personA, ...parsed.personA },
      personB: { ...defaults.personB, ...parsed.personB },
    };
  } catch (error) {
    return { ...defaults };
  }
}

function saveSettings(nextSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSettings));
}

function formatTime(date, timeZone) {
  const safeZone = isValidTimeZone(timeZone) ? timeZone : "UTC";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: safeZone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getHourFromZone(timeZone) {
  const safeZone = isValidTimeZone(timeZone) ? timeZone : "UTC";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: safeZone,
    hour: "numeric",
    hour12: false,
  }).formatToParts(new Date());
  return Number(parts.find((part) => part.type === "hour").value);
}

function getOffsetMinutes(timeZone) {
  const safeZone = isValidTimeZone(timeZone) ? timeZone : "UTC";
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: safeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const getPart = (type) => parts.find((part) => part.type === type).value;
  const iso = `${getPart("year")}-${getPart("month")}-${getPart("day")}T${getPart("hour")}:${getPart("minute")}:${getPart("second")}Z`;
  const asUtc = new Date(iso);
  return (asUtc - now) / 60000;
}

function isValidTimeZone(timeZone) {
  if (!timeZone) {
    return false;
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format();
    return true;
  } catch (error) {
    return false;
  }
}

function localTimeFromOffset(offsetSeconds) {
  const now = new Date();
  return new Date(now.getTime() + offsetSeconds * 1000);
}

function formatDiff(diffHours) {
  if (diffHours === 0) {
    return "Same time zone";
  }
  const ahead = diffHours > 0;
  const hours = Math.abs(diffHours);
  const hourLabel = hours === 1 ? "hour" : "hours";
  return ahead
    ? `${state.settings.personB.name} is ${hours} ${hourLabel} ahead ⏰`
    : `${state.settings.personB.name} is ${hours} ${hourLabel} behind ⏰`;
}

function formatDiffInverse(diffHours) {
  if (diffHours === 0) {
    return "Same time zone";
  }
  const ahead = diffHours > 0;
  const hours = Math.abs(diffHours);
  const hourLabel = hours === 1 ? "hour" : "hours";
  return ahead
    ? `${state.settings.personA.name} is ${hours} ${hourLabel} behind ⏰`
    : `${state.settings.personA.name} is ${hours} ${hourLabel} ahead ⏰`;
}

function predictionForHour(hour) {
  if (hour >= 6 && hour < 9) {
    return "Probably waking up and thinking of you 🌅";
  }
  if (hour >= 9 && hour < 17) {
    return "Probably busy during the day, with you on the mind 💼";
  }
  if (hour >= 18 && hour < 22) {
    return "Relaxing or talking with you 🌙";
  }
  return "Late-night mode 😴";
}

function updateTimes() {
  const { personA, personB } = state.settings;
  const now = new Date();

  const offsetA = state.offsets.personA;
  const offsetB = state.offsets.personB;

  const timeA = offsetA !== null ? localTimeFromOffset(offsetA) : now;
  const timeB = offsetB !== null ? localTimeFromOffset(offsetB) : now;

  elements.timeA.textContent = offsetA !== null ? formatTime(timeA, "UTC") : formatTime(now, personA.timeZone);
  elements.timeB.textContent = offsetB !== null ? formatTime(timeB, "UTC") : formatTime(now, personB.timeZone);

  const hourA = offsetA !== null ? timeA.getUTCHours() : getHourFromZone(personA.timeZone);
  const hourB = offsetB !== null ? timeB.getUTCHours() : getHourFromZone(personB.timeZone);

  elements.doingA.textContent = predictionForHour(hourA);
  elements.doingB.textContent = predictionForHour(hourB);

  const diffMinutes = offsetA !== null && offsetB !== null
    ? (offsetB - offsetA) / 60
    : getOffsetMinutes(personB.timeZone) - getOffsetMinutes(personA.timeZone);

  const diffHours = Math.round(diffMinutes / 60);
  elements.diffBadge.textContent = formatDiff(diffHours);
  elements.diffBadgeSecondary.textContent = formatDiffInverse(diffHours);
}

function updateLabels() {
  elements.nameA.textContent = state.settings.personA.name;
  elements.nameB.textContent = state.settings.personB.name;
  elements.labelA.textContent = `${state.settings.personA.name}'s Time`;
  elements.labelB.textContent = `${state.settings.personB.name}'s Time`;
  elements.cityA.textContent = `${state.settings.personA.city}, ${state.settings.personA.country}`;
  elements.cityB.textContent = `${state.settings.personB.city}, ${state.settings.personB.country}`;
  elements.doingTitleA.textContent = `What ${state.settings.personA.name}'s Probably Doing`;
  elements.doingTitleB.textContent = `What ${state.settings.personB.name}'s Probably Doing`;
}

function setWeatherLoading(id) {
  if (id === "A") {
    elements.descA.textContent = "Loading weather...";
  } else {
    elements.descB.textContent = "Loading weather...";
  }
}

function setWeatherError(id, message) {
  if (id === "A") {
    elements.descA.textContent = message;
    elements.tempA.textContent = "--";
    elements.iconA.textContent = "—";
    elements.suggestionA.textContent = "";
    setDefaultPhoto("A");
  } else {
    elements.descB.textContent = message;
    elements.tempB.textContent = "--";
    elements.iconB.textContent = "—";
    elements.suggestionB.textContent = "";
    setDefaultPhoto("B");
  }
}

function setWeatherSuccess(id, data) {
  const weather = data.current_weather;
  if (!weather) {
    setWeatherError(id, "Weather unavailable right now");
    return;
  }
  const temp = Math.round(weather.temperature);
  const isNight = weather.is_day === 0;
  const meta = getWeatherMeta(weather.weathercode, !isNight);

  if (id === "A") {
    elements.tempA.textContent = `${temp}°C`;
    elements.descA.textContent = meta.description;
    elements.iconA.textContent = meta.emoji;
  } else {
    elements.tempB.textContent = `${temp}°C`;
    elements.descB.textContent = meta.description;
    elements.iconB.textContent = meta.emoji;
  }

  state.weather[id] = { condition: meta.condition, isNight };
  setCardTheme(id, meta.condition, isNight);
  applyGlobalTheme();
}

async function fetchWeather(id, city, countryCode) {
  if (!city) {
    setWeatherError(id, "City not found. Try a nearby town.");
    return;
  }

  setWeatherLoading(id);

  try {
    const resolved = await resolveCity(city, countryCode);
    if (!resolved) {
      setWeatherError(id, "City not found. Try a nearby town.");
      return;
    }
    const data = await requestWeather(resolved);
    handleWeatherSuccess(id, data, city, resolved);
  } catch (error) {
    setWeatherError(id, "Weather unavailable right now");
  }
}

async function requestWeather(resolved) {
  const url = `${OPEN_METEO_WEATHER_URL}?latitude=${resolved.latitude}&longitude=${resolved.longitude}&current_weather=true&timezone=auto`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Weather unavailable");
  }
  return response.json();
}

async function resolveCity(city, countryCode) {
  const countryParam = countryCode ? `&country=${encodeURIComponent(countryCode)}` : "";
  const url = `${OPEN_METEO_GEO_URL}?name=${encodeURIComponent(city)}&count=1&language=en&format=json${countryParam}`;
  const response = await fetch(url);
  if (!response.ok) {
    return null;
  }
  const data = await response.json();
  return data.results ? data.results[0] : null;
}

function normalizeQuery(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function handleWeatherSuccess(id, data, originalQuery, resolved) {
  setWeatherSuccess(id, data);

  if (typeof data.utc_offset_seconds === "number") {
    if (id === "A") {
      state.offsets.personA = data.utc_offset_seconds;
    } else {
      state.offsets.personB = data.utc_offset_seconds;
    }
    updateTimes();
  }

  const countryCode = resolved?.country_code ? String(resolved.country_code).toUpperCase() : "";
  const country = normalizeCountry(
    countryCode,
    resolved?.country || (id === "A" ? state.settings.personA.country : state.settings.personB.country)
  );
  const cityName = resolved?.name;
  const timeZone = resolved?.timezone;

  if (id === "A") {
    state.settings.personA.city = cityName || state.settings.personA.city;
    state.settings.personA.country = country;
    if (countryCode) {
      state.settings.personA.countryCode = countryCode;
    }
    if (isValidTimeZone(timeZone)) {
      state.settings.personA.timeZone = timeZone;
    }
  } else {
    state.settings.personB.city = cityName || state.settings.personB.city;
    state.settings.personB.country = country;
    if (countryCode) {
      state.settings.personB.countryCode = countryCode;
    }
    if (isValidTimeZone(timeZone)) {
      state.settings.personB.timeZone = timeZone;
    }
  }
  saveSettings(state.settings);
  updateLabels();
  fetchCityPhoto(id, cityName, country);

  const normalizedQuery = normalizeQuery(originalQuery);
  const normalizedCity = normalizeQuery(cityName);
  const showSuggestion = normalizedQuery && normalizedCity && normalizedQuery !== normalizedCity;
  const message = showSuggestion ? `Showing weather for ${cityName}, ${country}.` : "";
  if (id === "A") {
    elements.suggestionA.textContent = message;
  } else {
    elements.suggestionB.textContent = message;
  }
}

function setPhoto(id, url, alt) {
  const target = id === "A" ? elements.photoA : elements.photoB;
  if (!target) {
    return;
  }
  target.classList.remove("is-loaded");
  const fallback = id === "A" ? DEFAULT_PHOTO_A : DEFAULT_PHOTO_B;
  const finalUrl = url || fallback;
  target.src = finalUrl;
  target.alt = alt || "";
  target.onload = () => target.classList.add("is-loaded");
}

function setDefaultPhoto(id) {
  const fallback = id === "A" ? DEFAULT_PHOTO_A : DEFAULT_PHOTO_B;
  setPhoto(id, fallback, "");
}

async function fetchCityPhoto(id, city, country) {
  if (!UNSPLASH_ACCESS_KEY || UNSPLASH_ACCESS_KEY === "YOUR_UNSPLASH_ACCESS_KEY") {
    setDefaultPhoto(id);
    return;
  }
  if (!city) {
    setDefaultPhoto(id);
    return;
  }
  const query = encodeURIComponent(`${city} ${country || ""}`.trim());
  const url = `${UNSPLASH_URL}?query=${query}&orientation=landscape&client_id=${UNSPLASH_ACCESS_KEY}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      setDefaultPhoto(id);
      return;
    }
    const data = await response.json();
    setPhoto(id, data.urls?.regular, data.alt_description || `${city} photo`);
  } catch (error) {
    setDefaultPhoto(id);
  }
}

const fallbackQuotes = [
  { content: "Love is the small things, done with a big heart.", author: "Unknown" },
  { content: "Where you are is where I want to be.", author: "Unknown" },
  { content: "Distance means so little when someone means so much.", author: "Tom McNeal" },
];

async function fetchQuote() {
  try {
    const response = await fetch(QUOTE_URL);
    if (!response.ok) {
      throw new Error("Quote unavailable");
    }
    const data = await response.json();
    const quote = Array.isArray(data) ? data[0] : data;
    elements.quoteText.textContent = quote.q || quote.content || "";
    elements.quoteAuthor.textContent = quote.a || quote.author ? `— ${quote.a || quote.author}` : "";
  } catch (error) {
    const pick = fallbackQuotes[Math.floor(Math.random() * fallbackQuotes.length)];
    elements.quoteText.textContent = pick.content;
    elements.quoteAuthor.textContent = pick.author ? `— ${pick.author}` : "";
  }
}

function openModal() {
  elements.modal.classList.add("is-open");
  elements.modal.setAttribute("aria-hidden", "false");
}

function closeModal() {
  elements.modal.classList.remove("is-open");
  elements.modal.setAttribute("aria-hidden", "true");
}

function hydrateForm() {
  elements.inputCityA.value = state.settings.personA.city;
  elements.inputCityB.value = state.settings.personB.city;
}

function handleSubmit(event) {
  event.preventDefault();
  state.settings.personA.city = elements.inputCityA.value.trim() || defaults.personA.city;
  state.settings.personB.city = elements.inputCityB.value.trim() || defaults.personB.city;

  saveSettings(state.settings);
  updateLabels();
  fetchWeather("A", state.settings.personA.city, state.settings.personA.countryCode);
  fetchWeather("B", state.settings.personB.city, state.settings.personB.countryCode);
  closeModal();
}

function init() {
  state.settings = loadSettings();
  updateLabels();
  updateTimes();
  fetchWeather("A", state.settings.personA.city, state.settings.personA.countryCode);
  fetchWeather("B", state.settings.personB.city, state.settings.personB.countryCode);
  fetchQuote();

  hydrateForm();

  elements.openSettings.addEventListener("click", () => {
    hydrateForm();
    openModal();
  });
  elements.closeSettings.addEventListener("click", closeModal);
  elements.modalOverlay.addEventListener("click", closeModal);
  elements.form.addEventListener("submit", handleSubmit);
  elements.newQuote.addEventListener("click", fetchQuote);

  setInterval(updateTimes, 60000);
}

init();
