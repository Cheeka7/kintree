import { useMemo } from 'react';
import type { Category, Person } from '../types';
import { CENTER, chartBounds, layoutCategories, layoutPeople } from '../layout';
import Avatar from './Avatar';

const PERSON_SIZE = 76;
const CATEGORY_SIZE = 92;
const CENTER_SIZE = 108;

export default function KinTree({
  categories,
  people,
  centerName,
  onSelectPerson,
  onSelectCategory,
  onAddPersonInCategory,
}: {
  categories: Category[];
  people: Person[];
  centerName: string;
  onSelectPerson: (p: Person) => void;
  onSelectCategory: (c: Category) => void;
  onAddPersonInCategory: (c: Category) => void;
}) {
  const categoryLayouts = useMemo(() => layoutCategories(categories), [categories]);
  const personLayouts = useMemo(() => layoutPeople(categoryLayouts, people), [categoryLayouts, people]);
  const bounds = useMemo(() => chartBounds(personLayouts), [personLayouts]);

  if (categories.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-ink-soft">
        Add a category to start building the chart.
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-auto">
      <svg
        viewBox={`${bounds.minX} ${bounds.minY} ${bounds.size} ${bounds.size}`}
        className="mx-auto block"
        style={{ width: bounds.size, height: bounds.size, maxWidth: 'none' }}
      >
        {/* lines: center -> category */}
        {categoryLayouts.map((cl) => (
          <line
            key={`line-cat-${cl.category.id}`}
            x1={CENTER.x}
            y1={CENTER.y}
            x2={cl.point.x}
            y2={cl.point.y}
            stroke={cl.category.color}
            strokeWidth={3}
            strokeOpacity={0.55}
          />
        ))}

        {/* lines: category -> person */}
        {personLayouts.map((pl) => {
          const cat = categories.find((c) => c.id === pl.person.category_id);
          const catPoint = categoryLayouts.find((cl) => cl.category.id === pl.person.category_id)?.point;
          return (
            <line
              key={`line-person-${pl.person.id}`}
              x1={catPoint?.x}
              y1={catPoint?.y}
              x2={pl.point.x}
              y2={pl.point.y}
              stroke={cat?.color ?? '#ccc'}
              strokeWidth={1.5}
              strokeOpacity={0.4}
            />
          );
        })}

        {/* center node */}
        <foreignObject
          x={CENTER.x - CENTER_SIZE / 2}
          y={CENTER.y - CENTER_SIZE / 2}
          width={CENTER_SIZE}
          height={CENTER_SIZE}
        >
          <div
            className="flex h-full w-full items-center justify-center rounded-full text-center shadow-lg"
            style={{
              background: 'linear-gradient(160deg, #f2d0b4, #c8622f)',
              border: '4px solid white',
            }}
          >
            <span className="font-display font-semibold text-white text-sm px-2 leading-tight">
              {centerName}
            </span>
          </div>
        </foreignObject>

        {/* category nodes */}
        {categoryLayouts.map((cl) => (
          <foreignObject
            key={`node-cat-${cl.category.id}`}
            x={cl.point.x - CATEGORY_SIZE / 2}
            y={cl.point.y - CATEGORY_SIZE / 2}
            width={CATEGORY_SIZE + 40}
            height={CATEGORY_SIZE}
          >
            <div className="flex h-full items-center gap-2">
              <button
                onClick={() => onSelectCategory(cl.category)}
                className="flex h-full aspect-square items-center justify-center rounded-full text-center shadow-md transition-transform hover:scale-105 shrink-0"
                style={{ background: cl.category.color, border: '3px solid white' }}
                title={`Edit ${cl.category.name}`}
              >
                <span className="font-display font-semibold text-white text-sm px-1">{cl.category.name}</span>
              </button>
              <button
                onClick={() => onAddPersonInCategory(cl.category)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-lg shadow shrink-0 hover:scale-110 transition-transform"
                style={{ color: cl.category.color, border: `2px solid ${cl.category.color}` }}
                title={`Add person to ${cl.category.name}`}
              >
                +
              </button>
            </div>
          </foreignObject>
        ))}

        {/* person nodes */}
        {personLayouts.map((pl) => (
          <foreignObject
            key={`node-person-${pl.person.id}`}
            x={pl.point.x - PERSON_SIZE / 2}
            y={pl.point.y - PERSON_SIZE / 2 - 4}
            width={PERSON_SIZE}
            height={PERSON_SIZE + (pl.person.relationship ? 54 : 34)}
          >
            <button
              onClick={() => onSelectPerson(pl.person)}
              className="flex w-full flex-col items-center gap-1 group"
            >
              <div className="transition-transform group-hover:scale-105">
                <Avatar
                  person={pl.person}
                  size={PERSON_SIZE}
                  ringColor={categories.find((c) => c.id === pl.person.category_id)?.color ?? '#ccc'}
                />
              </div>
              <span className="max-w-[90px] truncate rounded-full bg-white/90 px-2 py-0.5 text-xs font-medium text-ink shadow-sm">
                {pl.person.name}
              </span>
              {pl.person.relationship && (
                <span className="max-w-[90px] truncate rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-medium text-ink-soft shadow-sm">
                  {pl.person.relationship}
                </span>
              )}
            </button>
          </foreignObject>
        ))}
      </svg>
    </div>
  );
}
