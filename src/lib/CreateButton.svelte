<script lang="ts">
	import IconButton from '$lib/ui/IconButton.svelte';
	import Button from '$lib/ui/Button.svelte';
	import { createEventDispatcher } from 'svelte';
	import slugify from 'slugify';
	import { clickOutside } from '$lib/actions/clickOutside';
	import { Collection, DocType } from '$lib/database';
	import type { CollectionDocument, DocumentMap } from '$lib/database';
	import { generateID } from '$lib/firebase';

	export let parent:
		| Collection<any>
		| DocumentMap<any>
		| CollectionDocument<any>
		| DocType<any> = null;

	export let id: (text?: string) => string = () => generateID();
	export let data: (text: string, id?: string) => Object = (name) => ({ name });
	export let color = 'primary';
	export let buttonText = 'Create New';

	let text = '';
	let submitting = false;
	let showingCreate = false;

	const dispatch = createEventDispatcher();
	const makeDoc = async (e) => {
		e.preventDefault();
		if (text) {
			submitting = true;
			const idStr = id(text);
			const docData = data(text, idStr);

			let createPromise: Promise<string | null> = Promise.resolve(null);
			if (parent instanceof Collection) {
				const id = idStr && slugify(idStr, { lower: true, strict: true });
				createPromise = parent.addDoc(docData, id);
			} else {
				const id = idStr || generateID();
				createPromise = parent.update({ [id]: docData }).then(() => id);
			}

			return createPromise
				.then((id) => {
					clear();
					dispatch('create', id);
				})
				.catch(console.error);
		}
	};

	const maybeEscape = (e) => {
		if (e.key === 'Escape') {
			e.stopPropagation();
			showingCreate = false;
		}
	};
	const showCreate = () => (showingCreate = true);
	const hideCreate = () => (showingCreate = false);
	const clear = () => {
		text = '';
		showingCreate = false;
		submitting = false;
	};
</script>

<span class="create-wrapper {$$props.class || ''}">
	{#if showingCreate}
		<form
			use:clickOutside
			on:outclick={hideCreate}
			on:submit={makeDoc}
			class="flex fill items-center px1 rounded bg-{color}"
		>
			<!-- svelte-ignore a11y-autofocus -->
			<input
				autofocus
				type="text"
				class="flex-auto bg-transparent border-none text-on-{color}"
				disabled={submitting}
				on:keydown={maybeEscape}
				bind:value={text}
			/>
			<IconButton type="submit" icon="check" />
			<IconButton on:click={hideCreate} icon="clear" />
		</form>
	{:else}
		<Button class="flex-auto bg-{color}" on:click={showCreate}>{buttonText}</Button>
	{/if}
</span>

<style>
	.create-wrapper {
		display: flex;
		flex-direction: row;
	}
</style>
