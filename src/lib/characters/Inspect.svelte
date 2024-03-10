<script lang="ts">
	import Button from '$lib/ui/Button.svelte';
	import Modal from '$lib/ui/Modal.svelte';
	import RichViewer from '$lib/ui/RichViewer.svelte';
	import type { Docs } from '$lib/database';
	import { getFields } from '$lib/database/types/Assets';

	export let open = false;
	export let asset: Docs.Asset;
	export let assetType: Docs.AssetType;
	let closeModal
</script>

{#if open}
	<Modal
		open
		on:close={() => (open = null)}
		let:closeModal
		title={asset.data.name}
		--text-color="var(--on-surface)"
	>
		{#each getFields(asset, assetType) as { label, text, type }}
			<div>
				<h4>{label}</h4>
				<div class="pl2">
					{#if type === 'markdown'}
						<RichViewer value={text} />
					{:else}
						<p>{text}</p>
					{/if}
				</div>
			</div>
		{/each}
		<div slot="actions">
			<Button 
			on:click={closeModal}>Ok</Button>
		</div>
	</Modal>
{/if}
