<script lang="ts" context="module">
</script>

<script lang="ts">
	import Tooltip from '$lib/ui/Tooltip.svelte';
	import { getNotify } from '$lib/ui/Notifications.svelte';
	import type { Docs } from '$lib/database';

	import { Lock } from '$lib/database/types/Lock';
	import Icon from '$lib/ui/Icon.svelte';
	import type { Readable } from 'svelte/store';

	export let lockStatus: Readable<Lock.Status>;
	export let asset: Docs.Asset;

	const sendNotification = getNotify();

	const getLockIconName = (status: Lock.Status) => {
		switch (status) {
			case Lock.Status.None:
				return null;

			case Lock.Status.PlayerQueued:
				return 'lock_clock';

			case Lock.Status.PlayerClaimed:
				return 'lock';

			case Lock.Status.PlayerCanClaim:
			case Lock.Status.PlayerCanQueue:
				return 'lock_open';

			default:
				return 'lock_reset';
		}
	};

	const getDescription = (status: Lock.Status) => {
		switch (status) {
			case Lock.Status.PlayerQueued:
				return 'You are in the queue for this item.';

			case Lock.Status.PlayerClaimed:
				return 'You have claimed this item.';

			case Lock.Status.PlayerCanClaim:
				return 'You can claim this item.';

			case Lock.Status.PlayerCanQueue:
				return 'You can join the queue for this item.';

			case Lock.Status.Unavailable:
				return 'This item is no longer available.';

			default:
				return null;
		}
	};

	const getClass = (status: Lock.Status) => {
		switch (status) {
			case Lock.Status.PlayerQueued:
			case Lock.Status.PlayerClaimed:
			case Lock.Status.PlayerCanClaim:
				return 'lock-available';

			case Lock.Status.PlayerCanQueue:
				return 'lock-semi-available';

			case Lock.Status.Unavailable:
				return 'lock-unavailable';

			default:
				return null;
		}
	};

	let lastStatus = $lockStatus;
	$: {
		if (lastStatus === Lock.Status.PlayerQueued && $lockStatus === Lock.Status.PlayerClaimed) {
			sendNotification({ text: `Lock obtained for ${asset.data.name}` });
		}
		lastStatus = $lockStatus;
	}

	$: lockName = getLockIconName($lockStatus);
	$: description = getDescription($lockStatus);
	$: className = getClass($lockStatus);
</script>

{#if lockName}
	<span class="pr2">
		{#if description}
			<Tooltip rich text={description}>
				<Icon class={className}>{lockName}</Icon>
			</Tooltip>
		{:else}
			<Icon class={className}>{lockName}</Icon>
		{/if}
	</span>
{/if}

<style>
	:global(.lock-available) {
		color: var(--success);
	}
	:global(.lock-semi-available) {
		color: #ffeb3b;
	}
	:global(.lock-unavailable) {
		color: var(--error);
	}
</style>
