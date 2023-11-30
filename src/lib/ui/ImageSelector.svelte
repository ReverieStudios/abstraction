<script lang="ts">
	import { storage } from '$lib/firebase';
	import LinearProgress from '@smui/linear-progress';
	import Icon from '$lib/ui/Icon.svelte';
	import IconButton from '$lib/ui/IconButton.svelte';
	import Tooltip from '$lib/ui/Tooltip.svelte';
	import TextField from '$lib/ui/TextField.svelte';
	import { createEventDispatcher } from 'svelte';
	import { sortBy } from 'lodash-es';
	import { getNotify } from '$lib/ui/Notifications.svelte';
	import type { StorageReference } from 'firebase/storage';
	import ConfirmButton from '$lib/ConfirmButton.svelte';

	const dispatch = createEventDispatcher();
	const sendNotification = getNotify();

	let browsePath = 'images';
	let extraFolders: Record<string, string[]> = {};
	const addExtraFolder = (name: string) => {
		extraFolders[browsePath] = [...(extraFolders[browsePath] ?? []), name];
	};
	const navigateTo = (path: string) => (browsePath = path);

	let prefixes: StorageReference[] = [];
	let items: StorageReference[] = [];

	const withParentAndFolders = (prefixes: StorageReference[]): StorageReference[] => {
		const existing = new Set(prefixes.map((p) => p.name));
		const extra = (extraFolders[browsePath] ?? []).filter((name) => !existing.has(name));
		const withManual = sortBy(
			[
				...prefixes,
				...extra.map((name) => ({
					fullPath: `${browsePath}/${name}`,
					name,
					root: null,
					bucket: null,
					storage: null,
					parent: null
				}))
			],
			'name'
		);
		if (browsePath.includes('/')) {
			const parts = browsePath.split('/');
			parts.pop();
			const parent = parts.join('/');
			const upref: StorageReference = {
				root: null,
				bucket: null,
				storage: null,
				parent: null,
				fullPath: parent,
				name: '..'
			};
			return [upref, ...withManual];
		}
		return withManual;
	};

	const loadPath = (path: string) =>
		storage
			.listAll(path)
			.then((resp) => {
				prefixes = withParentAndFolders(resp.prefixes);
				items = resp.items;
			})
			.catch(console.error);

	$: loadPath(browsePath);

	const selectImage = (item: StorageReference) => {
		dispatch('select', item.fullPath);
	};
	const deleteImage = (item: StorageReference) => {
		storage.delete(item.fullPath).then(() => {
			sendNotification({
				text: `${item.fullPath} deleted`
			});
			loadPath(browsePath);
		});
	};
	let newFolder: HTMLInputElement;
	let folderName: string;
	const openNewFolder = () => {
		folderName = '';
		newFolder.focus();
	};
	const createFolder = (e: any) => {
		if (e.code === 'Enter') {
			addExtraFolder(folderName);
			browsePath = `${browsePath}/${folderName}`;
			newFolder.blur();
		}
	};
	let fileEl: HTMLInputElement;
	let loading = false;
	const uploadImage = async (file: File) => {
		return storage.upload(`${browsePath}/${file.name}`, file).catch((ex) => {
			sendNotification({ text: `Unable to upload ${file.name}` });
			throw ex;
		});
	};
	const handleUpload = async () => {
		const fileList = Array.from(fileEl.files);
		loading = true;
		return Promise.allSettled(fileList.map(uploadImage))
			.then((results) => {
				if (results.some((result) => result.status === 'fulfilled')) {
					// if anything uploaded, reload the path
					loadPath(browsePath);
				}
			})
			.finally(() => (loading = false));
	};
</script>

<input
	type="file"
	id="newFile"
	multiple
	accept="image/*"
	class="visually-hidden"
	bind:this={fileEl}
	on:change={handleUpload}
/>
<div class="header flex items-center justify-between">
	Browsing: /{browsePath}

	<div class="actions flex">
		<IconButton type="button" icon="create_new_folder" on:click={openNewFolder} />
		<TextField
			class="folderName"
			bind:value={folderName}
			bind:input={newFolder}
			on:keydown={createFolder}
		/>
		<IconButton type="button" icon="add_photo_alternate" on:click={() => fileEl.click()} />
	</div>
</div>
{#if loading}
	<LinearProgress indeterminate />
{/if}
<div class="flex flex-column divided bg-secondary-light">
	{#each prefixes as prefix (prefix.fullPath)}
		<button class="selectorRow" type="button" on:click={() => navigateTo(prefix.fullPath)}>
			<Icon class="p1" icon="folder" />
			<span class="title">{prefix.name}</span>
		</button>
	{/each}
	{#each items as item (item.fullPath)}
		<div class="selectorRow">
			<button
				class="rowBtn flex flex-auto items-center"
				type="button"
				on:click={() => selectImage(item)}
			>
				<Icon class="p1" icon="image" />
				<span class="title">{item.name}</span>
			</button>
			<ConfirmButton on:confirm={() => deleteImage(item)} />
		</div>
	{/each}
</div>

<style>
	:global(.folderName) {
		width: 0;
		overflow: hidden;
		transition: width 250ms;
	}
	:global(.folderName:focus-within) {
		width: 15em;
	}
	.visually-hidden {
		position: absolute !important;
		height: 1px;
		width: 1px;
		overflow: hidden;
		clip: rect(1px, 1px, 1px, 1px);
	}
	.selectorRow {
		display: flex;
		flex-direction: row;
		border: 0;
		padding: 0;
		align-items: center;
		cursor: pointer;
		background: none;
		color: var(--on-secondary);
		width: 100%;
	}
	.selectorRow .rowBtn {
		background: none;
		border: 0;
	}
	.selectorRow :global(.material-icons) {
		padding-right: 1rem;
	}
	.selectorRow:hover {
		background: var(--secondary);
	}
	.selectorRow .title {
		display: inline-block;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	/* .thumb {
		width: 200px;
		height: 200px;
		margin-bottom: 0.5em;
		background-size: contain;
		background-repeat: no-repeat;
	} */
</style>
