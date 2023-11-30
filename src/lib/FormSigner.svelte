<script lang="ts">
	import { database } from './database';
	import { derived, type Readable } from 'svelte/store';
	import Button from './ui/Button.svelte';
	import Modal from './ui/Modal.svelte';
	import RichViewer from './ui/RichViewer.svelte';
	import Icon from './ui/Icon.svelte';

	const { forms, users } = database;

	export let userID: string;

	const user = users.doc(userID);
	const userForms = derived(user, ($user) => {
		return $user?.data?.forms || {};
	});

	const formsWithSignedAt = derived([forms, userForms], ([$forms, $userForms]) => {
		return $forms.map((form) => {
			const signedAt = $userForms[form.id];

			return {
				id: form.id,
				form,
				signedAt,
				unsigned: signedAt == null,
				outOfDate: typeof signedAt === 'number' && signedAt < form.data.lastUpdated
			};
		});
	});

	const classes = (unsigned: boolean, outOfDate: boolean) => {
		if (unsigned) {
			return 'unsigned';
		} else if (outOfDate) {
			return 'updated';
		}
		return 'uptodate';
	};
	const icon = (unsigned: boolean, outOfDate: boolean) => {
		if (unsigned) {
			return 'close';
		} else if (outOfDate) {
			return 'refresh';
		}
		return 'done';
	};

	const format = (ts: number) => {
		const d = new Date(ts);
		return d.toDateString();
	};

	const signForm = (formID) => {
		const forms = $user.data.forms || {};
		forms[formID] = Date.now();
		return user.update({ forms });
	};

	let showForm = null;
</script>

<Modal
	open={showForm}
	on:close={() => (showForm = null)}
	let:closeModal
	title={showForm?.data?.name}
>
	<p>Last Updated: {format(showForm?.data?.lastUpdated)}</p>
	<RichViewer value={showForm?.data?.text} />

	<Button slot="actions" on:click={() => signForm(showForm.id).then(closeModal)}>
		I agree to the above
	</Button>
</Modal>

<div class="divided pt2">
	{#each $formsWithSignedAt as { id, form, unsigned, outOfDate } (id)}
		<Button class="fill h4 {classes(unsigned, outOfDate)}" on:click={() => (showForm = form)}>
			<Icon class="px2">{icon(unsigned, outOfDate)}</Icon>
			{form.data.name} (Last Updated {format(form.data.lastUpdated)})
		</Button>
	{/each}
</div>

<style>
	.divided {
		--mdc-filled-button-container-height: 60px;
	}
</style>
