<script lang="ts">
	import { database } from './database';
	import { derived, type Readable } from 'svelte/store';
	import { session, page } from '$app/stores';
	import { goto } from '$app/navigation';

	const { forms, users } = database;

	const formUrl = '/profile?tab=Forms';
	export let userID: string;

	const user = users.doc(userID);
	const userForms = derived(user, ($user) => {
		return $user?.data?.forms || {};
	});

	const anyUnsigned = derived([forms, userForms], ([$forms, $userForms]) =>
		$forms.some((form) => $userForms[form.id] == null)
	);
	const anyUpdated = derived([forms, userForms], ([$forms, $userForms]) =>
		$forms.some((form) => $userForms[form.id] < form.data.lastUpdated)
	);
</script>

{#if $page.url.pathname !== '/profile' && !$page.url.pathname.startsWith('/admin')}
	{#if $anyUnsigned}
		<aside role="alert" class="bg-warning p2" on:click={() => goto(formUrl)}>
			<h2 class="m0">Unsigned forms</h2>
			<p>
				There are some forms that require signing in order to play. Click <a href={formUrl}>here</a>
				to sign them now
			</p>
		</aside>
	{:else if $anyUpdated}
		<aside role="alert" class="bg-warning p2" on:click={() => goto(formUrl)}>
			<h2 class="m0">Updated forms</h2>
			<p>
				There are some forms that have been updated since you signed. Click <a href={formUrl}
					>here</a
				> to review them now
			</p>
		</aside>
	{/if}
{/if}
