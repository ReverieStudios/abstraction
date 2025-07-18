<script lang="ts">
	import "../app.postcss";
    import { setGameID, setUserID, database, type CollectionDocument } from '$lib/database';
    import { signOut, listenForAuth } from '$lib/firebase';
    import { page } from '$app/stores';
    import Breadcrumb from '$lib/Breadcrumb.svelte';
    import Drawer from '$lib/ui/Drawer.svelte';
    import AppContent from '@smui/drawer'
    import PageTransition from '$lib/ui/PageTransition.svelte';
    import '$lib/reporting/sentry';
    import { User } from '$lib/database/types/User';
    import { onMount } from 'svelte';
    import Notifications from '$lib/ui/Notifications.svelte';
    import FormChecker from '$lib/FormChecker.svelte';
    import { readable } from 'svelte/store';

    listenForAuth();

    $: setGameID($page.params.gameID);
    $: setUserID($page.data?.user?.uid);

    let isSignedIn: boolean = false;
    let userID: string | null = null;
    page.subscribe((page) => {
		isSignedIn = Boolean(page.data.user);
		userID = page.data?.user?.uid;
	});

    const anyAdminRoles = (roles: User.Roles) => {
		if (roles) {
			if (roles.system && roles.system >= User.AccountType.Editor) {
				return true;
			}
			if(roles.games) {
				for (let type of Object.values(roles.games)) {
					if (type >= User.AccountType.Editor) {
						return true;
					}
				}
			}
		}
		return false;
	};

    $: userStore = userID ? database.users.doc(userID) : (readable({}) as CollectionDocument<User>);

    $: menu = [
		anyAdminRoles($userStore?.data?.roles) && { href: '/admin', text: 'Admin' },
		{ href: '/', text: 'Home' },
		{ spacer: true },
		{ text: 'Logout', onClick: signOut }
	].filter(Boolean);

    let hasLoaded = false;
    onMount(() => {
		hasLoaded = true;
	});

    const currentYear = new Date().getFullYear();
</script>
<Notifications>
	<Drawer {isSignedIn} {menu}>
		<main class="main-content px4 py2">
			{#if isSignedIn}
				<Breadcrumb path="{$page.url.pathname}" class="mt-20 ml-10"></Breadcrumb>
				{#if userID}
					<FormChecker {userID}></FormChecker>
				{/if}
			{/if}
			<PageTransition>
				{#if hasLoaded}
					<slot></slot>
				{/if}
			</PageTransition>
		</main>
	</Drawer>
</Notifications>

<footer class="center">All rights reserved © {currentYear} Reverie Studios</footer>

<style lang="postcss">
	.main-content {
		overflow: auto;
		display: flex;
		flex-direction: column;
		position: relative;
		flex-grow: 1;
		min-height: 90%;
	}
	:global(.mdc-drawer-app-content) {
		transition-property: margin-left;
		transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
		transition-duration: 250ms;
	}

	@media (max-width: 1000px) {
		:global(.mdc-drawer.mdc-drawer--open + .mdc-drawer-app-content) {
			min-width: 100vw;
			overflow-x: hidden;
		}
	}
</style>
