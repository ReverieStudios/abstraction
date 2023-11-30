import admin from 'firebase-admin';

export const getComponent = (app, emulators) => {
	if (emulators && emulators.storage && emulators.storage.host) {
		process.env.FIREBASE_STORAGE_EMULATOR_HOST = `${emulators.storage.host}:${emulators.storage.port}`;
	}

	const bucket = admin.storage(app).bucket();

	return {
		storage: {
			upload: (path, data) => bucket.file(path).save(data),
			delete: (path) => bucket.file(path).delete(),
			listAll: (path) => bucket.getFiles({ prefix: path, delimiter: '/' }),
			getDownloadURL: (path) =>
				bucket
					.file(path)
					.getSignedUrl({ action: 'read' })
					.then((urls) => urls[0])
		}
	};
};
