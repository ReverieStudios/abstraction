<script>
	import Icon from '$lib/ui/Icon.svelte';
	import Tooltip from '$lib/ui/Tooltip.svelte';

	export let text;
</script>

<Tooltip rich {text}><Icon class="help">info</Icon></Tooltip>

<style>
	:global(.help) {
		cursor: help;
	}
</style>
