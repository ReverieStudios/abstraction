import type { DocumentReference, FieldValue, SetOptions, WithFieldValue } from 'firebase/firestore';
import type { Transaction, WriteBatch } from 'firebase/firestore';
import type { Snapshot } from './DocType';
import { sortBy } from 'lodash-es';
import { store, generateID } from '$lib/firebase';
import { Subscribable } from './Subscribable';
import { derived } from 'svelte/store';
import type { Readable, Subscriber, Writable } from 'svelte/store';

const isWriteBatch = (transaction: WriteBatch | Transaction): transaction is WriteBatch => {
	return (transaction as WriteBatch).commit != null;
};
const isTransaction = (transaction: WriteBatch | Transaction): transaction is Transaction => {
	return (transaction as Transaction).get != null;
};

export class SubDocType<T = Object> {
	id: string;
	protected ref: DocumentReference;
	data: T;

	constructor(doc: Snapshot, subDoc: T, key: string) {
		this.id = key;
		this.ref = doc.ref;
		this.data = subDoc;
	}

	protected updateRef(
		newValues: Object | FieldValue,
		transaction?: WriteBatch | Transaction,
		mergeArg?: SetOptions
	) {
		if (transaction) {
			if (isWriteBatch(transaction)) {
				transaction.set(this.ref, { [this.id]: newValues }, mergeArg);
				return Promise.resolve();
			} else if (isTransaction(transaction)) {
				transaction.set(this.ref, { [this.id]: newValues }, mergeArg);
				return Promise.resolve();
			}
		}
		return store.setDoc(this.ref, { [this.id]: newValues }, mergeArg);
	}

	remove(transaction?: WriteBatch | Transaction) {
		return this.updateRef(store.fieldValues.delete(), transaction, { merge: true });
	}

	update(newValues: WithFieldValue<Partial<T>>, transaction?: WriteBatch | Transaction) {
		return this.updateRef(newValues, transaction, { merge: true });
	}

	save(newValues: T, transaction?: WriteBatch | Transaction) {
		return this.updateRef(newValues, transaction, { mergeFields: [this.id] });
	}
}

class Mapped<T = Object> {
	id: string;
	collection: DocumentMap<T>;
	store: Readable<SubDocType<T>>;
	hasLoaded: Writable<boolean>;

	constructor(collection: DocumentMap<T>, id: string) {
		this.id = id;
		this.collection = collection;
		this.store = derived(collection, ($collection) => {
			return $collection.find((doc) => doc.id === id);
		});
		this.hasLoaded = collection.hasLoaded;
	}

	set(data: T | FieldValue) {
		return this.collection.set({ [this.id]: data });
	}

	subscribe(subscriber: Subscriber<SubDocType<T>>): () => void {
		return this.store.subscribe(subscriber);
	}
}

export class DocumentMap<T = Object> extends Subscribable<T, SubDocType<T>[]> {
	constructor(path: string, private sortBy?: string) {
		super(path, null);
		this.data = [];
	}

	doc(id: string): Mapped<T> {
		return new Mapped<T>(this, id);
	}

	addDoc(data: WithFieldValue<T>, maybeId?: string) {
		const id = maybeId || generateID();
		return store.setDoc(store.doc(this.path), { [id]: data }, { merge: true });
	}

	set(data: Record<string, T | FieldValue>, fullMerge = true) {
		const merge = fullMerge ? { merge: true } : { mergeFields: Object.keys(data) };
		return store.setDoc(store.doc(this.path), data, merge);
	}

	protected wrapDoc(doc: Snapshot) {
		const entries = Object.entries(doc.data() ?? {});
		const subDocs = this.sortBy ? sortBy(entries, `1.${this.sortBy}`) : entries;

		return subDocs.map(([key, subDoc]) => new SubDocType<T>(doc, subDoc, key));
	}
}
