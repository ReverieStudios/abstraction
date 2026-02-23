<script lang="ts" context="module">
    import { database } from '$lib/database';
    import type { Docs } from '$lib/database';

    const relationshipTypes = database.relationshipTypes;
</script>

<script lang="ts">
    import { slide } from 'svelte/transition';
    import RichViewer from '$lib/ui/RichViewer.svelte';
    import IconButton from 'lib/ui/IconButton.svelte';
    import { derived, type Readable } from 'svelte/store';
    import FavoriteIcon from './FavoriteIcon.svelte';
    import { storage } from '$lib/firebase';
    import type { User } from '$lib/database/types/User';
    import Tooltip from '$lib/ui/Tooltip.svelte';
    import { getFields } from '$lib/database/types/Relationships';
    import Accordion, { Panel, Header, Content } from '@smui-extra/accordion';
    import SmuiIconButton, { Icon } from '@smui/icon-button';
    import { afterUpdate, tick } from 'svelte';

    export let gameID: string | null;
    export let userID: string | null;
    export let user: User | null;
    export let relationship: Docs.Relationship | null;
    export let isChosen: boolean = false;

    export let choose: (() => void) | null = null;
    export let unchoose: (() => void) | null = null;

    const relType: Readable<Docs.RelationshipType | null> = derived(relationshipTypes, (types) => {
        const typeId = relationship?.data?.type;
        return (types ?? []).find((type: Docs.RelationshipType) => type.id === typeId);
    });

    const fields = derived(relType, (type) => {
        if (!type) {
            return [];
        }
        return getFields(relationship, type, false);
    });

    const summmaryField: Readable<{label: string; text: string; type: string; showAfterChosen: boolean} | null> = derived(relType, (type) => {
        if (!type) {
            return null;
        }
        return relationship?.data?.summary ? getFields(relationship, type, false)[0] : null;
    });

    const extraFields = derived(relType, (type) => {
        if (!type) {
            return [];
        }
        const sliceAmount = relationship?.data.summary ? 1 : 0;

        return getFields(relationship, type, false).slice(sliceAmount);
    });

    const fieldsAfterChosen = derived(fields, (allFields) =>
        allFields.filter((f) => f.showAfterChosen)
    );

    let fieldsPanelOpen = false;

    let extraPanelsOpen = $extraFields.length > 0 ? Array($extraFields.length).fill(true) : [];

    let chosenPanelsOpen = $fieldsAfterChosen.length > 0 ? Array($fieldsAfterChosen.length).fill(false): [];

    let rowEl: HTMLElement;
    let pendingScroll = false;

    async function scrollToSelf() {
        pendingScroll = true;
    };

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

    $: if (rowEl) {
        console.log('rowEl assigned:', rowEl?.id);
    }
</script>

<div class="flex items-start p2" out:slide|global data-showing bind:this={rowEl} id={"relationship-" + relationship?.id}>
    {#if !isChosen}
        <span class="flex-auto flex flex-column" id={"relationship-" + relationship?.id}>
            <span class="h3 flex items-center g1">
                {#if relationship?.data?.image}
                    {#await storage.getDownloadURL(relationship.data.image) then url}
                        <div class="image" style="background-image:url({url})" />
                    {/await}
                {/if}
                {relationship?.data?.name}

                <div class="ml-auto flex items-center g1">
                    <Tooltip rich text="Mark '{relationship?.data?.name}' as a favorite">
                        <FavoriteIcon assetID={relationship?.id ?? null} {gameID}  on:favorited={scrollToSelf} />
                    </Tooltip>
                    <Tooltip rich text="Add '{relationship?.data?.name}'">
                        <IconButton icon="add_shopping_cart" on:click={choose} />
                    </Tooltip>
                </div>
            </span>
            <div class="fields">
                {#if $summmaryField}
                    <div>
                        {#if $summmaryField.label}<h4 class="h3">{$summmaryField.label}</h4>{/if}
                        <div class="px2">
                            {#if $summmaryField.type === 'markdown'}
                                <RichViewer value={$summmaryField.text} />
                            {:else}
                                <p>{$summmaryField.text}</p>
                            {/if}
                        </div>
                    </div>
                {/if}
                {#if $extraFields.length > 0}
                    <div class="accordion-container">
                        <Accordion>
                            {#if $extraFields.length == 1}
                                {#each $extraFields as { label, text, type }, i}
                                    <Panel bind:open={fieldsPanelOpen} color="secondary">
                                        <Header>
                                            {#if label}{label}{/if}
                                            <SmuiIconButton slot="icon" toggle pressed={extraPanelsOpen[i]}>
                                                <Icon class="material-icons" on>expand_less</Icon>
                                                <Icon class="material-icons">expand_more</Icon>
                                            </SmuiIconButton>
                                        </Header>
                                        <Content>
                                            <div class="px2">
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
                                        {#each $extraFields as { label, text, type }, i}
                                            <Panel bind:open={extraPanelsOpen[i]} color="secondary">
                                                <Header>
                                                    {#if label}<h4 class="h3">{label}</h4>{/if}
                                                    <SmuiIconButton slot="icon" toggle pressed={extraPanelsOpen[i]}>
                                                        <Icon class="material-icons" on>expand_less</Icon>
                                                        <Icon class="material-icons">expand_more</Icon>
                                                    </SmuiIconButton>
                                                </Header>
                                                <Content>
                                                    <div class="px2">
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
            </div>
        </span>
    {:else}
        <div class="flex-auto flex flex-column" id={"relationship-" + relationship?.id}>
            <div class="h3 flex items-center">ß
                {relationship?.data?.name}
                <div class="ml-auto flex items-center g1">
                    <Tooltip rich text="Remove '{relationship?.data?.name}'">
                        <IconButton icon="remove_shopping_cart" on:click={unchoose} />
                    </Tooltip>
                </div>
            </div>
            {#if $fieldsAfterChosen.length > 0}
                <div class="fields">
                    <div class="accordion-container">
                        <Accordion multiple>
                            {#each $fieldsAfterChosen as { label, text, type }, i}
                                <Panel bind:open={chosenPanelsOpen[i]} color="surface">
                                    <Header>
                                        {#if label}{label}{:else}Summary{/if}
                                        <SmuiIconButton slot="icon" toggle pressed={chosenPanelsOpen[i]}>
                                            <Icon class="material-icons" on>expand_less</Icon>
                                            <Icon class="material-icons">expand_more</Icon>
                                        </SmuiIconButton>
                                    </Header>
                                    <Content>
                                        <div class="px2">
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
                    </div>
                </div>
            {/if}
        </div>
    {/if}
</div>

<style>
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
