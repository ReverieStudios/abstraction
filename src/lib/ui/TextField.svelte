<script>
	import Textfield from '@smui/textfield';
	import HelperText from '@smui/textfield/helper-text';

	export let input = null;
	export let value = '';
	export let helperText = null;
	export let error = null;
</script>

<span class={$$props.class || ''}>
	<Textfield
		bind:input
		on:keydown
		on:input
		on:change
		on:focus
		on:blur
		bind:value
		invalid={error}
		variant="filled"
		{...$$restProps}
		class="hook col-12"
	>
		<svelte:fragment slot="helper">
			{#if error}
				<HelperText persistent><span class="text-error">{error}</span></HelperText>
			{/if}
			{#if helperText}
				<HelperText persistent>{helperText}</HelperText>
			{/if}
		</svelte:fragment>
	</Textfield>
</span>

<style>
	:global(.hook:not(.mdc-text-field--invalid)) {
		--mdc-theme-primary: var(--on-secondary);
	}
	:global(.hook.mdc-text-field--focused:not(.mdc-text-field--invalid):not(.mdc-text-field--disabled)
			.mdc-floating-label) {
		color: var(--text-on-secondary);
	}
</style>
