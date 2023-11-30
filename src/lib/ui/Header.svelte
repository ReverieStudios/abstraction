<script>
	import AppBar, { Row, Section } from '@smui/top-app-bar';
	import ToggleColorScheme from '$lib/ToggleColorScheme.svelte';
	import IconButton from '$lib/ui/IconButton.svelte';
	import { debugEnabled } from '$lib/form/debug/DebugForm.svelte';
	import { dev } from '$app/env';

	export let isSignedIn = false;
	export let navAutoShown = false;
	export let toggleNav = () => {};

	const toggleDebug = () => debugEnabled.update((v) => !v);
</script>

<AppBar variant="static" color="primary">
	<Row>
		<Section>
			<a href="/" class="px-2 md:px-8 flex items-center">
				<img src="/logo-flat-white-1600.png" alt="Reverie Studios logo" />
			</a>
		</Section>
		<Section align="end" toolbar>
			{#if dev}
				<IconButton icon={$debugEnabled ? 'pest_control' : 'bug_report'} on:click={toggleDebug} />
			{/if}
			<ToggleColorScheme />
			{#if isSignedIn && !navAutoShown}
				<IconButton icon="menu" on:click={toggleNav} />
			{/if}
		</Section>
	</Row>
</AppBar>

<style>
	img {
		height: 44px;
	}
</style>
