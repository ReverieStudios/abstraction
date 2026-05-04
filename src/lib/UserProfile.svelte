<script lang="ts">
	import StoreForm from '$lib/StoreForm.svelte';
	import Form from '$lib/form/Form.svelte';
	import TextField from '$lib/form/TextField.svelte';
	import Button from '$lib/ui/Button.svelte';
	import Modal from '$lib/ui/Modal.svelte';
	import { getNotify } from '$lib/ui/Notifications.svelte';
	import TabBar from '@smui/tab-bar';
	import Tab, { Label } from '@smui/tab';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import FormSigner from './FormSigner.svelte';
	import { auth } from '$lib/firebase';
	import { validatePasswordChange, submitPasswordChange } from '$lib/auth/changePassword';

	export let userID: string;
	export let title = 'User Profile';
	export let subtitle = '';

	let activeTab = $page.url.searchParams.get('tab') ?? 'Profile';
	$: goto(`?tab=${activeTab}`);

	const sendNotification = getNotify();

	let updates: string[] | null = null;

	let isPasswordUser = false;
	let passwordResetKey = 0;
	const resetPasswordForm = () => passwordResetKey++;
	auth?.onAuthStateChanged((user: import('firebase/auth').User | null) => {
		isPasswordUser = user?.providerData.some((p: import('firebase/auth').UserInfo) => p.providerId === 'password') ?? false;
	});

	const changePassword = async (values: import('$lib/auth/changePassword').PasswordChangeValues) => {
		try {
			await submitPasswordChange(auth, values);
			sendNotification({ text: 'Password updated successfully.' });
		} catch (err: any) {
			const code = err?.code ?? '';
			if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
				sendNotification({ text: 'Current password is incorrect.' });
			} else {
				sendNotification({ text: 'Something went wrong changing your password.' });
			}
			resetPasswordForm();
		}
	};

	const validatePassword = validatePasswordChange as (values: object) => Record<string, string>;
	const submitPasswordForm = changePassword as (values: any) => Promise<void>;

	const activateToken = (data: any) =>
		fetch('/api/user/activateToken', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json;charset=utf-8'
			},
			body: JSON.stringify(data)
		})
			.then((res) => res.json())
			.then((body) => {
				if (body.updates) {
					updates = body.updates;
				} else if (body.noclaims) {
					sendNotification({ text: 'Token appears to be invalid.' });
				} else {
					throw new Error('Goto catch');
				}
			})
			.catch(() => {
				sendNotification({ text: 'Something went wrong.' });
			});
</script>

<svelte:head>
	<title>User Profile</title>
</svelte:head>

<h2>{title}</h2>
{#if subtitle}
	<h3>{subtitle}</h3>
{/if}
<TabBar
	tabs={['Profile', 'Unlock Permission Token', 'Forms']}
	class="my2"
	let:tab
	bind:active={activeTab}
>
	<Tab {tab}>
		<Label>{tab}</Label>
	</Tab>
</TabBar>
{#if activeTab === 'Profile'}
	<StoreForm path="users/{userID}" on:submit={() => sendNotification({ text: 'Profile updated' })}>
		<div class="flex flex-column g2">
			<TextField class="fill" label="Name" name="name" />
			<TextField class="fill" label="Pronouns" name="pronouns" />
			<p class="my0">Set email to allow staff to reach out to you about any issues</p>
			<TextField class="fill" label="Email Address" name="email" type="email" />
			<p class="my0">
				Setting your Discord handle to allow ReverieBot to notify you of changes to your character
			</p>
			<p class="my0">Please use your username plus distinguisher, e.g. MyCoolUsername#1234</p>
			<TextField class="fill" label="Discord Account" name="discordID" />

			<Button>Save</Button>
		</div>
	</StoreForm>

	{#if isPasswordUser}
		{#key passwordResetKey}
			<Form
				initialValues={{ currentPassword: '', newPassword: '', confirmPassword: '' }}
				validate={validatePassword}
				onSubmit={submitPasswordForm}
				afterSubmit={resetPasswordForm}
			>
				<h3 class="mt3 mb1">Change Password</h3>
				<div class="flex flex-column g2">
					<TextField class="fill" label="Current Password" name="currentPassword" type="password" />
					<TextField class="fill" label="New Password" name="newPassword" type="password" />
					<TextField class="fill" label="Confirm New Password" name="confirmPassword" type="password" />
					<Button>Update Password</Button>
				</div>
			</Form>
		{/key}
	{/if}
{/if}
{#if activeTab === 'Unlock Permission Token'}
	{#if updates}
		<Modal title="Unlocked" open on:close={() => (updates = null)}>
			{#if updates.length === 0}
				Token was valid, but no new permissions or flags were unlocked.
			{:else}
				<ul>
					{#each updates as update}
						<li>{update}</li>
					{/each}
				</ul>
			{/if}
			<svelte:fragment slot="actions">
				<Button class="fill">Dismiss</Button>
			</svelte:fragment>
		</Modal>
	{/if}
	<Form initialValues={{}} onSubmit={activateToken}>
		<h3>Activate Permission Token</h3>
		<p>Staff may send you a token string to unlock permissions for your account.</p>
		<p>Entering it below authenticates its accuracy and sets appropriate flags.</p>
		<TextField label="Token" name="token" />
		<Button class="mt2 fill">Activate</Button>
	</Form>
{/if}
{#if activeTab === 'Forms'}
	<FormSigner {userID} />
{/if}
