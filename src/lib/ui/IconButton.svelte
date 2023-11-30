<script>
	import IconButton from '@smui/icon-button';

	export let icon;
</script>

<IconButton
	on:click
	ripple={false}
	{...$$restProps}
	class="material-icons {$$restProps.class ?? ''}">{icon}</IconButton
>
