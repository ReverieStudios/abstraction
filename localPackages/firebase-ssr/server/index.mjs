import admin from 'firebase-admin';

export { getComponent as Auth } from './auth.mjs';
export { getComponent as Storage } from './storage.mjs';
export { getComponent as Store } from './store.mjs';

export const init = (config, components, emulators) => {
	config.credential = admin.credential.cert(config.credential);
	const app = admin.apps[0] || admin.initializeApp(config);

	return components.reduce(
		(acc, fn) => ({
			...acc,
			...fn(app, emulators)
		}),
		{}
	);
};
