import { FileStateStore, FileReadEntry } from './types';

export class SessionFileStateStore implements FileStateStore {
  private store = new Map<string, FileReadEntry>();

  get(path: string): FileReadEntry | undefined {
    return this.store.get(path);
  }

  set(path: string, entry: FileReadEntry): void {
    this.store.set(path, entry);
  }

  has(path: string): boolean {
    return this.store.has(path);
  }

  clear(): void {
    this.store.clear();
  }
}
