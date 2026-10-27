/**
 * API Client Module & Helper Utilities
 * Smart Waste Collection Tracking System (India)
 */

const API = {
  // Utility: HTML Escaping to prevent XSS
  escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  // Toast Notifications
  toast(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toastEl = document.createElement('div');
    toastEl.className = `toast toast-${type}`;
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '⚠️';

    toastEl.innerHTML = `
      <div style="font-size: 1.1rem; line-height: 1;">${icon}</div>
      <div class="toast-msg">${this.escapeHtml(message)}</div>
      <button class="toast-close" aria-label="Close">&times;</button>
    `;

    toastEl.querySelector('.toast-close').addEventListener('click', () => {
      toastEl.remove();
    });

    container.appendChild(toastEl);

    setTimeout(() => {
      if (toastEl.parentNode) {
        toastEl.style.opacity = '0';
        toastEl.style.transition = 'opacity 0.3s ease';
        setTimeout(() => toastEl.remove(), 300);
      }
    }, duration);
  },

  // Generic Request Helper with button locking
  async request(endpoint, options = {}, submitButton = null) {
    let originalButtonText = '';
    if (submitButton) {
      originalButtonText = submitButton.innerHTML;
      submitButton.disabled = true;
      submitButton.innerHTML = `<span class="btn-spinner">⌛</span> Processing...`;
    }

    try {
      const fetchOptions = {
        headers: { 'Content-Type': 'application/json' },
        ...options
      };

      if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
        fetchOptions.body = JSON.stringify(options.body);
      }

      const res = await fetch(endpoint, fetchOptions);
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const errorMsg = data.error || `HTTP ${res.status}: Failed to process request.`;
        this.toast(errorMsg, 'error');
        throw new Error(errorMsg);
      }

      return data;
    } catch (err) {
      if (!options.silent) {
        console.error(`API Error on ${endpoint}:`, err);
      }
      throw err;
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.innerHTML = originalButtonText;
      }
    }
  },

  // Bins
  async getBins(state = '', needingPickup = false) {
    const params = new URLSearchParams();
    if (state) params.append('state', state);
    if (needingPickup) params.append('needing_pickup', 'true');
    return this.request(`/api/bins?${params.toString()}`);
  },

  async createBin(binData, btn = null) {
    const res = await this.request('/api/bins', { method: 'POST', body: binData }, btn);
    this.toast(`Bin "${res.name}" added successfully!`, 'success');
    return res;
  },

  async updateBin(id, binData, btn = null) {
    const res = await this.request(`/api/bins/${id}`, { method: 'PUT', body: binData }, btn);
    this.toast(`Bin "${res.name}" updated successfully!`, 'success');
    return res;
  },

  async deleteBin(id, btn = null) {
    const res = await this.request(`/api/bins/${id}`, { method: 'DELETE' }, btn);
    this.toast(res.message || 'Bin deleted successfully.', 'success');
    return res;
  },

  async logBinReading(id, distanceCm, btn = null) {
    const res = await this.request(
      `/api/bins/${id}/readings`,
      { method: 'POST', body: { distance_cm: distanceCm } },
      btn
    );
    this.toast(res.message, 'success');
    return res;
  },

  async getBinReadings(id) {
    return this.request(`/api/bins/${id}/readings`);
  },

  // Trucks
  async getTrucks() {
    return this.request('/api/trucks');
  },

  async createTruck(truckData, btn = null) {
    const res = await this.request('/api/trucks', { method: 'POST', body: truckData }, btn);
    this.toast(`Truck "${res.number}" registered successfully!`, 'success');
    return res;
  },

  async updateTruck(id, truckData, btn = null) {
    const res = await this.request(`/api/trucks/${id}`, { method: 'PUT', body: truckData }, btn);
    this.toast(`Truck "${res.number}" updated successfully!`, 'success');
    return res;
  },

  async deleteTruck(id, btn = null) {
    const res = await this.request(`/api/trucks/${id}`, { method: 'DELETE' }, btn);
    this.toast(res.message || 'Truck deleted.', 'success');
    return res;
  },

  async updateTruckLocation(id, lat, lng, btn = null) {
    const res = await this.request(
      `/api/trucks/${id}/location`,
      { method: 'POST', body: { lat, lng } },
      btn
    );
    this.toast(res.message, 'success');
    return res;
  },

  async getTruckHistory(id) {
    return this.request(`/api/trucks/${id}/history`);
  },

  // Routes
  async planRoute(truckId, state = '', speedKmh = 25, btn = null) {
    const res = await this.request(
      '/api/routes/plan',
      { method: 'POST', body: { truck_id: truckId, state, speed_kmh: speedKmh } },
      btn
    );
    if (res.stops && res.stops.length > 0) {
      this.toast(`Route planned: ${res.stops.length} stops (${res.distance_km} km, ~${res.eta_minutes} mins)`, 'success');
    } else {
      this.toast(res.message || 'No bins requiring collection.', 'info');
    }
    return res;
  },

  // Collections
  async markCollected(binId, truckId = null, btn = null) {
    const res = await this.request(
      '/api/collections',
      { method: 'POST', body: { bin_id: binId, truck_id: truckId } },
      btn
    );
    this.toast(res.message, 'success');
    return res;
  },

  async getCollections(state = '') {
    const params = new URLSearchParams();
    if (state) params.append('state', state);
    return this.request(`/api/collections?${params.toString()}`);
  },

  // Complaints
  async getComplaints(state = '', status = '') {
    const params = new URLSearchParams();
    if (state) params.append('state', state);
    if (status) params.append('status', status);
    return this.request(`/api/complaints?${params.toString()}`);
  },

  async createComplaint(data, btn = null) {
    const res = await this.request('/api/complaints', { method: 'POST', body: data }, btn);
    this.toast('Complaint registered successfully. Admin will review soon.', 'success');
    return res;
  },

  async updateComplaint(id, data, btn = null) {
    const res = await this.request(`/api/complaints/${id}`, { method: 'PUT', body: data }, btn);
    this.toast(`Complaint #${id} updated to "${res.status}".`, 'success');
    return res;
  },

  async deleteComplaint(id, btn = null) {
    const res = await this.request(`/api/complaints/${id}`, { method: 'DELETE' }, btn);
    this.toast(res.message, 'success');
    return res;
  },

  // Stats & System
  async getStats() {
    return this.request('/api/stats');
  },

  async loadDemoData(btn = null) {
    const res = await this.request('/api/demo-data', { method: 'POST' }, btn);
    this.toast(res.message, 'success');
    return res;
  },

  async resetDatabase(btn = null) {
    const res = await this.request('/api/reset', { method: 'POST' }, btn);
    this.toast(res.message, 'success');
    return res;
  }
};
