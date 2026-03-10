export interface Station {
  name: string;
  normalized: string;
  lat: number;
  lng: number;
  order: number;
}

export interface OverlapStation extends Station {
  orderA: number;
  orderB: number;
}

export function normalizeStationName(name: string): string {
  const cleaned = name
    .replace(/\s/g, '')
    .replace(/[（(]\d*호선[)）]/g, '')
    .replace(/[\[\]()（）]/g, '');
  return cleaned.endsWith('역') ? cleaned : `${cleaned}역`;
}

export function extractStations(legs: Record<string, unknown>[]): Station[] {
  const stations: Station[] = [];
  let order = 0;

  for (const leg of legs) {
    const mode = leg.mode as string;
    if (mode === 'WALK' || mode === 'TRANSFER') continue;

    const passStopList = leg.passStopList as Record<string, unknown> | undefined;
    const stationList = passStopList?.stationList;
    if (!Array.isArray(stationList)) continue;

    for (const stop of stationList) {
      const s = stop as Record<string, unknown>;
      const name = s.stationName as string;
      stations.push({
        name,
        normalized: normalizeStationName(name),
        lat: parseFloat(s.lat as string),
        lng: parseFloat(s.lon as string),
        order: order++,
      });
    }
  }

  return stations;
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const PROXIMITY_THRESHOLD_METERS = 50;

export function findOverlapStations(stationsA: Station[], stationsB: Station[]): OverlapStation[] {
  const overlap: OverlapStation[] = [];
  const matchedB = new Set<number>();

  for (const a of stationsA) {
    const nameMatch = stationsB.find((b, i) => !matchedB.has(i) && a.normalized === b.normalized);
    if (nameMatch) {
      const idx = stationsB.indexOf(nameMatch);
      matchedB.add(idx);
      overlap.push({ ...a, orderA: a.order, orderB: nameMatch.order });
      continue;
    }

    const proximityMatch = stationsB.find(
      (b, i) => !matchedB.has(i) && haversineMeters(a.lat, a.lng, b.lat, b.lng) <= PROXIMITY_THRESHOLD_METERS,
    );
    if (proximityMatch) {
      const idx = stationsB.indexOf(proximityMatch);
      matchedB.add(idx);
      overlap.push({ ...a, orderA: a.order, orderB: proximityMatch.order });
    }
  }

  return overlap;
}

export function findMeetupStation(overlap: OverlapStation[]): OverlapStation | null {
  if (overlap.length === 0) return null;
  return overlap.reduce((best, current) => {
    const bestSum = best.orderA + best.orderB;
    const currentSum = current.orderA + current.orderB;
    return currentSum < bestSum ? current : best;
  });
}
