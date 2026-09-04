import type { Category, Person } from './types';

export interface Point {
  x: number;
  y: number;
}

export interface CategoryLayout {
  category: Category;
  angle: number;
  point: Point;
}

export interface PersonLayout {
  person: Person;
  point: Point;
  categoryAngle: number;
}

export const CENTER: Point = { x: 500, y: 500 };
export const CATEGORY_RADIUS = 190;
export const PERSON_BASE_RADIUS = 320;
export const PERSON_RING_GAP = 110;
export const SATELLITE_RADIUS = 150;
const MIN_PERSON_ANGLE_DEG = 20;
const SATELLITE_FAN_DEG = 42;

const toRad = (deg: number) => (deg * Math.PI) / 180;

const pointOnCircle = (center: Point, radius: number, angleDeg: number): Point => ({
  x: center.x + radius * Math.cos(toRad(angleDeg)),
  y: center.y + radius * Math.sin(toRad(angleDeg)),
});

export function layoutCategories(categories: Category[]): CategoryLayout[] {
  const n = categories.length || 1;
  const step = 360 / n;
  return categories.map((category, i) => {
    const angle = -90 + step * i;
    return { category, angle, point: pointOnCircle(CENTER, CATEGORY_RADIUS, angle) };
  });
}

export function layoutPeople(categoryLayouts: CategoryLayout[], people: Person[]): PersonLayout[] {
  const n = categoryLayouts.length || 1;
  const sectorSpan = 360 / n;
  const result: PersonLayout[] = [];
  const pointById = new Map<number, Point>();

  for (const cl of categoryLayouts) {
    const members = people.filter((p) => p.category_id === cl.category.id);
    if (members.length === 0) continue;

    const sectorStart = cl.angle - sectorSpan / 2 + 10;
    const usableSpan = sectorSpan - 20;
    const ringCapacity = Math.max(1, Math.floor(usableSpan / MIN_PERSON_ANGLE_DEG));

    members.forEach((person, i) => {
      const ring = Math.floor(i / ringCapacity);
      const posInRing = i % ringCapacity;
      const ringCount = Math.min(ringCapacity, members.length - ring * ringCapacity);
      const angleStep = usableSpan / (ringCount + 1);
      const angle = sectorStart + angleStep * (posInRing + 1);
      const radius = PERSON_BASE_RADIUS + ring * PERSON_RING_GAP;
      const point = pointOnCircle(CENTER, radius, angle);
      pointById.set(person.id, point);
      result.push({ person, point, categoryAngle: cl.angle });
    });
  }

  // People with no category (added directly as a link) don't belong to a ring —
  // orbit them near whichever linked person is already placed.
  const remaining = new Map(people.filter((p) => p.category_id == null).map((p) => [p.id, p]));
  const satelliteCount = new Map<number, number>();

  let placedSomething = true;
  while (remaining.size > 0 && placedSomething) {
    placedSomething = false;
    for (const person of remaining.values()) {
      const anchorLink = person.links.find((l) => pointById.has(l.id));
      if (!anchorLink) continue;
      const anchorPoint = pointById.get(anchorLink.id)!;
      const count = satelliteCount.get(anchorLink.id) ?? 0;
      const anchorAngle = (Math.atan2(anchorPoint.y - CENTER.y, anchorPoint.x - CENTER.x) * 180) / Math.PI;
      const fanAngle = anchorAngle + SATELLITE_FAN_DEG * (count % 2 === 0 ? 1 : -1) * (Math.floor(count / 2) + 1);
      const point = pointOnCircle(anchorPoint, SATELLITE_RADIUS, fanAngle);
      pointById.set(person.id, point);
      satelliteCount.set(anchorLink.id, count + 1);
      result.push({ person, point, categoryAngle: anchorAngle });
      remaining.delete(person.id);
      placedSomething = true;
    }
  }

  // Isolated people (no category and no path back to a categorized person) still need a spot.
  if (remaining.size > 0) {
    const leftover = Array.from(remaining.values());
    const fallbackRadius = PERSON_BASE_RADIUS + PERSON_RING_GAP * 2;
    leftover.forEach((person, i) => {
      const angle = (360 / leftover.length) * i;
      result.push({ person, point: pointOnCircle(CENTER, fallbackRadius, angle), categoryAngle: angle });
    });
  }

  return result;
}

export function chartBounds(personLayouts: PersonLayout[]) {
  const maxRadius = personLayouts.length
    ? Math.max(...personLayouts.map((p) => Math.hypot(p.point.x - CENTER.x, p.point.y - CENTER.y)))
    : PERSON_BASE_RADIUS;
  const size = (maxRadius + 130) * 2;
  const origin = CENTER.x - size / 2;
  return { minX: origin, minY: origin, size };
}
