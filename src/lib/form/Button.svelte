<script>
	import { getContext } from 'svelte';
	import { key } from 'svelte-forms-lib';
	import Button from '$lib/ui/Button.svelte';

	export let name = null;
	export let value = null;

	const { handleChange } = getContext(key);

	const handleClick = () => {
		if (name) {
			handleChange({ target: { name, value } });
		}
	};
</script>

<Button type="submit" on:click={handleClick} {...$$props}><slot /></Button>
