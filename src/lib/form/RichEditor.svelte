<script lang="ts">
	import { marked } from 'marked';
	import TurndownService from 'turndown';
	import './medium-editor.postcss';

	import { onMount } from 'svelte';
	import { getFieldContext } from './getFormContext';

	const turndownService = new TurndownService();

	export let name: string;
	export let label: string;

	const {
		updateValidateField,
		field: { value }
	} = getFieldContext(name, '');

	let lastUpdated = null;
	let html = '';
	let content = '';
	$: {
		const formValue = $value;
		if (formValue !== lastUpdated) {
			content = formValue;
			html = marked.parse($value, { breaks: true });
		}
	}
	let el: HTMLDivElement;

	let hasFocus = false;
	$: visibleText = /\S/.test(content);
	$: floatLabel = visibleText || hasFocus;

	onMount(async () => {
		const MediumEditor = (await import('medium-editor')).default;
		const editor = new MediumEditor([el], {
			placeholder: false,
			toolbar: {
				buttons: ['bold', 'italic', 'underline', 'h2', 'h3', 'quote', 'anchor']
			}
		});
		return () => {
			editor.removeElements(el);
		};
	});

	const saveForm = () => {
		const html = el.innerHTML;
		content = el.innerText;
		const markdown = turndownService.turndown(html);
		lastUpdated = markdown;
		updateValidateField(name, lastUpdated);
	};
</script>

<!-- svelte-ignore a11y-label-has-associated-control -->
<label class="hook col-12 mdc-text-field mdc-text-field--filled mdc-ripple-upgraded adjustable">
	<span class="mdc-text-field__ripple" />
	<span
		class="mdc-floating-label"
		class:mdc-floating-label--float-above={floatLabel}
		class:floating={floatLabel}>{label}</span
	>
	<div
		bind:this={el}
		class="editable mdc-text-field__input"
		on:focus={() => (hasFocus = true)}
		on:blur={() => (hasFocus = false)}
		on:input={saveForm}
		contenteditable="true"
		bind:innerHTML={html}
	/>
	<div class="mdc-line-ripple" style="" />
</label>

<style>
	.adjustable {
		height: auto;
	}
	.floating {
		top: 1.7em;
	}
	.editable {
		color: var(--text-color);
		overflow: auto;
		cursor: text;
		min-height: 2em;
		height: auto;
		max-height: 15em;
		width: 100%;
		margin-top: 1.4em;
		padding-bottom: 0.5em;
	}
	:global(.editable p) {
		margin: 0;
	}
	:global(.editable p + p) {
		margin-top: 0.5em;
	}
	.editable:focus {
		outline: none;
	}
</style>
