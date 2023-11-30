<script>
	import { onMount } from 'svelte';
	import IconButton from '$lib/ui/IconButton.svelte';

	const getCurrentScheme = () => {
		const saved = localStorage.getItem('colorScheme');
		return (
			saved ||
			(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
				? 'dark'
				: 'light')
		);
	};

	let currentScheme = null;

	const toggleScheme = () => {
		currentScheme = currentScheme === 'dark' ? 'light' : 'dark';
		const stylesheet = document.querySelector('#color-scheme');
		localStorage.setItem('colorScheme', currentScheme);
		switch (currentScheme) {
			case 'dark':
				stylesheet.setAttribute('href', '/smui-dark.css');
				break;
			default:
				stylesheet.setAttribute('href', '/smui.css');
				break;
		}
	};

	onMount(() => {
		currentScheme = getCurrentScheme();
	});
</script>

{#if currentScheme === 'light'}
	<IconButton icon="light_mode" on:click={toggleScheme} />
{:else if currentScheme === 'dark'}
	<IconButton icon="dark_mode" on:click={toggleScheme} />
{/if}
