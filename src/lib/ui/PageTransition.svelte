<script>
	import { fly } from 'svelte/transition';
	import { page } from '$app/stores';
	// import { afterNavigate, beforeNavigate } from '$app/navigation';
	$: refresh = $page.url.pathname;

	// beforeNavigate(() => console.log('beforeNav'));
	// afterNavigate(() => console.log('afterNav'));
</script>

{#key refresh}
	<div in:fly|global={{ y: -50, duration: 250, delay: 300 }} out:fly|global={{ y: -50, duration: 250 }}>
		<slot />
	</div>
{/key}
