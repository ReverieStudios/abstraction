<script lang="ts">
	import { page } from '$app/stores';
	import Header from '$lib/ui/Header.svelte';
	import Drawer, { AppContent, Content } from '@smui/drawer';
	import List, { Item, Text } from '@smui/list';

	import { writable } from 'svelte/store';

	interface Spacer {}

	interface Link {
		text: string;
		href?: string;
		onClick?: (e: CustomEvent<any>) => any;
	}

	type MenuItem = Spacer | Link;

	const isLink = (item: MenuItem): item is Link => {
		return (item as Link).text !== undefined;
	};

	export let isSignedIn: boolean = false;
	export let menu: MenuItem[] = [];

	const navToggled = writable(false);
	$: {
		$page.url.pathname; // side-effect to trigger nav closing
		navToggled.set(false);
	}

	let width = 0;
	let navAutoShown = true;
	$: {
		if (width > 1000) {
			navAutoShown = true;
			navToggled.set(false);
		} else {
			navAutoShown = false;
		}
	}

	$: showNav = isSignedIn && (navAutoShown || $navToggled);
</script>

<svelte:window bind:innerWidth={width} />

<Header {isSignedIn} {navAutoShown} toggleNav={() => navToggled.set(!$navToggled)} />
<div class="drawer-container">
	<Drawer variant="dismissible" class="drawer" open={showNav}>
		<Content>
			<List>
				{#each menu as item}
					{#if isLink(item)}
						<Item href={item.href} on:click={item.onClick}>
							<Text class="h2">{item.text}</Text>
						</Item>
					{:else}
						<hr />
					{/if}
				{/each}
			</List>
		</Content>
	</Drawer>

	<AppContent class="app-content">
		<slot />
	</AppContent>
</div>

<style lang="postcss">
	.drawer-container {
		flex-grow: 1;
		height: 0;
		display: flex;
	}

	.drawer-container > :global(.drawer) {
		overflow: auto;
		height: 100%;
	}

	.drawer-container > :global(.app-content) {
		flex: auto;
		overflow: auto;
		position: relative;
		flex-grow: 1;
	}

	:global(.mdc-drawer--open + .app-content) {
		overflow-x: hidden;
	}
	:global(.mdc-deprecated-list-item__text) {
		height: 1.1em;
	}
</style>
