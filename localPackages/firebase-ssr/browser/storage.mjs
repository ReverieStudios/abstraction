import {
	getStorage,
	connectStorageEmulator,
	deleteObject,
	getDownloadURL,
	listAll,
	uploadBytes,
	uploadString,
	ref
} from 'firebase/storage';

let initialized = false;
export const getComponent = (app, emulators) => {
	const storage = getStorage(app);
	if (!initialized) {
		if (emulators && emulators.storage && emulators.storage.host) {
			connectStorageEmulator(storage, emulators.storage.host, emulators.storage.port);
		}
	}

	return {
		storage: {
			upload: (path, data, metadata) => {
				const r = ref(storage, path);
				if (typeof data === 'string') {
					return uploadString(r, data, metadata);
				}
				return uploadBytes(r, data, metadata);
			},
			delete: (path) => deleteObject(ref(storage, path)),
			listAll: (path) => listAll(ref(storage, path)),
			getDownloadURL: (path) => getDownloadURL(ref(storage, path))
		}
	};
};
