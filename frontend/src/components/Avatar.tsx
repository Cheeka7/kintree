import type { Person } from '../types';

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
}

export default function Avatar({
  person,
  size,
  ringColor,
}: {
  person: Person;
  size: number;
  ringColor: string;
}) {
  const cover = person.photos.find((p) => p.id === person.cover_photo_id) ?? person.photos[0];

  return (
    <div
      className="relative flex items-center justify-center rounded-full bg-white shadow-md overflow-hidden shrink-0"
      style={{ width: size, height: size, border: `3px solid ${ringColor}` }}
    >
      {cover ? (
        <img
          src={`/uploads/${cover.thumb_filename ?? cover.filename}`}
          alt={person.name}
          className="h-full w-full object-cover"
        />
      ) : (
        <span
          className="font-display font-semibold text-ink-soft"
          style={{ fontSize: size * 0.34 }}
        >
          {initials(person.name)}
        </span>
      )}
    </div>
  );
}
