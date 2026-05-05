import type { Shrine } from "@/data/shrines";

export type LatLng = {
  lat: number;
  lng: number;
};

const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

export function distanceKm(a: LatLng, b: LatLng) {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const haversine =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(haversine));
}

export function optimizeRoute(selected: Shrine[], start?: LatLng) {
  if (selected.length <= 1) {
    return selected;
  }

  const remaining = [...selected];
  const route: Shrine[] = [];
  let current: LatLng = start ?? remaining[0];

  while (remaining.length > 0) {
    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;

    remaining.forEach((shrine, index) => {
      const distance = distanceKm(current, shrine);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });

    const [next] = remaining.splice(nearestIndex, 1);
    route.push(next);
    current = next;
  }

  return route;
}

export function totalRouteDistanceKm(route: Shrine[], start?: LatLng) {
  if (route.length === 0) {
    return 0;
  }

  let total = 0;
  let current: LatLng = start ?? route[0];

  route.forEach((shrine) => {
    total += distanceKm(current, shrine);
    current = shrine;
  });

  return total;
}

export function estimatedDriveMinutes(distance: number) {
  return Math.max(5, Math.round((distance / 45) * 60));
}
