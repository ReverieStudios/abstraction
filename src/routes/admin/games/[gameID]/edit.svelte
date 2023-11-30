<script>
	import StoreForm from '$lib/StoreForm.svelte';
	import Button from '$lib/ui/Button.svelte';
	import TextField from '$lib/form/TextField.svelte';
	import Checkbox from '$lib/form/Checkbox.svelte';

	import { page } from '$app/stores';
	import { goto } from '$app/navigation';

	const { gameID } = $page.params;
</script>

<svelte:head>
	<title>Editing Game</title>
</svelte:head>

<div class="content">
	<h1>Editing game</h1>

	<StoreForm
		class="flex flex-column mb3"
		path="/admin/games/{gameID}"
		on:submit={() => goto(`/admin/games/${gameID}`)}
	>
		<TextField label="Name" name="name" class="mb2" />
		<TextField label="Summary" name="summary" class="mb2" />
		<TextField label="Discord Server ID" name="discordID" class="mb2" />
		<Checkbox label="Public" name="public" class="mb2" />
		<Button class="w-full mt3">Save</Button>
	</StoreForm>
</div>
