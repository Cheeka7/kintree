import { describe, expect, it } from 'vitest';
import type { Category, Person } from './types';
import {
  CENTER,
  CATEGORY_RADIUS,
  PERSON_BASE_RADIUS,
  PERSON_RING_GAP,
  SATELLITE_RADIUS,
  chartBounds,
  layoutCategories,
  layoutPeople,
} from './layout';

function makeCategory(id: number, sort_order = id): Category {
  return { id, name: `Cat ${id}`, color: '#000000', sort_order };
}

function makePerson(id: number, category_id: number | null, overrides: Partial<Person> = {}): Person {
  return {
    id,
    name: `Person ${id}`,
    category_id,
    relationship: null,
    notes: null,
    cover_photo_id: null,
    created_at: '',
    photos: [],
    links: [],
    ...overrides,
  };
}

const linkedTo = (...people: Person[]) => people.map((p) => ({ id: p.id, name: p.name }));

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

// Angular distance in degrees, normalized to [-180, 180].
function angleDiff(a: number, b: number) {
  let d = (a - b) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

describe('layoutCategories', () => {
  it('returns an empty layout for no categories', () => {
    expect(layoutCategories([])).toEqual([]);
  });

  it('spaces categories evenly around the center starting at -90deg', () => {
    const categories = [makeCategory(1), makeCategory(2), makeCategory(3), makeCategory(4)];
    const layouts = layoutCategories(categories);

    expect(layouts.map((l) => l.angle)).toEqual([-90, 0, 90, 180]);
    for (const l of layouts) {
      expect(dist(l.point, CENTER)).toBeCloseTo(CATEGORY_RADIUS, 5);
    }
  });

  it('places a single category directly above the center', () => {
    const [layout] = layoutCategories([makeCategory(1)]);
    expect(layout.point.x).toBeCloseTo(CENTER.x, 5);
    expect(layout.point.y).toBeCloseTo(CENTER.y - CATEGORY_RADIUS, 5);
  });
});

describe('layoutPeople', () => {
  it('produces no entries for categories with nobody in them', () => {
    const categoryLayouts = layoutCategories([makeCategory(1), makeCategory(2)]);
    expect(layoutPeople(categoryLayouts, [])).toEqual([]);
  });

  it('places a lone person near their category angle, further out than the category ring', () => {
    const categories = [makeCategory(1), makeCategory(2)];
    const categoryLayouts = layoutCategories(categories);
    const people = [makePerson(1, 1)];

    const [layout] = layoutPeople(categoryLayouts, people);
    const catAngle = categoryLayouts.find((c) => c.category.id === 1)!.angle;

    expect(dist(layout.point, CENTER)).toBeCloseTo(PERSON_BASE_RADIUS, 5);
    expect(Math.abs(angleDiff(layout.categoryAngle, catAngle))).toBeCloseTo(0, 5);
  });

  it('keeps every person within their own category sector (no bleed into a neighboring category)', () => {
    const categories = Array.from({ length: 6 }, (_, i) => makeCategory(i + 1));
    const categoryLayouts = layoutCategories(categories);
    const sectorSpan = 360 / categories.length;

    // Overload one category with many people to force multiple rings.
    const people = [
      ...Array.from({ length: 9 }, (_, i) => makePerson(i + 1, 1)),
      makePerson(100, 2),
      makePerson(101, 3),
    ];

    const personLayouts = layoutPeople(categoryLayouts, people);
    expect(personLayouts).toHaveLength(people.length);

    for (const pl of personLayouts) {
      const cat = categoryLayouts.find((c) => c.category.id === pl.person.category_id)!;
      const personAngle = (Math.atan2(pl.point.y - CENTER.y, pl.point.x - CENTER.x) * 180) / Math.PI;
      const offset = angleDiff(personAngle, cat.angle);
      expect(Math.abs(offset)).toBeLessThanOrEqual(sectorSpan / 2 + 0.01);
    }
  });

  it('pushes overflow people onto a second ring at a larger radius', () => {
    // A single 360deg sector holds many people per ring, so use a tight multi-category
    // setup instead: 18 categories -> 20deg sectors -> ring capacity of 1 person each.
    const manyCategories = Array.from({ length: 18 }, (_, i) => makeCategory(i + 1));
    const manyCategoryLayouts = layoutCategories(manyCategories);
    const people = [makePerson(1, 1), makePerson(2, 1)];

    const personLayouts = layoutPeople(manyCategoryLayouts, people);
    const radii = personLayouts.map((pl) => dist(pl.point, CENTER));

    expect(radii[0]).toBeCloseTo(PERSON_BASE_RADIUS, 5);
    expect(radii[1]).toBeCloseTo(PERSON_BASE_RADIUS + PERSON_RING_GAP, 5);
  });

  it('gives every person in the same category a distinct position', () => {
    const categories = [makeCategory(1)];
    const categoryLayouts = layoutCategories(categories);
    const people = Array.from({ length: 8 }, (_, i) => makePerson(i + 1, 1));

    const personLayouts = layoutPeople(categoryLayouts, people);
    const keys = personLayouts.map((pl) => `${pl.point.x.toFixed(2)},${pl.point.y.toFixed(2)}`);
    expect(new Set(keys).size).toBe(people.length);
  });
});

describe('layoutPeople — people with no category (added only as a link)', () => {
  it('orbits a link-only person near the categorized person they are linked to', () => {
    const categories = [makeCategory(1)];
    const categoryLayouts = layoutCategories(categories);
    const anchor = makePerson(1, 1);
    const satellite = makePerson(2, null, { links: linkedTo(anchor) });
    anchor.links = linkedTo(satellite);

    const personLayouts = layoutPeople(categoryLayouts, [anchor, satellite]);
    expect(personLayouts).toHaveLength(2);

    const anchorLayout = personLayouts.find((pl) => pl.person.id === anchor.id)!;
    const satelliteLayout = personLayouts.find((pl) => pl.person.id === satellite.id)!;
    expect(dist(satelliteLayout.point, anchorLayout.point)).toBeCloseTo(SATELLITE_RADIUS, 5);
  });

  it('resolves a chain of link-only people back to a categorized anchor', () => {
    const categories = [makeCategory(1)];
    const categoryLayouts = layoutCategories(categories);
    const anchor = makePerson(1, 1);
    const middle = makePerson(2, null);
    const tip = makePerson(3, null);
    anchor.links = linkedTo(middle);
    middle.links = linkedTo(anchor, tip);
    tip.links = linkedTo(middle);

    const personLayouts = layoutPeople(categoryLayouts, [anchor, middle, tip]);
    expect(personLayouts).toHaveLength(3);
    expect(personLayouts.every((pl) => Number.isFinite(pl.point.x) && Number.isFinite(pl.point.y))).toBe(true);
  });

  it('still places link-only people that never connect back to a categorized person', () => {
    const categories = [makeCategory(1)];
    const categoryLayouts = layoutCategories(categories);
    const isolatedA = makePerson(1, null);
    const isolatedB = makePerson(2, null);
    isolatedA.links = linkedTo(isolatedB);
    isolatedB.links = linkedTo(isolatedA);

    const personLayouts = layoutPeople(categoryLayouts, [isolatedA, isolatedB]);
    expect(personLayouts).toHaveLength(2);
    expect(personLayouts.every((pl) => Number.isFinite(pl.point.x) && Number.isFinite(pl.point.y))).toBe(true);
  });

  it('gives multiple satellites of the same anchor distinct positions', () => {
    const categories = [makeCategory(1)];
    const categoryLayouts = layoutCategories(categories);
    const anchor = makePerson(1, 1);
    const satellites = [makePerson(2, null), makePerson(3, null), makePerson(4, null)];
    anchor.links = linkedTo(...satellites);
    for (const s of satellites) s.links = linkedTo(anchor);

    const personLayouts = layoutPeople(categoryLayouts, [anchor, ...satellites]);
    const keys = personLayouts.map((pl) => `${pl.point.x.toFixed(2)},${pl.point.y.toFixed(2)}`);
    expect(new Set(keys).size).toBe(personLayouts.length);
  });
});

describe('chartBounds', () => {
  it('falls back to the base radius when there are no people', () => {
    const bounds = chartBounds([]);
    const expectedSize = (PERSON_BASE_RADIUS + 130) * 2;
    expect(bounds.size).toBeCloseTo(expectedSize, 5);
    expect(bounds.minX).toBeCloseTo(CENTER.x - expectedSize / 2, 5);
    expect(bounds.minY).toBeCloseTo(CENTER.y - expectedSize / 2, 5);
  });

  it('grows to fit the furthest person plus padding', () => {
    const categories = [makeCategory(1)];
    const categoryLayouts = layoutCategories(categories);
    const people = [makePerson(1, 1)];
    const personLayouts = layoutPeople(categoryLayouts, people);

    const bounds = chartBounds(personLayouts);
    const maxRadius = Math.max(...personLayouts.map((p) => dist(p.point, CENTER)));
    expect(bounds.size).toBeCloseTo((maxRadius + 130) * 2, 5);
  });

  it('is always square and centered on CENTER', () => {
    const categories = [makeCategory(1), makeCategory(2), makeCategory(3)];
    const categoryLayouts = layoutCategories(categories);
    const people = Array.from({ length: 5 }, (_, i) => makePerson(i + 1, (i % 3) + 1));
    const personLayouts = layoutPeople(categoryLayouts, people);

    const bounds = chartBounds(personLayouts);
    expect(bounds.minX).toBeCloseTo(CENTER.x - bounds.size / 2, 5);
    expect(bounds.minY).toBeCloseTo(CENTER.y - bounds.size / 2, 5);
  });
});
