<script lang="ts">
	import type { Docs } from '$lib/database/types';
	import SearchInput from '$lib/ui/SearchInput.svelte';

	export let users: Docs.User[] = [];
	export let placeholder = 'Search by name or email…';

	let query = '';

	$: filteredUsers = query.trim()
		? users.filter((u) => {
				const q = query.toLowerCase();
				return (
					u.data.name?.toLowerCase().includes(q) || u.data.email?.toLowerCase().includes(q)
				);
			})
		: users;
</script>

<SearchInput bind:query {placeholder} />
<slot {filteredUsers} />
