import { initializeApp, getApps } from 'firebase/app';

export { getComponent as Auth } from './auth.mjs';
export { getComponent as Storage } from './storage.mjs';
export { getComponent as Store } from './store.mjs';

export const init = (config, components, emulators) => {
	const existing = getApps()[0];
	const app = existing || initializeApp(config);

	return components.reduce(
		(acc, fn) => ({
			...acc,
			...fn(app, emulators)
		}),
		{}
	);
};
