<script context="module" lang="ts">
	import { key } from 'svelte-forms-lib';
	export { key };
</script>

<script lang="ts">
	import { setContext } from 'svelte';
	import { get, derived, writable } from 'svelte/store';
	import { createForm } from 'svelte-forms-lib';
	import { dequal as isEqual } from 'dequal/lite';
	import DebugForm from './debug/DebugForm.svelte';
	import { dev } from '$app/environment';

	export let initialValues = {};
	export let validationSchema = null;
	export let validate: (values: Object) => Record<string, string> = () => ({});
	export let onSubmit: (values: Object, modified: Object) => void = () => {};
	export let afterSubmit: (...any) => void = () => {};
	export let multiform: boolean = false;

	const firstInitial = initialValues;

	let isSubmitting = false;
	const context = createForm<Record<string, any>>({
		initialValues,
		validate,
		validationSchema,
		onSubmit: (values) => {
			isSubmitting = true;
			Promise.resolve(onSubmit(freeze(values), get(modified)))
				.catch((ex) => {
					isSubmitting = false;
					updateInitial(initialValues);
					throw ex;
				})
				.then(afterSubmit);
		}
	});

	const { handleSubmit, updateValidateField, form } = context;

	const freeze = (o) => (o == null || typeof o !== 'object' ? o : JSON.parse(JSON.stringify(o)));

	const initial = writable(initialValues);
	const updateInitial = (newInitial) => {
		if (isSubmitting || newInitial === firstInitial) {
			return;
		}

		const updates = [];

		if (multiform) {
			for (let key in newInitial) {
				if (!firstInitial[key]) {
					updates.push([key, freeze({ from: firstInitial[key], to: newInitial[key] })]);
					firstInitial[key] = freeze(newInitial[key]);
					updateValidateField(key, freeze(newInitial[key]));
				} else if (firstInitial[key] !== newInitial[key]) {
					for (let subkey in newInitial) {
						if (!isEqual($form[key][subkey], firstInitial[key][subkey])) {
							updates.push([
								`${key}.${subkey}`,
								freeze({ from: firstInitial[key][subkey], to: newInitial[key][subkey] })
							]);
							firstInitial[key][subkey] = freeze(newInitial[key][subkey]);
							updateValidateField(`${key}.${subkey}`, freeze(newInitial[key][subkey]));
						}
					}
				}
			}
		} else {
			for (let key in newInitial) {
				if (!isEqual($form[key], firstInitial[key])) {
					updates.push([key, freeze({ from: firstInitial[key], to: newInitial[key] })]);
					firstInitial[key] = newInitial[key];
					updateValidateField(key, newInitial[key]);
				}
			}
		}

		if (updates.length > 0) {
			console.groupCollapsed(`InitialValue updates (${updates.length})`);
			updates.forEach(([key, detail]) => console.log(key, detail));
			console.groupEnd();
		} else {
			console.log('InitialValues updates (0)');
		}

		initial.set(newInitial);
	};

	$: updateInitial(initialValues);

	const modified = derived([form, initial], (stores: Object[]) => {
		const [$form, $initial] = stores;
		const object = {};
		for (let key in $form) {
			object[key] = !isEqual($form[key], $initial[key]);
		}

		return object;
	});

	setContext(key, { ...context, initial, modified });
</script>

<form on:submit|preventDefault={handleSubmit} {...$$restProps} autocomplete="off">
	{#if dev}
		<DebugForm {initialValues} />
	{/if}
	<slot />
</form>
