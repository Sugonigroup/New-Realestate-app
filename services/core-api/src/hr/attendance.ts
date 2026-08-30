/** Geo-attendance (WP-4F, FR-9.2): haversine geofence, anomaly detection, muster. */

export interface GeoPoint {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_M = 6_371_000;

export function distanceMeters(a: GeoPoint, b: GeoPoint): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export interface GeoFence {
  center: GeoPoint;
  radiusMeters: number;
}

export interface AttendanceCheck {
  userId: string;
  deviceId: string;
  at: GeoPoint;
  timestamp: Date;
}

export interface AttendanceEvaluation {
  withinFence: boolean;
  distanceMeters: number;
  anomalies: string[];
}

/**
 * Site attendance check: geo-fence + device-reuse anomaly (same device for two
 * users within 10 minutes is a buddy-punching flag, 07 §2 anomaly queue).
 */
export function evaluateAttendance(
  check: AttendanceCheck,
  fence: GeoFence,
  recentChecks: Array<AttendanceCheck>,
): AttendanceEvaluation {
  const distance = distanceMeters(check.at, fence.center);
  const withinFence = distance <= fence.radiusMeters;
  const anomalies: string[] = [];
  if (!withinFence) anomalies.push(`outside geofence by ${Math.round(distance - fence.radiusMeters)}m`);
  const deviceOwner = recentChecks.find(
    (r) => r.deviceId === check.deviceId && r.userId !== check.userId && check.timestamp.getTime() - r.timestamp.getTime() < 10 * 60_000,
  );
  if (deviceOwner) anomalies.push(`device recently used by ${deviceOwner.userId} (possible buddy punching)`);
  return { withinFence, distanceMeters: distance, anomalies };
}

/** Contractor muster aggregation from daily site reports (WP-4H, FR-9.5). */
export interface MusterDay {
  date: Date;
  contractorId: string;
  trade: string;
  headcount: number;
}

export function aggregateMuster(days: MusterDay[]): Map<string, { contractorId: string; trade: string; mandays: number }> {
  const out = new Map<string, { contractorId: string; trade: string; mandays: number }>();
  for (const d of days) {
    const key = `${d.contractorId}:${d.trade}`;
    const cur = out.get(key) ?? { contractorId: d.contractorId, trade: d.trade, mandays: 0 };
    cur.mandays += d.headcount;
    out.set(key, cur);
  }
  return out;
}
