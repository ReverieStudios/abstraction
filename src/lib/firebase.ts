import { invalidateAll } from '$app/navigation';
import { init, Auth, Storage, Store } from 'firebase-ssr';
import type { UserCredential } from 'firebase/auth';


const CONFIG = JSON.parse(
	(import.meta.env.SSR as boolean)
		? (import.meta.env.VITE_FIREBASE_SERVER_CONFIG as string)
		: (import.meta.env.VITE_FIREBASE_CLIENT_CONFIG as string)
);
interface Emulators {
	auth?: string;
	store?: { host: string; port: string };
}
const EMULATORS: Emulators = {};
if (import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_HOST) {
	EMULATORS.auth = import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_HOST as string;
}
if (import.meta.env.VITE_FIRESTORE_EMULATOR_HOST) {
	EMULATORS.store = {
		host: import.meta.env.VITE_FIRESTORE_EMULATOR_HOST as string,
		port: import.meta.env.VITE_FIRESTORE_EMULATOR_PORT as string
	};
}
const { auth, storage, store } = init(CONFIG, [Auth, Storage, Store], EMULATORS);
// TODO move into store
export const generateID = store?.generateID;

export { auth, storage, store };

export const deleted = '__deleted';

export const listenForAuth = () => {
	const callback = async (user) => {
		const token = await (user ? user.getIdToken() : '');
		console.log("callback called ", user);
		setToken(token);
		if (user && window.location.pathname === '/') {
			console.log("callback going home");
			window.location.href = '/home';
			await invalidateAll();
		}

	};
	auth?.onAuthStateChanged(callback);
	auth?.onIdTokenChanged(callback);
};

export const handleSignIn = async (userCredential: UserCredential) => {
	console.log("handleSignIn called");
	const user = userCredential?.user;
	if (user) {
		console.log("handleSignIn should redirect");
		return user
			.getIdToken(true)
			.then(setToken)
			.then(() => (window.location.href = '/home'));
	}
};

export const signOut = () => {
	setToken('')
		.then(auth?.signOut)
		.then(() => (window.location.href = '/'));
};

async function setToken(token: string) {
	const options = {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json;charset=utf-8'
		},
		body: JSON.stringify({ token })
	};

	await fetch('/api/token', options);
}
