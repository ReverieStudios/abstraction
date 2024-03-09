<script lang="ts">
	import UserProfile from '$lib/UserProfile.svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';

	const userID = $page.data.userID;
</script>

<UserProfile {userID} on:submit={() => goto('/')} />
