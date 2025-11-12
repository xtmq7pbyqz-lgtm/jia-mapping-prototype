import React, { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix default icon issues for Create React App + Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const mockCensusData = [
  { id: 1, name: "Cape Town", lat: -33.9249, lon: 18.4241, child_pop: 120000 },
  { id: 2, name: "Johannesburg", lat: -26.2041, lon: 28.0473, child_pop: 140000 },
  { id: 3, name: "Durban", lat: -29.8587, lon: 31.0218, child_pop: 90000 }
];

const PREVALENCE_PER_1000 = 1.5;
const PREVALENCE_LOW = 1.0;
const PREVALENCE_HIGH = 2.0;

function AddMarker({ onAdd }) {
  useMapEvents({
    click(e) {
      const label = window.prompt("Optional: add a short non-identifying note (e.g. 'clinic referral')", "");
      onAdd({ lat: e.latlng.lat, lon: e.latlng.lng, note: label || "" });
    }
  });
  return null;
}

export default function App() {
  const [markers, setMarkers] = useState(() => {
    try {
      const raw = localStorage.getItem("jia_markers_v1");
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem("jia_markers_v1", JSON.stringify(markers));
  }, [markers]);

  function handleAdd(marker) {
    let nearest = mockCensusData[0];
    let bestDist = Number.MAX_VALUE;
    for (const t of mockCensusData) {
      const dLat = t.lat - marker.lat;
      const dLon = t.lon - marker.lon;
      const dist = dLat * dLat + dLon * dLon;
      if (dist < bestDist) {
        bestDist = dist;
        nearest = t;
      }
    }
    const anon = { id: Date.now(), townId: nearest.id, townName: nearest.name, note: marker.note };
    setMarkers(m => [...m, anon]);
  }

  function handleExportCSV() {
    const rows = ["town,markers_count,child_pop,expected_cases_center,expected_cases_range_low,expected_cases_range_high"];
    for (const t of mockCensusData) {
      const count = markers.filter(m => m.townId === t.id).length;
      const expected_center = (t.child_pop * (PREVALENCE_PER_1000 / 1000)).toFixed(2);
      const expected_low = (t.child_pop * (PREVALENCE_LOW / 1000)).toFixed(2);
      const expected_high = (t.child_pop * (PREVALENCE_HIGH / 1000)).toFixed(2);
      rows.push(`${t.name},${count},${t.child_pop},${expected_center},${expected_low}-${expected_high}`);
    }
    const csv = rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "jia_town_summary.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function summaryForTown(t) {
    const count = markers.filter(m => m.townId === t.id).length;
    const expected = t.child_pop * (PREVALENCE_PER_1000 / 1000);
    return { count, expected };
  }

  return (
    <div style={{ height: "100vh", display: "grid", gridTemplateColumns: "360px 1fr" }}>
      <aside style={{ padding: 16, borderRight: "1px solid #ddd" }}>
        <h1 style={{ marginTop: 0 }}>Arthritis Kids South Africa — JIA Mapping Prototype</h1>
        <p style={{ fontSize: 14 }}>Click on the map to add an anonymised patient point. Points are snapped to the nearest town centroid.</p>
        <button onClick={handleExportCSV} style={{ padding: "8px 12px", marginTop: 8 }}>Export summary CSV</button>

        <div style={{ marginTop: 16 }}>
          <h2 style={{ fontSize: 16, marginBottom: 8 }}>Town summaries</h2>
          <ul>
            {mockCensusData.map(t => {
              const s = summaryForTown(t);
              return (
                <li key={t.id} style={{ marginBottom: 6 }}>
                  <strong>{t.name}</strong>: {s.count} diagnosed — expected {s.expected.toFixed(1)} (based on {PREVALENCE_PER_1000} per 1000 children)
                </li>
              );
            })}
          </ul>
        </div>

        <div style={{ marginTop: 16, fontSize: 12, color: "#555" }}>
          <p style={{ marginBottom: 6 }}>Privacy notes:</p>
          <ul>
            <li>No identifying data should be entered.</li>
            <li>Points snap to town centroids in this prototype.</li>
            <li>Clinicians should obtain appropriate consent (POPIA) before entering real data.</li>
          </ul>
        </div>
      </aside>

      <main>
        <MapContainer center={[-30.5595, 22.9375]} zoom={5} style={{ height: "100%", width: "100%" }}>
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {mockCensusData.map(t => (
            <Marker key={t.id} position={[t.lat, t.lon]}>
              <Popup>
                <div>
                  <strong>{t.name}</strong>
                  <div>Child population: {t.child_pop.toLocaleString()}</div>
                  <div>Expected JIA cases (center): {(t.child_pop * (PREVALENCE_PER_1000 / 1000)).toFixed(1)}</div>
                  <div>Reported here: {markers.filter(m => m.townId === t.id).length}</div>
                </div>
              </Popup>
            </Marker>
          ))}

          {mockCensusData.map(t => {
            const count = markers.filter(m => m.townId === t.id).length;
            if (count === 0) return null;
            return (
              <Marker key={`a-${t.id}`} position={[t.lat, t.lon]}>
                <Popup>
                  <div>
                    <strong>{t.name}</strong>
                    <div>{count} anonymised patient(s) mapped to this town.</div>
                  </div>
                </Popup>
              </Marker>
            );
          })}

          <AddMarker onAdd={handleAdd} />
        </MapContainer>
      </main>
    </div>
  );
}
