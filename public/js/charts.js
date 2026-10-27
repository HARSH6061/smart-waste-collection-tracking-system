/**
 * Chart.js Controller Module
 * Smart Waste Collection Tracking System (India)
 */

const ChartsModule = {
  chartNeedingPickup: null,
  chartCollections: null,
  chartComplaints: null,
  chartAvgFill: null,

  isDarkTheme() {
    return document.documentElement.getAttribute('data-theme') === 'dark';
  },

  getThemeColors() {
    const isDark = this.isDarkTheme();
    return {
      textColor: isDark ? '#94a3b8' : '#64748b',
      gridColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
      cardBg: isDark ? '#142420' : '#ffffff'
    };
  },

  init(statsData) {
    this.renderCharts(statsData);
  },

  renderCharts(statsData) {
    if (!statsData || !statsData.charts) return;
    const { needing_pickup_by_state, collections_last_7_days, complaints_by_type, avg_fill_by_state } =
      statsData.charts;
    const theme = this.getThemeColors();

    // 1. Bar Chart: Bins Needing Pickup Per State
    this.renderNeedingPickupChart(needing_pickup_by_state, theme);

    // 2. Line Chart: Collections Per Day (Last 7 Days)
    this.renderCollectionsChart(collections_last_7_days, theme);

    // 3. Doughnut Chart: Complaints by Type
    this.renderComplaintsChart(complaints_by_type, theme);

    // 4. Bar Chart: Average Fill Level Per State
    this.renderAvgFillChart(avg_fill_by_state, theme);
  },

  renderNeedingPickupChart(data = [], theme) {
    const ctx = document.getElementById('chart-needing-pickup');
    if (!ctx) return;

    if (this.chartNeedingPickup) {
      this.chartNeedingPickup.destroy();
    }

    const labels = data.map(d => d.state);
    const counts = data.map(d => d.count);

    this.chartNeedingPickup = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels.length > 0 ? labels : ['No Data'],
        datasets: [
          {
            label: 'Bins Needing Pickup',
            data: counts.length > 0 ? counts : [0],
            backgroundColor: '#ef4444',
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { enabled: true }
        },
        scales: {
          x: {
            ticks: { color: theme.textColor, font: { size: 10 } },
            grid: { display: false }
          },
          y: {
            beginAtZero: true,
            ticks: { color: theme.textColor, stepSize: 1 },
            grid: { color: theme.gridColor }
          }
        }
      }
    });
  },

  renderCollectionsChart(data = [], theme) {
    const ctx = document.getElementById('chart-collections');
    if (!ctx) return;

    if (this.chartCollections) {
      this.chartCollections.destroy();
    }

    // Default last 7 days labels if empty
    const labels = data.length > 0 ? data.map(d => d.date) : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const counts = data.length > 0 ? data.map(d => d.count) : [0, 0, 0, 0, 0, 0, 0];

    this.chartCollections = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Collections',
            data: counts,
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.15)',
            fill: true,
            tension: 0.35,
            pointRadius: 4,
            pointBackgroundColor: '#0f766e'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: {
            ticks: { color: theme.textColor, font: { size: 10 } },
            grid: { display: false }
          },
          y: {
            beginAtZero: true,
            ticks: { color: theme.textColor, stepSize: 1 },
            grid: { color: theme.gridColor }
          }
        }
      }
    });
  },

  renderComplaintsChart(data = [], theme) {
    const ctx = document.getElementById('chart-complaints');
    if (!ctx) return;

    if (this.chartComplaints) {
      this.chartComplaints.destroy();
    }

    const defaultTypes = ['Overflow', 'Missed pickup', 'Damaged bin', 'Other'];
    const labels = data.length > 0 ? data.map(d => d.type) : defaultTypes;
    const counts = data.length > 0 ? data.map(d => d.count) : [0, 0, 0, 0];

    this.chartComplaints = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [
          {
            data: counts,
            backgroundColor: ['#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6'],
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: { color: theme.textColor, boxWidth: 12, font: { size: 11 } }
          }
        },
        cutout: '65%'
      }
    });
  },

  renderAvgFillChart(data = [], theme) {
    const ctx = document.getElementById('chart-avg-fill');
    if (!ctx) return;

    if (this.chartAvgFill) {
      this.chartAvgFill.destroy();
    }

    const labels = data.map(d => d.state);
    const fills = data.map(d => d.avg_fill);

    this.chartAvgFill = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels.length > 0 ? labels : ['No Data'],
        datasets: [
          {
            label: 'Avg Fill %',
            data: fills.length > 0 ? fills : [0],
            backgroundColor: '#0d9488',
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: {
            ticks: { color: theme.textColor, font: { size: 10 } },
            grid: { display: false }
          },
          y: {
            beginAtZero: true,
            max: 100,
            ticks: {
              color: theme.textColor,
              callback: value => value + '%'
            },
            grid: { color: theme.gridColor }
          }
        }
      }
    });
  },

  updateTheme() {
    if (window.App && typeof window.App.refreshStats === 'function') {
      window.App.refreshStats();
    }
  }
};
