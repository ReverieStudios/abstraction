<script>
	import { store } from './firebase';
	import { onDestroy, createEventDispatcher } from 'svelte';
	import { writable } from 'svelte/store';
	import Form from '$lib/form/Form.svelte';
	import Spinner from './Spinner.svelte';

	export let path = '';
	export let doc = null;
	export let exists = true;
	export let defaultData = {};
	export let preSubmit = (values) => values;

	const dispatch = createEventDispatcher();

	const getDocRef = () => {
		if (doc) {
			if (doc.ref) {
				return doc.ref;
			}
			return doc.ref;
		}
		return store.doc(path);
	};

	const loading = Symbol('LOADING');
	const value = writable(exists ? loading : defaultData);
	const handleSubmit = (values) => {
		Promise.resolve(preSubmit(values))
			.then((values) => {
				const docToSet = getDocRef();
				return store.setDoc(docToSet, values, { merge: true }).then(() => values);
			})
			.then((values) => dispatch('submit', values))
			.catch(console.error);
	};

	if (exists) {
		const docToRead = getDocRef();
		const unsubscribe = store.onSnapshot(docToRead, (doc) => {
			value.set(doc.data());
		});
		onDestroy(unsubscribe);
	}
</script>

{#if $value === loading}
	<Spinner />
{:else}
	<Form initialValues={$value} onSubmit={handleSubmit} {...$$restProps}>
		<slot />
	</Form>
{/if}
