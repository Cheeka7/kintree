import { useEffect, useState, useCallback, useMemo } from 'react';
import type { Category, Person } from './types';
import { createApi, kinsApi } from './api';
import KinTree from './components/KinTree';
import PersonDetailModal from './components/PersonDetailModal';
import PersonFormModal from './components/PersonFormModal';
import CategoryModal from './components/CategoryModal';
import ConfirmDialog from './components/ConfirmDialog';
import KinGateModal from './components/KinGateModal';

const KIN_CODE_KEY = 'kintree-kin-code';

type PersonFormState = { mode: 'add' | 'edit'; defaultCategoryId?: number; person?: Person; linkToPersonId?: number };
type CategoryFormState = { category: Category | null };
type ConfirmState = { title: string; message: string; onConfirm: () => Promise<void> | void };

export default function App() {
  const [kinCode, setKinCode] = useState<string | null>(null);
  const [checkingStoredCode, setCheckingStoredCode] = useState(true);

  useEffect(() => {
    (async () => {
      const stored = localStorage.getItem(KIN_CODE_KEY);
      if (stored) {
        const ok = await kinsApi.exists(stored).catch(() => false);
        if (ok) {
          setKinCode(stored);
        } else {
          localStorage.removeItem(KIN_CODE_KEY);
        }
      }
      setCheckingStoredCode(false);
    })();
  }, []);

  const goToKin = (code: string) => {
    localStorage.setItem(KIN_CODE_KEY, code);
    setKinCode(code);
  };

  if (checkingStoredCode) {
    return <div className="flex h-screen items-center justify-center text-ink-soft">Loading KinTree…</div>;
  }

  if (!kinCode) {
    return <KinGateModal onResolved={goToKin} />;
  }

  return <KinTreeApp key={kinCode} kinCode={kinCode} onSwitchKin={goToKin} />;
}

function KinTreeApp({ kinCode, onSwitchKin }: { kinCode: string; onSwitchKin: (code: string) => void }) {
  const [switchingKin, setSwitchingKin] = useState(false);
  const api = useMemo(() => createApi(kinCode), [kinCode]);
  const centerNameKey = `kintree-center-name-${kinCode}`;

  const [categories, setCategories] = useState<Category[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [centerName, setCenterName] = useState(() => localStorage.getItem(centerNameKey) || 'My Son');
  const [editingName, setEditingName] = useState(false);

  const [selectedPersonId, setSelectedPersonId] = useState<number | null>(null);
  const [personForm, setPersonForm] = useState<PersonFormState | null>(null);
  const [categoryForm, setCategoryForm] = useState<CategoryFormState | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  const refresh = useCallback(async () => {
    const [cats, ppl] = await Promise.all([api.getCategories(), api.getPeople()]);
    setCategories(cats);
    setPeople(ppl);
  }, [api]);

  useEffect(() => {
    (async () => {
      try {
        await refresh();
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : 'Failed to load. Is the server running?');
      } finally {
        setLoading(false);
      }
    })();
  }, [refresh]);

  useEffect(() => {
    localStorage.setItem(centerNameKey, centerName);
  }, [centerNameKey, centerName]);

  const selectedPerson = people.find((p) => p.id === selectedPersonId) ?? null;

  const handleAddPerson = async (data: { name: string; category_id: number | null; relationship: string; notes: string }) => {
    const created = await api.createPerson(data);
    if (personForm?.linkToPersonId) {
      await api.addPersonLink(created.id, personForm.linkToPersonId);
    }
    await refresh();
    setSelectedPersonId(created.id);
  };

  const handleEditPerson = async (data: { name: string; category_id: number | null; relationship: string; notes: string }) => {
    if (!personForm?.person) return;
    await api.updatePerson(personForm.person.id, data);
    await refresh();
  };

  const handleSaveCategory = async (data: { name: string; color: string }) => {
    if (categoryForm?.category) {
      await api.updateCategory(categoryForm.category.id, data);
    } else {
      await api.createCategory(data);
    }
    await refresh();
  };

  const handleDeletePerson = (person: Person) => {
    setConfirm({
      title: `Delete ${person.name}?`,
      message: 'This removes them and all of their photos. This cannot be undone.',
      onConfirm: async () => {
        await api.deletePerson(person.id);
        setSelectedPersonId(null);
        setConfirm(null);
        await refresh();
      },
    });
  };

  const handleDeleteCategory = (category: Category) => {
    const count = people.filter((p) => p.category_id === category.id).length;
    if (count > 0) {
      setConfirm({
        title: 'Category not empty',
        message: `Move or delete the ${count} ${count === 1 ? 'person' : 'people'} in "${category.name}" first.`,
        onConfirm: () => setConfirm(null),
      });
      return;
    }
    setConfirm({
      title: `Delete "${category.name}"?`,
      message: 'This cannot be undone.',
      onConfirm: async () => {
        await api.deleteCategory(category.id);
        setCategoryForm(null);
        setConfirm(null);
        await refresh();
      },
    });
  };

  if (loading) {
    return <div className="flex h-screen items-center justify-center text-ink-soft">Loading KinTree…</div>;
  }

  if (loadError) {
    return (
      <div className="flex h-screen items-center justify-center px-6 text-center">
        <div>
          <p className="font-display text-lg font-semibold text-ink">Couldn't reach the server</p>
          <p className="mt-1 text-sm text-ink-soft">{loadError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-paper px-6 py-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🌳</span>
          <div>
            <h1 className="font-display text-xl font-semibold leading-tight text-ink">KinTree</h1>
            {editingName ? (
              <input
                autoFocus
                className="border-b border-accent bg-transparent text-xs text-ink-soft outline-none"
                value={centerName}
                onChange={(e) => setCenterName(e.target.value)}
                onBlur={() => setEditingName(false)}
                onKeyDown={(e) => e.key === 'Enter' && setEditingName(false)}
              />
            ) : (
              <button
                className="text-xs text-ink-soft hover:underline"
                onClick={() => setEditingName(true)}
                title="Click to rename the center of the chart"
              >
                Center: {centerName} ✎
              </button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="px-1 text-xs text-ink-soft" title="Kin code for this chart">
            Kin: {kinCode}
          </span>
          <button
            onClick={() => setSwitchingKin(true)}
            className="rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink hover:bg-paper-dim"
          >
            Switch Kin
          </button>
          <button
            onClick={() => setCategoryForm({ category: null })}
            className="rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink hover:bg-paper-dim"
          >
            + Category
          </button>
          <button
            onClick={() => setPersonForm({ mode: 'add', defaultCategoryId: categories[0]?.id })}
            disabled={categories.length === 0}
            className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            + Person
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-hidden bg-[radial-gradient(circle_at_center,_var(--color-paper-dim),_var(--color-paper))]">
        <KinTree
          categories={categories}
          people={people}
          centerName={centerName}
          onSelectPerson={(p) => setSelectedPersonId(p.id)}
          onSelectCategory={(c) => setCategoryForm({ category: c })}
          onAddPersonInCategory={(c) => setPersonForm({ mode: 'add', defaultCategoryId: c.id })}
        />
      </main>

      {selectedPerson && (
        <PersonDetailModal
          person={selectedPerson}
          category={categories.find((c) => c.id === selectedPerson.category_id)}
          people={people}
          api={api}
          onClose={() => setSelectedPersonId(null)}
          onChanged={refresh}
          onEdit={() => setPersonForm({ mode: 'edit', person: selectedPerson })}
          onDelete={() => handleDeletePerson(selectedPerson)}
          onNavigateToPerson={(id) => setSelectedPersonId(id)}
          onAddLinkedPerson={() => setPersonForm({ mode: 'add', linkToPersonId: selectedPerson.id })}
        />
      )}

      {personForm && (
        <PersonFormModal
          person={personForm.person ?? null}
          categories={categories}
          defaultCategoryId={personForm.defaultCategoryId}
          hideCategory={personForm.mode === 'add' && !!personForm.linkToPersonId}
          onClose={() => setPersonForm(null)}
          onSave={personForm.mode === 'add' ? handleAddPerson : handleEditPerson}
        />
      )}

      {categoryForm && (
        <CategoryModal
          category={categoryForm.category}
          canDelete
          onClose={() => setCategoryForm(null)}
          onSave={handleSaveCategory}
          onDelete={categoryForm.category ? () => handleDeleteCategory(categoryForm.category!) : undefined}
        />
      )}

      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          onCancel={() => setConfirm(null)}
          onConfirm={confirm.onConfirm}
        />
      )}

      {switchingKin && (
        <KinGateModal
          onResolved={(code) => {
            setSwitchingKin(false);
            onSwitchKin(code);
          }}
          onCancel={() => setSwitchingKin(false)}
        />
      )}
    </div>
  );
}
