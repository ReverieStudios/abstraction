<script lang="ts">
	import UserSearch from './UserSearch.svelte';
	export let users: any[] = [];
	export let placeholder: string | undefined = undefined;
</script>

<UserSearch {users} {placeholder} let:filteredUsers>
	{#each filteredUsers as user (user.id)}
		<li data-testid="user-item" data-userid={user.id}>
			{user.data.name ?? ''} {user.data.email ?? ''}
		</li>
	{/each}
</UserSearch>
