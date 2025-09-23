<script>
	import { Wrapper } from '$lib/boxLinks';
    import { isOwner } from '$lib/permissions';
    export let data;
    const roles = data.user?.roles;

    const items = [
        { href: '/admin/games', text: 'Games' },
    ];

    if (isOwner(roles)) {
        items.unshift({ href: '/admin/forms', text: 'Forms' });
        items.push({ href: '/admin/tokens', text: 'Tokens' });
        items.push({ href: '/admin/users', text: 'Users' });
    }
</script>

<svelte:head>
	<title>Admin</title>
</svelte:head>

<div class="content">
	<h1>Reverie Character Admin</h1>

	<Wrapper {items} />
</div>
