export interface Category {
  id: number;
  name: string;
  color: string;
  sort_order: number;
}

export interface Photo {
  id: number;
  person_id: number;
  filename: string;
  thumb_filename: string | null;
  caption: string | null;
  created_at: string;
}

export interface Person {
  id: number;
  name: string;
  category_id: number;
  relationship: string | null;
  notes: string | null;
  cover_photo_id: number | null;
  created_at: string;
  photos: Photo[];
}
