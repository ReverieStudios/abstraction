import {
	getAuth,
	setPersistence,
	GoogleAuthProvider,
	EmailAuthProvider,
	createUserWithEmailAndPassword,
	signInWithEmailAndPassword,
	connectAuthEmulator,
	browserLocalPersistence,
	signInWithPopup,
	signInWithRedirect,
	signOut,
	onAuthStateChanged,
	onIdTokenChanged,
	reauthenticateWithCredential,
	updatePassword
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
			getCurrentUser: () => auth.currentUser,
			changePassword: async (currentPassword, newPassword) => {
				const user = auth.currentUser;
				if (!user) throw new Error('No authenticated user');
				const credential = EmailAuthProvider.credential(user.email, currentPassword);
				await reauthenticateWithCredential(user, credential);
				await updatePassword(user, newPassword);
			},
			getUser: unimplemented,
			updateUser: unimplemented,
			deleteUser: unimplemented
		}
	};
};
