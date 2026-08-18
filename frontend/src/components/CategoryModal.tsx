import { useState } from 'react';
import type { Category } from '../types';
import Modal from './Modal';

const SWATCHES = ['#c8622f', '#4a90a4', '#7a7ac1', '#4f8b5b', '#c9497a', '#b8933a', '#5b6b8c'];

export default function CategoryModal({
  category,
  onClose,
  onSave,
  onDelete,
  canDelete,
}: {
  category: Category | null;
  onClose: () => void;
  onSave: (data: { name: string; color: string }) => Promise<void>;
  onDelete?: () => void;
  canDelete?: boolean;
}) {
  const [name, setName] = useState(category?.name ?? '');
  const [color, setColor] = useState(category?.color ?? SWATCHES[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({ name: name.trim(), color });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={category ? 'Edit category' : 'New category'} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-ink-soft">Name</span>
          <input
            className="rounded-lg border border-line bg-white px-3 py-2 outline-none focus:border-accent"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Cousins, Classmates, Neighbors"
            autoFocus
          />
        </label>

        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-ink-soft">Color</span>
          <div className="flex flex-wrap items-center gap-2">
            {SWATCHES.map((sw) => (
              <button
                key={sw}
                onClick={() => setColor(sw)}
                className="h-8 w-8 rounded-full transition-transform hover:scale-110"
                style={{
                  background: sw,
                  boxShadow: sw === color ? '0 0 0 2px white, 0 0 0 4px #2b2620' : 'none',
                }}
              />
            ))}
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-8 w-8 cursor-pointer rounded-full border-0 bg-transparent"
              title="Custom color"
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="mt-2 flex items-center justify-between">
          {category && canDelete && onDelete ? (
            <button
              onClick={onDelete}
              className="text-sm font-medium text-red-600 hover:underline"
            >
              Delete category
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-ink-soft hover:bg-paper-dim">
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={saving}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
