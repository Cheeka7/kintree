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
const MIN_PERSON_ANGLE_DEG = 20;

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
      result.push({ person, point: pointOnCircle(CENTER, radius, angle), categoryAngle: cl.angle });
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
