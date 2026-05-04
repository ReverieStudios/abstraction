<script lang="ts">
	import type { Docs } from '$lib/database/types';
	import Textfield from '@smui/textfield';
	import Icon from '@smui/textfield/icon';
	import IconButton from '@smui/icon-button';

	export let users: Docs.User[] = [];
	export let placeholder = 'Search by name or email…';
	export let extraSearchTerms: Record<string, string> = {};

	let query = '';

	$: filteredUsers = query.trim()
		? users.filter((u) => {
				const q = query.toLowerCase();
				return (
					u.data.name?.toLowerCase().includes(q) ||
					u.data.email?.toLowerCase().includes(q) ||
					extraSearchTerms[u.id]?.toLowerCase().includes(q)
				);
			})
		: users;
</script>

<span class="user-search-wrapper">
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
<slot {filteredUsers} />

<style>
	.user-search-wrapper {
		display: block;
		margin-bottom: 0.5rem;
	}
	:global(.user-search-wrapper .hook:not(.mdc-text-field--invalid)) {
		--mdc-theme-primary: var(--on-secondary);
	}
	:global(.user-search-wrapper .hook.mdc-text-field--focused:not(.mdc-text-field--invalid):not(.mdc-text-field--disabled)
			.mdc-floating-label) {
		color: var(--text-on-secondary);
	}
	:global(.user-search-wrapper .clear-btn--hidden) {
		visibility: hidden;
		pointer-events: none;
	}
</style>
