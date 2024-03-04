<script lang="ts">
	import { database } from '$lib/database';
	import type { Docs } from '$lib/database/types';
	import { User } from '$lib/database/types/User';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import Form from '$lib/form/Form.svelte';
	import Modal from '$lib/ui/Modal.svelte';
	import Button from '$lib/ui/Button.svelte';
	import Select from '$lib/form/Select.svelte';
	import { getNotify } from '$lib/ui/Notifications.svelte';
	import CopyBox from '$lib/ui/CopyBox.svelte';
	import Icon from '$lib/ui/Icon.svelte';
	import Tooltip from '$lib/ui/Tooltip.svelte';

	const { users, games, forms } = database;

	const sendNotification = getNotify();

	const roleOptions = Object.entries(User.AccountType)
		.filter(([, v]) => typeof v === 'number')
		.map(([text, value]) => ({ text, value }));

	$: userID = $page.url.searchParams.get('user') as string;
	$: editing = $users.find((user) => user.id === userID) as Docs.User;

	const deselect = () => goto('?');
	const updateUser = ({ roles }) => editing.update({ roles });

	let newPassword = '';
	const loadUser = (userID: string) => {
		newPassword = '';
		return fetch('/api/user/manage/read', { method: 'POST', body: JSON.stringify({ userID }) })
			.then((res) => res.json())
			.then((res) => res.user);
	};

	const resetPassword = (userID: string) =>
		fetch('/api/user/manage/resetPassword', { method: 'POST', body: JSON.stringify({ userID }) })
			.then((res) => res.json())
			.then((res) => {
				if (res.success) {
					newPassword = res.newPassword;
					sendNotification({ text: 'Password reset.' });
				} else {
					sendNotification({ text: 'Password reset failed.' });
				}
			});

	const checkForms = (userForms) => {
		const formList = $forms || [];
		const allSigned = formList.every((form) => typeof userForms[form.id] === 'number');
		const allUpToDate = formList.every(
			(form) => typeof userForms[form.id] === 'number' && userForms[form.id] > form.data.lastUpdated
		);

		const data = {
			allSigned,
			allUpToDate,
			icon: 'content_paste_off',
			tooltip: 'Forms are unsigned'
		};

		if (allUpToDate) {
			data.icon = 'assignment';
			data.tooltip = 'All forms are signed';
		} else if (allSigned) {
			data.icon = 'pending_actions';
			data.tooltip = 'All forms are signed, but not the most recent version';
		}

		return data;
	};
</script>

<svelte:head>
	<title>Admin: Users</title>
</svelte:head>

<h1>User Management</h1>

<Modal title="Editing User" open={editing} on:close={deselect} let:closeModal>
	<Form class="mb1" initialValues={editing.data} onSubmit={updateUser} afterSubmit={closeModal}>
		<h2>{editing.data.name}</h2>

		<Select
			name="roles.system"
			items={roleOptions}
			label="System Role"
			defaultValue={User.AccountType.None}
		/>

		<h3>Roles by Game</h3>
		{#each $games as game (game.id)}
			<div class="mb2">
				<Select
					name="roles.games.{game.id}"
					items={roleOptions}
					label="Role for {game.data.name}"
					defaultValue={User.AccountType.None}
				/>
			</div>
		{/each}

		<Button class="mt2 fill" type="submit">Save</Button>
	</Form>

	<div class="my2">
		<h3>Form Signatures</h3>
		{#each $forms as form (form.id)}
			<div>
				{form.data.name}
				{#if editing.data.forms?.[form.id]}
					- signed on {new Date(editing.data.forms?.[form.id]).toDateString()}
					{#if editing.data.forms?.[form.id] < form.data.lastUpdated}
						(Updated on {new Date(form.data.lastUpdated).toDateString()})
					{/if}
				{:else}
					- not signed
				{/if}
			</div>
		{/each}
	</div>

	{#await loadUser(editing.id) then user}
		<div>Last Signed In: {user.metadata.lastSignInTime}</div>
		<div>Account type: {user.providerData[0].providerId}</div>
		{#if user.providerData[0].providerId === 'password'}
			<Button on:click={() => resetPassword(editing.id)} type="button" class="fill mt2">
				Reset Password
			</Button>
			{#if newPassword}
				<CopyBox label="New Password" content={newPassword} />
			{/if}
		{/if}
	{/await}
</Modal>

<div class="flex flex-column mx2 divided bg-primary rounded">
	{#each $users as user}
		{@const formData = checkForms(user.data.forms || {})}
		<div class="p2 flex justify-between">
			<a href="?user={user.id}">
				{user.data.name} ({user.data.email})
			</a>
			<span
				class="formData"
				class:allDone={formData.allUpToDate}
				class:allSigned={formData.allSigned}
			>
				<Tooltip rich text={formData.tooltip}><Icon>{formData.icon}</Icon></Tooltip>
			</span>
		</div>
	{/each}
</div>

<style>
	.formData {
		color: var(--error);
	}
	.formData.allSigned {
		color: var(--warning);
	}
	.formData.allDone {
		color: var(--success);
	}
</style>
