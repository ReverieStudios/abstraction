<script lang="ts" context="module">
	import type { Load } from '@sveltejs/kit';

	export const load: Load = async ({ session }) => {
		return {
			props: { userID: session.user.uid }
		};
	};
</script>

<script lang="ts">
	import UserProfile from '$lib/UserProfile.svelte';
	import { goto } from '$app/navigation';

	export let userID: string = null;
</script>

<UserProfile {userID} on:submit={() => goto('/')} />
