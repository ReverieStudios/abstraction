<script lang="ts">
	import ImageSelector from '$lib/ui/ImageSelector.svelte';
	import Modal from '$lib/ui/Modal.svelte';
	import { getFieldContext } from './getFormContext';
	import { storage } from '$lib/firebase';
	import Button from '$lib/ui/Button.svelte';
	import Icon from '$lib/ui/Icon.svelte';

	export let name: string;

	const {
		updateValidateField,
		field: { value }
	} = getFieldContext(name, '');

	let previewUrl: string;
	$: {
		if ($value) {
			storage.getDownloadURL($value).then((url) => {
				previewUrl = url;
			});
		} else {
			previewUrl = '';
		}
	}

	let selectingImage = false;
	const selectImage = (e: CustomEvent<string>) => {
		const imagePath = e.detail;
		selectingImage = false;
		updateValidateField(name, imagePath);
	};
	const deselect = () => {
		selectingImage = false;
		updateValidateField(name, null);
	};
</script>

<!-- {#if selectingImage}
	<Modal open>
		<ImageSelector on:select={selectImage} />
		<svelte:fragment slot="actions">
			<Button type="button" on:click={() => (selectingImage = false)}>Cancel</Button>
			<Button type="button" on:click={deselect}>Remove</Button>
		</svelte:fragment>
	</Modal>
{/if} -->

<div
	class="image"
	class:hasImage={previewUrl}
	style="background-image:url({previewUrl})"
	on:click={() => (selectingImage = true)}
>
	<Icon>photo_library</Icon>
</div>
{#if selectingImage}
	<div style="flex-basis:100%">
		<ImageSelector on:select={selectImage} />
		<div class="mt2">
			<Button type="button" on:click={() => (selectingImage = false)}>Cancel</Button>
			<Button type="button" on:click={deselect}>Remove</Button>
		</div>
	</div>
{/if}

<style>
	.image {
		background-position: center center;
		background-size: contain;
		background-repeat: no-repeat;
		height: 50px;
		width: 50px;
		border-radius: 50%;
		border: 1px solid #ccc;
		position: relative;
		cursor: pointer;
	}
	.image:hover {
		background-color: var(--secondary);
	}
	.image :global(.material-icons) {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
	}
	.hasImage :global(.material-icons) {
		opacity: 0;
	}
	.hasImage:hover :global(.material-icons) {
		opacity: 1;
	}
</style>
