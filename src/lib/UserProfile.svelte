<script lang="ts">
	import StoreForm from '$lib/StoreForm.svelte';
	import Form from '$lib/form/Form.svelte';
	import TextField from '$lib/form/TextField.svelte';
	import Button from '$lib/ui/Button.svelte';
	import Modal from '$lib/ui/Modal.svelte';
	import { getNotify } from '$lib/ui/Notifications.svelte';
	import { session } from '$app/stores';
	import TabBar from '@smui/tab-bar';
	import Tab, { Label } from '@smui/tab';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import FormSigner from './FormSigner.svelte';

	export let userID: string;
	export let title = 'User Profile';
	export let subtitle = '';

	let activeTab = $page.url.searchParams.get('tab') ?? 'Profile';
	$: goto(`?tab=${activeTab}`);

	const sendNotification = getNotify();

	let updates: string[] = null;

	const activateToken = (data) =>
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
					session.update(($session) => ({
						...$session,
						user: {
							...$session.user,
							...body.user
						}
					}));
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
