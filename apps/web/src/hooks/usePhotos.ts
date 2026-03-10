import { useCallback, useEffect, useRef, useState } from 'react';
import { authFetch, authUpload } from '../lib/api';

export interface PhotoData {
  id: string;
  coupleId: string;
  uploadedByUserId: string;
  url: string;
  thumbnailUrl: string | null;
  caption: string | null;
  takenAt: string | null;
  createdAt: string;
}

const PAGE_SIZE = 36;

export function usePhotos(coupleId: string) {
  const [photos, setPhotos] = useState<PhotoData[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const cursorRef = useRef<string | null>(null);
  const initialLoadDone = useRef(false);

  const fetchPhotos = useCallback(async (cursor?: string) => {
    if (!coupleId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ coupleId, take: String(PAGE_SIZE) });
      if (cursor) params.set('cursor', cursor);
      const res = await authFetch(`/v1/photos?${params}`);
      if (!res.ok) throw new Error('Failed to fetch photos');
      const data = (await res.json()) as PhotoData[];

      if (data.length < PAGE_SIZE) {
        setHasMore(false);
      }

      if (cursor) {
        setPhotos((prev) => [...prev, ...data]);
      } else {
        setPhotos(data);
      }

      if (data.length > 0) {
        cursorRef.current = data[data.length - 1].id;
      }
    } catch (error) {
      console.error('Failed to fetch photos:', error);
    } finally {
      setLoading(false);
    }
  }, [coupleId]);

  useEffect(() => {
    if (coupleId && !initialLoadDone.current) {
      initialLoadDone.current = true;
      cursorRef.current = null;
      setHasMore(true);
      fetchPhotos();
    }
  }, [coupleId, fetchPhotos]);

  const loadMore = useCallback(() => {
    if (loading || !hasMore || !cursorRef.current) return;
    fetchPhotos(cursorRef.current);
  }, [loading, hasMore, fetchPhotos]);

  const uploadPhotos = useCallback(async (files: File[]) => {
    if (!coupleId || files.length === 0) return [];

    const formData = new FormData();
    formData.append('coupleId', coupleId);
    for (const file of files) {
      formData.append('files', file);
    }

    const res = await authUpload('/v1/photos', formData);
    if (!res.ok) throw new Error('Failed to upload photos');
    const uploaded = (await res.json()) as PhotoData[];
    setPhotos((prev) => [...uploaded, ...prev]);
    return uploaded;
  }, [coupleId]);

  const deletePhoto = useCallback(async (photoId: string) => {
    const res = await authFetch(`/v1/photos/${photoId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete photo');
    setPhotos((prev) => prev.filter((p) => p.id !== photoId));
  }, []);

  const deletePhotos = useCallback(async (photoIds: string[]) => {
    if (photoIds.length === 0) return;
    const res = await authFetch('/v1/photos', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: photoIds }),
    });
    if (!res.ok) throw new Error('Failed to delete photos');
    const idSet = new Set(photoIds);
    setPhotos((prev) => prev.filter((p) => !idSet.has(p.id)));
  }, []);

  const refetch = useCallback(() => {
    cursorRef.current = null;
    setHasMore(true);
    initialLoadDone.current = false;
    fetchPhotos();
    initialLoadDone.current = true;
  }, [fetchPhotos]);

  return { photos, loading, hasMore, loadMore, uploadPhotos, deletePhoto, deletePhotos, refetch };
}
