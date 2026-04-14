<script lang="ts">
	import { characterDoc } from '$lib/database/Database';
	import { setContext } from 'svelte';

	setContext('character', characterDoc);
</script>

<slot />
