<script>
	import { store } from './firebase';
	import { setContext, createEventDispatcher } from 'svelte';
	import { createForm, key } from 'svelte-forms-lib';

	export let collection = '';
	export let initialValues = {};

	const context = createForm({
		initialValues,
		onSubmit: (values) => {
			update(values).then(() => {
				dispatch('submit', { ...values });
				handleReset();
			});
		}
	});

	const { handleSubmit, handleReset } = context;

	setContext(key, context);

	const dispatch = createEventDispatcher();

	let form;
	const update = (newData) =>
		store
			.addDoc(store.collection(collection), newData)
			.then(() => form.scrollIntoView({ behavior: 'smooth', inline: 'end' }));
</script>

<form autocomplete="off" on:submit={handleSubmit} bind:this={form}>
	<slot />
</form>
