import type { Category, Person, Photo } from './types';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || 'Request failed');
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const kinsApi = {
  create: () => request<{ code: string }>('/api/kins', { method: 'POST' }),
  exists: async (code: string) => {
    const res = await fetch(`/api/kins/${code}`);
    return res.ok;
  },
};

export function createApi(kinCode: string) {
  const base = `/api/kins/${kinCode}`;

  return {
    getCategories: () => request<Category[]>(`${base}/categories`),
    createCategory: (data: { name: string; color: string }) =>
      request<Category>(`${base}/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    updateCategory: (id: number, data: Partial<{ name: string; color: string }>) =>
      request<Category>(`${base}/categories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    deleteCategory: (id: number) => request<void>(`${base}/categories/${id}`, { method: 'DELETE' }),

    getPeople: () => request<Person[]>(`${base}/people`),
    createPerson: (data: { name: string; category_id: number | null; relationship?: string; notes?: string }) =>
      request<Person>(`${base}/people`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    updatePerson: (
      id: number,
      data: Partial<{ name: string; category_id: number | null; relationship: string; notes: string; cover_photo_id: number | null }>
    ) =>
      request<Person>(`${base}/people/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    deletePerson: (id: number) => request<void>(`${base}/people/${id}`, { method: 'DELETE' }),

    addPersonLink: (id: number, linkedPersonId: number) =>
      request<Person>(`${base}/people/${id}/links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linked_person_id: linkedPersonId }),
      }),
    removePersonLink: (id: number, linkedPersonId: number) =>
      request<void>(`${base}/people/${id}/links/${linkedPersonId}`, { method: 'DELETE' }),

    uploadPhotos: async (personId: number, files: File[]) => {
      const form = new FormData();
      files.forEach((f) => form.append('photos', f));
      return request<Photo[]>(`${base}/people/${personId}/photos`, { method: 'POST', body: form });
    },
    deletePhoto: (id: number) => request<void>(`${base}/photos/${id}`, { method: 'DELETE' }),
    updatePhoto: (id: number, caption: string) =>
      request<Photo>(`${base}/photos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caption }),
      }),
  };
}

export type Api = ReturnType<typeof createApi>;
