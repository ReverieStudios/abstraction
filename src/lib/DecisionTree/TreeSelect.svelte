<script lang="ts">
	import ConfirmButton from '$lib/ConfirmButton.svelte';
	import CreateButton from '$lib/CreateButton.svelte';

	import type { Docs, KeyGroups } from '$lib/database';
	import { database } from '$lib/database';
	import type { Decision } from '$lib/database/types/Decision';
	import { isStartNode } from '$lib/database/types/Decision';
	import Select from '$lib/ui/Select.svelte';
	import { deleteNodeAndChildren, START_ID } from './helpers';
	import type { State } from './helpers';
	import type { Writable } from 'svelte/store';
	import { sortBy } from 'lodash-es';

	export let state: Writable<State>;
	export let nodes: Docs.Decision[];
	export let nodesByParentId: KeyGroups.Decision;

	$: drawTreeID = $state.drawTreeID;

	const getTreeOptions = (nodes: Docs.Decision[]) => {
		const opts = nodes
			.map((node) => {
				if (isStartNode(node.data)) {
					return {
						text: node.data.name,
						value: node.id,
						sortKey: node.id === START_ID ? 'A' : `B${node.data.name}`
					};
				}
			})
			.filter(Boolean);
		return sortBy(opts, 'sortKey');
	};

	$: treeOptions = getTreeOptions(nodes);

	const updateDrawTree = (e: CustomEvent) => {
		const { detail } = e;

		let treeID: string;
		if (typeof detail === 'string') {
			treeID = detail;
		} else {
			treeID = detail?.value ?? START_ID;
		}

		state.update((c) => ({ ...c, drawTreeID: treeID }));
	};

	const getStartNode = (name: string, id: string) => {
		const node: Decision.StartNode = {
			name,
			treeID: id,
			parentIDs: []
		};

		return node;
	};

	const deleteCurrentTree = () => {
		const startNode = nodes.find((node) => isStartNode(node.data) && node.id === drawTreeID);
		if (startNode) {
			if (startNode.id !== START_ID) {
				state.update((c) => ({ ...c, drawTreeID: START_ID }));
			}
			deleteNodeAndChildren(startNode, nodesByParentId);
		}
	};
</script>

<div class="grid g2 mb2">
	<Select class="flex-auto" value={drawTreeID} on:change={updateDrawTree} items={treeOptions} />
	<CreateButton
		color="primary"
		parent={database.decisionTree}
		data={getStartNode}
		on:create={updateDrawTree}
	/>
	<ConfirmButton on:confirm={deleteCurrentTree} />
</div>

<style>
	.grid {
		display: grid;
		grid-auto-rows: 1fr;
		grid-template-columns: 1fr 200px 110px;
	}
	.grid :global(.create-wrapper > button) {
		height: 100%;
	}
	.grid :global(.confirm-wrapper) {
		place-content: flex-end;
		margin-right: 0;
	}
	:global(.fill-h) {
		height: 100%;
	}
</style>
