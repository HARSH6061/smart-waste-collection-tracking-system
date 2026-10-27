/**
 * User Interface Controller Module
 * Smart Waste Collection Tracking System (India)
 */

const UI = {
  activeTab: 'dashboard',
  selectedStateFilter: '',
  sortState: {
    bins: { column: 'id', dir: 'desc' },
    trucks: { column: 'id', dir: 'desc' },
    complaints: { column: 'id', dir: 'desc' },
    collections: { column: 'id', dir: 'desc' }
  },

  init() {
    this.setupTheme();
    this.setupTabs();
    this.setupMobileMenu();
    this.setupSearchBox();
  },

  // ----------------------------------------------------------------
  // Theme Toggle (Light / Dark)
  // ----------------------------------------------------------------
  setupTheme() {
    const savedTheme = localStorage.getItem('waste_tracker_theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    this.updateThemeButtonIcon(savedTheme);

    const themeBtn = document.getElementById('theme-toggle-btn');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        const nextTheme = currentTheme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', nextTheme);
        localStorage.setItem('waste_tracker_theme', nextTheme);
        this.updateThemeButtonIcon(nextTheme);

        if (window.ChartsModule) {
          ChartsModule.updateTheme();
        }
      });
    }
  },

  updateThemeButtonIcon(theme) {
    const themeBtn = document.getElementById('theme-toggle-btn');
    if (!themeBtn) return;
    themeBtn.innerHTML = theme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode';
  },

  // ----------------------------------------------------------------
  // Tabs Navigation
  // ----------------------------------------------------------------
  setupTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');
        this.switchTab(targetTab);
      });
    });
  },

  switchTab(tabId) {
    this.activeTab = tabId;

    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
    });

    document.querySelectorAll('.tab-panel').forEach(panel => {
      panel.classList.toggle('active', panel.id === `tab-${tabId}`);
    });

    // Close mobile drawer if open
    const sidebar = document.getElementById('app-sidebar');
    if (sidebar) sidebar.classList.remove('open');
  },

  // ----------------------------------------------------------------
  // Mobile Drawer
  // ----------------------------------------------------------------
  setupMobileMenu() {
    const mobileBtn = document.getElementById('mobile-menu-toggle');
    const sidebar = document.getElementById('app-sidebar');
    if (mobileBtn && sidebar) {
      mobileBtn.addEventListener('click', () => {
        sidebar.classList.toggle('open');
      });
    }
  },

  // ----------------------------------------------------------------
  // Top Search Box (Jump to State / City)
  // ----------------------------------------------------------------
  setupSearchBox() {
    const searchInput = document.getElementById('global-search-input');
    const dropdown = document.getElementById('search-results-dropdown');
    if (!searchInput || !dropdown) return;

    searchInput.addEventListener('input', () => {
      const query = searchInput.value.trim().toLowerCase();
      if (!query) {
        dropdown.classList.remove('active');
        dropdown.innerHTML = '';
        return;
      }

      const results = [];

      // States from GeoJSON
      if (MapModule.statesData && MapModule.statesData.features) {
        MapModule.statesData.features.forEach(f => {
          const name = f.properties.name || f.properties.ST_NM;
          if (name && name.toLowerCase().includes(query)) {
            results.push({ type: 'State / UT', name: name, category: 'state' });
          }
        });
      }

      // Cities from user bins
      if (window.App && window.App.bins) {
        window.App.bins.forEach(b => {
          if (b.city && b.city.toLowerCase().includes(query)) {
            if (!results.some(r => r.name.toLowerCase() === b.city.toLowerCase())) {
              results.push({ type: `City (${b.state})`, name: b.city, category: 'city', lat: b.lat, lng: b.lng });
            }
          }
        });
      }

      if (results.length === 0) {
        dropdown.innerHTML = `<div class="search-item" style="color: var(--text-muted); cursor: default;">No matching states or cities</div>`;
        dropdown.classList.add('active');
        return;
      }

      dropdown.innerHTML = results
        .slice(0, 8)
        .map(
          r => `
          <div class="search-item" onclick="UI.selectSearchResult('${API.escapeHtml(r.name)}')">
            <span><b>${API.escapeHtml(r.name)}</b></span>
            <span class="badge badge-info">${API.escapeHtml(r.type)}</span>
          </div>
        `
        )
        .join('');
      dropdown.classList.add('active');
    });

    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const query = searchInput.value.trim();
        if (query) {
          dropdown.classList.remove('active');
          this.selectSearchResult(query);
        }
      }
    });

    // Close search dropdown on click outside
    document.addEventListener('click', (e) => {
      if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.classList.remove('active');
      }
    });
  },

  selectSearchResult(name) {
    const searchInput = document.getElementById('global-search-input');
    const dropdown = document.getElementById('search-results-dropdown');
    if (searchInput) searchInput.value = name;
    if (dropdown) dropdown.classList.remove('active');

    const userCities = (window.App && window.App.bins)
      ? window.App.bins.map(b => ({ name: b.city, lat: b.lat, lng: b.lng }))
      : [];

    MapModule.jumpToLocation(name, userCities);
  },

  // ----------------------------------------------------------------
  // Filter sidebar and state dropdowns by state click
  // ----------------------------------------------------------------
  filterByState(stateName) {
    this.selectedStateFilter = stateName;

    // Set filter dropdown values
    const filterIds = [
      'filter-bins-state',
      'filter-complaints-state',
      'filter-collections-state',
      'route-filter-state'
    ];
    filterIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = stateName;
    });

    // Auto-fill state in Add Bin and Complaint forms
    const addBinState = document.getElementById('bin-form-state');
    if (addBinState) addBinState.value = stateName;

    const complaintState = document.getElementById('complaint-form-state');
    if (complaintState) complaintState.value = stateName;

    // Refresh views
    this.renderBinsTable();
    this.renderComplaintsTable();
    this.renderCollectionsTable();
  },

  // ----------------------------------------------------------------
  // Modals Controller
  // ----------------------------------------------------------------
  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('active');
  },

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
  },

  // Confirmation Dialog Modal Helper
  confirm(message, onConfirm) {
    const msgEl = document.getElementById('confirm-modal-message');
    const confirmBtn = document.getElementById('confirm-modal-ok');
    if (!msgEl || !confirmBtn) {
      if (window.confirm(message)) onConfirm();
      return;
    }

    msgEl.textContent = message;
    this.openModal('modal-confirm');

    // Remove previous listeners
    const newBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);

    newBtn.addEventListener('click', () => {
      this.closeModal('modal-confirm');
      onConfirm();
    });
  },

  // ----------------------------------------------------------------
  // Bin Actions & Tables
  // ----------------------------------------------------------------
  renderBinsTable() {
    const tbody = document.getElementById('bins-table-body');
    if (!tbody) return;

    let bins = (window.App && window.App.bins) ? [...window.App.bins] : [];

    // State filter
    const stateFilter = document.getElementById('filter-bins-state')?.value;
    if (stateFilter) {
      bins = bins.filter(b => b.state === stateFilter);
    }

    // Search query
    const searchQuery = document.getElementById('search-bins-input')?.value.toLowerCase().trim();
    if (searchQuery) {
      bins = bins.filter(
        b =>
          b.name.toLowerCase().includes(searchQuery) ||
          b.city.toLowerCase().includes(searchQuery) ||
          b.state.toLowerCase().includes(searchQuery)
      );
    }

    // Sorting
    const { column, dir } = this.sortState.bins;
    bins.sort((a, b) => {
      let valA = a[column];
      let valB = b[column];
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      if (valA < valB) return dir === 'asc' ? -1 : 1;
      if (valA > valB) return dir === 'asc' ? 1 : -1;
      return 0;
    });

    if (bins.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 18px;">No bins match your current filters. Add a bin using the form above.</td></tr>`;
      return;
    }

    tbody.innerHTML = bins
      .map(b => {
        let statusBadge = `<span class="badge badge-ok">Normal (${b.fill_percent}%)</span>`;
        if (b.fill_percent >= b.threshold) {
          statusBadge = `<span class="badge badge-bad">Needs Pickup (${b.fill_percent}%)</span>`;
        } else if (b.fill_percent >= 50) {
          statusBadge = `<span class="badge badge-warn">Filling (${b.fill_percent}%)</span>`;
        }

        return `
          <tr>
            <td><b>${API.escapeHtml(b.name)}</b></td>
            <td>${API.escapeHtml(b.state)}</td>
            <td>${API.escapeHtml(b.city)}</td>
            <td>${b.height_cm} cm</td>
            <td>${b.threshold}%</td>
            <td>${statusBadge}</td>
            <td>
              <div style="display: flex; gap: 4px;">
                <button class="btn btn-sm btn-primary" title="Update Ultrasonic Reading" onclick="UI.openReadingModal(${b.id})">📶 Reading</button>
                <button class="btn btn-sm btn-secondary" title="View Reading History" onclick="UI.openBinHistoryModal(${b.id})">📜 History</button>
                <button class="btn btn-sm btn-accent" title="Mark Collected" onclick="UI.handleMarkCollected(${b.id})">✓ Collect</button>
                <button class="btn btn-sm btn-secondary" title="Edit Bin" onclick="UI.openEditBinModal(${b.id})">✏️</button>
                <button class="btn btn-sm btn-danger" title="Delete Bin" onclick="UI.handleDeleteBin(${b.id})">🗑️</button>
              </div>
            </td>
          </tr>
        `;
      })
      .join('');
  },

  // Open Reading Modal
  openReadingModal(binId) {
    const bin = (window.App && window.App.bins) ? window.App.bins.find(b => b.id === binId) : null;
    if (!bin) return;

    document.getElementById('reading-modal-bin-id').value = bin.id;
    document.getElementById('reading-modal-bin-name').textContent = bin.name;
    document.getElementById('reading-modal-height').textContent = bin.height_cm;
    document.getElementById('reading-modal-current-fill').textContent = `${bin.fill_percent}%`;

    const distInput = document.getElementById('reading-modal-distance');
    distInput.value = '';
    distInput.max = bin.height_cm;

    const previewEl = document.getElementById('reading-modal-preview');
    previewEl.textContent = 'Enter distance above to preview fill %';

    distInput.oninput = () => {
      const d = parseFloat(distInput.value);
      if (!isNaN(d) && d >= 0 && d <= bin.height_cm) {
        const fill = Math.round(((bin.height_cm - d) / bin.height_cm) * 100);
        previewEl.innerHTML = `Calculated Fill: <b style="color: ${fill >= bin.threshold ? 'var(--status-bad)' : 'var(--status-ok)'}">${fill}%</b>`;
      } else {
        previewEl.textContent = 'Distance must be between 0 and ' + bin.height_cm + ' cm';
      }
    };

    this.openModal('modal-update-reading');
  },

  // Open Bin Reading History Modal
  async openBinHistoryModal(binId) {
    const bin = (window.App && window.App.bins) ? window.App.bins.find(b => b.id === binId) : null;
    if (!bin) return;

    document.getElementById('bin-history-modal-name').textContent = bin.name;
    const listBody = document.getElementById('bin-history-table-body');
    listBody.innerHTML = `<tr><td colspan="4" style="text-align: center;">Loading history...</td></tr>`;

    this.openModal('modal-bin-history');

    try {
      const readings = await API.getBinReadings(binId);
      if (readings.length === 0) {
        listBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">No readings recorded yet.</td></tr>`;
        return;
      }

      listBody.innerHTML = readings
        .map(
          r => `
          <tr>
            <td>#${r.id}</td>
            <td>${r.distance_cm} cm</td>
            <td><b>${r.fill_percent}%</b></td>
            <td>${new Date(r.created_at).toLocaleString()}</td>
          </tr>
        `
        )
        .join('');
    } catch (err) {
      listBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--status-bad);">Failed to load readings.</td></tr>`;
    }
  },

  // Open Edit Bin Modal
  openEditBinModal(binId) {
    const bin = (window.App && window.App.bins) ? window.App.bins.find(b => b.id === binId) : null;
    if (!bin) return;

    document.getElementById('edit-bin-id').value = bin.id;
    document.getElementById('edit-bin-name').value = bin.name;
    document.getElementById('edit-bin-state').value = bin.state;
    document.getElementById('edit-bin-city').value = bin.city;
    document.getElementById('edit-bin-lat').value = bin.lat;
    document.getElementById('edit-bin-lng').value = bin.lng;
    document.getElementById('edit-bin-height').value = bin.height_cm;
    document.getElementById('edit-bin-threshold').value = bin.threshold;

    this.openModal('modal-edit-bin');
  },

  // Handle Mark Collected
  async handleMarkCollected(binId, truckId = null) {
    this.confirm('Mark this bin as collected? Fill level will be reset to 0%.', async () => {
      try {
        await API.markCollected(binId, truckId);
        if (window.App) {
          await window.App.refreshAll();
        }
      } catch (err) {
        // Handled in API
      }
    });
  },

  // Handle Delete Bin
  async handleDeleteBin(binId) {
    const bin = (window.App && window.App.bins) ? window.App.bins.find(b => b.id === binId) : null;
    const binName = bin ? bin.name : `Bin #${binId}`;

    this.confirm(`Are you sure you want to delete "${binName}"? This action cannot be undone.`, async () => {
      try {
        await API.deleteBin(binId);
        if (window.App) {
          await window.App.refreshAll();
        }
      } catch (err) {
        // Handled in API
      }
    });
  },

  // ----------------------------------------------------------------
  // Truck Actions & Tables
  // ----------------------------------------------------------------
  renderTrucksTable() {
    const tbody = document.getElementById('trucks-table-body');
    if (!tbody) return;

    let trucks = (window.App && window.App.trucks) ? [...window.App.trucks] : [];

    // Search
    const search = document.getElementById('search-trucks-input')?.value.toLowerCase().trim();
    if (search) {
      trucks = trucks.filter(
        t =>
          t.number.toLowerCase().includes(search) ||
          t.driver_name.toLowerCase().includes(search) ||
          t.driver_phone.includes(search)
      );
    }

    // Sort
    const { column, dir } = this.sortState.trucks;
    trucks.sort((a, b) => {
      let valA = a[column];
      let valB = b[column];
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      if (valA < valB) return dir === 'asc' ? -1 : 1;
      if (valA > valB) return dir === 'asc' ? 1 : -1;
      return 0;
    });

    if (trucks.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 18px;">No trucks registered yet. Add a garbage truck above.</td></tr>`;
      return;
    }

    tbody.innerHTML = trucks
      .map(
        t => `
        <tr>
          <td><b>🚛 ${API.escapeHtml(t.number)}</b></td>
          <td>${API.escapeHtml(t.driver_name)}</td>
          <td>${API.escapeHtml(t.driver_phone)}</td>
          <td>${t.capacity_kg} kg</td>
          <td>${t.lat.toFixed(4)}, ${t.lng.toFixed(4)}</td>
          <td>${new Date(t.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
          <td>
            <div style="display: flex; gap: 4px;">
              <button class="btn btn-sm btn-primary" title="Update Location" onclick="UI.openTruckLocationModal(${t.id})">📍 GPS</button>
              <button class="btn btn-sm btn-secondary" title="View Travel Path" onclick="UI.viewTruckGpsHistory(${t.id})">🗺️ Path</button>
              <button class="btn btn-sm btn-accent" title="Plan Route" onclick="UI.planRouteForTruck(${t.id})">⚡ Plan</button>
              <button class="btn btn-sm btn-danger" title="Delete Truck" onclick="UI.handleDeleteTruck(${t.id})">🗑️</button>
            </div>
          </td>
        </tr>
      `
      )
      .join('');
  },

  openTruckLocationModal(truckId) {
    const truck = (window.App && window.App.trucks) ? window.App.trucks.find(t => t.id === truckId) : null;
    if (!truck) return;

    document.getElementById('truck-loc-id').value = truck.id;
    document.getElementById('truck-loc-number').textContent = truck.number;
    document.getElementById('truck-loc-lat').value = truck.lat;
    document.getElementById('truck-loc-lng').value = truck.lng;

    this.openModal('modal-update-truck-location');
  },

  async viewTruckGpsHistory(truckId) {
    try {
      const data = await API.getTruckHistory(truckId);
      MapModule.drawTruckPath(data.points, data.truck.number);
    } catch (err) {
      // Handled in API
    }
  },

  planRouteForTruck(truckId) {
    this.switchTab('routes');
    const select = document.getElementById('route-truck-select');
    if (select) select.value = truckId;
  },

  handleDeleteTruck(truckId) {
    const truck = (window.App && window.App.trucks) ? window.App.trucks.find(t => t.id === truckId) : null;
    const name = truck ? truck.number : `Truck #${truckId}`;

    this.confirm(`Are you sure you want to delete Truck "${name}"?`, async () => {
      try {
        await API.deleteTruck(truckId);
        if (window.App) {
          await window.App.refreshAll();
        }
      } catch (err) {
        // Handled in API
      }
    });
  },

  // ----------------------------------------------------------------
  // Complaints Actions & Tables
  // ----------------------------------------------------------------
  renderComplaintsTable() {
    const tbody = document.getElementById('complaints-table-body');
    if (!tbody) return;

    let complaints = (window.App && window.App.complaints) ? [...window.App.complaints] : [];

    // State filter
    const stateFilter = document.getElementById('filter-complaints-state')?.value;
    if (stateFilter) {
      complaints = complaints.filter(c => c.state === stateFilter);
    }

    // Status filter
    const statusFilter = document.getElementById('filter-complaints-status')?.value;
    if (statusFilter) {
      complaints = complaints.filter(c => c.status === statusFilter);
    }

    // Search
    const search = document.getElementById('search-complaints-input')?.value.toLowerCase().trim();
    if (search) {
      complaints = complaints.filter(
        c =>
          c.name.toLowerCase().includes(search) ||
          c.city.toLowerCase().includes(search) ||
          c.description.toLowerCase().includes(search) ||
          c.phone.includes(search)
      );
    }

    // Sort
    const { column, dir } = this.sortState.complaints;
    complaints.sort((a, b) => {
      let valA = a[column];
      let valB = b[column];
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      if (valA < valB) return dir === 'asc' ? -1 : 1;
      if (valA > valB) return dir === 'asc' ? 1 : -1;
      return 0;
    });

    if (complaints.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 18px;">No citizen complaints found.</td></tr>`;
      return;
    }

    tbody.innerHTML = complaints
      .map(c => {
        let statusBadge = `<span class="badge badge-bad">Open</span>`;
        if (c.status === 'In progress') statusBadge = `<span class="badge badge-warn">In Progress</span>`;
        if (c.status === 'Resolved') statusBadge = `<span class="badge badge-ok">Resolved</span>`;

        return `
          <tr>
            <td>#${c.id}</td>
            <td><b>${API.escapeHtml(c.name)}</b><br><small style="color: var(--text-muted)">${API.escapeHtml(c.phone)}</small></td>
            <td>${API.escapeHtml(c.city)}, ${API.escapeHtml(c.state)}</td>
            <td><span class="badge badge-info">${API.escapeHtml(c.type)}</span></td>
            <td style="max-width: 220px; white-space: normal;" title="${API.escapeHtml(c.description)}">${API.escapeHtml(c.description)}</td>
            <td>
              <select style="font-size: 0.78rem; padding: 3px 6px;" onchange="UI.handleUpdateComplaintStatus(${c.id}, this.value)">
                <option value="Open" ${c.status === 'Open' ? 'selected' : ''}>Open</option>
                <option value="In progress" ${c.status === 'In progress' ? 'selected' : ''}>In Progress</option>
                <option value="Resolved" ${c.status === 'Resolved' ? 'selected' : ''}>Resolved</option>
              </select>
            </td>
            <td>
              <button class="btn btn-sm btn-danger" onclick="UI.handleDeleteComplaint(${c.id})">🗑️</button>
            </td>
          </tr>
        `;
      })
      .join('');
  },

  async handleUpdateComplaintStatus(complaintId, newStatus) {
    try {
      await API.updateComplaint(complaintId, { status: newStatus });
      if (window.App) {
        await window.App.refreshAll();
      }
    } catch (err) {
      // Handled in API
    }
  },

  handleDeleteComplaint(complaintId) {
    this.confirm('Delete this complaint record?', async () => {
      try {
        await API.deleteComplaint(complaintId);
        if (window.App) {
          await window.App.refreshAll();
        }
      } catch (err) {
        // Handled in API
      }
    });
  },

  // ----------------------------------------------------------------
  // Collections Table
  // ----------------------------------------------------------------
  renderCollectionsTable() {
    const tbody = document.getElementById('collections-table-body');
    if (!tbody) return;

    let collections = (window.App && window.App.collections) ? [...window.App.collections] : [];

    const stateFilter = document.getElementById('filter-collections-state')?.value;
    if (stateFilter) {
      collections = collections.filter(c => c.state === stateFilter);
    }

    if (collections.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 18px;">No waste collection history logged yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = collections
      .map(
        c => `
        <tr>
          <td>#${c.id}</td>
          <td><b>${API.escapeHtml(c.bin_name || 'Bin #' + c.bin_id)}</b></td>
          <td>${API.escapeHtml(c.truck_number ? '🚛 ' + c.truck_number : 'Manual')}</td>
          <td>${API.escapeHtml(c.state || 'N/A')}</td>
          <td>${new Date(c.collected_at).toLocaleString()}</td>
        </tr>
      `
      )
      .join('');
  }
};
