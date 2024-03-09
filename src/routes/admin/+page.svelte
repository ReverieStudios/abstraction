<script>
	import { Wrapper } from '$lib/boxLinks';

	const items = [
		{ href: '/admin/forms', text: 'Forms' },
		{ href: '/admin/games', text: 'Games' },
		{ href: '/admin/tokens', text: 'Tokens' },
		{ href: '/admin/users', text: 'Users' }
	];
</script>

<svelte:head>
	<title>Admin</title>
</svelte:head>

<div class="content">
	<h1>Reverie Character Admin</h1>

	<Wrapper {items} />
</div>
