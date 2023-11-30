import {
	collection,
	doc,
	getFirestore,
	enableMultiTabIndexedDbPersistence,
	connectFirestoreEmulator,
	getDoc,
	getDocs,
	getDocsFromCache,
	onSnapshot,
	setDoc,
	addDoc,
	deleteDoc,
	query,
	orderBy,
	runTransaction,
	where,
	writeBatch,
	arrayRemove,
	arrayUnion,
	deleteField,
	increment,
	serverTimestamp
} from 'firebase/firestore';

let initialized = false;
export const getComponent = (app, emulators) => {
	const store = getFirestore(app);

	if (!initialized) {
		initialized = true;
		if (emulators && emulators.store && emulators.store.host) {
			connectFirestoreEmulator(store, emulators.store.host, emulators.store.port);
		}
		const isApple = /(iP(ad|od|hone)|Safari)/i.test(window.navigator.userAgent);
		if (!isApple) {
			enableMultiTabIndexedDbPersistence(store).catch(console.error);
		}
	}

	return {
		store: {
			generateID: () => {
				const col = collection(store, '__autogenerate');
				return doc(col).id;
			},
			collection: (path, queries = []) => {
				const conditions = queries
					.map((query) => {
						if (query.sortBy) {
							return orderBy(query.sortBy);
						} else {
							return where(query.field, query.op, query.value);
						}
					})
					.filter(Boolean);
				const collectionRef = collection(store, path);
				return conditions.length === 0 ? collectionRef : query(collectionRef, ...conditions);
			},
			doc: (pathOrCollection) => {
				if (typeof pathOrCollection === 'string') {
					return doc(store, pathOrCollection);
				} else {
					return doc(pathOrCollection);
				}
			},
			collectionDoc: (path) => doc(collection(store, path)),
			getDoc,
			getDocs: (query, fromCache) => {
				if (fromCache) {
					return getDocsFromCache(query);
				}
				return getDocs(query);
			},
			onSnapshot,
			setDoc,
			addDoc,
			deleteDoc,
			writeBatch: () => writeBatch(store),
			runTransaction: (updateFn) => runTransaction(store, updateFn),
			fieldValues: {
				arrayUnion,
				arrayRemove,
				delete: deleteField,
				increment,
				serverTimestamp
			}
		}
	};
};
