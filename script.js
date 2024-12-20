// script.js

// ======== API KEYS ========
// Replace the placeholders with your actual API keys.
const WEATHER_API_KEY = "33dfd53a9d3d81f2922261c29bc94c06";
const FINNHUB_API_KEY = "ctcpibpr01qlc0uvah90ctcpibpr01qlc0uvah9g";

// ======== Theme Initialization ========
const savedTheme = localStorage.getItem("dashboardTheme");
if (savedTheme === "dark") {
  document.body.classList.add("dark-mode");
}

// ======== Initial Tiles Configuration ========
let tilesConfig = {
  tiles: [
    {
      id: "weather-1",
      type: "weather",
      visible: true,
      config: {
        city: "Morgantown",
        countryCode: "US",
        unit: "imperial",
        updateInterval: 30
      }
    },
    {
      id: "stock-1",
      type: "stock",
      visible: true,
      config: {
        symbol: "QUBT",
        updateInterval: 1
      }
    }
  ]
};

// ======== Load Saved Configuration ========
const savedConfig = localStorage.getItem("dashboardConfig");
if (savedConfig) {
  tilesConfig = JSON.parse(savedConfig);
}

// ======== State Variables ========
let moveMode = false; 
let currentlyOpenMenu = null; 
let currentConfigTile = null;
const tileTimers = {};

// ======== DOM Elements ========
const dashboard = document.getElementById("dashboard");
const addTileOverlay = document.getElementById("add-tile-overlay");
const closeAddTileBtn = document.getElementById("close-add-tile");
const addTileButton = document.getElementById("add-tile-button");
const configOverlay = document.getElementById("config-overlay");
const closeConfigModalBtn = document.getElementById("close-config-modal");
const configForm = document.getElementById("config-form");
const saveConfigBtn = document.getElementById("save-config");
const themeToggleBtn = document.getElementById("theme-toggle");
const contextMenu = document.getElementById("context-menu");

// ======== Event Listeners ========

// Prevent Duplicate Event Listeners
// Ensure the script runs only once by checking a flag
if (!window.dashboardInitialized) {
  window.dashboardInitialized = true;

  // Theme Toggle
  themeToggleBtn.addEventListener("click", () => {
    document.body.classList.toggle("dark-mode");
    localStorage.setItem("dashboardTheme", document.body.classList.contains("dark-mode") ? "dark" : "light");
  });

  // Open Add Tile Modal
  addTileButton.addEventListener("click", () => {
    addTileOverlay.style.display = "flex";
  });

  // Close Add Tile Modal
  closeAddTileBtn.addEventListener("click", () => {
    addTileOverlay.style.display = "none";
  });

  // Add Tile from List
  document.querySelectorAll(".add-tile-list li").forEach(li => {
    li.addEventListener("click", () => {
      const type = li.getAttribute("data-tile-type");
      addNewTile(type);
      addTileOverlay.style.display = "none";
    });
  });

  // Close Configure Modal
  closeConfigModalBtn.addEventListener("click", () => {
    configOverlay.style.display = "none";
    currentConfigTile = null;
  });

  // Save Configuration
  saveConfigBtn.addEventListener("click", () => {
    if (!currentConfigTile) return;
    const formData = new FormData(configForm);
    
    for (let [key, value] of formData.entries()) {
      if (currentConfigTile.type === "rss" && key === "limit") {
        value = parseInt(value, 10);
      }
      if (currentConfigTile.type === "stock" && key === "updateInterval") {
        value = parseInt(value, 10);
      }
      if (currentConfigTile.type === "weather" && key === "updateInterval") {
        value = parseInt(value, 10);
      }
      currentConfigTile.config[key] = value;
    }

    saveConfig();
    configOverlay.style.display = "none";
    currentConfigTile = null;
    renderTiles();
  });

  // Initialize the dashboard
  renderTiles();
}

// ======== Fetch Functions ========

async function fetchWeather(tile) {
  const { city, countryCode, unit } = tile.config;
  const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)},${encodeURIComponent(countryCode)}&units=${unit}&appid=${WEATHER_API_KEY}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error("Weather request failed:", response.status, response.statusText);
      return null;
    }
    return await response.json();
  } catch (err) {
    console.error("Weather fetch error:", err);
    return null;
  }
}

async function fetchStock(tile) {
  const { symbol } = tile.config;
  const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${FINNHUB_API_KEY}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error("Stock request failed:", response.status, response.statusText);
      return null;
    }
    return await response.json();
  } catch (err) {
    console.error("Stock fetch error:", err);
    return null;
  }
}

async function fetchRSS(tile) {
  const { url, limit } = tile.config;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error("RSS request failed:", response.status, response.statusText);
      return null;
    }
    const data = await response.json();
    if (!data || !data.items) return null;
    return data.items.slice(0, limit);
  } catch (err) {
    console.error("RSS fetch error:", err);
    return null;
  }
}

async function fetchQuote(tile) {
  const url = "https://api.quotable.io/random";
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error("Quote request failed:", response.status, response.statusText);
      return null;
    }
    return await response.json();
  } catch (err) {
    console.error("Quote fetch error:", err);
    return null;
  }
}

async function fetchCrypto(tile) {
  const { coinId, currency } = tile.config;
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(coinId)}&vs_currencies=${encodeURIComponent(currency)}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error("Crypto request failed:", response.status, response.statusText);
      return null;
    }
    return await response.json();
  } catch (err) {
    console.error("Crypto fetch error:", err);
    return null;
  }
}

function updateClock(tile, el) {
  const now = new Date();
  let hours = now.getHours();
  let minutes = now.getMinutes().toString().padStart(2, '0');
  let seconds = now.getSeconds().toString().padStart(2, '0');

  if (tile.config.format === "12h") {
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    el.textContent = `${hours}:${minutes}:${seconds} ${ampm}`;
  } else {
    el.textContent = `${hours.toString().padStart(2, '0')}:${minutes}:${seconds}`;
  }
}

// ======== Grid Setup ========

function setGridSize() {
  const visibleTiles = tilesConfig.tiles.filter(t => t.visible);
  const N = visibleTiles.length;
  let s;
  if (N === 0) {
    s = 1;
  } else if (N <= 4) {
    s = 2;
  } else if (N <= 9) {
    s = 3;
  } else {
    s = 4;
  }

  // Set grid columns and rows based on the number of tiles
  dashboard.style.gridTemplateColumns = `repeat(${s}, 1fr)`;
  dashboard.style.gridTemplateRows = `repeat(${s}, 1fr)`;
}

window.addEventListener('resize', () => {
  setGridSize();
});

// ======== Rendering Functions ========

function renderTiles() {
  const tilesToRender = tilesConfig.tiles.filter(t => t.visible).slice(0,16);
  console.log("Rendering tiles:", tilesToRender.map(t => t.id));
  setGridSize();
  dashboard.innerHTML = '';

  // Clear existing timers
  for (let id in tileTimers) {
    clearTimeout(tileTimers[id]);
    delete tileTimers[id];
  }

  tilesToRender.forEach(tile => renderTile(tile));
}

async function renderTile(tile) {
  console.log("Rendering tile:", tile.id);
  let tileEl = document.querySelector(`[data-tile-id="${tile.id}"]`);
  if (!tileEl) {
    tileEl = document.createElement("div");
    tileEl.className = "tile";
    tileEl.setAttribute("data-tile-id", tile.id);
    tileEl.setAttribute("draggable", moveMode.toString());
    if (moveMode) tileEl.classList.add("move-mode");
    dashboard.appendChild(tileEl);
  } else {
    tileEl.innerHTML = '';
    tileEl.classList.toggle("move-mode", moveMode);
  }

  // Tile Content
  try {
    let data;
    if (tile.type === "weather") {
      data = await fetchWeather(tile);
      if (!data || !data.weather || !data.sys) throw new Error("Incomplete weather data");
      const unitSymbol = (tile.config.unit === "metric") ? "°C" : "°F";
      tileEl.innerHTML += `
        <i class="fas fa-cloud-sun icon"></i>
        <h2>Weather</h2>
        <p><strong>${data.name}, ${data.sys.country}</strong></p>
        <p>${Math.round(data.main.temp)} ${unitSymbol}, ${data.weather[0].description}</p>
        <div class="updated">Updated: ${new Date().toLocaleTimeString()}</div>
      `;
    } else if (tile.type === "stock") {
      data = await fetchStock(tile);
      if (!data || typeof data.c === 'undefined') throw new Error("Incomplete stock data");
      tileEl.innerHTML += `
        <i class="fas fa-chart-line icon"></i>
        <h2>Stock: ${tile.config.symbol}</h2>
        <p>Price: $${data.c.toFixed(2)}</p>
        <div class="updated">Updated: ${new Date().toLocaleTimeString()}</div>
      `;
    } else if (tile.type === "rss") {
      const rssData = await fetchRSS(tile);
      if (!rssData || !Array.isArray(rssData) || rssData.length === 0) throw new Error("No RSS articles returned");
      tileEl.innerHTML += `
        <i class="fas fa-rss icon"></i>
        <h2>News</h2>
      `;
      rssData.forEach(a => {
        tileEl.innerHTML += `<p><a href="${a.link}" target="_blank">${a.title}</a></p>`;
      });
      tileEl.innerHTML += `<div class="updated">Updated: ${new Date().toLocaleTimeString()}</div>`;
    } else if (tile.type === "quote") {
      data = await fetchQuote(tile);
      if (!data || !data.content || !data.author) throw new Error("Incomplete quote data");
      tileEl.innerHTML += `
        <i class="fas fa-quote-right icon"></i>
        <h2>Quote</h2>
        <p>"${data.content}"<br>- ${data.author}</p>
        <div class="updated">Updated: ${new Date().toLocaleTimeString()}</div>
      `;
    } else if (tile.type === "crypto") {
      data = await fetchCrypto(tile);
      const price = data?.[tile.config.coinId]?.[tile.config.currency];
      if (typeof price === 'undefined') throw new Error("Incomplete crypto data");
      tileEl.innerHTML += `
        <i class="fas fa-bitcoin icon"></i>
        <h2>${capitalizeFirstLetter(tile.config.coinId)} Price</h2>
        <p>${price} ${tile.config.currency.toUpperCase()}</p>
        <div class="updated">Updated: ${new Date().toLocaleTimeString()}</div>
      `;
    } else if (tile.type === "notes") {
      tileEl.innerHTML += `
        <i class="fas fa-sticky-note icon"></i>
        <h2>Notes</h2>
        <p>${tile.config.text.replace(/\n/g, "<br>")}</p>
      `;
    } else if (tile.type === "clock") {
      tileEl.innerHTML += `
        <i class="fas fa-clock icon"></i>
        <h2>Clock</h2>
        <p id="clock-${tile.id}"></p>
      `;
      const clockEl = tileEl.querySelector(`#clock-${tile.id}`);
      updateClock(tile, clockEl);
      if (!tileTimers[tile.id]) {
        tileTimers[tile.id] = setInterval(() => updateClock(tile, clockEl), 1000);
      }
    } else {
      throw new Error("Unknown tile type");
    }
  } catch (err) {
    console.error("Error rendering tile:", tile.type, tile.id, err);
    tileEl.innerHTML += `<p>Error loading data</p>`;
  }

  // Attach Context Menu Handlers
  attachContextMenuHandlers(tileEl, tile);

  // Interval Re-rendering
  if (tile.type !== "clock" && tile.config.updateInterval && Number(tile.config.updateInterval) > 0) {
    if (tileTimers[tile.id]) {
      clearTimeout(tileTimers[tile.id]);
    }
    tileTimers[tile.id] = setTimeout(() => {
      const stillVisible = tilesConfig.tiles.some(t => t.id === tile.id && t.visible);
      console.log(`Interval re-check for ${tile.id}. Still visible?`, stillVisible);
      if (stillVisible) {
        console.log(`Re-rendering from interval due to ${tile.id}`);
        renderTiles();
      } else {
        console.log(`Tile ${tile.id} no longer visible, skipping interval re-render.`);
      }
    }, tile.config.updateInterval * 60 * 1000);
  }
}

function attachContextMenuHandlers(tileEl, tile) {
  // Prevent default context menu on tiles
  tileEl.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    openContextMenu(e, tile);
  });

  // Handle tap-and-hold for mobile devices
  let touchTimer;
  tileEl.addEventListener("touchstart", (e) => {
    touchTimer = setTimeout(() => {
      const touch = e.touches[0];
      openContextMenu(touch, tile);
    }, 600); // Duration to detect tap-and-hold (in ms)
  });

  tileEl.addEventListener("touchend", () => {
    clearTimeout(touchTimer);
  });

  tileEl.addEventListener("touchmove", () => {
    clearTimeout(touchTimer);
  });
}

function openContextMenu(e, tile) {
  // Close any existing open menu
  closeAnyOpenMenu();

  // Set the current tile
  currentConfigTile = tile;

  // Position the context menu
  contextMenu.style.top = `${e.clientY}px`;
  contextMenu.style.left = `${e.clientX}px`;
  contextMenu.style.display = "block";

  // Adjust position if the menu goes beyond the viewport
  const menuRect = contextMenu.getBoundingClientRect();
  if (menuRect.bottom > window.innerHeight) {
    contextMenu.style.top = `${window.innerHeight - menuRect.height - 10}px`;
  }
  if (menuRect.right > window.innerWidth) {
    contextMenu.style.left = `${window.innerWidth - menuRect.width - 10}px`;
  }

  currentlyOpenMenu = contextMenu;

  // Add event listeners for menu options
  const configureOption = contextMenu.querySelector(".configure-tile");
  const moveOption = contextMenu.querySelector(".move-tile");
  const removeOption = contextMenu.querySelector(".remove-tile");

  configureOption.onclick = () => {
    closeContextMenu();
    openConfigModal(tile);
  };

  moveOption.onclick = () => {
    closeContextMenu();
    toggleMoveMode();
  };

  removeOption.onclick = () => {
    closeContextMenu();
    removeTile(tile.id);
  };
}

function closeContextMenu() {
  if (currentlyOpenMenu) {
    currentlyOpenMenu.style.display = "none";
    currentlyOpenMenu = null;
  }
}

function closeAnyOpenMenu() {
  if (currentlyOpenMenu) {
    currentlyOpenMenu.style.display = "none";
    currentlyOpenMenu = null;
  }
}

// Close context menu when clicking outside
document.addEventListener("click", (e) => {
  if (currentlyOpenMenu && !currentlyOpenMenu.contains(e.target)) {
    closeContextMenu();
  }
});

// Remove Tile Function
function removeTile(id) {
  if (tileTimers[id]) {
    clearTimeout(tileTimers[id]);
    delete tileTimers[id];
  }
  tilesConfig.tiles = tilesConfig.tiles.filter(t => t.id !== id);
  saveConfig();
  renderTiles();
}

// Reorder Tiles Function (Drag and Drop)
function reorderTiles(draggedTileId, targetTileId) {
  const draggedIndex = tilesConfig.tiles.findIndex(t => t.id === draggedTileId);
  const targetIndex = tilesConfig.tiles.findIndex(t => t.id === targetTileId);

  if (draggedIndex < 0 || targetIndex < 0 || draggedIndex === targetIndex) return;

  const draggedTile = tilesConfig.tiles.splice(draggedIndex, 1)[0];
  tilesConfig.tiles.splice(targetIndex, 0, draggedTile);

  saveConfig();
  renderTiles();
}

// Toggle Move Mode
function toggleMoveMode() {
  moveMode = !moveMode;
  console.log("Move mode:", moveMode);
  renderTiles();
}

// Add New Tile Function
function addNewTile(type) {
  // Generate a unique ID using timestamp and a random component
  const id = `${type}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  if (tilesConfig.tiles.some(t => t.id === id)) {
    console.warn("A tile with this id already exists, skipping:", id);
    return;
  }

  const config = getDefaultConfigForTileType(type);
  tilesConfig.tiles.push({
    id: id,
    type: type,
    visible: true,
    config: config
  });
  console.log("Added new tile:", id, "of type:", type);
  console.log("tilesConfig now:", tilesConfig.tiles.map(t => t.id));
  saveConfig();
  renderTiles();
}

// Get Default Configuration for Tile Type
function getDefaultConfigForTileType(type) {
  if (type === "weather") return { city: "Morgantown", countryCode: "US", unit: "imperial", updateInterval: 30 };
  if (type === "stock") return { symbol: "QUBT", updateInterval: 1 };
  if (type === "rss") return { url: "https://api.rss2json.com/v1/api.json?rss_url=https://news.google.com/rss", limit: 5 };
  if (type === "quote") return {};
  if (type === "crypto") return { coinId: "bitcoin", currency: "usd" };
  if (type === "notes") return { text: "Enter your notes here..." };
  if (type === "clock") return { format: "12h" };
  return {};
}

// Open Configuration Modal
function openConfigModal(tile) {
  currentConfigTile = tile;
  configForm.innerHTML = '';

  if (tile.type === "weather") {
    configForm.innerHTML = `
      <label>City:</label>
      <input type="text" name="city" value="${tile.config.city}">
      <label>Country Code:</label>
      <input type="text" name="countryCode" value="${tile.config.countryCode}">
      <label>Unit:</label>
      <select name="unit">
        <option value="metric" ${tile.config.unit === "metric" ? "selected" : ""}>Celsius</option>
        <option value="imperial" ${tile.config.unit === "imperial" ? "selected" : ""}>Fahrenheit</option>
      </select>
      <label>Update Interval (minutes):</label>
      <input type="number" name="updateInterval" value="${tile.config.updateInterval || 5}">
    `;
  } else if (tile.type === "stock") {
    configForm.innerHTML = `
      <label>Symbol:</label>
      <input type="text" name="symbol" value="${tile.config.symbol}">
      <label>Update Interval (minutes):</label>
      <input type="number" name="updateInterval" value="${tile.config.updateInterval || 5}">
    `;
  } else if (tile.type === "rss") {
    configForm.innerHTML = `
      <label>RSS URL (JSON):</label>
      <input type="text" name="url" value="${tile.config.url}">
      <label>Limit:</label>
      <input type="number" name="limit" value="${tile.config.limit}">
    `;
  } else if (tile.type === "quote") {
    configForm.innerHTML = `<p>No additional configuration needed.</p>`;
  } else if (tile.type === "crypto") {
    configForm.innerHTML = `
      <label>Coin ID:</label>
      <input type="text" name="coinId" value="${tile.config.coinId}">
      <label>Currency:</label>
      <input type="text" name="currency" value="${tile.config.currency}">
    `;
  } else if (tile.type === "notes") {
    configForm.innerHTML = `
      <label>Notes:</label>
      <textarea name="text" rows="5">${tile.config.text}</textarea>
    `;
  } else if (tile.type === "clock") {
    configForm.innerHTML = `
      <label>Format:</label>
      <select name="format">
        <option value="24h" ${tile.config.format === "24h" ? 'selected' : ''}>24-hour</option>
        <option value="12h" ${tile.config.format === "12h" ? 'selected' : ''}>12-hour</option>
      </select>
    `;
  }

  configOverlay.style.display = "flex";
}

// Save Configuration to Local Storage
function saveConfig() {
  localStorage.setItem("dashboardConfig", JSON.stringify(tilesConfig));
}

// ======== Drag and Drop Functionality ========

let draggedTileElement = null;
let dragStartX = 0;
let dragStartY = 0;
let ghostEl = null;

function onPointerDown(e) {
  if (!e.target.closest('.tile') || moveMode === false) return;
  const tileEl = e.target.closest('.tile');
  draggedTileElement = tileEl;
  const rect = tileEl.getBoundingClientRect();
  dragStartX = e.clientX - rect.left;
  dragStartY = e.clientY - rect.top;
  tileEl.setPointerCapture(e.pointerId);
}

function onPointerMove(e) {
  if (!draggedTileElement) return;
  if (!ghostEl) {
    ghostEl = draggedTileElement.cloneNode(true);
    ghostEl.classList.add('drag-ghost');
    document.body.appendChild(ghostEl);
  }
  ghostEl.style.left = (e.clientX - dragStartX) + 'px';
  ghostEl.style.top = (e.clientY - dragStartY) + 'px';
}

function onPointerUp(e) {
  if (!draggedTileElement) return;
  draggedTileElement.releasePointerCapture(e.pointerId);
  if (ghostEl) {
    const dropTile = document.elementFromPoint(e.clientX, e.clientY)?.closest('.tile');
    if (dropTile && dropTile !== draggedTileElement) {
      const tileId = draggedTileElement.getAttribute('data-tile-id');
      const targetTileId = dropTile.getAttribute('data-tile-id');
      reorderTiles(tileId, targetTileId);
    }
    document.body.removeChild(ghostEl);
    ghostEl = null;
  }
  draggedTileElement = null;
}

dashboard.addEventListener('pointerdown', onPointerDown);
dashboard.addEventListener('pointermove', onPointerMove);
dashboard.addEventListener('pointerup', onPointerUp);
dashboard.addEventListener('pointercancel', onPointerUp);

// ======== Utility Function ========

// Capitalize First Letter of a String
function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}
