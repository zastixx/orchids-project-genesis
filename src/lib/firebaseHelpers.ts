import { database } from './firebase';
import {
  ref,
  set,
  update,
  remove,
  push,
  onValue,
  off,
  DatabaseReference,
} from 'firebase/database';

export function createItem(path: string, data: Record<string, unknown>): Promise<string> {
  const listRef = ref(database, path);
  const newRef = push(listRef);
  return set(newRef, data).then(() => newRef.key as string);
}

export function setItem(path: string, data: Record<string, unknown>): Promise<void> {
  const itemRef = ref(database, path);
  return set(itemRef, data);
}

export function updateItem(path: string, data: Record<string, unknown>): Promise<void> {
  const itemRef = ref(database, path);
  return update(itemRef, data);
}

export function deleteItem(path: string): Promise<void> {
  const itemRef = ref(database, path);
  return remove(itemRef);
}

export function listenToPath(
  path: string,
  callback: (data: unknown) => void
): () => void {
  const itemRef: DatabaseReference = ref(database, path);
  onValue(itemRef, (snapshot) => {
    callback(snapshot.val());
  });
  return () => off(itemRef);
}

export function objectToArray<T>(obj: Record<string, T> | null): (T & { id: string })[] {
  if (!obj) return [];
  return Object.entries(obj).map(([id, value]) => ({ id, ...(value as object) } as T & { id: string }));
}
