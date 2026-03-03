<script lang="ts">
	import { database } from '$lib/database';
	import { slide } from 'svelte/transition';
	import { groupByParentId, START_ID } from '$lib/DecisionTree/helpers';
	import { isAssetNode, isRelationshipNode, isStartNode } from '$lib/database/types/Decision';
	import type { Docs, KeyGroups, KeyMaps } from '$lib/database/types';
	import { derived, type Readable } from 'svelte/store';
	import Button from '$lib/ui/Button.svelte';
	import { goto } from '$app/navigation';
	import AssetSection from './AssetSection.svelte';
	import RelationshipSection from './RelationshipSection.svelte';
	import type { User } from '$lib/database/types/User';
	import { keyBy } from 'lodash-es';
	import { dev } from '$app/environment';
	import CartSidebar from 'lib/CartSidebar.svelte';
	import type { Dictionary } from 'lodash';

	export let gameName: string | null = null;
	export let gameID: string | null = null;
	export let userID: string | null = null;
	export let user: User | null = null;
	export let chosenItems: Readable<string[]>;
	export let secureLock: (assetID: string, depth: number) => Promise<boolean>;
	export let releaseLocks: (assetIDs: string[]) => Promise<boolean>;
	export let updateRankings: (relationshipSelectorID: string, rankedIDs: string[]) => Promise<boolean>;
	export let finalize: (() => Promise<boolean>) | null = null;

	let decisionTree = database.decisionTree;

	const selectorsById: Readable<Dictionary<Docs.RelationshipSelector>> = derived(database.relationshipSelectors, ($sels) => keyBy($sels ?? [], 'id'));

	$: nodesByParentId = groupByParentId($decisionTree) as KeyGroups.Decision;
	$: nodesById = keyBy($decisionTree, 'id') as KeyMaps.Decision;
	$: allVariables = Array.from(
		($decisionTree ?? []).reduce((acc: Set<string>, node) => {
			const vars: string[] = isAssetNode(node.data) ? node.data?.setVariables?.map((v) => v.name) ?? [] : [];
			vars.forEach((v) => acc.add(v));
			return acc;
		}, new Set<string>())
	) as string[];
	$: variableSetup = allVariables.map((name) => `let ${name} = 0;`).join('\n') as string;

	let loading = false;

	const choose = (depth: number) => (assetID: string) => {
		if (!loading) {
			loading = true;
			secureLock(assetID, depth).finally(() => (loading = false));
		}
	};

	const unchoose = (depth: number) => () => {
		if (!loading) {
			const freed = $chosenItems.slice(depth);
			loading = true;
			releaseLocks(freed).finally(() => (loading = false));
		}
	};

	const getVariableProcessor = (chosenIDs: string[]) => {
		const variables = chosenIDs.reduce((acc: Record<string, string | number>, id) => {
			const node = nodesById[id];
			if (node && isAssetNode(node.data)) {
				(node.data.setVariables ?? []).forEach((variable) => {
					acc[variable.name] = variable.value;
				});
			}
			return acc;
		}, {});
		const varString = Object.entries(variables)
			.map(([name, value]) => `${name}=${value};`)
			.join('\n');
		const debug =
			false && dev ? [`console.log('checking', check);`, `console.log('result', r);`] : ['', ''];
		return eval(
			`(function(){${variableSetup}${varString}return (check) => { ${debug[0]} const r = eval(check); ${debug[1]} return r;}})()`
		);
	};

	interface DecisionElement {
		decisionID: string;
		assetID?: string;
		relationshipSelectorID?: string;
	}
	const nextIsStartNode = (root: string) => {
		const decisions = nodesByParentId[root] ?? [];
		return decisions.length === 1 && isStartNode(decisions[0].data);
	};

	const getMaxTreeDepth = (root: string, initial = false): number => {
		if (!initial && isStartNode(nodesById[root]?.data)) {
			return 0;
		}
		return (
			(initial ? 0 : 1) +
			Math.max(0, ...(nodesByParentId[root] ?? []).map((node) => getMaxTreeDepth(node.id)))
		);
	};

	const enumerateOptions = (root: string, chosenIDs: string[], prefix: string[] = []): string[] => {
		if (prefix.length > 0 && isStartNode(nodesById[root]?.data)) {
			return [prefix.join('--')];
		}
		const newChosen = [...chosenIDs, root];
		const variableProcessor = getVariableProcessor(newChosen);
		const newPrefix = [...prefix, root];
		const childConditions = nodesById[root]?.data?.childConditions;
		const children = (nodesByParentId[root] ?? []).filter((node) => {
			if (!childConditions) {
				return true;
			}
			if (isStartNode(node.data)) {
				return true;
			}
			if (isAssetNode(node.data)) {
				return (
				!childConditions[node.data.assetID] || variableProcessor(childConditions[node.data.assetID])
			);
			}
			if (isRelationshipNode(node.data)) {
				return (
					!childConditions[node.data.relationshipSelectorID] ||
					variableProcessor(childConditions[node.data.relationshipSelectorID])
				);
			};
		});

		if (children.length === 0) {
			return [newPrefix.join('--')];
		}

		return children.flatMap((node) => enumerateOptions(node.id, newChosen, newPrefix));
	};

	const getRemainingOptions = (loop: MultiSelect): string[] => {
		const endChoices = loop.prior.filter((_, idx) => (idx + 1) % loop.depth === 0);
		return loop.options.filter((opt) => endChoices.every((chosenEnd) => !opt.includes(chosenEnd)));
	};

	const getChildren = (
		byParent: KeyGroups.Decision,
		root: string,
		chosenIDs: string[]
	): {
		loops: number;
		options: string[];
		depth: number;
		name: string;
		children: DecisionElement[];
	} => {
		const decisions = nodesByParentId[root] ?? [];
		const childConditions = nodesById[root]?.data?.childConditions || {};
		const variableProcessor = getVariableProcessor(chosenIDs);
		if (decisions.length === 1 && isStartNode(decisions[0].data)) {
			return {
				loops: decisions[0].data.loops == null ? 1 : variableProcessor(decisions[0].data.loops),
				depth: getMaxTreeDepth(decisions[0].id, true),
				options: enumerateOptions(decisions[0].id, chosenIDs),
				name: decisions[0].data.name,
				children: getChildren(byParent, decisions[0].id, chosenIDs).children
			};
		}
		const children = decisions.flatMap((decision) => {
			if (
				isAssetNode(decision.data) &&
				(!childConditions[decision.data.assetID] ||
					variableProcessor(childConditions[decision.data.assetID]))
			) {
				return {
					decisionID: decision.id,
					assetID: decision.data.assetID
				};
			}
			if (
				isRelationshipNode(decision.data) &&
				(!childConditions[decision.data.relationshipSelectorID] ||
					variableProcessor(childConditions[decision.data.relationshipSelectorID]))
			) {
				return {
					decisionID: decision.id,
					relationshipSelectorID: decision.data.relationshipSelectorID
				};
			}
			return [];
		});

		return {
			loops: 1,
			depth: 1,
			options: children.map((c) => c.decisionID),
			name: '',
			children
		};
	};

	interface ListItem {
		id: string;
		depth: number;
		// name: choices[i].name;
		chosen?: string;
		children: string[];
		childType?: 'asset' | 'relationship';
		loop: { name: string; on: number; total: number; depth: number; loopDepth: number };
	}
	let list: ListItem[] = [];
	interface MultiSelect {
		name: string;
		loops: number;
		total: number;
		options: string[];
		start: string;
		depth: number;
		prior: string[];
	}
	$: {
		const newList: ListItem[] = [];
		const chosenIDs: string[] = [];

		let pointer: string | null | undefined = START_ID;
		let loops: MultiSelect | null = null;
		while (pointer) {
			const nextNodes = getChildren(nodesByParentId, pointer, chosenIDs);
			if (loops === null) {
				loops = {
					name: nextNodes.name,
					loops: nextNodes.loops,
					total: nextNodes.loops,
					start: pointer,
					depth: nextNodes.depth,
					options: nextNodes.options,
					prior: []
				};
			}
			const remainingOptions: string = getRemainingOptions(loops).join('--');
			const assetChoices = nextNodes.children.filter((child) =>
				remainingOptions.includes(child.decisionID)
			);
			const chosen = assetChoices.find((choice) => {
				const currentChosen = $chosenItems[newList.length];
				if (!currentChosen) return false;
				if (choice.assetID) {
					return choice.assetID === currentChosen;
				}
				if (choice.relationshipSelectorID) {
					return choice.relationshipSelectorID === currentChosen;
				}
				return false;
			});
			if (chosen) {
				chosenIDs.push(chosen.decisionID);
			}
			newList.push({
				id: `${pointer}-${loops.loops}`,
				depth: newList.length,
				chosen: chosen?.assetID ?? chosen?.relationshipSelectorID ?? undefined,
				children: assetChoices.map((c) => c.assetID ?? c.relationshipSelectorID ?? ''),
				childType: assetChoices.length > 0 && assetChoices[0].relationshipSelectorID ? 'relationship' : 'asset',
				loop: {
					name: loops.name,
					on: loops.total - loops.loops + 1,
					total: loops.total,
					depth: loops.depth,
					loopDepth: loops.prior.length % loops.depth
				}
			});
				console.log('Decider: added list item', {
					id: `${pointer}-${loops.loops}`,
					childCount: assetChoices.length,
					childType: assetChoices.length > 0 && assetChoices[0].relationshipSelectorID ? 'relationship' : 'asset'
				});

			if (loops.loops > 1) {
				if (chosen) {
					if (nextIsStartNode(chosen.decisionID)) {
						loops.loops--;
						loops.prior.push(chosen.decisionID);
						pointer = loops.start;
					} else {
						pointer = chosen?.decisionID;
						loops.prior.push(chosen.decisionID);
					}
				} else {
					pointer = null;
				}
			} else {
				pointer = chosen?.decisionID;
				loops = null;
			}
		}

		list = newList;
	}
</script>

<svelte:head>
	<title>{gameName ?? 'Game'} Character Builder</title>
</svelte:head>
<CartSidebar chosenItems={chosenItems} />

<div class="content mt3">
	{#if list.length === 0}
		<h3>Nothing to browse yet. Check back later</h3>
	{/if}
	{#each list as item (item.id)}
		{#if item.children.length === 0}
			<div class="rounded bg-primary mb2">
				<div class="flex flex-column g1">
					{#if finalize}
						<Button
							on:click={() =>
								finalize().then((success) => success && goto(`/games/${gameID}/character`))}
						>
							Create my Character
						</Button>
					{:else}
						<button type="button" on:click={unchoose(item.depth - 1)}>
							Character Creation Complete
						</button>
					{/if}
				</div>
			</div>
		{:else}
			<div transition:slide|global={{ duration: 200 }}>
				{#if item.childType === 'asset'}
					<AssetSection
						{gameID}
						{user}
						{userID}
						assetIDs={item.children}
						chosenID={item.chosen}
						choose={choose(item.depth)}
						unchoose={unchoose(item.depth)}
						subselection={item.loop}
					/>
				{:else}
					<RelationshipSection
						{gameID}
						{user}
						{userID}
						relationshipSelectorIDs={item.children}
						chosenID={item.chosen}
						choose={choose(item.depth)}
						unchoose={unchoose(item.depth)}
						updateRankings={updateRankings}
						subselection={item.loop}
					/>
				{/if}
			</div>
		{/if}
	{/each}
</div>
