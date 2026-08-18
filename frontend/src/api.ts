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

export const api = {
  getCategories: () => request<Category[]>('/api/categories'),
  createCategory: (data: { name: string; color: string }) =>
    request<Category>('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  updateCategory: (id: number, data: Partial<{ name: string; color: string }>) =>
    request<Category>(`/api/categories/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  deleteCategory: (id: number) => request<void>(`/api/categories/${id}`, { method: 'DELETE' }),

  getPeople: () => request<Person[]>('/api/people'),
  createPerson: (data: { name: string; category_id: number; relationship?: string; notes?: string }) =>
    request<Person>('/api/people', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  updatePerson: (
    id: number,
    data: Partial<{ name: string; category_id: number; relationship: string; notes: string; cover_photo_id: number | null }>
  ) =>
    request<Person>(`/api/people/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  deletePerson: (id: number) => request<void>(`/api/people/${id}`, { method: 'DELETE' }),

  uploadPhotos: async (personId: number, files: File[]) => {
    const form = new FormData();
    files.forEach((f) => form.append('photos', f));
    return request<Photo[]>(`/api/people/${personId}/photos`, { method: 'POST', body: form });
  },
  deletePhoto: (id: number) => request<void>(`/api/photos/${id}`, { method: 'DELETE' }),
  updatePhoto: (id: number, caption: string) =>
    request<Photo>(`/api/photos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caption }),
    }),
};
