<script context="module">
	export const UP = Symbol('UP');
	export const DOWN = Symbol('DOWN');
</script>

<script lang="ts">
	import Button from '$lib/ui/Button.svelte';
	import { get } from 'lodash-es';
	import { getFormContext } from './getFormContext';

	export let name: string;
	export let itemTemplate: Object = {};

	const { form, updateValidateField } = getFormContext();

	$: list = get($form, name, []) as Array<any>;

	const addItem = () => {
		const added = [...list, { ...itemTemplate }];
		updateValidateField(name, added);
	};
	const removeItem = (idx: number) => {
		const remove: any = list[idx];
		const without = list.filter((i: any) => i !== remove);
		updateValidateField(name, without);
	};
	const move = (idx: number, direction: typeof UP | typeof DOWN) => () => {
		let newList = list;
		if (direction === UP) {
			if (idx >= 1 && idx <= list.length - 1) {
				newList = [...list.slice(0, idx - 1), list[idx], list[idx - 1], ...list.slice(idx + 1)];
			}
		} else if (direction === DOWN) {
			if (idx >= 0 && idx <= list.length - 2) {
				newList = [...list.slice(0, idx), list[idx + 1], list[idx], ...list.slice(idx + 2)];
			}
		}
		if (newList !== list) {
			updateValidateField(name, newList);
		}
	};
	const getMove = (idx: number, listLength: number) => ({
		up: {
			disabled: idx === 0,
			handler: move(idx, UP)
		},
		down: {
			disabled: idx === listLength - 1,
			handler: move(idx, UP)
		}
	});
</script>

<div class="flex flex-column fill g2 {$$props.class || ''}">
	{#each list as item, i (i)}
		<slot
			{item}
			fieldName={name}
			namePrefix="{name}.{i}."
			move={getMove(i, list.length)}
			remove={() => removeItem(i)}
		/>
	{/each}
	<div class="flex flex-row justify-center m2">
		<Button type="button" class="fill" on:click={addItem}>+</Button>
	</div>
</div>
