import admin from 'firebase-admin';

const noop = () => {};

export const getComponent = (app, emulators) => {
	if (emulators && emulators.auth) {
		process.env.FIREBASE_AUTH_EMULATOR_HOST = emulators.auth;
	}

	const auth = admin.auth(app);

	return {
		auth: {
			signInWithEmailAndPassword: noop,
			createUserWithEmailAndPassword: noop,
			signInWithPopup: noop,
			signInWithRedirect: noop,
			signOut: noop,
			onAuthStateChanged: noop,
			onIdTokenChanged: noop,
			decodeToken: async (token) => {
				if (!token || token === 'null' || token === 'undefined') return null;
				try {
					return await app.auth().verifyIdToken(token);
				} catch (err) {
					console.error(err);
					return null;
				}
			},
			providers: {
				Google: {}
			},
			getUser: (uid) => auth.getUser(uid),
			updateUser: (uid, data) => auth.updateUser(uid, data),
			deleteUser: (uid) => auth.deleteUser(uid)
		}
	};
};
