import { derived } from 'svelte/store';
import { page, session } from '$app/stores';

export const userStore = derived(session, ({ user }) => user);
export const gameStore = derived(page, ($page) => $page.params.gameID);
