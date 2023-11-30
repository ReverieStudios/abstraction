import {
	getAuth,
	setPersistence,
	GoogleAuthProvider,
	createUserWithEmailAndPassword,
	signInWithEmailAndPassword,
	connectAuthEmulator,
	browserLocalPersistence,
	signInWithPopup,
	signInWithRedirect,
	signOut,
	onAuthStateChanged,
	onIdTokenChanged
} from 'firebase/auth';

const unimplemented = () => {
	throw new Error('Not implemented');
};

let initialized = false;
export const getComponent = (app, emulators) => {
	const auth = getAuth(app);

	if (!initialized) {
		initialized = true;
		if (emulators && emulators.auth) {
			connectAuthEmulator(auth, `http://${emulators.auth}`);
		}

		setPersistence(auth, browserLocalPersistence);
	}

	return {
		auth: {
			signInWithEmailAndPassword: (email, password) =>
				signInWithEmailAndPassword(auth, email, password),
			createUserWithEmailAndPassword: (email, password) =>
				createUserWithEmailAndPassword(auth, email, password),
			signInWithPopup: (provider) => signInWithPopup(auth, provider),
			signInWithRedirect: (provider) => signInWithRedirect(auth, provider),
			signOut: () => signOut(auth),
			onAuthStateChanged: (callback) => onAuthStateChanged(auth, callback),
			onIdTokenChanged: (callback) => onIdTokenChanged(auth, callback),
			decodeToken: () => {},
			providers: {
				Google: new GoogleAuthProvider()
			},
			getUser: unimplemented,
			updateUser: unimplemented,
			deleteUser: unimplemented
		}
	};
};
