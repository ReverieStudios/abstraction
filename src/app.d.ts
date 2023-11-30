/// <reference types="@sveltejs/kit" />
declare namespace App {
	import type { DecodedIdToken } from 'firebase-admin/lib/auth/token-verifier';
	import type { Game } from '$lib/database/types/Game';
	import type { User } from '$lib/database/types/User';

	interface Locals {
		decodedToken: DecodedIdToken;
		user: User;
	}

	interface Platform {}

	interface Session {
		user: User;
	}

	interface Stuff {
		user?: User;
		game?: Game;
		gameID?: string;
	}
}
