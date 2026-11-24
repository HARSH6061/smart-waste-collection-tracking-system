const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Geographic Bounds for India
const INDIA_BOUNDS = {
  minLat: 6.0,
  maxLat: 37.5,
  minLng: 68.0,
  maxLng: 97.5
};

function validateCoordinates(lat, lng) {
  const numLat = parseFloat(lat);
  const numLng = parseFloat(lng);
  if (isNaN(numLat) || isNaN(numLng)) {
    return 'Latitude and Longitude must be valid numbers.';
  }
  if (numLat < -90 || numLat > 90 || numLng < -180 || numLng > 180) {
    return 'Latitude must be between -90 and 90, Longitude between -180 and 180.';
  }
  if (
    numLat < INDIA_BOUNDS.minLat ||
    numLat > INDIA_BOUNDS.maxLat ||
    numLng < INDIA_BOUNDS.minLng ||
    numLng > INDIA_BOUNDS.maxLng
  ) {
    return `Coordinates (${numLat.toFixed(4)}, ${numLng.toFixed(4)}) fall outside India geographic bounds (${INDIA_BOUNDS.minLat}°N - ${INDIA_BOUNDS.maxLat}°N, ${INDIA_BOUNDS.minLng}°E - ${INDIA_BOUNDS.maxLng}°E).`;
  }
  return null;
}

function validateIndianPhone(phone) {
  if (!phone || typeof phone !== 'string') return false;
  const cleanPhone = phone.trim().replace(/^(\+91|91|0)/, '');
  return /^[6-9]\d{9}$/.test(cleanPhone);
}

// Haversine Distance (in kilometers)
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// -------------------------------------------------------------
// BINS API
// -------------------------------------------------------------

// GET /api/bins
app.get('/api/bins', (req, res) => {
  try {
    const { state, needing_pickup } = req.query;
    let query = 'SELECT * FROM bins WHERE 1=1';
    const params = [];

    if (state && state.trim()) {
      query += ' AND state = ?';
      params.push(state.trim());
    }

    if (needing_pickup === 'true') {
      query += ' AND fill_percent >= threshold';
    }

    query += ' ORDER BY id DESC';
    const bins = db.prepare(query).all(...params);
    res.json(bins);
  } catch (err) {
    console.error('Error fetching bins:', err);
    res.status(500).json({ error: 'Failed to retrieve bins.' });
  }
});

// POST /api/bins
app.post('/api/bins', (req, res) => {
  try {
    const { name, state, city, lat, lng, height_cm, threshold } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Bin name/ID is required.' });
    }
    if (!state || !state.trim()) {
      return res.status(400).json({ error: 'State is required.' });
    }
    if (!city || !city.trim()) {
      return res.status(400).json({ error: 'City/Area is required.' });
    }

    const coordError = validateCoordinates(lat, lng);
    if (coordError) {
      return res.status(400).json({ error: coordError });
    }

    const numHeight = parseFloat(height_cm) || 100;
    const numThreshold = parseFloat(threshold) || 80;

    if (numHeight <= 0) {
      return res.status(400).json({ error: 'Bin height must be a positive number.' });
    }
    if (numThreshold <= 0 || numThreshold > 100) {
      return res.status(400).json({ error: 'Pickup threshold must be between 1% and 100%.' });
    }

    const stmt = db.prepare(`
      INSERT INTO bins (name, state, city, lat, lng, height_cm, threshold, fill_percent)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0)
    `);
    const info = stmt.run(
      name.trim(),
      state.trim(),
      city.trim(),
      parseFloat(lat),
      parseFloat(lng),
      numHeight,
      numThreshold
    );

    const newBin = db.prepare('SELECT * FROM bins WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(newBin);
  } catch (err) {
    console.error('Error creating bin:', err);
    res.status(500).json({ error: 'Failed to create bin.' });
  }
});

// GET /api/bins/:id
app.get('/api/bins/:id', (req, res) => {
  try {
    const bin = db.prepare('SELECT * FROM bins WHERE id = ?').get(req.params.id);
    if (!bin) {
      return res.status(404).json({ error: 'Bin not found.' });
    }
    res.json(bin);
  } catch (err) {
    console.error('Error fetching bin:', err);
    res.status(500).json({ error: 'Failed to retrieve bin details.' });
  }
});

// PUT /api/bins/:id
app.put('/api/bins/:id', (req, res) => {
  try {
    const { name, state, city, lat, lng, height_cm, threshold } = req.body;
    const binId = req.params.id;

    const existing = db.prepare('SELECT * FROM bins WHERE id = ?').get(binId);
    if (!existing) {
      return res.status(404).json({ error: 'Bin not found.' });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Bin name/ID is required.' });
    }
    if (!state || !state.trim()) {
      return res.status(400).json({ error: 'State is required.' });
    }
    if (!city || !city.trim()) {
      return res.status(400).json({ error: 'City/Area is required.' });
    }

    const coordError = validateCoordinates(lat, lng);
    if (coordError) {
      return res.status(400).json({ error: coordError });
    }

    const numHeight = parseFloat(height_cm) || existing.height_cm;
    const numThreshold = parseFloat(threshold) || existing.threshold;

    if (numHeight <= 0) {
      return res.status(400).json({ error: 'Bin height must be a positive number.' });
    }
    if (numThreshold <= 0 || numThreshold > 100) {
      return res.status(400).json({ error: 'Pickup threshold must be between 1% and 100%.' });
    }

    db.prepare(`
      UPDATE bins
      SET name = ?, state = ?, city = ?, lat = ?, lng = ?, height_cm = ?, threshold = ?
      WHERE id = ?
    `).run(
      name.trim(),
      state.trim(),
      city.trim(),
      parseFloat(lat),
      parseFloat(lng),
      numHeight,
      numThreshold,
      binId
    );

    const updated = db.prepare('SELECT * FROM bins WHERE id = ?').get(binId);
    res.json(updated);
  } catch (err) {
    console.error('Error updating bin:', err);
    res.status(500).json({ error: 'Failed to update bin.' });
  }
});

// DELETE /api/bins/:id
app.get('/api/bins/:id/readings', (req, res) => {
  try {
    const readings = db
      .prepare('SELECT * FROM readings WHERE bin_id = ? ORDER BY id DESC LIMIT 50')
      .all(req.params.id);
    res.json(readings);
  } catch (err) {
    console.error('Error fetching readings:', err);
    res.status(500).json({ error: 'Failed to retrieve readings.' });
  }
});

// POST /api/bins/:id/readings
app.post('/api/bins/:id/readings', (req, res) => {
  try {
    const binId = req.params.id;
    const { distance_cm } = req.body;

    const bin = db.prepare('SELECT * FROM bins WHERE id = ?').get(binId);
    if (!bin) {
      return res.status(404).json({ error: 'Bin not found.' });
    }

    const dist = parseFloat(distance_cm);
    if (isNaN(dist) || dist < 0) {
      return res.status(400).json({ error: 'Distance must be a non-negative number.' });
    }
    if (dist > bin.height_cm) {
      return res.status(400).json({
        error: `Ultrasonic distance (${dist} cm) cannot exceed bin height (${bin.height_cm} cm).`
      });
    }

    // fill % = (binHeight - distance) / binHeight * 100
    const rawFill = ((bin.height_cm - dist) / bin.height_cm) * 100;
    const fillPercent = Math.max(0, Math.min(100, Math.round(rawFill * 10) / 10));

    const insertReading = db.transaction(() => {
      const readingStmt = db.prepare(`
        INSERT INTO readings (bin_id, distance_cm, fill_percent)
        VALUES (?, ?, ?)
      `);
      const info = readingStmt.run(binId, dist, fillPercent);

      db.prepare(`
        UPDATE bins
        SET fill_percent = ?
        WHERE id = ?
      `).run(fillPercent, binId);

      return info.lastInsertRowid;
    });

    const readingId = insertReading();
    const reading = db.prepare('SELECT * FROM readings WHERE id = ?').get(readingId);
    const updatedBin = db.prepare('SELECT * FROM bins WHERE id = ?').get(binId);

    res.status(201).json({
      reading,
      bin: updatedBin,
      message: `Reading logged successfully. Bin fill level is now ${fillPercent}%.`
    });
  } catch (err) {
    console.error('Error logging reading:', err);
    res.status(500).json({ error: 'Failed to record bin reading.' });
  }
});

app.delete('/api/bins/:id', (req, res) => {
  try {
    const bin = db.prepare('SELECT * FROM bins WHERE id = ?').get(req.params.id);
    if (!bin) {
      return res.status(404).json({ error: 'Bin not found.' });
    }

    db.prepare('DELETE FROM bins WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: `Bin "${bin.name}" deleted successfully.` });
  } catch (err) {
    console.error('Error deleting bin:', err);
    res.status(500).json({ error: 'Failed to delete bin.' });
  }
});

// -------------------------------------------------------------
// TRUCKS API
// -------------------------------------------------------------

// GET /api/trucks
app.get('/api/trucks', (req, res) => {
  try {
    const trucks = db.prepare('SELECT * FROM trucks ORDER BY id DESC').all();
    res.json(trucks);
  } catch (err) {
    console.error('Error fetching trucks:', err);
    res.status(500).json({ error: 'Failed to retrieve trucks.' });
  }
});

// POST /api/trucks
app.post('/api/trucks', (req, res) => {
  try {
    const { number, driver_name, driver_phone, capacity_kg, lat, lng } = req.body;

    if (!number || !number.trim()) {
      return res.status(400).json({ error: 'Truck registration number is required.' });
    }
    if (!driver_name || !driver_name.trim()) {
      return res.status(400).json({ error: 'Driver name is required.' });
    }
    if (!validateIndianPhone(driver_phone)) {
      return res.status(400).json({
        error: 'Driver phone must be a valid 10-digit Indian mobile number starting with 6-9.'
      });
    }

    const numCapacity = parseFloat(capacity_kg);
    if (isNaN(numCapacity) || numCapacity <= 0) {
      return res.status(400).json({ error: 'Capacity must be a positive number in kg.' });
    }

    const coordError = validateCoordinates(lat, lng);
    if (coordError) {
      return res.status(400).json({ error: coordError });
    }

    const createTruckTx = db.transaction(() => {
      const stmt = db.prepare(`
        INSERT INTO trucks (number, driver_name, driver_phone, capacity_kg, lat, lng)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      const info = stmt.run(
        number.trim().toUpperCase(),
        driver_name.trim(),
        driver_phone.trim(),
        numCapacity,
        parseFloat(lat),
        parseFloat(lng)
      );

      // Record starting GPS history
      db.prepare(`
        INSERT INTO gps_history (truck_id, lat, lng)
        VALUES (?, ?, ?)
      `).run(info.lastInsertRowid, parseFloat(lat), parseFloat(lng));

      return info.lastInsertRowid;
    });

    const truckId = createTruckTx();
    const newTruck = db.prepare('SELECT * FROM trucks WHERE id = ?').get(truckId);
    res.status(201).json(newTruck);
  } catch (err) {
    console.error('Error creating truck:', err);
    res.status(500).json({ error: 'Failed to create truck.' });
  }
});

// GET /api/trucks/:id
app.get('/api/trucks/:id', (req, res) => {
  try {
    const truck = db.prepare('SELECT * FROM trucks WHERE id = ?').get(req.params.id);
    if (!truck) {
      return res.status(404).json({ error: 'Truck not found.' });
    }
    res.json(truck);
  } catch (err) {
    console.error('Error fetching truck:', err);
    res.status(500).json({ error: 'Failed to retrieve truck.' });
  }
});

// PUT /api/trucks/:id
app.put('/api/trucks/:id', (req, res) => {
  try {
    const truckId = req.params.id;
    const existing = db.prepare('SELECT * FROM trucks WHERE id = ?').get(truckId);
    if (!existing) {
      return res.status(404).json({ error: 'Truck not found.' });
    }

    const { number, driver_name, driver_phone, capacity_kg } = req.body;

    if (!number || !number.trim()) {
      return res.status(400).json({ error: 'Truck number is required.' });
    }
    if (!driver_name || !driver_name.trim()) {
      return res.status(400).json({ error: 'Driver name is required.' });
    }
    if (!validateIndianPhone(driver_phone)) {
      return res.status(400).json({
        error: 'Driver phone must be a valid 10-digit Indian mobile number starting with 6-9.'
      });
    }

    const numCapacity = parseFloat(capacity_kg) || existing.capacity_kg;
    if (numCapacity <= 0) {
      return res.status(400).json({ error: 'Capacity must be a positive number in kg.' });
    }

    db.prepare(`
      UPDATE trucks
      SET number = ?, driver_name = ?, driver_phone = ?, capacity_kg = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(number.trim().toUpperCase(), driver_name.trim(), driver_phone.trim(), numCapacity, truckId);

    const updated = db.prepare('SELECT * FROM trucks WHERE id = ?').get(truckId);
    res.json(updated);
  } catch (err) {
    console.error('Error updating truck:', err);
    res.status(500).json({ error: 'Failed to update truck.' });
  }
});

// DELETE /api/trucks/:id
app.delete('/api/trucks/:id', (req, res) => {
  try {
    const truckId = req.params.id;
    const truck = db.prepare('SELECT * FROM trucks WHERE id = ?').get(truckId);
    if (!truck) {
      return res.status(404).json({ error: 'Truck not found.' });
    }

    db.prepare('DELETE FROM trucks WHERE id = ?').run(truckId);
    res.json({ success: true, message: `Truck ${truck.number} deleted successfully.` });
  } catch (err) {
    console.error('Error deleting truck:', err);
    res.status(500).json({ error: 'Failed to delete truck.' });
  }
});

// POST /api/trucks/:id/location
app.post('/api/trucks/:id/location', (req, res) => {
  try {
    const truckId = req.params.id;
    const { lat, lng } = req.body;

    const truck = db.prepare('SELECT * FROM trucks WHERE id = ?').get(truckId);
    if (!truck) {
      return res.status(404).json({ error: 'Truck not found.' });
    }

    const coordError = validateCoordinates(lat, lng);
    if (coordError) {
      return res.status(400).json({ error: coordError });
    }

    const numLat = parseFloat(lat);
    const numLng = parseFloat(lng);

    const updateTx = db.transaction(() => {
      db.prepare(`
        UPDATE trucks
        SET lat = ?, lng = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(numLat, numLng, truckId);

      db.prepare(`
        INSERT INTO gps_history (truck_id, lat, lng)
        VALUES (?, ?, ?)
      `).run(truckId, numLat, numLng);
    });

    updateTx();

    const updatedTruck = db.prepare('SELECT * FROM trucks WHERE id = ?').get(truckId);
    res.json({
      truck: updatedTruck,
      message: `GPS location updated for Truck ${updatedTruck.number}.`
    });
  } catch (err) {
    console.error('Error updating truck location:', err);
    res.status(500).json({ error: 'Failed to update truck location.' });
  }
});

// GET /api/trucks/:id/history
app.get('/api/trucks/:id/history', (req, res) => {
  try {
    const truckId = req.params.id;
    const truck = db.prepare('SELECT * FROM trucks WHERE id = ?').get(truckId);
    if (!truck) {
      return res.status(404).json({ error: 'Truck not found.' });
    }

    const history = db
      .prepare('SELECT * FROM gps_history WHERE truck_id = ? ORDER BY id ASC')
      .all(truckId);

    res.json({
      truck,
      points: history.map(h => ({
        id: h.id,
        lat: h.lat,
        lng: h.lng,
        created_at: h.created_at
      }))
    });
  } catch (err) {
    console.error('Error retrieving GPS history:', err);
    res.status(500).json({ error: 'Failed to retrieve GPS history.' });
  }
});

// -------------------------------------------------------------
// ROUTE PLANNER API
// -------------------------------------------------------------

// POST /api/routes/plan
app.post('/api/routes/plan', (req, res) => {
  try {
    const { truck_id, state, speed_kmh } = req.body;

    if (!truck_id) {
      return res.status(400).json({ error: 'Please select a truck to plan the route.' });
    }

    const truck = db.prepare('SELECT * FROM trucks WHERE id = ?').get(truck_id);
    if (!truck) {
      return res.status(404).json({ error: 'Truck not found.' });
    }

    const avgSpeed = parseFloat(speed_kmh) > 0 ? parseFloat(speed_kmh) : 25;

    // Find all bins at or above their pickup threshold
    let binQuery = 'SELECT * FROM bins WHERE fill_percent >= threshold';
    const params = [];

    if (state && state.trim()) {
      binQuery += ' AND state = ?';
      params.push(state.trim());
    }

    const fullBins = db.prepare(binQuery).all(...params);

    if (fullBins.length === 0) {
      return res.json({
        truck,
        stops: [],
        distance_km: 0,
        eta_minutes: 0,
        speed_kmh: avgSpeed,
        message: 'No bins currently need pickup in the selected region.'
      });
    }

    // Nearest-Neighbour ordering starting from Truck location
    const unvisited = [...fullBins];
    const orderedStops = [];
    let currentPoint = { lat: truck.lat, lng: truck.lng };

    while (unvisited.length > 0) {
      let nearestIndex = 0;
      let minDistance = Infinity;

      for (let i = 0; i < unvisited.length; i++) {
        const d = haversineDistance(
          currentPoint.lat,
          currentPoint.lng,
          unvisited[i].lat,
          unvisited[i].lng
        );
        if (d < minDistance) {
          minDistance = d;
          nearestIndex = i;
        }
      }

      const nextBin = unvisited.splice(nearestIndex, 1)[0];
      orderedStops.push(nextBin);
      currentPoint = { lat: nextBin.lat, lng: nextBin.lng };
    }

    // 2-opt pass for route improvement
    // Total tour nodes: [Truck, stop_1, stop_2, ..., stop_n]
    if (orderedStops.length > 2) {
      let improved = true;
      let iterations = 0;
      const maxIterations = 50;

      while (improved && iterations < maxIterations) {
        improved = false;
        iterations++;

        for (let i = 0; i < orderedStops.length - 1; i++) {
          for (let j = i + 1; j < orderedStops.length; j++) {
            const prevPoint = i === 0 ? { lat: truck.lat, lng: truck.lng } : orderedStops[i - 1];
            const currPoint = orderedStops[i];
            const nextPoint = orderedStops[j];
            const afterPoint = j + 1 < orderedStops.length ? orderedStops[j + 1] : null;

            // Current cost of (prev->curr) + (next->after)
            const currentDist =
              haversineDistance(prevPoint.lat, prevPoint.lng, currPoint.lat, currPoint.lng) +
              (afterPoint
                ? haversineDistance(nextPoint.lat, nextPoint.lng, afterPoint.lat, afterPoint.lng)
                : 0);

            // Cost if reversed: (prev->next) + (curr->after)
            const newDist =
              haversineDistance(prevPoint.lat, prevPoint.lng, nextPoint.lat, nextPoint.lng) +
              (afterPoint
                ? haversineDistance(currPoint.lat, currPoint.lng, afterPoint.lat, afterPoint.lng)
                : 0);

            if (newDist + 0.0001 < currentDist) {
              // Reverse subsegment between i and j
              const sub = orderedStops.slice(i, j + 1).reverse();
              orderedStops.splice(i, j - i + 1, ...sub);
              improved = true;
              break;
            }
          }
          if (improved) break;
        }
      }
    }

    // Compute total route distance
    let totalDistanceKm = 0;
    let prev = { lat: truck.lat, lng: truck.lng };
    for (const stop of orderedStops) {
      totalDistanceKm += haversineDistance(prev.lat, prev.lng, stop.lat, stop.lng);
      prev = { lat: stop.lat, lng: stop.lng };
    }

    totalDistanceKm = Math.round(totalDistanceKm * 100) / 100;
    const etaMinutes = Math.max(1, Math.round((totalDistanceKm / avgSpeed) * 60));

    // Save planned route to database
    const routeStmt = db.prepare(`
      INSERT INTO routes (truck_id, stops_json, distance_km, eta_minutes)
      VALUES (?, ?, ?, ?)
    `);
    const info = routeStmt.run(truck.id, JSON.stringify(orderedStops), totalDistanceKm, etaMinutes);

    res.json({
      id: info.lastInsertRowid,
      truck,
      stops: orderedStops.map((stop, idx) => ({
        stop_number: idx + 1,
        ...stop
      })),
      distance_km: totalDistanceKm,
      eta_minutes: etaMinutes,
      speed_kmh: avgSpeed,
      created_at: new Date().toISOString()
    });
  } catch (err) {
    console.error('Error planning route:', err);
    res.status(500).json({ error: 'Failed to compute route.' });
  }
});

// GET /api/routes/latest/:truck_id
app.get('/api/routes/latest/:truck_id', (req, res) => {
  try {
    const route = db
      .prepare('SELECT * FROM routes WHERE truck_id = ? ORDER BY id DESC LIMIT 1')
      .get(req.params.truck_id);

    if (!route) {
      return res.status(404).json({ error: 'No recent route found for this truck.' });
    }

    const truck = db.prepare('SELECT * FROM trucks WHERE id = ?').get(req.params.truck_id);
    const stops = JSON.parse(route.stops_json || '[]');

    res.json({
      id: route.id,
      truck,
      stops: stops.map((s, idx) => ({ stop_number: idx + 1, ...s })),
      distance_km: route.distance_km,
      eta_minutes: route.eta_minutes,
      created_at: route.created_at
    });
  } catch (err) {
    console.error('Error fetching latest route:', err);
    res.status(500).json({ error: 'Failed to retrieve route.' });
  }
});

// -------------------------------------------------------------
// COLLECTIONS API
// -------------------------------------------------------------

// POST /api/collections
app.post('/api/collections', (req, res) => {
  try {
    const { bin_id, truck_id } = req.body;

    if (!bin_id) {
      return res.status(400).json({ error: 'Bin ID is required to mark collected.' });
    }

    const bin = db.prepare('SELECT * FROM bins WHERE id = ?').get(bin_id);
    if (!bin) {
      return res.status(404).json({ error: 'Bin not found.' });
    }

    let truck = null;
    if (truck_id) {
      truck = db.prepare('SELECT * FROM trucks WHERE id = ?').get(truck_id);
    }

    const collectTx = db.transaction(() => {
      // 1. Reset bin fill percent to 0
      db.prepare(`
        UPDATE bins
        SET fill_percent = 0
        WHERE id = ?
      `).run(bin_id);

      // 2. Add an ultrasonic reading showing bin is empty (distance = height)
      db.prepare(`
        INSERT INTO readings (bin_id, distance_cm, fill_percent)
        VALUES (?, ?, 0)
      `).run(bin_id, bin.height_cm);

      // 3. Log a collection record
      const colStmt = db.prepare(`
        INSERT INTO collections (bin_id, truck_id, state)
        VALUES (?, ?, ?)
      `);
      const info = colStmt.run(bin_id, truck_id || null, bin.state);

      return info.lastInsertRowid;
    });

    const collectionId = collectTx();
    const updatedBin = db.prepare('SELECT * FROM bins WHERE id = ?').get(bin_id);

    res.status(201).json({
      success: true,
      collection_id: collectionId,
      bin: updatedBin,
      truck,
      message: `Bin "${bin.name}" collected successfully. Fill level reset to 0%.`
    });
  } catch (err) {
    console.error('Error recording collection:', err);
    res.status(500).json({ error: 'Failed to record collection.' });
  }
});

// GET /api/collections
app.get('/api/collections', (req, res) => {
  try {
    const { state } = req.query;
    let query = `
      SELECT c.*, b.name AS bin_name, b.city AS bin_city, t.number AS truck_number, t.driver_name
      FROM collections c
      LEFT JOIN bins b ON c.bin_id = b.id
      LEFT JOIN trucks t ON c.truck_id = t.id
      WHERE 1=1
    `;
    const params = [];

    if (state && state.trim()) {
      query += ' AND c.state = ?';
      params.push(state.trim());
    }

    query += ' ORDER BY c.id DESC LIMIT 100';
    const collections = db.prepare(query).all(...params);
    res.json(collections);
  } catch (err) {
    console.error('Error fetching collections:', err);
    res.status(500).json({ error: 'Failed to retrieve collection history.' });
  }
});

// -------------------------------------------------------------
// CITIZEN COMPLAINTS API
// -------------------------------------------------------------

// GET /api/complaints
app.get('/api/complaints', (req, res) => {
  try {
    const { state, status } = req.query;
    let query = `
      SELECT c.*, b.name AS bin_name
      FROM complaints c
      LEFT JOIN bins b ON c.bin_id = b.id
      WHERE 1=1
    `;
    const params = [];

    if (state && state.trim()) {
      query += ' AND c.state = ?';
      params.push(state.trim());
    }

    if (status && status.trim()) {
      query += ' AND c.status = ?';
      params.push(status.trim());
    }

    query += ' ORDER BY c.id DESC';
    const complaints = db.prepare(query).all(...params);
    res.json(complaints);
  } catch (err) {
    console.error('Error fetching complaints:', err);
    res.status(500).json({ error: 'Failed to retrieve complaints.' });
  }
});

// POST /api/complaints
app.post('/api/complaints', (req, res) => {
  try {
    const { name, phone, state, city, bin_id, type, description, lat, lng } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Citizen name is required.' });
    }
    if (!validateIndianPhone(phone)) {
      return res.status(400).json({
        error: 'Phone must be a valid 10-digit Indian mobile number starting with 6-9.'
      });
    }
    if (!state || !state.trim()) {
      return res.status(400).json({ error: 'State is required.' });
    }
    if (!city || !city.trim()) {
      return res.status(400).json({ error: 'City is required.' });
    }

    const validTypes = ['Overflow', 'Missed pickup', 'Damaged bin', 'Other'];
    if (!type || !validTypes.includes(type)) {
      return res.status(400).json({
        error: `Complaint type must be one of: ${validTypes.join(', ')}.`
      });
    }

    if (!description || !description.trim()) {
      return res.status(400).json({ error: 'Complaint description is required.' });
    }

    let parsedLat = null;
    let parsedLng = null;
    if (lat !== undefined && lat !== '' && lng !== undefined && lng !== '') {
      const coordError = validateCoordinates(lat, lng);
      if (coordError) {
        return res.status(400).json({ error: coordError });
      }
      parsedLat = parseFloat(lat);
      parsedLng = parseFloat(lng);
    }

    let parsedBinId = null;
    if (bin_id) {
      const b = db.prepare('SELECT id FROM bins WHERE id = ?').get(bin_id);
      if (b) parsedBinId = b.id;
    }

    const stmt = db.prepare(`
      INSERT INTO complaints (name, phone, state, city, bin_id, type, description, lat, lng, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Open')
    `);
    const info = stmt.run(
      name.trim(),
      phone.trim(),
      state.trim(),
      city.trim(),
      parsedBinId,
      type,
      description.trim(),
      parsedLat,
      parsedLng
    );

    const newComplaint = db.prepare('SELECT * FROM complaints WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(newComplaint);
  } catch (err) {
    console.error('Error creating complaint:', err);
    res.status(500).json({ error: 'Failed to submit complaint.' });
  }
});

// PUT /api/complaints/:id
app.put('/api/complaints/:id', (req, res) => {
  try {
    const complaintId = req.params.id;
    const complaint = db.prepare('SELECT * FROM complaints WHERE id = ?').get(complaintId);
    if (!complaint) {
      return res.status(404).json({ error: 'Complaint not found.' });
    }

    const { status, description, type } = req.body;
    const validStatuses = ['Open', 'In progress', 'Resolved'];

    const newStatus = status && validStatuses.includes(status) ? status : complaint.status;
    const newDesc = description && description.trim() ? description.trim() : complaint.description;
    const newType = type || complaint.type;

    db.prepare(`
      UPDATE complaints
      SET status = ?, description = ?, type = ?
      WHERE id = ?
    `).run(newStatus, newDesc, newType, complaintId);

    const updated = db.prepare('SELECT * FROM complaints WHERE id = ?').get(complaintId);
    res.json(updated);
  } catch (err) {
    console.error('Error updating complaint:', err);
    res.status(500).json({ error: 'Failed to update complaint.' });
  }
});

// DELETE /api/complaints/:id
app.delete('/api/complaints/:id', (req, res) => {
  try {
    const complaintId = req.params.id;
    const complaint = db.prepare('SELECT * FROM complaints WHERE id = ?').get(complaintId);
    if (!complaint) {
      return res.status(404).json({ error: 'Complaint not found.' });
    }

    db.prepare('DELETE FROM complaints WHERE id = ?').run(complaintId);
    res.json({ success: true, message: 'Complaint deleted successfully.' });
  } catch (err) {
    console.error('Error deleting complaint:', err);
    res.status(500).json({ error: 'Failed to delete complaint.' });
  }
});

// -------------------------------------------------------------
// DASHBOARD & ANALYTICS API
// -------------------------------------------------------------

// GET /api/stats
app.get('/api/stats', (req, res) => {
  try {
    const totalBins = db.prepare('SELECT COUNT(*) AS count FROM bins').get().count;
    const binsNeedingPickup = db
      .prepare('SELECT COUNT(*) AS count FROM bins WHERE fill_percent >= threshold')
      .get().count;
    const activeTrucks = db.prepare('SELECT COUNT(*) AS count FROM trucks').get().count;
    const openComplaints = db
      .prepare("SELECT COUNT(*) AS count FROM complaints WHERE status = 'Open'")
      .get().count;
    const totalCollections = db.prepare('SELECT COUNT(*) AS count FROM collections').get().count;
    const totalDistancePlanned =
      db.prepare('SELECT COALESCE(SUM(distance_km), 0) AS total FROM routes').get().total || 0;

    // Chart 1: Bins needing pickup per state
    const needingPickupByState = db
      .prepare(`
        SELECT state, COUNT(*) AS count
        FROM bins
        WHERE fill_percent >= threshold
        GROUP BY state
        ORDER BY count DESC
        LIMIT 10
      `)
      .all();

    // Chart 2: Collections per day for the last 7 days
    const collectionsLast7Days = db
      .prepare(`
        SELECT strftime('%Y-%m-%d', collected_at) AS date, COUNT(*) AS count
        FROM collections
        WHERE collected_at >= datetime('now', '-7 days')
        GROUP BY strftime('%Y-%m-%d', collected_at)
        ORDER BY date ASC
      `)
      .all();

    // Chart 3: Complaints by type
    const complaintsByType = db
      .prepare(`
        SELECT type, COUNT(*) AS count
        FROM complaints
        GROUP BY type
        ORDER BY count DESC
      `)
      .all();

    // Chart 4: Average fill level per state
    const avgFillByState = db
      .prepare(`
        SELECT state, ROUND(AVG(fill_percent), 1) AS avg_fill
        FROM bins
        GROUP BY state
        ORDER BY avg_fill DESC
        LIMIT 10
      `)
      .all();

    res.json({
      summary: {
        total_bins: totalBins,
        bins_needing_pickup: binsNeedingPickup,
        active_trucks: activeTrucks,
        open_complaints: openComplaints,
        total_collections: totalCollections,
        total_distance_km: Math.round(totalDistancePlanned * 10) / 10
      },
      charts: {
        needing_pickup_by_state: needingPickupByState,
        collections_last_7_days: collectionsLast7Days,
        complaints_by_type: complaintsByType,
        avg_fill_by_state: avgFillByState
      }
    });
  } catch (err) {
    console.error('Error fetching stats:', err);
    res.status(500).json({ error: 'Failed to retrieve statistics.' });
  }
});

// -------------------------------------------------------------
// CSV EXPORT API
// -------------------------------------------------------------

function escapeCsvField(val) {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

// GET /api/export/:type
app.get('/api/export/:type', (req, res) => {
  try {
    const { type } = req.params;

    if (type === 'bins') {
      const rows = db.prepare('SELECT * FROM bins ORDER BY id ASC').all();
      const headers = [
        'ID',
        'Name',
        'State',
        'City',
        'Latitude',
        'Longitude',
        'Height (cm)',
        'Threshold (%)',
        'Fill (%)',
        'Created At'
      ];
      let csv = headers.join(',') + '\n';
      rows.forEach(r => {
        csv +=
          [
            r.id,
            escapeCsvField(r.name),
            escapeCsvField(r.state),
            escapeCsvField(r.city),
            r.lat,
            r.lng,
            r.height_cm,
            r.threshold,
            r.fill_percent,
            escapeCsvField(r.created_at)
          ].join(',') + '\n';
      });

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="bins_export.csv"');
      return res.send(csv);
    }

    if (type === 'collections') {
      const rows = db
        .prepare(`
          SELECT c.*, b.name AS bin_name, t.number AS truck_number
          FROM collections c
          LEFT JOIN bins b ON c.bin_id = b.id
          LEFT JOIN trucks t ON c.truck_id = t.id
          ORDER BY c.id ASC
        `)
        .all();
      const headers = ['Collection ID', 'Bin ID', 'Bin Name', 'Truck Number', 'State', 'Collected At'];
      let csv = headers.join(',') + '\n';
      rows.forEach(r => {
        csv +=
          [
            r.id,
            r.bin_id,
            escapeCsvField(r.bin_name),
            escapeCsvField(r.truck_number),
            escapeCsvField(r.state),
            escapeCsvField(r.collected_at)
          ].join(',') + '\n';
      });

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="collections_export.csv"');
      return res.send(csv);
    }

    if (type === 'complaints') {
      const rows = db
        .prepare(`
          SELECT c.*, b.name AS bin_name
          FROM complaints c
          LEFT JOIN bins b ON c.bin_id = b.id
          ORDER BY c.id ASC
        `)
        .all();
      const headers = [
        'ID',
        'Citizen Name',
        'Phone',
        'State',
        'City',
        'Bin ID',
        'Type',
        'Description',
        'Latitude',
        'Longitude',
        'Status',
        'Created At'
      ];
      let csv = headers.join(',') + '\n';
      rows.forEach(r => {
        csv +=
          [
            r.id,
            escapeCsvField(r.name),
            escapeCsvField(r.phone),
            escapeCsvField(r.state),
            escapeCsvField(r.city),
            r.bin_id || '',
            escapeCsvField(r.type),
            escapeCsvField(r.description),
            r.lat !== null ? r.lat : '',
            r.lng !== null ? r.lng : '',
            escapeCsvField(r.status),
            escapeCsvField(r.created_at)
          ].join(',') + '\n';
      });

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="complaints_export.csv"');
      return res.send(csv);
    }

    res.status(400).json({ error: 'Invalid export type. Valid types: bins, collections, complaints.' });
  } catch (err) {
    console.error('Error generating CSV export:', err);
    res.status(500).json({ error: 'Failed to generate export file.' });
  }
});

// -------------------------------------------------------------
// DEMO DATA & RESET API (Explicitly user-triggered only)
// -------------------------------------------------------------

app.post('/api/demo-data', (req, res) => {
  try {
    const seedTx = db.transaction(() => {
      // 1. Seed sample bins across India
      const binStmt = db.prepare(`
        INSERT INTO bins (name, state, city, lat, lng, height_cm, threshold, fill_percent)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const b1 = binStmt.run('BIN-MUM-01', 'Maharashtra', 'Mumbai - Bandra West', 19.0596, 72.8295, 100, 80, 85).lastInsertRowid;
      const b2 = binStmt.run('BIN-MUM-02', 'Maharashtra', 'Mumbai - Andheri East', 19.1136, 72.8697, 100, 80, 92).lastInsertRowid;
      const b3 = binStmt.run('BIN-DEL-01', 'Delhi', 'New Delhi - Connaught Place', 28.6315, 77.2167, 120, 75, 80).lastInsertRowid;
      const b4 = binStmt.run('BIN-BLR-01', 'Karnataka', 'Bengaluru - Indiranagar', 12.9784, 77.6408, 100, 80, 45).lastInsertRowid;
      const b5 = binStmt.run('BIN-CHN-01', 'Tamil Nadu', 'Chennai - T. Nagar', 13.0418, 80.2341, 100, 75, 88).lastInsertRowid;
      const b6 = binStmt.run('BIN-KOL-01', 'West Bengal', 'Kolkata - Salt Lake Sector V', 22.5804, 88.4378, 110, 80, 30).lastInsertRowid;

      // Seed readings
      const readStmt = db.prepare(`
        INSERT INTO readings (bin_id, distance_cm, fill_percent)
        VALUES (?, ?, ?)
      `);
      readStmt.run(b1, 15, 85);
      readStmt.run(b2, 8, 92);
      readStmt.run(b3, 24, 80);
      readStmt.run(b4, 55, 45);
      readStmt.run(b5, 12, 88);
      readStmt.run(b6, 77, 30);

      // 2. Seed Trucks
      const truckStmt = db.prepare(`
        INSERT INTO trucks (number, driver_name, driver_phone, capacity_kg, lat, lng)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      const t1 = truckStmt.run('MH-02-CW-4921', 'Ramesh Patil', '9820112233', 3500, 19.0760, 72.8777).lastInsertRowid;
      const t2 = truckStmt.run('DL-01-GA-8172', 'Suresh Kumar', '9811223344', 4000, 28.6139, 77.2090).lastInsertRowid;
      const t3 = truckStmt.run('KA-05-MK-9910', 'Anand Rao', '9845012345', 3000, 12.9716, 77.5946).lastInsertRowid;

      // Truck GPS history
      const gpsStmt = db.prepare(`
        INSERT INTO gps_history (truck_id, lat, lng)
        VALUES (?, ?, ?)
      `);
      gpsStmt.run(t1, 19.0700, 72.8600);
      gpsStmt.run(t1, 19.0730, 72.8700);
      gpsStmt.run(t1, 19.0760, 72.8777);

      gpsStmt.run(t2, 28.6050, 77.2000);
      gpsStmt.run(t2, 28.6139, 77.2090);

      // 3. Seed Collections
      const colStmt = db.prepare(`
        INSERT INTO collections (bin_id, truck_id, state, collected_at)
        VALUES (?, ?, ?, datetime('now', ?))
      `);
      colStmt.run(b1, t1, 'Maharashtra', '-2 days');
      colStmt.run(b2, t1, 'Maharashtra', '-1 days');
      colStmt.run(b3, t2, 'Delhi', '-6 hours');

      // 4. Seed Complaints
      const compStmt = db.prepare(`
        INSERT INTO complaints (name, phone, state, city, bin_id, type, description, lat, lng, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      compStmt.run(
        'Aakash Sharma',
        '9876543210',
        'Maharashtra',
        'Mumbai',
        b1,
        'Overflow',
        'Garbage bin overflowing near Hill Road market corner.',
        19.0596,
        72.8295,
        'Open'
      );
      compStmt.run(
        'Priya Verma',
        '9810123456',
        'Delhi',
        'New Delhi',
        b3,
        'Damaged bin',
        'The ultrasonic sensor lid is damaged and swinging loose.',
        28.6315,
        77.2167,
        'In progress'
      );
    });

    seedTx();
    res.json({ success: true, message: 'Demo data loaded successfully!' });
  } catch (err) {
    console.error('Error seeding demo data:', err);
    res.status(500).json({ error: 'Failed to load demo data.' });
  }
});

// POST /api/reset
app.post('/api/reset', (req, res) => {
  try {
    const resetTx = db.transaction(() => {
      db.prepare('DELETE FROM routes').run();
      db.prepare('DELETE FROM collections').run();
      db.prepare('DELETE FROM complaints').run();
      db.prepare('DELETE FROM gps_history').run();
      db.prepare('DELETE FROM readings').run();
      db.prepare('DELETE FROM bins').run();
      db.prepare('DELETE FROM trucks').run();
    });
    resetTx();
    res.json({ success: true, message: 'System database cleared to pristine state.' });
  } catch (err) {
    console.error('Error resetting database:', err);
    res.status(500).json({ error: 'Failed to reset database.' });
  }
});

// -------------------------------------------------------------
// HEALTH CHECK
// -------------------------------------------------------------
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Fallback for SPA/HTML
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Export app for serverless deployment (Vercel)
module.exports = app;

// Start Server locally or on traditional hosts
if (!process.env.VERCEL) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Smart Waste Collection Tracking Server running on http://localhost:${PORT}`);
  });
}
