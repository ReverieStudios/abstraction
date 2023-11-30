import { noop } from 'svelte/internal';
import type { Writable, Subscriber } from 'svelte/store';
import { writable } from 'svelte/store';
import type {
	DocumentReference,
	DocumentSnapshot,
	Transaction,
	WithFieldValue
} from 'firebase/firestore';
import { store as firestore, deleted } from '$lib/firebase';
import type { DocType, Snapshot } from './DocType';

export abstract class Subscribable<T = Object, DT = DocType<T>> {
	hasLoaded: Writable<boolean>;
	data: DT;
	private subscribers: Subscriber<DT>[];
	stop: () => void;
	path: string;
	id: string;
	cacheField: string;

	constructor(path: string, cacheField?: string) {
		this.path = path;
		this.hasLoaded = writable(false);
		this.stop = noop;
		this.subscribers = [];
		this.cacheField = cacheField;
	}

	private start() {
		// console.log('start watching doc', this.path);
		const doc = firestore.doc(this.path);
		this.stop = firestore.onSnapshot(doc, (snapshot: DocumentSnapshot<T>) => {
			this.hasLoaded.set(true);
			this.data = this.wrapDoc(snapshot);
			this.emit();
		});
	}

	private emit() {
		this.subscribers.forEach((run) => run(this.data));
	}

	protected abstract wrapDoc(doc: Snapshot): DT;

	remove(transaction?: Transaction) {
		const doc = firestore.doc(this.path);
		if (transaction) {
			if (this.cacheField) {
				transaction.update(doc, { [deleted]: true, [this.cacheField]: Date.now() });
			} else {
				transaction.delete(doc);
			}
			return Promise.resolve();
		}
		if (this.cacheField) {
			return firestore.setDoc(doc, { [deleted]: true, [this.cacheField]: Date.now() });
		} else {
			return firestore.deleteDoc(doc);
		}
	}

	update(newValues: WithFieldValue<Partial<T>>, transaction?: Transaction) {
		const values = newValues as any;
		const doc = firestore.doc(this.path) as DocumentReference<T>;
		if (this.cacheField) {
			values[deleted] = false;
			values[this.cacheField] = Date.now();
		}
		if (transaction) {
			transaction.set(doc, values, { merge: true });
			return Promise.resolve();
		}
		return firestore.setDoc(doc, values, { merge: true });
	}

	save(newValues: WithFieldValue<T>, transaction?: Transaction) {
		const values = newValues as any;
		const doc = firestore.doc(this.path) as DocumentReference<T>;
		if (this.cacheField) {
			values[deleted] = false;
			values[this.cacheField] = Date.now();
		}
		if (transaction) {
			transaction.set(doc, values);
			return Promise.resolve();
		}
		return firestore.setDoc(doc, values);
	}

	async read(transaction?: Transaction) {
		const doc = firestore.doc(this.path);
		if (transaction) {
			return transaction.get(doc).then((d) => this.wrapDoc(d));
		}
		return firestore.getDoc(doc).then((d) => this.wrapDoc(d));
	}

	awaitLoad(): Promise<void> {
		return new Promise((resolve) => {
			if (this.stop === noop) {
				this.start();
			}
			this.hasLoaded.subscribe((loaded) => {
				if (loaded) {
					resolve();
				}
			});
		});
	}

	subscribe(subscriber: Subscriber<DT>): () => void {
		this.subscribers.push(subscriber);
		if (this.stop === noop) {
			this.start();
		}
		subscriber(this.data);
		return () => {
			const index = this.subscribers.indexOf(subscriber);
			if (index !== -1) {
				this.subscribers.splice(index, 1);
			}
			if (this.subscribers.length === 0) {
				this.stop();
				this.stop = noop;
			}
		};
	}
}
