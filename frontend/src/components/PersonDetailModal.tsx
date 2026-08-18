import { useRef, useState } from 'react';
import type { Category, Person } from '../types';
import { api } from '../api';
import Modal from './Modal';

export default function PersonDetailModal({
  person,
  category,
  onClose,
  onChanged,
  onEdit,
  onDelete,
}: {
  person: Person;
  category: Category | undefined;
  onClose: () => void;
  onChanged: () => Promise<void>;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      await api.uploadPhotos(person.id, Array.from(files));
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const setCover = async (photoId: number) => {
    await api.updatePerson(person.id, { cover_photo_id: photoId });
    await onChanged();
  };

  const removePhoto = async (photoId: number) => {
    await api.deletePhoto(photoId);
    await onChanged();
  };

  return (
    <Modal title={person.name} onClose={onClose} wide>
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2">
          {category && (
            <span
              className="rounded-full px-3 py-1 text-xs font-semibold text-white"
              style={{ background: category.color }}
            >
              {category.name}
            </span>
          )}
          {person.relationship && (
            <span className="rounded-full bg-paper-dim px-3 py-1 text-xs font-medium text-ink-soft">
              {person.relationship}
            </span>
          )}
        </div>

        {person.notes && <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{person.notes}</p>}

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-display text-sm font-semibold text-ink-soft">
              Photos {person.photos.length > 0 && `(${person.photos.length})`}
            </h3>
            <button
              onClick={() => fileInput.current?.click()}
              disabled={uploading}
              className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {uploading ? 'Uploading…' : '+ Add photos'}
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
          </div>

          {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

          {person.photos.length === 0 ? (
            <div className="flex h-32 items-center justify-center rounded-xl border-2 border-dashed border-line text-sm text-ink-soft">
              No photos yet — add one to remember this moment.
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {person.photos.map((photo) => (
                <div key={photo.id} className="group relative aspect-square overflow-hidden rounded-lg bg-paper-dim">
                  <img
                    src={`/uploads/${photo.filename}`}
                    alt={photo.caption ?? person.name}
                    className="h-full w-full cursor-pointer object-cover transition-transform group-hover:scale-105"
                    onClick={() => setLightbox(photo.filename)}
                  />
                  <div className="absolute inset-x-0 bottom-0 flex justify-between gap-1 bg-gradient-to-t from-black/60 to-transparent p-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={() => setCover(photo.id)}
                      className="rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-medium text-ink"
                      title="Set as cover photo"
                    >
                      {person.cover_photo_id === photo.id ? '★ Cover' : 'Set cover'}
                    </button>
                    <button
                      onClick={() => removePhoto(photo.id)}
                      className="rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-medium text-red-600"
                      title="Remove photo"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-between border-t border-line pt-4">
          <button onClick={onDelete} className="text-sm font-medium text-red-600 hover:underline">
            Delete person
          </button>
          <button
            onClick={onEdit}
            className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-paper-dim"
          >
            Edit details
          </button>
        </div>
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-6"
          onClick={() => setLightbox(null)}
        >
          <img src={`/uploads/${lightbox}`} className="max-h-full max-w-full rounded-lg object-contain" />
        </div>
      )}
    </Modal>
  );
}
