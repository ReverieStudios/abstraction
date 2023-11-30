<script lang="ts">
	import { database, type Docs } from '$lib/database';
	import type { User } from '$lib/database/types/User';
	import Icon from '$lib/ui/Icon.svelte';
	import Tooltip from '$lib/ui/Tooltip.svelte';

	export let gameID: string;
	export let user: User;
	export let requirements: string[];
	export let limitations: string[];

	const validateFlags = (flags: string[], allFlags: Docs.Flag[]) => {
		if (!Array.isArray(flags)) {
			return null;
		}
		return flags.filter((flagID) => allFlags.some((flag) => flag.id === flagID));
	};
	const getFlagName = (flagID: string, allFlags: Docs.Flag[]) => {
		return allFlags.find((flag) => flag.id === flagID)?.data?.name;
	};

	const flags = database.flags;
	$: validated = {
		requirements: validateFlags(requirements, $flags),
		limitations: validateFlags(limitations, $flags)
	};
	$: anyFlags = (validated?.requirements?.length ?? 0) + (validated?.limitations?.length ?? 0) > 0;

	$: userFlags = user?.flags?.[gameID] ?? [];

	$: meetsRequired = (validated?.requirements ?? []).some((flagID) => userFlags?.includes(flagID));
	$: meetsLimited = (validated?.limitations ?? []).every((flagID) => !userFlags?.includes(flagID));
	$: meetsAll = meetsRequired && meetsLimited;
</script>

{#if anyFlags}
	<Tooltip rich class="flex items-center">
		<Icon style="cursor:pointer" class={meetsAll ? 'req-met' : 'req-unmet'}
			>{meetsAll ? 'check_circle' : 'cancel'}</Icon
		>
		<svelte:fragment slot="tooltip">
			{#if requirements}
				<div class="flagList">
					<div>
						<Icon class="mr1 {meetsRequired ? 'req-met' : 'req-unmet'}">add_circle_outline</Icon
						>Required:
					</div>
					{#each requirements as required}
						{@const met = userFlags.includes(required)}
						<div class="requirement">
							<Icon class="mr1 {met ? 'req-met' : 'req-unmet'}">{met ? 'check' : 'clear'}</Icon>
							{getFlagName(required, $flags)}
						</div>
					{/each}
				</div>
			{/if}
			{#if limitations}
				<div class="flagList">
					<div>
						<Icon class="mr1 {meetsLimited ? 'req-met' : 'req-unmet'}">remove_circle_outline</Icon
						>Forbidden:
					</div>
					{#each limitations as limited}
						{@const met = !userFlags.includes(limited)}
						<div class="requirement">
							<Icon class="mr1 {met ? 'req-met' : 'req-unmet'}">{met ? 'check' : 'clear'}</Icon>
							{getFlagName(limited, $flags)}
						</div>
					{/each}
				</div>
			{/if}
		</svelte:fragment>
	</Tooltip>
{/if}

<style>
	.flagList + .flagList {
		margin-top: 1em;
	}
	.requirement {
		display: flex;
		align-items: center;
		margin-left: 1em;
		white-space: nowrap;
	}
	:global(.req-met) {
		color: var(--success);
	}
	:global(.req-unmet) {
		color: var(--error);
	}
</style>
