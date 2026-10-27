/**
 * Leaflet Map Controller Module
 * Smart Waste Collection Tracking System (India)
 */

const MapModule = {
  map: null,
  geoJsonLayer: null,
  binsLayer: null,
  trucksLayer: null,
  routesLayer: null,
  gpsPathsLayer: null,
  statesData: null,

  // State metrics cache: stateName -> { totalBins, needingPickup, trucks }
  stateStats: {},

  // Active picking callback (for "Pick on map" button)
  activePickerCallback: null,
  tempPickerMarker: null,

  // Initialize Map
  init() {
    // Exact India Bounds
    const indiaBounds = [
      [6.0, 68.0],
      [37.5, 97.5]
    ];
    const maxBounds = [
      [4.0, 65.0],
      [40.0, 100.0]
    ];

    this.map = L.map('map', {
      center: [22.5, 82.5],
      zoom: 5,
      minZoom: 4,
      maxZoom: 18,
      maxBounds: maxBounds,
      maxBoundsViscosity: 0.95
    });

    this.map.fitBounds(indiaBounds);

    // OpenStreetMap Base Tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    }).addTo(this.map);

    // Layer Groups
    this.binsLayer = L.layerGroup().addTo(this.map);
    this.trucksLayer = L.layerGroup().addTo(this.map);
    this.routesLayer = L.layerGroup().addTo(this.map);
    this.gpsPathsLayer = L.layerGroup().addTo(this.map);

    // Setup map click listener (for map picker or generic clicks)
    this.map.on('click', (e) => {
      if (this.activePickerCallback) {
        const { lat, lng } = e.latlng;
        // Validate India bounds
        if (lat < 6.0 || lat > 37.5 || lng < 68.0 || lng > 97.5) {
          API.toast('Please click inside India boundaries (6°N-37.5°N, 68°E-97.5°E).', 'error');
          return;
        }

        if (this.tempPickerMarker) {
          this.map.removeLayer(this.tempPickerMarker);
        }

        this.tempPickerMarker = L.circleMarker([lat, lng], {
          radius: 9,
          color: '#ef4444',
          fillColor: '#ef4444',
          fillOpacity: 0.9
        }).addTo(this.map);

        this.activePickerCallback(lat.toFixed(5), lng.toFixed(5));
        this.clearPicker();
        API.toast(`Coordinates selected: ${lat.toFixed(4)}, ${lng.toFixed(4)}`, 'info');
      }
    });

    // Load GeoJSON locally
    this.loadStateBoundaries();
  },

  // Start "Pick on map" mode
  startPicker(callback) {
    this.activePickerCallback = callback;
    const banner = document.getElementById('map-picker-banner');
    if (banner) banner.style.display = 'flex';
    document.getElementById('map').style.cursor = 'crosshair';
  },

  clearPicker() {
    this.activePickerCallback = null;
    const banner = document.getElementById('map-picker-banner');
    if (banner) banner.style.display = 'none';
    document.getElementById('map').style.cursor = '';
    if (this.tempPickerMarker) {
      setTimeout(() => {
        if (this.tempPickerMarker && this.map.hasLayer(this.tempPickerMarker)) {
          this.map.removeLayer(this.tempPickerMarker);
          this.tempPickerMarker = null;
        }
      }, 4000);
    }
  },

  // Load and Render India States GeoJSON
  async loadStateBoundaries() {
    try {
      const res = await fetch('/data/india-states.geojson');
      if (!res.ok) throw new Error('Could not load india-states.geojson');
      this.statesData = await res.json();

      this.renderStateLayer();
      this.populateStateDropdowns();
    } catch (err) {
      console.error('Error loading India GeoJSON:', err);
      API.toast('Failed to load local India state boundaries.', 'error');
    }
  },

  // Render or re-render state boundaries colored by bins needing pickup
  renderStateLayer() {
    if (!this.statesData) return;

    if (this.geoJsonLayer) {
      this.map.removeLayer(this.geoJsonLayer);
    }

    const getStateColor = (needingPickup) => {
      if (needingPickup === 0) return '#10b981'; // Light green
      if (needingPickup >= 1 && needingPickup <= 2) return '#f59e0b'; // Amber
      return '#ef4444'; // Red (3+)
    };

    const getStateFillOpacity = (needingPickup) => {
      if (needingPickup === 0) return 0.08;
      if (needingPickup >= 1 && needingPickup <= 2) return 0.22;
      return 0.38;
    };

    this.geoJsonLayer = L.geoJSON(this.statesData, {
      style: (feature) => {
        const stateName = feature.properties.name || feature.properties.ST_NM;
        const stats = this.stateStats[stateName] || { totalBins: 0, needingPickup: 0, trucks: 0 };
        return {
          color: getStateColor(stats.needingPickup),
          weight: 1.5,
          opacity: 0.8,
          fillColor: getStateColor(stats.needingPickup),
          fillOpacity: getStateFillOpacity(stats.needingPickup)
        };
      },
      onEachFeature: (feature, layer) => {
        const stateName = feature.properties.name || feature.properties.ST_NM;

        // Tooltip on Hover
        layer.on('mouseover', (e) => {
          const stats = this.stateStats[stateName] || { totalBins: 0, needingPickup: 0, trucks: 0 };
          const tooltipContent = `
            <div style="font-family: inherit; font-size: 0.82rem; padding: 2px;">
              <b style="font-size: 0.92rem; color: #0f766e; display: block; border-bottom: 1px solid #ddd; margin-bottom: 4px; padding-bottom: 2px;">${stateName}</b>
              <div>Total Bins: <b>${stats.totalBins}</b></div>
              <div>Needs Pickup: <b style="color: ${stats.needingPickup > 0 ? '#ef4444' : '#10b981'}">${stats.needingPickup}</b></div>
              <div>Active Trucks: <b>${stats.trucks}</b></div>
            </div>
          `;
          layer.bindTooltip(tooltipContent, { sticky: true, opacity: 0.95 }).openTooltip();
          layer.setStyle({ weight: 3, opacity: 1 });
        });

        layer.on('mouseout', () => {
          this.geoJsonLayer.resetStyle(layer);
        });

        // Click state: zoom into it and filter side panel
        layer.on('click', () => {
          this.map.fitBounds(layer.getBounds(), { padding: [20, 20], maxZoom: 10 });
          if (window.UI && typeof window.UI.filterByState === 'function') {
            window.UI.filterByState(stateName);
          }
          API.toast(`Viewing state: ${stateName}`, 'info', 2000);
        });
      }
    });

    // Check layer toggle
    const toggle = document.getElementById('layer-toggle-states');
    if (!toggle || toggle.checked) {
      this.geoJsonLayer.addTo(this.map);
    }
  },

  // Populate all State dropdowns dynamically from the GeoJSON
  populateStateDropdowns() {
    if (!this.statesData || !this.statesData.features) return;

    const stateNames = this.statesData.features
      .map(f => f.properties.name || f.properties.ST_NM)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));

    const dropdownIds = [
      'bin-form-state',
      'complaint-form-state',
      'filter-bins-state',
      'filter-complaints-state',
      'filter-collections-state',
      'route-filter-state'
    ];

    dropdownIds.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;

      const currentValue = el.value;
      const hasAllOption = el.querySelector('option[value=""]');

      el.innerHTML = hasAllOption
        ? '<option value="">All States / UTs</option>'
        : '<option value="">Select State / UT</option>';

      stateNames.forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        el.appendChild(opt);
      });

      if (currentValue && stateNames.includes(currentValue)) {
        el.value = currentValue;
      }
    });
  },

  // Update State statistics for choropleth styling & tooltips
  updateStateMetrics(bins, trucks) {
    this.stateStats = {};

    bins.forEach(bin => {
      if (!bin.state) return;
      if (!this.stateStats[bin.state]) {
        this.stateStats[bin.state] = { totalBins: 0, needingPickup: 0, trucks: 0 };
      }
      this.stateStats[bin.state].totalBins++;
      if (bin.fill_percent >= bin.threshold) {
        this.stateStats[bin.state].needingPickup++;
      }
    });

    trucks.forEach(t => {
      // Find which state this truck is in
      // If truck has no explicit state, we can associate with closest or count total
    });

    this.renderStateLayer();
  },

  // Render Bin Markers
  renderBins(bins) {
    this.binsLayer.clearLayers();

    bins.forEach(bin => {
      if (bin.lat === null || bin.lng === null) return;

      // Color coding:
      // Green below 50%, Amber 50% to threshold, Red at or above threshold
      let color = '#10b981'; // Green
      if (bin.fill_percent >= bin.threshold) {
        color = '#ef4444'; // Red
      } else if (bin.fill_percent >= 50) {
        color = '#f59e0b'; // Amber
      }

      const marker = L.circleMarker([bin.lat, bin.lng], {
        radius: 8.5,
        fillColor: color,
        color: '#ffffff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.9
      });

      const popupHtml = `
        <div class="popup-container">
          <div class="popup-title">🗑️ ${API.escapeHtml(bin.name)}</div>
          <div class="popup-meta">📍 ${API.escapeHtml(bin.city)}, ${API.escapeHtml(bin.state)}</div>
          
          <div style="margin: 8px 0; background: #f3f4f6; padding: 6px 8px; border-radius: 4px;">
            <div style="display: flex; justify-content: space-between; font-weight: 600; font-size: 0.8rem; margin-bottom: 3px;">
              <span>Fill Level:</span>
              <span style="color: ${color}">${bin.fill_percent}%</span>
            </div>
            <div style="width: 100%; height: 8px; background: #e5e7eb; border-radius: 4px; overflow: hidden;">
              <div style="width: ${bin.fill_percent}%; height: 100%; background: ${color};"></div>
            </div>
            <div style="font-size: 0.72rem; color: #6b7280; margin-top: 4px; display: flex; justify-content: space-between;">
              <span>Height: ${bin.height_cm} cm</span>
              <span>Threshold: ${bin.threshold}%</span>
            </div>
          </div>

          <div class="popup-actions">
            <button class="btn btn-sm btn-primary" onclick="window.UI.openReadingModal(${bin.id})">Update Reading</button>
            <button class="btn btn-sm btn-accent" onclick="window.UI.handleMarkCollected(${bin.id})">Mark Collected</button>
            <button class="btn btn-sm btn-danger" onclick="window.UI.handleDeleteBin(${bin.id})">Delete</button>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml);
      this.binsLayer.addLayer(marker);
    });
  },

  // Create SVG DivIcon for Truck (Garbage Truck Silhouette)
  createTruckIcon(truckNumber) {
    const svgIcon = `
      <div style="position: relative; display: flex; flex-direction: column; align-items: center;">
        <div style="background: #0f766e; color: #fff; font-size: 9px; font-weight: 800; padding: 1px 4px; border-radius: 3px; white-space: nowrap; margin-bottom: 2px; box-shadow: 0 1px 3px rgba(0,0,0,0.3);">
          ${API.escapeHtml(truckNumber)}
        </div>
        <svg class="truck-marker-svg" width="34" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="1" y="5" width="14" height="11" rx="1.5" fill="#0f766e" stroke="#ffffff" stroke-width="1.5"/>
          <path d="M15 8H19.5L22 11V16H15V8Z" fill="#14b8a6" stroke="#ffffff" stroke-width="1.5"/>
          <circle cx="5.5" cy="17.5" r="2.5" fill="#1e293b" stroke="#ffffff" stroke-width="1.2"/>
          <circle cx="17.5" cy="17.5" r="2.5" fill="#1e293b" stroke="#ffffff" stroke-width="1.2"/>
          <line x1="4" y1="9" x2="11" y2="9" stroke="#ffffff" stroke-width="1.2" stroke-linecap="round"/>
        </svg>
      </div>
    `;

    return L.divIcon({
      className: 'custom-truck-icon',
      html: svgIcon,
      iconSize: [40, 36],
      iconAnchor: [20, 30],
      popupAnchor: [0, -28]
    });
  },

  // Render Truck Markers
  renderTrucks(trucks) {
    this.trucksLayer.clearLayers();

    trucks.forEach(truck => {
      if (truck.lat === null || truck.lng === null) return;

      const marker = L.marker([truck.lat, truck.lng], {
        icon: this.createTruckIcon(truck.number)
      });

      const popupHtml = `
        <div class="popup-container">
          <div class="popup-title">🚛 Truck ${API.escapeHtml(truck.number)}</div>
          <div class="popup-meta">Driver: <b>${API.escapeHtml(truck.driver_name)}</b> (${API.escapeHtml(truck.driver_phone)})</div>
          <div style="font-size: 0.8rem; margin: 4px 0;">
            Capacity: <b>${truck.capacity_kg} kg</b> | Coordinates: <b>${truck.lat.toFixed(4)}, ${truck.lng.toFixed(4)}</b>
          </div>
          <div class="popup-actions">
            <button class="btn btn-sm btn-primary" onclick="window.UI.openTruckLocationModal(${truck.id})">Update GPS</button>
            <button class="btn btn-sm btn-secondary" onclick="window.UI.viewTruckGpsHistory(${truck.id})">View Path</button>
            <button class="btn btn-sm btn-accent" onclick="window.UI.planRouteForTruck(${truck.id})">Plan Route</button>
            <button class="btn btn-sm btn-danger" onclick="window.UI.handleDeleteTruck(${truck.id})">Delete</button>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml);
      this.trucksLayer.addLayer(marker);
    });
  },

  // Draw Truck GPS Traveled Path
  drawTruckPath(points, truckNumber) {
    this.gpsPathsLayer.clearLayers();
    if (!points || points.length < 2) {
      API.toast(`No travel path history found for Truck ${truckNumber}.`, 'info');
      return;
    }

    const latlngs = points.map(p => [p.lat, p.lng]);
    const polyline = L.polyline(latlngs, {
      color: '#0d9488',
      weight: 3.5,
      dashArray: '6, 8',
      opacity: 0.85
    });

    this.gpsPathsLayer.addLayer(polyline);
    this.map.fitBounds(polyline.getBounds(), { padding: [40, 40] });
    API.toast(`Displaying ${points.length} GPS tracking points for Truck ${truckNumber}.`, 'info');
  },

  // Draw Planned Route on Map with Numbered Stops
  drawRoute(routeData) {
    this.routesLayer.clearLayers();
    if (!routeData || !routeData.stops || routeData.stops.length === 0) return;

    const { truck, stops, distance_km, eta_minutes } = routeData;

    // Latlng line: Truck start -> Stop 1 -> Stop 2 -> ... -> Stop n
    const routeCoordinates = [[truck.lat, truck.lng], ...stops.map(s => [s.lat, s.lng])];

    const polyline = L.polyline(routeCoordinates, {
      color: '#2563eb',
      weight: 4,
      opacity: 0.85
    });

    this.routesLayer.addLayer(polyline);

    // Numbered stops markers
    stops.forEach((stop, index) => {
      const stopNumber = index + 1;
      const stopIcon = L.divIcon({
        className: 'custom-stop-marker',
        html: `<span>${stopNumber}</span>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
        popupAnchor: [0, -14]
      });

      const stopMarker = L.marker([stop.lat, stop.lng], { icon: stopIcon });

      const stopPopupHtml = `
        <div class="popup-container">
          <div class="popup-title">Stop #${stopNumber}: ${API.escapeHtml(stop.name)}</div>
          <div class="popup-meta">📍 ${API.escapeHtml(stop.city)}, ${API.escapeHtml(stop.state)}</div>
          <div style="margin: 6px 0; font-size: 0.82rem;">
            Current Fill: <b style="color: #ef4444">${stop.fill_percent}%</b> (Threshold: ${stop.threshold}%)
          </div>
          <div class="popup-actions">
            <button class="btn btn-sm btn-accent" onclick="window.UI.handleMarkCollected(${stop.id}, ${truck.id})">Mark Collected</button>
          </div>
        </div>
      `;

      stopMarker.bindPopup(stopPopupHtml);
      this.routesLayer.addLayer(stopMarker);
    });

    this.map.fitBounds(polyline.getBounds(), { padding: [50, 50], maxZoom: 12 });
  },

  // Clear current route display
  clearRoute() {
    this.routesLayer.clearLayers();
  },

  // Search Jump (State or City)
  jumpToLocation(query, userCities = []) {
    if (!query || !query.trim()) return false;
    const cleanQuery = query.trim().toLowerCase();

    // 1. Check matching states from GeoJSON
    if (this.statesData && this.statesData.features) {
      const matchingFeature = this.statesData.features.find(f => {
        const name = (f.properties.name || f.properties.ST_NM || '').toLowerCase();
        return name === cleanQuery || name.includes(cleanQuery);
      });

      if (matchingFeature) {
        const stateLayer = L.geoJSON(matchingFeature);
        this.map.fitBounds(stateLayer.getBounds(), { padding: [20, 20], maxZoom: 9 });
        API.toast(`Zoomed to ${matchingFeature.properties.name || matchingFeature.properties.ST_NM}`, 'info');
        return true;
      }
    }

    // 2. Check user-entered cities
    const matchingCity = userCities.find(c => c.name.toLowerCase().includes(cleanQuery));
    if (matchingCity) {
      this.map.setView([matchingCity.lat, matchingCity.lng], 13);
      API.toast(`Zoomed to ${matchingCity.name}`, 'info');
      return true;
    }

    API.toast(`No state or city found matching "${query}".`, 'error');
    return false;
  }
};
