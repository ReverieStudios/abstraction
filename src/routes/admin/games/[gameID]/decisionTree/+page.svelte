<script lang="ts">
	import Graph from '$lib/DecisionTree/Graph.svelte';
	import Panel from '$lib/DecisionTree/Panel.svelte';
	import { keyBy } from 'lodash-es';
	import TreeSelect from '$lib/DecisionTree/TreeSelect.svelte';
	import { groupByParentId, START_ID } from '$lib/DecisionTree/helpers';
	import { writable } from 'svelte/store';
	import type { Writable } from 'svelte/store';
	import type { State } from '$lib/DecisionTree/helpers';
	import type { Game } from '$lib/database/types/Game';
	import { database } from '$lib/database';
	import { page } from '$app/stores';

	const game: Game = $page.data.game;
	export let assets = database.assets;
	export let assetTypes = database.assetTypes;
	export let decisionTree = database.decisionTree;

	$: assetsById = keyBy($assets, 'id');
	$: nodesById = keyBy($decisionTree, 'id');
	$: nodesByParentId = groupByParentId($decisionTree);

	const treeLoaded = decisionTree.hasLoaded;

	const state: Writable<State> = writable({
		selected: null,
		drawTreeID: START_ID
	});

	// const validateGraph = () => {
	// 	const assetIds = new Set($assets.map((a) => a[ID]));
	// 	assetIds.add('Start');
	// 	const nodesById = keyBy($decisionTree, ID);

	// 	const collectValid = (nodeId) => {
	// 		if (nodeId && nodesById[nodeId]) {
	// 			const node = nodesById[nodeId];
	// 			if (assetIds.has(node.name)) {
	// 				const children = node.children || [];

	// 				return [nodeId, ...children.flatMap(collectValid)];
	// 			}
	// 		}
	// 		return [];
	// 	};
	// 	const validSet = new Set(collectValid(START_ID));

	// 	const broken = $decisionTree.filter((n) => !validSet.has(n[ID]));
	// 	const batch = store.writeBatch();

	// 	const deleteIds = broken.map((doc) => {
	// 		batch.delete(doc[REF]);
	// 		return doc[ID];
	// 	});

	// 	const deleteIdSet = new Set(deleteIds);

	// 	const remainingNodes = $decisionTree.filter((n) => !deleteIdSet.has(n[ID]));
	// 	const remainingIds = new Set(remainingNodes.map((n) => n[ID]));
	// 	remainingNodes.forEach((n) => {
	// 		if (n.children) {
	// 			const filtered = n.children.filter((c) => remainingIds.has(c));
	// 			if (filtered.length !== n.children.length) {
	// 				batch.update(n[REF], { children: filtered });
	// 			}
	// 		}
	// 	});
	// 	// batch.commit();
	// };

	$: {
		if ($treeLoaded) {
			const hasStartNode = $decisionTree.some((n) => n.id === START_ID);
			if (!hasStartNode) {
				console.log('RECREATING START NODE', { nodes: $decisionTree });
				decisionTree.addDoc({ name: 'Start', treeID: START_ID, parentIDs: [] }, START_ID);
			}
		}
	}
</script>

<svelte:head>
	<title>Editing: {game?.name ?? 'Game'} Decisions</title>
</svelte:head>

{#if $treeLoaded}
	<TreeSelect {state} nodes={$decisionTree} {nodesByParentId} />
	<Panel
		nodes={$decisionTree}
		{nodesById}
		{assetsById}
		{nodesByParentId}
		assetTypes={$assetTypes}
		assets={$assets}
		{state}
	/>
	<Graph nodes={$decisionTree} {assetsById} {state} />
{/if}
