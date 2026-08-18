import { useState } from 'react';
import type { Category, Person } from '../types';
import Modal from './Modal';

export default function PersonFormModal({
  person,
  categories,
  defaultCategoryId,
  onClose,
  onSave,
}: {
  person: Person | null;
  categories: Category[];
  defaultCategoryId?: number;
  onClose: () => void;
  onSave: (data: { name: string; category_id: number; relationship: string; notes: string }) => Promise<void>;
}) {
  const [name, setName] = useState(person?.name ?? '');
  const [categoryId, setCategoryId] = useState<number>(
    person?.category_id ?? defaultCategoryId ?? categories[0]?.id
  );
  const [relationship, setRelationship] = useState(person?.relationship ?? '');
  const [notes, setNotes] = useState(person?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    if (!categoryId) {
      setError('Choose a category');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({ name: name.trim(), category_id: categoryId, relationship, notes });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={person ? 'Edit person' : 'Add person'} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-ink-soft">Name</span>
          <input
            className="rounded-lg border border-line bg-white px-3 py-2 outline-none focus:border-accent"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Grandma Rose"
            autoFocus
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-ink-soft">Category</span>
          <select
            className="rounded-lg border border-line bg-white px-3 py-2 outline-none focus:border-accent"
            value={categoryId}
            onChange={(e) => setCategoryId(Number(e.target.value))}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-ink-soft">Relationship</span>
          <input
            className="rounded-lg border border-line bg-white px-3 py-2 outline-none focus:border-accent"
            value={relationship}
            onChange={(e) => setRelationship(e.target.value)}
            placeholder="e.g. Grandmother, Best friend, Preschool teacher"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-ink-soft">Notes</span>
          <textarea
            className="min-h-20 rounded-lg border border-line bg-white px-3 py-2 outline-none focus:border-accent"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="How they met, favorite memory, anything worth remembering"
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="mt-2 flex justify-end gap-2">
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
    </Modal>
  );
}
