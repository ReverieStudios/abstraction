<script>
	import { Wrapper } from '$lib/boxLinks';

	const items = [
		{ href: '/games', text: 'Games' },
		{ href: '/profile', text: 'Profile' }
	];
</script>

<svelte:head>
	<title>Reverie Portal</title>
</svelte:head>

<div class="content">
	<h1>Reverie Portal</h1>

	<Wrapper {items} />
</div>
