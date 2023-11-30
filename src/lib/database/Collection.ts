import type { Snapshot } from './DocType';
import { DocType } from './DocType';
import { noop } from 'svelte/internal';
import type { Writable, Subscriber } from 'svelte/store';
import { writable } from 'svelte/store';
import { CollectionDocument } from './CollectionDocument';

import { store as firestore, deleted } from '$lib/firebase';
import type { QueryClause } from 'firebase-ssr';
import type { Query, Transaction, WithFieldValue } from 'firebase/firestore';
import { sortBy } from 'lodash-es';

interface CollectionOptions {
	sortBy?: string;
	queries?: QueryClause[];
	cacheField?: string;
}

export class Collection<T = Object> {
	hasLoaded: Writable<boolean>;
	path: string;
	docs: DocType<T>[];
	private subscribers: Subscriber<DocType<T>[]>[];
	stop: () => void;
	options: CollectionOptions;
	private readDocs: Map<string, CollectionDocument<T>>;

	constructor(path: string, options: CollectionOptions = {}) {
		this.hasLoaded = writable(false);
		this.path = path;
		this.stop = noop;
		this.subscribers = [];
		this.docs = [];
		this.options = options;
		this.readDocs = new Map();
	}

	get query(): Query {
		return firestore.collection(this.path, [...(this.options.queries ?? [])]);
	}

	withQueries(...queries: QueryClause[]) {
		return new Collection<T>(this.path, {
			...this.options,
			queries: [...(this.options.queries ?? []), ...queries]
		});
	}

	whereFieldExists(field: string) {
		return this.withQueries({ sortBy: field });
	}
	doc(id: string) {
		if (!this.readDocs.has(id)) {
			this.readDocs.set(
				id,
				new CollectionDocument<T>(`${this.path}/${id}`, this.options.cacheField)
			);
		}
		return this.readDocs.get(id);
	}

	async addDoc(data: WithFieldValue<T>, id?: string, transaction?: Transaction): Promise<string> {
		const doc = id
			? firestore.doc(`${this.path}/${id}`)
			: firestore.doc(firestore.collection(this.path));

		if (this.options.cacheField) {
			data[this.options.cacheField] = Date.now();
		}

		if (transaction) {
			transaction.set(doc, data as any);
			return Promise.resolve(doc.id);
		}
		return firestore.setDoc(doc, data as any).then(() => doc.id);
	}

	private async start() {
		// console.log('start watching collection', this.path);
		let stopped = false;
		this.stop = () => {
			stopped = true;
			this.stop = noop;
		};
		if (this.options.cacheField) {
			// get query from cache
			firestore.getDocs(this.query, true).then((cacheRef) => {
				if (!stopped) {
					const docs = cacheRef.docs.map((doc) => this.wrapDoc(doc));
					const cacheTimes = docs.map((doc) => doc.data[this.options.cacheField]);

					const lastCacheRead = Math.max(0, ...cacheTimes);
					this.setDocs(docs);
					const data = new Map(docs.map((doc) => [doc.id, doc]));
					const afterCache = firestore.collection(this.path, [
						...(this.options.queries ?? []),
						{ sortBy: this.options.cacheField },
						{ field: this.options.cacheField, op: '>=', value: lastCacheRead }
					]);

					this.stop = firestore.onSnapshot(afterCache, (snapshot) => {
						console.log({
							lastCacheRead,
							cached: docs.length,
							server: snapshot.docs.map((d) => d.id)
						});
						this.hasLoaded.set(true);
						snapshot.docs.forEach((doc) => {
							data.set(doc.id, this.wrapDoc(doc));
						});
						this.setDocs(Array.from(data.values()));
					});
				}
			});
		} else {
			this.stop = firestore.onSnapshot(this.query, (snapshot) => {
				this.hasLoaded.set(true);
				this.setDocs(snapshot.docs.map((doc) => this.wrapDoc(doc)));
			});
		}
	}

	private setDocs(docs: DocType<T>[]) {
		const withoutDeleted = docs.filter((doc) => doc.data?.[deleted] !== true);
		const sorted = this.options.sortBy
			? sortBy(withoutDeleted, `data.${this.options.sortBy}`)
			: withoutDeleted;

		this.docs = sorted;
		this.emit();
	}

	private emit() {
		this.subscribers.forEach((run) => run(this.docs));
	}

	private wrapDoc(doc: Snapshot) {
		return new DocType<T>(doc, this.options.cacheField);
	}

	async read() {
		return firestore
			.getDocs(this.query)
			.then((snapshot) => snapshot.docs.map((doc) => this.wrapDoc(doc)));
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

	subscribe(subscriber: Subscriber<DocType<T>[]>): () => void {
		this.subscribers.push(subscriber);
		if (this.stop === noop) {
			this.start();
		}
		subscriber(this.docs);
		return () => {
			const index = this.subscribers.indexOf(subscriber);
			if (index !== -1) {
				this.subscribers.splice(index, 1);
			}
			if (this.subscribers.length === 0) {
				// TODO delay stopping watch for N seconds in case next page wants same data?
				console.log('stop watching doc', this.path);
				this.stop();
				this.stop = noop;
			}
		};
	}
}
