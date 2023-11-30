import { getContext } from 'svelte';
import { key } from 'svelte-forms-lib';
import { derived } from 'svelte/store';
import type { Writable, Readable } from 'svelte/store';
import { get } from 'lodash-es';

type Inf = Record<string, any>;

type FormState = {
	form: Writable<Inf>;
	errors: Writable<Record<keyof Inf, string>>;
	touched: Writable<Record<keyof Inf, boolean>>;
	modified: Readable<Record<keyof Inf, boolean>>;
	isValid: Readable<boolean>;
	isSubmitting: Writable<boolean>;
	isValidating: Writable<boolean>;
	isModified: Readable<boolean>;
	updateField: (field: keyof Inf, value: any) => void;
	updateValidateField: (field: keyof Inf, value: any) => void;
	updateTouched: (field: keyof Inf, value: any) => void;
	validateField: (field: keyof Inf) => Promise<any>;
	updateInitialValues: (newValues: Inf) => void;
	handleReset: () => void;
	state: Readable<{
		form: Inf;
		errors: Record<keyof Inf, string>;
		touched: Record<keyof Inf, boolean>;
		modified: Record<keyof Inf, boolean>;
		isValid: boolean;
		isSubmitting: boolean;
		isValidating: boolean;
		isModified: boolean;
	}>;
	handleChange: (event: Event) => any;
	handleSubmit: (event: Event) => any;
};

interface FieldData {
	value: Readable<any>;
	formError: Readable<string>;
}

interface FormStateWithField extends FormState {
	field: FieldData;
}

export const getFormContext = (): FormState => {
	return getContext(key) as FormState;
};

export const getFieldContext = (name: string, defaultValue?: any): FormStateWithField => {
	const context = getContext(key) as FormState;

	return {
		...context,
		field: {
			value: derived(context.form, ($form) => get($form, name, defaultValue)),
			formError: derived(context.errors, ($errors) => get($errors, name, null))
		}
	} as FormStateWithField;
};
