<script lang="ts">
	import ConfirmButton from '$lib/ConfirmButton.svelte';
	import CreateButton from '$lib/CreateButton.svelte';
	import { goto } from '$app/navigation';
	import { Wrapper, Item } from '$lib/boxLinks';
	import { database } from '$lib/database';
	import Modal from '$lib/ui/Modal.svelte';
	import { page } from '$app/stores';
	import Form from '$lib/form/Form.svelte';
	import TextField from '$lib/form/TextField.svelte';
	import Button from '$lib/form/Button.svelte';
	import RichEditor from '$lib/form/RichEditor.svelte';

	const { forms } = database;

	let showForm = null;
	$: {
		const id = $page.url.searchParams.get('id');
		if (!id) {
			showForm = null;
		} else {
			showForm = $forms.find((f) => f.id === id);
		}
	}
	const updateForm = (values) => showForm.update(values);
	const closeModal = () => goto('?');
</script>

<svelte:head>
	<title>Admin: Forms</title>
</svelte:head>

<div class="content">
	<h1>Forms</h1>

	<Modal open={showForm} on:close={() => goto('?')}>
		<Form
			initialValues={showForm.data}
			class="flex flex-column g2"
			onSubmit={updateForm}
			afterSubmit={closeModal}
		>
			<TextField class="flex-auto" label="Name" name="name" />
			<RichEditor label="Body" name="text" />
			<Button type="submit">Save</Button>
		</Form>
	</Modal>

	<Wrapper items={$forms} let:item>
		<Item href="?id={item.id}">
			<h4 class="bold h3 my1">
				{item.data.name}
			</h4>

			<ConfirmButton slot="actions" on:confirm={() => item.remove()} />
		</Item>
	</Wrapper>
	<div class="mt2 mx3">
		<CreateButton parent={forms} id={(t) => t} on:create={(e) => goto(`?id=${e.detail}`)} />
	</div>
</div>
