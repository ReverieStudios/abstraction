<script lang="ts">
	import { auth, handleSignIn } from '$lib/firebase';
	import Form from '$lib/form/Form.svelte';
	import LayoutGrid, { Cell } from '@smui/layout-grid';
	import TextField from '$lib/form/TextField.svelte';
	import FormButton from '$lib/form/Button.svelte';
	import Button from '$lib/ui/Button.svelte';
	import { getNotify } from '$lib/ui/Notifications.svelte';
	import type { GoogleAuthProvider } from 'firebase/auth';

	type Provider = GoogleAuthProvider;
	interface LoginFormData {
		email: string;
		password: string;
		action: string;
	}

	const sendNotification = getNotify();

	const validate = (data: LoginFormData): Record<string, string> => {
		const err = {} as Record<string, string>;
		if (!data.email) {
			err.email = 'Email must be filled in';
		}
		if (!data.password) {
			err.password = 'Password must be filled in';
		}
		return err;
	};

	const handleLocalAuth = async (data: LoginFormData) => {
		if (data.action === 'sign-up') {
			return auth
				.createUserWithEmailAndPassword(data.email, data.password)
				.catch((error) => {
					const errorMessage = error.message;
					sendNotification({ text: errorMessage.replace('Firebase: ', '') });
				})
				.then(handleSignIn);
		}
		return auth
			.signInWithEmailAndPassword(data.email, data.password)
			.catch((error) => {
				const errorMessage = error.message;
				sendNotification({ text: errorMessage.replace('Firebase: ', '') });
			})
			.then(handleSignIn);
	};
	const handleProviderAuth = (provider: Provider) => {
		const isApple = /(iP(ad|od|hone)|Safari)/i.test(window.navigator.userAgent);
		if (isApple) {
			console.log("handleProviderAuth isApple");
			window.location.href = '/home';
			auth.signInWithRedirect(provider).then(handleSignIn);
		} else {
			console.log("handleProviderAuth notApple");
			auth.signInWithPopup(provider).then(handleSignIn);
		}
	};
</script>

<svelte:head>
	<title>Reverie Portal</title>
</svelte:head>

<div class="content">
	<h1>Reverie Portal</h1>

	<Form {validate} onSubmit={handleLocalAuth} autocomplete="off">
		<LayoutGrid>
			<Cell span={12}>
				<TextField class="col-12" label="Email" name="email" />
			</Cell>
			<Cell span={12}>
				<TextField class="col-12" label="Password" type="password" name="password" />
			</Cell>
			<Cell spanDevices={{ desktop: 6, tablet: 4, phone: 2 }}>
				<FormButton class="col-12" name="action" value="sign-up">Sign Up</FormButton>
			</Cell>
			<Cell spanDevices={{ desktop: 6, tablet: 4, phone: 2 }}>
				<FormButton class="col-12" name="action" value="sign-in">Sign In</FormButton>
			</Cell>

			{#each Object.entries(auth.providers) as [name, provider] (name)}
				<Cell span={12}>
					<Button class="col-12" type="button" on:click={() => handleProviderAuth(provider)}>
						Sign In With {name}
					</Button>
				</Cell>
			{/each}
		</LayoutGrid>
	</Form>
</div>

<style>
	.content {
		max-width: 64rem;
		margin: 0 auto;
		padding: 1rem 0;
	}
	@media (min-width: 40em) {
		.content {
			padding: 1rem 4rem;
		}
	}
</style>
