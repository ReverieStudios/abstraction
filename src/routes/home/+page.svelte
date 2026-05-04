<script lang="ts">
	import { Wrapper } from '$lib/boxLinks';
	import { database } from '$lib/database';
	import { page } from '$app/stores';
	import { User } from '$lib/database/types/User';
	import { readable } from 'svelte/store';

	const anyAdminRoles = (roles: User.Roles) => {
		if (roles?.system >= User.AccountType.Editor) return true;
		if (roles?.games) {
			for (const type of Object.values(roles.games)) {
				if (type >= User.AccountType.Editor) return true;
			}
		}
		return false;
	};

	$: userID = $page.data?.user?.uid;
	$: userStore = userID ? database.users.doc(userID) : readable({} as any);
	$: isAdmin = anyAdminRoles($userStore?.data?.roles);

	$: items = [
		isAdmin && { href: '/admin', text: 'Admin' },
		{ href: '/games', text: 'Games' },
		{ href: '/profile', text: 'Profile' }
	].filter(Boolean);
</script>

<svelte:head>
	<title>Reverie Portal</title>
</svelte:head>

<div class="content">
	<h1>Reverie Portal</h1>
	<Wrapper {items} />
</div>
