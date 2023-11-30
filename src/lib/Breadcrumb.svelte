<script>
	export let path = '/';

	const DIVIDER = Symbol('dividor');

	let crumbs = [];
	$: {
		const tokens = path.split('/').filter(Boolean);
		tokens.pop();

		let tokenPath = '';
		crumbs = tokens.flatMap((t) => {
			tokenPath += '/' + t;
			return [
				DIVIDER,
				{
					name: t,
					url: tokenPath
				}
			];
		});

		crumbs.unshift({ name: 'home', url: '/' });
	}
</script>

<div {...$$restProps} class="breadcrumbs {$$restProps.class}">
	{#each crumbs as page}
		{#if page === DIVIDER}
			<span class="mx1">&gt;</span>
		{:else}
			<a class="caps h5 text-accent" href={page.url}>{page.name}</a>
		{/if}
	{/each}
</div>
