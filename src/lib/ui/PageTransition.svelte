<script lang="ts">
	import { fly } from 'svelte/transition';

	export let data;
</script>

{#key data.url}
	<div 
		in:fly|global={{ y: -50, duration: 250, delay: 300 }}
		out:fly|global={{ y: -50, duration: 250 }} class="transition-page">
		<slot />
	</div>
{/key}
