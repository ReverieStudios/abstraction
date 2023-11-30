import admin from 'firebase-admin';

const noop = () => {};

export const getComponent = (app, emulators) => {
	if (emulators && emulators.store && emulators.store.host) {
		process.env.FIRESTORE_EMULATOR_HOST = `${emulators.store.host}:${emulators.store.port}`;
	}

	const store = app.firestore();

	return {
		store: {
			generateID: () => {
				const col = store.collection('__autogenerate');
				return col.doc().id;
			},
			collection: (path, queries = []) =>
				queries.reduce((acc, query) => {
					if (query.sortBy) {
						return acc.orderBy(query.sortBy);
					} else {
						return acc.where(query.field, query.op, query.value);
					}
				}, store.collection(path)),
			doc: (pathOrCollection) => {
				if (typeof pathOrCollection === 'string') {
					return store.doc(pathOrCollection);
				} else {
					return pathOrCollection.doc();
				}
			},
			collectionDoc: (path) => store.collection(path).doc(),
			getDoc: (doc) => doc.get(),
			getDocs: (query) => query.get(),
			onSnapshot: () => {
				return noop;
			},
			setDoc: (doc, data, opts) => doc.set(data, opts),
			addDoc: (collection, data) => collection.add(data),
			deleteDoc: (doc) => doc.delete(),
			writeBatch: () => store.batch(),
			runTransaction: (updateFn) => store.runTransaction(updateFn),
			fieldValues: {
				arrayUnion: admin.firestore.FieldValue.arrayUnion,
				arrayRemove: admin.firestore.FieldValue.arrayRemove,
				delete: admin.firestore.FieldValue.delete,
				increment: admin.firestore.FieldValue.increment,
				serverTimestamp: admin.firestore.FieldValue.serverTimestamp
			}
		}
	};
};
