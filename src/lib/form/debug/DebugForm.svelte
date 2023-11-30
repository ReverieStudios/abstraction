<script lang="ts" context="module">
	import { writable } from 'svelte/store';
	export const debugEnabled = writable(false);
</script>

<script lang="ts">
	import { getFormContext } from '../getFormContext';
	import Checkbox from '$lib/ui/Checkbox.svelte';

	let showValues = false;
	let showErrors = false;
	let showInitial = false;
	let showModified = false;

	export let initialValues;

	const { form, errors, modified } = getFormContext();
</script>

{#if $debugEnabled}
	<div class="flex items-center justify-between px3 bg-accent rounded">
		<span>Debug: </span>
		<Checkbox label="Values" bind:checked={showValues} />
		{#if initialValues}
			<Checkbox label="Initial" bind:checked={showInitial} />
		{/if}
		<Checkbox label="Errors" bind:checked={showErrors} />
		<Checkbox label="Modified" bind:checked={showModified} />
	</div>
	{#if showValues}
		<pre style="white-space: pre-wrap;"><code>{JSON.stringify($form)}</code></pre>
	{/if}
	{#if showInitial && initialValues}
		<pre style="white-space: pre-wrap;"><code>{JSON.stringify(initialValues)}</code></pre>
	{/if}
	{#if showErrors}
		<pre style="white-space: pre-wrap;"><code>{JSON.stringify($errors)}</code></pre>
	{/if}
	{#if showModified}
		<pre style="white-space: pre-wrap;"><code>{JSON.stringify($modified)}</code></pre>
	{/if}
{/if}
