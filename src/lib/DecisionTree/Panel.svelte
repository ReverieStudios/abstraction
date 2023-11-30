<script lang="ts">
	import Select from '$lib/ui/Select.svelte';
	import Form from '$lib/form/Form.svelte';
	import Button from '$lib/form/Button.svelte';
	import CheckBoxGroup from '$lib/form/CheckBoxGroup.svelte';
	import RadioGroup from '$lib/form/RadioGroup.svelte';
	import Modal from '$lib/ui/Modal.svelte';
	import { groupBy, keyBy } from 'lodash-es';
	import { isAssetNode, isStartNode, type Decision } from '$lib/database/types/Decision';
	import { getNodeName, TREE_TYPE, updateSelectedNode } from './helpers';
	import type { Docs, KeyMaps, KeyGroups } from '$lib/database/types';
	import type { State } from './helpers';
	import type { Writable } from 'svelte/store';
	import TextField from '$lib/form/TextField.svelte';
	import TabBar from '@smui/tab-bar';
	import Tab, { Label } from '@smui/tab';
	import Autocomplete from '$lib/form/Autocomplete.svelte';
	import SimpleList from '$lib/form/SimpleList.svelte';
	import ConfirmButton from '$lib/ConfirmButton.svelte';
	import ChildCondition from './ChildCondition.svelte';

	export let state: Writable<State>;
	export let nodes: Docs.Decision[];
	export let assetTypes: Docs.AssetType[];
	export let assets: Docs.Asset[];
	export let assetsById: KeyMaps.Asset;
	export let nodesById: KeyMaps.Decision;
	export let nodesByParentId: KeyGroups.Decision;

	let selected = null;
	let tabs = ['Next Nodes', 'Variables'];
	let activeTab = null;

	$: {
		if (selected !== $state.selected) {
			selected = $state.selected;
			activeTab = tabs[0];
		}
	}

	$: startNodes = nodes.filter((node) => isStartNode(node.data));

	$: usedVariables = nodes.flatMap((node) =>
		isAssetNode(node.data) ? node.data?.setVariables?.map((v) => v.name) ?? [] : []
	);

	$: selectItems = [
		{ text: 'Trees', value: { type: TREE_TYPE } },
		...assetTypes.flatMap((type) => {
			let subgroups = [];
			if (type.data.parentTypeID) {
				const assetsOfType = assets.filter((asset) => asset.data.type === type.data.parentTypeID);
				subgroups = assetsOfType.map((asset) => ({
					text: `Asset Type: ${type.data.name} (${asset.data.name})`,
					value: { type: type.id, subtype: asset.id }
				}));
			}
			return [{ text: `Asset Type: ${type.data.name}`, value: { type: type.id } }, ...subgroups];
		})
	];

	$: assetsByType = groupBy(assets, 'data.type') as KeyGroups.Asset;

	$: treeOptions = startNodes
		.map((node) => ({
			text: getNodeName(node, assetsById),
			value: node.id
		}))
		.filter((opt) => opt.value !== $state.drawTreeID)
		.sort((a, b) => a.text.localeCompare(b.text));

	let selectedType = null;
	$: {
		if (selected) {
			if (!selectedType) {
				const childNode = nodesByParentId[selected.id]?.[0];
				if (childNode) {
					if (isStartNode(childNode.data)) {
						selectedType = { type: TREE_TYPE };
					} else if (isAssetNode(childNode.data)) {
						const asset = assetsById[childNode.data.assetID];
						selectedType = { type: asset?.data?.type };
					}
				}
			}
		} else {
			selectedType = null;
		}
	}

	let selectedChildren: string | string[];
	let selectableChildren: { label: string; value: string }[];
	let selectedChildConditions: Record<string, string>;

	const sortChildren = (a, b) => a.label.localeCompare(b.label);
	$: {
		if (!selectedType) {
			selectableChildren = null;
			selectedChildren = null;
			selectedChildConditions = null;
		} else if (selectedType.type === TREE_TYPE) {
			selectableChildren = startNodes
				.map((node) => ({
					label: getNodeName(node, assetsById),
					value: node.id
				}))
				.filter((opt) => opt.value !== selected.data.treeID)
				.sort(sortChildren);

			selectedChildren = (nodesByParentId[selected.id] ?? []).map(
				(node) => node && isStartNode(node.data) && node.id
			)[0];
			selectedChildConditions = selected.data.childConditions;
		} else if (selectedType.subtype) {
			selectableChildren = (assetsByType[selectedType.type] ?? [])
				.filter((asset) => asset.data.subtype === selectedType.subtype)
				.map((asset) => ({
					label: asset.data.name,
					value: asset.id
				}))
				.sort(sortChildren);
			const selectableById = keyBy(selectableChildren, 'value');
			selectedChildren = (nodesByParentId[selected.id] ?? [])
				.map((node) => {
					if (node && isAssetNode(node.data)) {
						return selectableById[node.data.assetID]?.value;
					}
				})
				.filter(Boolean);
			selectedChildConditions = selected.data.childConditions;
		} else {
			selectableChildren = (assetsByType[selectedType.type] ?? [])
				.map((asset) => ({
					label: asset.data.name,
					value: asset.id
				}))
				.sort(sortChildren);
			selectedChildren = (nodesByParentId[selected.id] ?? [])
				.map((node) => {
					if (node && isAssetNode(node.data)) {
						const asset = assetsById[node.data.assetID];
						if (asset && asset.data.type === selectedType.type) {
							return asset.id;
						}
					}
				})
				.filter(Boolean);
			selectedChildConditions = selected.data.childConditions;
		}
	}

	const updateNode = (values: {
		loops?: string;
		children: string | string[];
		childConditions: Record<string, string>;
	}) => {
		return updateSelectedNode(
			selected,
			Array.isArray(values.children) ? values.children : [values.children],
			values.loops ?? '1',
			values.childConditions || {},
			selectedType?.type,
			nodesById,
			nodesByParentId,
			assetsById
		);
	};

	const updateNodeVariables = (values: { variables: Decision.Variable[] }) =>
		selected.update({
			setVariables: values.variables
		});

	const unsetSelected = () => {
		state.update((c) => ({ ...c, selected: null }));
	};

	const getParent = (node: Docs.Decision): string[] => {
		if (isStartNode(node.data)) {
			return node.data.parentIDs ?? [];
		} else if (isAssetNode(node.data)) {
			return node.data.parentID ? [node.data.parentID] : [];
		}
		return [];
	};

	let nextTreeValue = '';
	const assignOpenNodes = (e: CustomEvent<{ value: string }>) => {
		const nextTreeNode = nodesById[e.detail.value];
		if (nextTreeNode) {
			const allParentIDs = new Set(nodes.flatMap(getParent));
			const currentTreeNodes = nodes.filter((node) => node.data.treeID === $state.drawTreeID);
			const openEnds = currentTreeNodes
				.filter((node) => !allParentIDs.has(node.id))
				.map((n) => n.id);

			nextTreeNode.update({ parentIDs: [...openEnds, ...getParent(nextTreeNode)] });
		}
		nextTreeValue = '';
	};
	const initialLoops = (node) => (isStartNode(node.data) ? node.data.loops : undefined);

	const listVariables = (node) =>
		isAssetNode(node.data) ? Object.entries(node.data.setVariables ?? {}) : [];
</script>

{#if selected}
	<Modal open on:close={unsetSelected}>
		{#if isAssetNode(selected.data)}
			<TabBar {tabs} class="mb2" let:tab bind:active={activeTab}>
				<Tab {tab}>
					<Label>{tab}</Label>
				</Tab>
			</TabBar>
		{/if}
		{#if activeTab === tabs[0]}
			<Form
				initialValues={{
					children: selectedChildren,
					loops: initialLoops(selected),
					childConditions: selectedChildConditions
				}}
				onSubmit={updateNode}
				afterSubmit={unsetSelected}
			>
				<div class="flex-1 p-5">
					{#if isStartNode(selected.data)}
						<Autocomplete name="loops" label="Loops through tree" items={usedVariables} />
					{/if}
					Next Choices:
					<Select label="Type" items={selectItems} bind:value={selectedType} />
					{#if selectableChildren}
						{#if selectedType?.type === TREE_TYPE}
							<RadioGroup label="Trees:" name="children" items={selectableChildren} />
						{:else}
							<CheckBoxGroup
								all
								label="Assets:"
								name="children"
								items={selectableChildren}
								let:id
								let:checked
							>
								<ChildCondition slot="extra" name="childConditions.{id}" {checked} />
							</CheckBoxGroup>
						{/if}
					{/if}
				</div>
				<Button type="submit">Save</Button>
			</Form>
		{/if}
		{#if activeTab === tabs[1]}
			{#if isAssetNode(selected.data)}
				<Form
					initialValues={{ variables: selected.data.setVariables ?? [] }}
					onSubmit={updateNodeVariables}
					afterSubmit={unsetSelected}
				>
					<SimpleList
						name="variables"
						itemTemplate={{ name: 'New Variable', value: '' }}
						let:remove
						let:namePrefix
					>
						<div class="flex g2">
							<Autocomplete name="{namePrefix}name" label="Variable name" items={usedVariables} />
							<TextField name="{namePrefix}value" label="Value" />
							<ConfirmButton on:confirm={remove} />
						</div>
					</SimpleList>
					<Button type="submit">Save</Button>
				</Form>
			{/if}
		{/if}
	</Modal>
{/if}

<div>
	Assign next node for all unassigned nodes: <Select
		items={treeOptions}
		label="Tree"
		bind:value={nextTreeValue}
		on:change={assignOpenNodes}
	/>
</div>
