// ─────────────────────────────────────────────────────────────────────────────
// EnvVault – Firestore Base Repository
// Generic repository pattern for type-safe Firestore operations.
// All feature-specific repositories extend this base.
// ─────────────────────────────────────────────────────────────────────────────

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  DocumentSnapshot,
  QueryConstraint,
  WriteBatch,
  writeBatch,
  onSnapshot,
  Unsubscribe,
  QueryDocumentSnapshot,
  DocumentData,
} from 'firebase/firestore';
import { db } from '../../firebase/config';

// ── Types ───────────────────────────────────────────────────────────────────

export interface PaginatedResult<T> {
  data: T[];
  lastDoc: DocumentSnapshot | null;
  hasMore: boolean;
}

export interface QueryOptions {
  constraints?: QueryConstraint[];
  orderByField?: string;
  orderDirection?: 'asc' | 'desc';
  pageSize?: number;
  startAfterDoc?: DocumentSnapshot;
}

// ── Base Repository ─────────────────────────────────────────────────────────

export class FirestoreRepository<T extends { id: string }> {
  protected readonly collectionName: string;

  constructor(collectionName: string) {
    this.collectionName = collectionName;
  }

  // ── Reference Helpers ───────────────────────────────────────────────────

  protected get collectionRef() {
    return collection(db, this.collectionName);
  }

  protected docRef(id: string) {
    return doc(db, this.collectionName, id);
  }

  protected newDocRef() {
    return doc(this.collectionRef);
  }

  // ── Read Operations ─────────────────────────────────────────────────────

  async getById(id: string): Promise<T | null> {
    const snapshot = await getDoc(this.docRef(id));
    if (!snapshot.exists()) return null;
    return { id: snapshot.id, ...snapshot.data() } as T;
  }

  async getAll(options?: QueryOptions): Promise<T[]> {
    const constraints = this.buildConstraints(options);
    const q = query(this.collectionRef, ...constraints);
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as T);
  }

  async getPaginated(options?: QueryOptions): Promise<PaginatedResult<T>> {
    const pageSize = options?.pageSize ?? 25;
    const constraints = this.buildConstraints({
      ...options,
      pageSize: pageSize + 1, // Fetch one extra to detect hasMore
    });

    const q = query(this.collectionRef, ...constraints);
    const snapshot = await getDocs(q);
    const docs = snapshot.docs;
    const hasMore = docs.length > pageSize;
    const items = (hasMore ? docs.slice(0, pageSize) : docs).map(
      (d) => ({ id: d.id, ...d.data() }) as T,
    );

    return {
      data: items,
      lastDoc: items.length > 0 ? docs[items.length - 1] : null,
      hasMore,
    };
  }

  async getByField(
    field: string,
    value: unknown,
    additionalConstraints?: QueryConstraint[],
  ): Promise<T[]> {
    const constraints: QueryConstraint[] = [
      where(field, '==', value),
      ...(additionalConstraints ?? []),
    ];
    const q = query(this.collectionRef, ...constraints);
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as T);
  }

  // ── Write Operations ────────────────────────────────────────────────────

  async create(data: Omit<T, 'id'>, customId?: string): Promise<T> {
    const ref = customId ? this.docRef(customId) : this.newDocRef();
    const document = { ...data, id: ref.id } as unknown as T;
    await setDoc(ref, document as DocumentData);
    return document;
  }

  async update(id: string, data: Partial<T>): Promise<void> {
    const ref = this.docRef(id);
    await updateDoc(ref, data as DocumentData);
  }

  async upsert(id: string, data: Partial<T>): Promise<void> {
    const ref = this.docRef(id);
    await setDoc(ref, data as DocumentData, { merge: true });
  }

  async delete(id: string): Promise<void> {
    await deleteDoc(this.docRef(id));
  }

  /**
   * Soft delete: sets `isDeleted`, `deletedAt`, and `deletedBy` fields.
   */
  async softDelete(id: string, userId: string): Promise<void> {
    await this.update(id, {
      isDeleted: true,
      deletedAt: Date.now(),
      deletedBy: userId,
    } as unknown as Partial<T>);
  }

  // ── Batch Operations ────────────────────────────────────────────────────

  createBatch(): WriteBatch {
    return writeBatch(db);
  }

  addToBatch(batch: WriteBatch, id: string, data: Partial<T>): void {
    batch.set(this.docRef(id), data as DocumentData, { merge: true });
  }

  deleteFromBatch(batch: WriteBatch, id: string): void {
    batch.delete(this.docRef(id));
  }

  // ── Real-time Listeners ─────────────────────────────────────────────────

  onSnapshotById(id: string, callback: (data: T | null) => void): Unsubscribe {
    return onSnapshot(this.docRef(id), (snapshot) => {
      if (!snapshot.exists()) {
        callback(null);
        return;
      }
      callback({ id: snapshot.id, ...snapshot.data() } as T);
    });
  }

  onSnapshotQuery(
    options: QueryOptions,
    callback: (data: T[]) => void,
  ): Unsubscribe {
    const constraints = this.buildConstraints(options);
    const q = query(this.collectionRef, ...constraints);
    return onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(
        (d: QueryDocumentSnapshot) => ({ id: d.id, ...d.data() }) as T,
      );
      callback(items);
    });
  }

  // ── Private Helpers ─────────────────────────────────────────────────────

  private buildConstraints(options?: QueryOptions): QueryConstraint[] {
    const constraints: QueryConstraint[] = [];

    if (options?.constraints) {
      constraints.push(...options.constraints);
    }

    if (options?.orderByField) {
      constraints.push(orderBy(options.orderByField, options.orderDirection ?? 'desc'));
    }

    if (options?.startAfterDoc) {
      constraints.push(startAfter(options.startAfterDoc));
    }

    if (options?.pageSize) {
      constraints.push(limit(options.pageSize));
    }

    return constraints;
  }
}
