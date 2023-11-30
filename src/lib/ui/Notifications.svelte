<script lang="ts" context="module">
	import { getContext, setContext } from 'svelte';
	const NOTIFY = Symbol('Notify');

	interface NotificationAction {
		onClick: () => void;
		text: string;
	}

	interface Notification {
		text: string;
		actions?: NotificationAction[];
		onDismiss?: () => void;
		onClose?: () => void;
	}

	type Notify = (notification: Notification) => void;

	export const getNotify = (): Notify => {
		return getContext(NOTIFY);
	};
</script>

<script lang="ts">
	import Kitchen from '@smui/snackbar/kitchen';
	let kitchen: { push: (d: Object) => void };

	const notify = ({ text, actions, onDismiss, onClose }) => {
		kitchen.push({
			props: {
				variant: 'stacked'
			},
			label: text,
			actions,
			dismissButton: typeof onDismiss === 'function',
			onDismiss,
			onClose
		});
	};

	setContext(NOTIFY, notify);
</script>

<Kitchen bind:this={kitchen} dismiss$class="material-icons" />
<slot />
