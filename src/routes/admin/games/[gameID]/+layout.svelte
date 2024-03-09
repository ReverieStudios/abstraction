<script context="module">
	import { database } from '$lib/database';
</script>

<script lang="ts">
	const assets = database.assets;
	assets?.subscribe(() => {});

	const assetTypes = database.assetTypes;
	assetTypes?.subscribe(() => {});
</script>

<slot />
