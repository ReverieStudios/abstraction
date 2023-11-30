<script>
	// https://github.com/hperrin/svelte-material-ui/tree/master/packages/button
	import Button from '@smui/button';
</script>

<Button on:click ripple={false} variant="unelevated" {...$$props}><slot /></Button>
