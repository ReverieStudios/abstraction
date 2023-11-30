import type {
	DocumentData,
	DocumentReference,
	Transaction,
	WithFieldValue,
	WriteBatch
} from 'firebase/firestore';
import { store, deleted } from '$lib/firebase';

export interface Snapshot {
	id: string;
	ref: DocumentReference;
	data(): DocumentData;
	exists: boolean | (() => boolean);
}

export class DocType<T = Object> {
	id: string;
	protected ref: DocumentReference<T>;
	data: T;
	exists: boolean;
	cacheField: string;

	constructor(doc: Snapshot, cacheField: string) {
		this.id = doc.id;
		this.ref = doc.ref as DocumentReference<T>;
		this.data = doc.data() as T;
		this.exists = typeof doc.exists === 'function' ? doc.exists() : doc.exists;
		this.cacheField = cacheField;
	}

	remove(transaction?: WriteBatch) {
		if (transaction) {
			if (this.cacheField) {
				transaction.update(this.ref, { [deleted]: true, [this.cacheField]: Date.now() } as any);
			} else {
				transaction.delete(this.ref);
			}
			return Promise.resolve();
		}
		if (this.cacheField) {
			return store.setDoc(this.ref, { [deleted]: true, [this.cacheField]: Date.now() } as any, {
				merge: true
			});
		} else {
			return store.deleteDoc(this.ref);
		}
	}

	update(newValues: WithFieldValue<Partial<T>>, transaction?: WriteBatch | Transaction) {
		const values = newValues as any;
		if (this.cacheField) {
			values[this.cacheField] = Date.now();
		}

		if (transaction) {
			// @ts-ignore - signature is literally the same
			return transaction.set<T>(this.ref, values, {
				mergeFields: Object.keys(values)
			});
		}
		return store.setDoc<T>(this.ref, values, { mergeFields: Object.keys(values) });
	}

	save(newValues: WithFieldValue<T>, transaction?: WriteBatch | Transaction) {
		const values = newValues as any;
		if (this.cacheField) {
			values[this.cacheField] = Date.now();
		}

		if (transaction) {
			// @ts-ignore - signature is literally the same
			return transaction.set(this.ref, values);
		}
		return store.setDoc(this.ref, values);
	}
}
