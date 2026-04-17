<script lang="ts">
    import { slide } from 'svelte/transition';
    import RichViewer from '$lib/ui/RichViewer.svelte';
    import { storage } from '$lib/firebase';
    import type { User } from '$lib/database/types/User';
    import { getFields } from '$lib/database/types/Relationships';
    import Accordion, { Panel, Header, Content } from '@smui-extra/accordion';
    import SmuiIconButton, { Icon } from '@smui/icon-button';
    import { afterUpdate, tick } from 'svelte';
    import { database } from '$lib/database';
    import type { Docs } from '$lib/database';

    export let gameID: string | null;
    export let userID: string | null;
    export let user: User | null;
    export let relationship: Docs.Relationship | null;
    const relationshipTypes = database.relationshipTypes;

    let relType: Docs.RelationshipType | null = null;
    $: {
        const types = $relationshipTypes;
        relType = types?.find((type: Docs.RelationshipType) => type.id === relationship?.data?.type) ?? null;
    }

    let fields = [];
    $: fields = relType ? getFields(relationship, relType, false) : [];

    let summmaryField: {label: string; text: string; type: string; showAfterChosen: boolean} | null = null;
    $: summmaryField = relType && relationship ? getFields(relationship, relType, false)[0] : null;

    let extraFields: {label: string; text: string; type: string; showAfterChosen: boolean}[] = [];
    $: extraFields = relType ? getFields(relationship, relType, false).slice(relationship?.data?.summary ? 1 : 0) : [];

    let fieldsPanelOpen = false;
    let extraPanelsOpen = extraFields?.length > 0 ? Array(extraFields.length).fill(true) : [];

    let rowEl: HTMLElement;
    let pendingScroll = false;

    afterUpdate(async () => {
        if (pendingScroll && rowEl) {
            await tick();
            await new Promise(requestAnimationFrame);
            rowEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            rowEl.classList.add('highlight');
            setTimeout(() => rowEl.classList.remove('highlight'), 1200);
            console.log('scrolled to', rowEl.id);
            pendingScroll = false;
        }
    });
</script>

<div class="flex items-start" out:slide|global data-showing bind:this={rowEl} id={"relationship-" + relationship?.id}>
    <span class="flex-auto flex flex-column" id={"relationship-" + relationship?.id}>
        <span class="h3 flex items-center g1">
            {#if relationship?.data?.image}
                {#await storage.getDownloadURL(relationship.data.image) then url}
                    <div class="image" style="background-image:url({url})" />
                {/await}
            {/if}
            {relationship?.data?.name}
        </span>
        <div class="fields">
            {#if summmaryField}
                <div>
                    {#if summmaryField?.label}<h4 class="h3">{summmaryField.label}</h4>{/if}
                    <div class="px2">
                        {#if summmaryField.type === 'markdown'}
                            <RichViewer value={summmaryField.text} />
                        {:else}
                            <p>{summmaryField.text}</p>
                        {/if}
                    </div>
                </div>
            {/if}
            {#if extraFields?.length > 0}
                <div class="accordion-container">
                    <Accordion>
                        {#if extraFields.length == 1}
                            {#each extraFields as { label, text, type }, i}
                                <Panel bind:open={fieldsPanelOpen} color="secondary">
                                    <Header>
                                        {#if label}{label}{/if}
                                        <SmuiIconButton slot="icon" toggle pressed={extraPanelsOpen[i]}>
                                            <Icon class="material-icons" on>expand_less</Icon>
                                            <Icon class="material-icons">expand_more</Icon>
                                        </SmuiIconButton>
                                    </Header>
                                    <Content>
                                        <div>
                                            {#if type === 'markdown'}
                                                <RichViewer value={text} />
                                            {:else}
                                                <p>{text}</p>
                                            {/if}
                                        </div>
                                    </Content>
                                </Panel>
                            {/each}
                        {:else}
                        <Panel bind:open={fieldsPanelOpen} color="secondary">
                            <Header>
                                Details
                                <SmuiIconButton slot="icon" toggle pressed={fieldsPanelOpen}>
                                    <Icon class="material-icons" on>expand_less</Icon>
                                    <Icon class="material-icons">expand_more</Icon>
                                </SmuiIconButton>
                            </Header>
                            <Content>
                                <Accordion multiple>
                                    {#each extraFields as { label, text, type }, i}
                                        <Panel bind:open={extraPanelsOpen[i]} color="secondary">
                                            <Header>
                                                {#if label}<h4 class="h4">{label}</h4>{/if}
                                                <SmuiIconButton slot="icon" toggle pressed={extraPanelsOpen[i]}>
                                                    <Icon class="material-icons" on>expand_less</Icon>
                                                    <Icon class="material-icons">expand_more</Icon>
                                                </SmuiIconButton>
                                            </Header>
                                            <Content>
                                                <div>
                                                    {#if type === 'markdown'}
                                                        <RichViewer value={text} />
                                                    {:else}
                                                        <p>{text}</p>
                                                    {/if}
                                                </div>
                                            </Content>
                                        </Panel>
                                    {/each}
                                </Accordion>
                            </Content>
                        </Panel>
                        {/if}
                    </Accordion>
                </div>
            {/if}
            <div class="p1 h4">Characters per relationship: {relationship?.data?.size}
            {#if relationship?.data?.capacity ?? 0 > 0}
            <br/>{relationship?.data?.capacity} characters at most can have this relationship.
            {/if}
        </div>
    </span>
</div>

<style>
	@media (max-width: 52em) {
		h4 {
			margin-top: 2px;
			margin-bottom: 2px;
		}

		.accordion-container :global(.smui-paper__content),
		.accordion-container :global(.smui-paper) {
			padding-top: 0px !important;
			padding-bottom: 0px !important;
			padding-left: 8px !important;
			padding-right: 8px !important;
		}
		.accordion-container :global(.smui-accordion__header__title) {
			padding-left: 8px !important;
			padding-right: 8px !important;
		}
	}

    .image {
        background-position: center center;
        background-size: 70%;
        background-repeat: no-repeat;
        height: 50px;
        width: 50px;
        border-radius: 50%;
        border: 1px solid #ccc;
    }
    :global(.highlight) {
        background: color-mix(in srgb, var(--primary) 20%, transparent) !important;
        box-shadow: 0 2px 12px 0 color-mix(in srgb, var(--primary) 30%, transparent) !important;
        border-radius: 12px;
        z-index: 10;
        position: relative;
        transition: box-shadow 0.4s, background 0.4s;
    }
</style>
