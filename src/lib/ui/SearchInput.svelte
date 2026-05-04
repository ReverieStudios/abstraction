<script lang="ts">
	import Textfield from '@smui/textfield';
	import Icon from '@smui/textfield/icon';
	import IconButton from '@smui/icon-button';

	export let placeholder = 'Search…';
	export let query = '';
</script>

<span class="search-input-wrapper">
	<Textfield
		bind:value={query}
		label={placeholder}
		variant="filled"
		class="hook col-12"
		withLeadingIcon
		withTrailingIcon
	>
		<Icon class="material-icons" slot="leadingIcon">search</Icon>
		<IconButton
			class="material-icons clear-btn {query ? '' : 'clear-btn--hidden'}"
			slot="trailingIcon"
			on:click={() => (query = '')}
			title="Clear search"
			tabindex={query ? 0 : -1}
		>close</IconButton>
	</Textfield>
</span>
<slot {query} />

<style>
	.search-input-wrapper {
		display: block;
		margin-bottom: 0.5rem;
	}
	:global(.search-input-wrapper .hook:not(.mdc-text-field--invalid)) {
		--mdc-theme-primary: var(--on-secondary);
	}
	:global(.search-input-wrapper .hook.mdc-text-field--focused:not(.mdc-text-field--invalid):not(.mdc-text-field--disabled)
			.mdc-floating-label) {
		color: var(--text-on-secondary);
	}
	:global(.search-input-wrapper .clear-btn--hidden) {
		visibility: hidden;
		pointer-events: none;
	}
</style>
