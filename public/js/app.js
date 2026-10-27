/**
 * Application Orchestrator
 * Smart Waste Collection Tracking System (India)
 */

const App = {
  bins: [],
  trucks: [],
  complaints: [],
  collections: [],
  stats: null,
  activeRoute: null,

  async init() {
    console.log('Initializing Smart Waste Collection Tracking System (India)...');
    UI.init();
    MapModule.init();

    this.setupFormListeners();
    this.setupLayerToggles();
    this.setupTableControls();
    this.setupMapPickerButtons();
    this.setupSystemButtons();

    // Load initial data
    await this.refreshAll();
  },

  // Refresh all state from backend
  async refreshAll() {
    try {
      const [bins, trucks, complaints, collections, stats] = await Promise.all([
        API.getBins(),
        API.getTrucks(),
        API.getComplaints(),
        API.getCollections(),
        API.getStats()
      ]);

      this.bins = bins;
      this.trucks = trucks;
      this.complaints = complaints;
      this.collections = collections;
      this.stats = stats;

      // Update Map Layers
      MapModule.renderBins(this.bins);
      MapModule.renderTrucks(this.trucks);
      MapModule.updateStateMetrics(this.bins, this.trucks);

      // Update Summary Cards
      this.renderSummaryCards();

      // Update Charts
      ChartsModule.init(this.stats);

      // Update Tables
      UI.renderBinsTable();
      UI.renderTrucksTable();
      UI.renderComplaintsTable();
      UI.renderCollectionsTable();

      // Populate Route Truck Select
      this.populateTruckSelects();
    } catch (err) {
      console.error('Error refreshing app data:', err);
    }
  },

  async refreshStats() {
    try {
      this.stats = await API.getStats();
      this.renderSummaryCards();
      ChartsModule.init(this.stats);
    } catch (err) {
      console.error('Error refreshing stats:', err);
    }
  },

  renderSummaryCards() {
    if (!this.stats || !this.stats.summary) return;
    const s = this.stats.summary;

    const elTotalBins = document.getElementById('stat-total-bins');
    const elNeedingPickup = document.getElementById('stat-needing-pickup');
    const elActiveTrucks = document.getElementById('stat-active-trucks');
    const elOpenComplaints = document.getElementById('stat-open-complaints');
    const elTotalCollections = document.getElementById('stat-total-collections');
    const elTotalDistance = document.getElementById('stat-total-distance');

    if (elTotalBins) elTotalBins.textContent = s.total_bins;
    if (elNeedingPickup) elNeedingPickup.textContent = s.bins_needing_pickup;
    if (elActiveTrucks) elActiveTrucks.textContent = s.active_trucks;
    if (elOpenComplaints) elOpenComplaints.textContent = s.open_complaints;
    if (elTotalCollections) elTotalCollections.textContent = s.total_collections;
    if (elTotalDistance) elTotalDistance.textContent = `${s.total_distance_km} km`;
  },

  populateTruckSelects() {
    const routeSelect = document.getElementById('route-truck-select');
    if (!routeSelect) return;

    const currentVal = routeSelect.value;
    routeSelect.innerHTML = '<option value="">Select a Garbage Truck</option>';

    this.trucks.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = `🚛 ${t.number} (${t.driver_name} - ${t.capacity_kg}kg)`;
      routeSelect.appendChild(opt);
    });

    if (currentVal) routeSelect.value = currentVal;
  },

  // -------------------------------------------------------------
  // Map Pickers Configuration
  // -------------------------------------------------------------
  setupMapPickerButtons() {
    // 1. Add Bin map picker
    document.getElementById('btn-pick-bin-coord')?.addEventListener('click', () => {
      MapModule.startPicker((lat, lng) => {
        document.getElementById('bin-form-lat').value = lat;
        document.getElementById('bin-form-lng').value = lng;
      });
    });

    // 2. Add Truck map picker
    document.getElementById('btn-pick-truck-coord')?.addEventListener('click', () => {
      MapModule.startPicker((lat, lng) => {
        document.getElementById('truck-form-lat').value = lat;
        document.getElementById('truck-form-lng').value = lng;
      });
    });

    // 3. Update Truck location picker
    document.getElementById('btn-pick-truck-loc-coord')?.addEventListener('click', () => {
      MapModule.startPicker((lat, lng) => {
        document.getElementById('truck-loc-lat').value = lat;
        document.getElementById('truck-loc-lng').value = lng;
      });
    });

    // 4. Complaint map picker
    document.getElementById('btn-pick-complaint-coord')?.addEventListener('click', () => {
      MapModule.startPicker((lat, lng) => {
        document.getElementById('complaint-form-lat').value = lat;
        document.getElementById('complaint-form-lng').value = lng;
      });
    });

    // Map picker cancel button
    document.getElementById('map-picker-cancel-btn')?.addEventListener('click', () => {
      MapModule.clearPicker();
    });
  },

  // -------------------------------------------------------------
  // Layer Toggles Configuration
  // -------------------------------------------------------------
  setupLayerToggles() {
    const toggleStates = document.getElementById('layer-toggle-states');
    const toggleBins = document.getElementById('layer-toggle-bins');
    const toggleTrucks = document.getElementById('layer-toggle-trucks');
    const toggleRoutes = document.getElementById('layer-toggle-routes');

    if (toggleStates) {
      toggleStates.addEventListener('change', (e) => {
        if (e.target.checked) {
          if (MapModule.geoJsonLayer) MapModule.geoJsonLayer.addTo(MapModule.map);
        } else {
          if (MapModule.geoJsonLayer) MapModule.map.removeLayer(MapModule.geoJsonLayer);
        }
      });
    }

    if (toggleBins) {
      toggleBins.addEventListener('change', (e) => {
        if (e.target.checked) {
          MapModule.binsLayer.addTo(MapModule.map);
        } else {
          MapModule.map.removeLayer(MapModule.binsLayer);
        }
      });
    }

    if (toggleTrucks) {
      toggleTrucks.addEventListener('change', (e) => {
        if (e.target.checked) {
          MapModule.trucksLayer.addTo(MapModule.map);
        } else {
          MapModule.map.removeLayer(MapModule.trucksLayer);
        }
      });
    }

    if (toggleRoutes) {
      toggleRoutes.addEventListener('change', (e) => {
        if (e.target.checked) {
          MapModule.routesLayer.addTo(MapModule.map);
        } else {
          MapModule.map.removeLayer(MapModule.routesLayer);
        }
      });
    }
  },

  // -------------------------------------------------------------
  // Table Controls (Search, Sort, Filters)
  // -------------------------------------------------------------
  setupTableControls() {
    // Bins Table Search & Filters
    document.getElementById('search-bins-input')?.addEventListener('input', () => UI.renderBinsTable());
    document.getElementById('filter-bins-state')?.addEventListener('change', () => UI.renderBinsTable());

    // Trucks Table Search
    document.getElementById('search-trucks-input')?.addEventListener('input', () => UI.renderTrucksTable());

    // Complaints Table Search & Filters
    document.getElementById('search-complaints-input')?.addEventListener('input', () => UI.renderComplaintsTable());
    document.getElementById('filter-complaints-state')?.addEventListener('change', () => UI.renderComplaintsTable());
    document.getElementById('filter-complaints-status')?.addEventListener('change', () => UI.renderComplaintsTable());

    // Collections Filter
    document.getElementById('filter-collections-state')?.addEventListener('change', () => UI.renderCollectionsTable());

    // Sorting Headers
    document.querySelectorAll('[data-sort]').forEach(th => {
      th.addEventListener('click', () => {
        const table = th.getAttribute('data-table');
        const col = th.getAttribute('data-sort');
        if (!table || !col || !UI.sortState[table]) return;

        if (UI.sortState[table].column === col) {
          UI.sortState[table].dir = UI.sortState[table].dir === 'asc' ? 'desc' : 'asc';
        } else {
          UI.sortState[table].column = col;
          UI.sortState[table].dir = 'asc';
        }

        if (table === 'bins') UI.renderBinsTable();
        if (table === 'trucks') UI.renderTrucksTable();
        if (table === 'complaints') UI.renderComplaintsTable();
        if (table === 'collections') UI.renderCollectionsTable();
      });
    });
  },

  // -------------------------------------------------------------
  // Forms Event Handlers
  // -------------------------------------------------------------
  setupFormListeners() {
    // 1. Add Bin Form
    const addBinForm = document.getElementById('form-add-bin');
    if (addBinForm) {
      addBinForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = addBinForm.querySelector('button[type="submit"]');

        const binData = {
          name: document.getElementById('bin-form-name').value.trim(),
          state: document.getElementById('bin-form-state').value,
          city: document.getElementById('bin-form-city').value.trim(),
          lat: document.getElementById('bin-form-lat').value.trim(),
          lng: document.getElementById('bin-form-lng').value.trim(),
          height_cm: document.getElementById('bin-form-height').value,
          threshold: document.getElementById('bin-form-threshold').value
        };

        if (!binData.name || !binData.state || !binData.city || !binData.lat || !binData.lng) {
          API.toast('Please fill all required bin details and coordinates.', 'error');
          return;
        }

        try {
          await API.createBin(binData, btn);
          addBinForm.reset();
          document.getElementById('bin-form-height').value = 100;
          document.getElementById('bin-form-threshold').value = 80;
          await this.refreshAll();
        } catch (err) {
          // Handled in API
        }
      });
    }

    // 2. Edit Bin Form
    const editBinForm = document.getElementById('form-edit-bin');
    if (editBinForm) {
      editBinForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = editBinForm.querySelector('button[type="submit"]');
        const binId = document.getElementById('edit-bin-id').value;

        const binData = {
          name: document.getElementById('edit-bin-name').value.trim(),
          state: document.getElementById('edit-bin-state').value,
          city: document.getElementById('edit-bin-city').value.trim(),
          lat: document.getElementById('edit-bin-lat').value.trim(),
          lng: document.getElementById('edit-bin-lng').value.trim(),
          height_cm: document.getElementById('edit-bin-height').value,
          threshold: document.getElementById('edit-bin-threshold').value
        };

        try {
          await API.updateBin(binId, binData, btn);
          UI.closeModal('modal-edit-bin');
          await this.refreshAll();
        } catch (err) {
          // Handled in API
        }
      });
    }

    // 3. Update Bin Reading Modal Form
    const updateReadingForm = document.getElementById('form-update-reading');
    if (updateReadingForm) {
      updateReadingForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = updateReadingForm.querySelector('button[type="submit"]');
        const binId = document.getElementById('reading-modal-bin-id').value;
        const distance = document.getElementById('reading-modal-distance').value;

        if (distance === '') {
          API.toast('Please enter ultrasonic distance in cm.', 'error');
          return;
        }

        try {
          await API.logBinReading(binId, distance, btn);
          UI.closeModal('modal-update-reading');
          await this.refreshAll();
        } catch (err) {
          // Handled in API
        }
      });
    }

    // 4. Add Truck Form
    const addTruckForm = document.getElementById('form-add-truck');
    if (addTruckForm) {
      addTruckForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = addTruckForm.querySelector('button[type="submit"]');

        const truckData = {
          number: document.getElementById('truck-form-number').value.trim(),
          driver_name: document.getElementById('truck-form-driver').value.trim(),
          driver_phone: document.getElementById('truck-form-phone').value.trim(),
          capacity_kg: document.getElementById('truck-form-capacity').value,
          lat: document.getElementById('truck-form-lat').value.trim(),
          lng: document.getElementById('truck-form-lng').value.trim()
        };

        if (!truckData.number || !truckData.driver_name || !truckData.driver_phone || !truckData.lat || !truckData.lng) {
          API.toast('Please enter all truck and driver information.', 'error');
          return;
        }

        try {
          await API.createTruck(truckData, btn);
          addTruckForm.reset();
          await this.refreshAll();
        } catch (err) {
          // Handled in API
        }
      });
    }

    // 5. Update Truck Location Modal Form
    const updateTruckLocForm = document.getElementById('form-update-truck-location');
    if (updateTruckLocForm) {
      updateTruckLocForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = updateTruckLocForm.querySelector('button[type="submit"]');
        const truckId = document.getElementById('truck-loc-id').value;
        const lat = document.getElementById('truck-loc-lat').value.trim();
        const lng = document.getElementById('truck-loc-lng').value.trim();

        try {
          await API.updateTruckLocation(truckId, lat, lng, btn);
          UI.closeModal('modal-update-truck-location');
          await this.refreshAll();
        } catch (err) {
          // Handled in API
        }
      });
    }

    // 6. Plan Route Form
    const planRouteForm = document.getElementById('form-plan-route');
    if (planRouteForm) {
      planRouteForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = planRouteForm.querySelector('button[type="submit"]');
        const truckId = document.getElementById('route-truck-select').value;
        const state = document.getElementById('route-filter-state').value;
        const speedKmh = document.getElementById('route-speed-input').value;

        if (!truckId) {
          API.toast('Please select a truck to calculate the collection route.', 'error');
          return;
        }

        try {
          const route = await API.planRoute(truckId, state, speedKmh, btn);
          this.activeRoute = route;
          this.renderRouteResults(route);
          MapModule.drawRoute(route);
          await this.refreshStats();
        } catch (err) {
          // Handled in API
        }
      });
    }

    // 7. Citizen Complaint Form
    const complaintForm = document.getElementById('form-complaint');
    if (complaintForm) {
      complaintForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = complaintForm.querySelector('button[type="submit"]');

        const complaintData = {
          name: document.getElementById('complaint-form-name').value.trim(),
          phone: document.getElementById('complaint-form-phone').value.trim(),
          state: document.getElementById('complaint-form-state').value,
          city: document.getElementById('complaint-form-city').value.trim(),
          bin_id: document.getElementById('complaint-form-bin').value || null,
          type: document.getElementById('complaint-form-type').value,
          description: document.getElementById('complaint-form-desc').value.trim(),
          lat: document.getElementById('complaint-form-lat').value.trim() || undefined,
          lng: document.getElementById('complaint-form-lng').value.trim() || undefined
        };

        try {
          await API.createComplaint(complaintData, btn);
          complaintForm.reset();
          await this.refreshAll();
        } catch (err) {
          // Handled in API
        }
      });
    }
  },

  // Render Plan Route Results & Sequence
  renderRouteResults(route) {
    const card = document.getElementById('route-results-card');
    const container = document.getElementById('route-stops-container');
    if (!card || !container) return;

    if (!route || !route.stops || route.stops.length === 0) {
      card.style.display = 'none';
      container.innerHTML = '';
      return;
    }

    card.style.display = 'block';
    document.getElementById('route-res-truck').textContent = route.truck.number;
    document.getElementById('route-res-stops').textContent = route.stops.length;
    document.getElementById('route-res-dist').textContent = `${route.distance_km} km`;
    document.getElementById('route-res-eta').textContent = `~${route.eta_minutes} mins`;

    container.innerHTML = route.stops
      .map(
        (stop, idx) => `
        <div class="route-stop-item">
          <div class="route-stop-left">
            <span class="stop-num-badge">${idx + 1}</span>
            <div>
              <b>${API.escapeHtml(stop.name)}</b>
              <div style="font-size: 0.74rem; color: var(--text-muted);">
                ${API.escapeHtml(stop.city)}, ${API.escapeHtml(stop.state)} | Fill: <b style="color: var(--status-bad)">${stop.fill_percent}%</b>
              </div>
            </div>
          </div>
          <button class="btn btn-sm btn-accent" onclick="App.markStopCollected(${stop.id}, ${route.truck.id})">
            ✓ Collect
          </button>
        </div>
      `
      )
      .join('');
  },

  async markStopCollected(binId, truckId) {
    try {
      await API.markCollected(binId, truckId);
      // If we have an active route, remove collected stop and recompute
      if (this.activeRoute && this.activeRoute.stops) {
        this.activeRoute.stops = this.activeRoute.stops.filter(s => s.id !== binId);
        this.renderRouteResults(this.activeRoute);
        MapModule.drawRoute(this.activeRoute);
      }
      await this.refreshAll();
    } catch (err) {
      // Handled in API
    }
  },

  // -------------------------------------------------------------
  // System Buttons (Demo Data & Reset Database)
  // -------------------------------------------------------------
  setupSystemButtons() {
    // Load Demo Data Button
    document.querySelectorAll('.btn-load-demo-data').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await API.loadDemoData(btn);
          await this.refreshAll();
        } catch (err) {
          // Handled in API
        }
      });
    });

    // Reset Database Button
    document.querySelectorAll('.btn-reset-db').forEach(btn => {
      btn.addEventListener('click', () => {
        UI.confirm(
          'Are you sure you want to completely RESET the system database? All bins, trucks, complaints, and collections will be wiped.',
          async () => {
            try {
              await API.resetDatabase(btn);
              MapModule.clearRoute();
              await this.refreshAll();
            } catch (err) {
              // Handled in API
            }
          }
        );
      });
    });
  }
};

// Start application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
  window.App = App;
  window.UI = UI;
  window.MapModule = MapModule;
  window.ChartsModule = ChartsModule;
  window.API = API;
});
