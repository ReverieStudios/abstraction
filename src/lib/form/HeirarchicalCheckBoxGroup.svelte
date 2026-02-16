<script lang="ts">
  import { getFieldContext } from './getFormContext';
  import Checkbox from '$lib/ui/Checkbox.svelte';
  import Fieldset from '$lib/ui/Fieldset.svelte';
  import { writable } from 'svelte/store';

  type GroupItem = { label: string; value: string; disabled?: boolean };
  type Group = { id: string; label?: string; items: GroupItem[] };

  export let name: string;
  // Primary API: groups of items
  export let groups: Group[] | null = [];
  // Backwards-compatible: flat items (will be rendered in a single unnamed group)
  export let items: GroupItem[] = [];
  export let label: string;
  export let all = false;
  export let collapsible = true;
  export let maxHeight = '35vh';

  const {
    field: { value },
    updateValidateField
  } = getFieldContext(name);

  // combine props into canonical groups array
  $: canonicalGroups = groups && groups.length ? groups : [{ id: '__all', label: undefined, items }];

  let selected: string[] = [];
  $: {
    const formValue = $value;
    if (Array.isArray(formValue)) {
      selected = formValue;
    } else if (formValue != null) {
      selected = [formValue];
    } else {
      selected = [];
    }
  }

  $: selectedSet = new Set(selected);

  const updateForm = (v: string[]) => updateValidateField(name, v);

  const allItemValues = () => new Set(canonicalGroups.flatMap((g) => g.items.map((i) => i.value)));

  const updateCell = (value: string) => () => {
    if (!selectedSet.has(value)) {
      updateForm([...selected, value]);
    } else {
      updateForm(selected.filter((v) => v !== value));
    }
  };

  $: {
    const itemValues = allItemValues();
    const onlyValid = selected.filter((v) => itemValues.has(v));
    if (onlyValid.length !== selected.length) {
      updateForm(onlyValid);
    }
  }

  const selectAll = () => {
    const enabled = canonicalGroups.flatMap((g) => g.items.filter((i) => !i.disabled).map((i) => i.value));
    if (selectedSet.size === enabled.length) {
      updateForm([]);
    } else {
      updateForm(enabled);
    }
  };

  // group level select
  const selectGroup = (group: Group) => {
    const enabled = group.items.filter((i) => !i.disabled).map((i) => i.value);
    const enabledSet = new Set(enabled);
    const allSelected = enabled.every((v) => selectedSet.has(v));
    if (allSelected) {
      updateForm(selected.filter((v) => !enabledSet.has(v)));
    } else {
      // add enabled values that aren't present
      const toAdd = enabled.filter((v) => !selectedSet.has(v));
      updateForm([...selected, ...toAdd]);
    }
  };

  // collapse state for groups
  const collapsed = writable<Record<string, boolean>>({});
  const toggleCollapse = (id: string) => () => {
    collapsed.update((c) => ({ ...c, [id]: !c[id] }));
  };
</script>

<Fieldset name="checkbox-group-{name}" {label} class="checkboxgroup {$$props.class}">
  {#if all}
    <div class="select-all-row">
      <Checkbox
        checked={canonicalGroups.flatMap(g => g.items).filter(i => !i.disabled).every(i => selectedSet.has(i.value))}
        indeterminate={canonicalGroups.flatMap(g => g.items).filter(i => !i.disabled).some(i => selectedSet.has(i.value)) &&
          !canonicalGroups.flatMap(g => g.items).filter(i => !i.disabled).every(i => selectedSet.has(i.value))}
        label="Select All"
        on:change={selectAll}
      />
    </div>
  {/if}

  <div class="groups" style="max-height: {maxHeight}; overflow: auto; padding-right: 6px;">
    {#each canonicalGroups as group (group.id)}
      {@const groupEnabled = group.items.filter(i => !i.disabled)}
      <div class="group">
        <div class="group-header">
          {#if collapsible}
            <button type="button" class="collapse-toggle" on:click={toggleCollapse(group.id)} aria-expanded={!$collapsed[group.id] ? 'true' : 'false'}>
              {#if $collapsed[group.id]}▶{:else}▼{/if}
            </button>
          {/if}
          <Checkbox
            checked={groupEnabled.length > 0 && groupEnabled.every(i => selectedSet.has(i.value))}
            indeterminate={groupEnabled.some(i => selectedSet.has(i.value)) && !groupEnabled.every(i => selectedSet.has(i.value))}
            label={group.label ?? ''}
            on:change={() => selectGroup(group)}
          />
        </div>

        {#if !$collapsed[group.id] || !collapsible}
          <div class="group-items">
            {#each group.items as item (item.value)}
              {@const id = item.value}
              {@const checked = selectedSet.has(item.value)}
              <div class="flex">
                <Checkbox {checked} {...item} on:change={updateCell(item.value)} />
                <slot name="extra" {id} {checked} />
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/each}
  </div>
</Fieldset>

<style>
  :global(.checkboxgroup .mdc-form-field label) {
    display: block;
    font-size: 1.3em;
    cursor: pointer;
    padding: 10px 0;
  }
  .groups {
    margin-top: 0.5rem;
  }
  .group {
    border-bottom: 1px solid rgba(0,0,0,0.06);
    padding: 6px 0 8px 0;
  }
  .group-header {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .collapse-toggle {
    border: none;
    background: transparent;
    padding: 0 6px 0 0;
    font-size: 0.9rem;
    cursor: pointer;
  }
  .group-items {
    margin-top: 6px;
    padding-left: 1.6rem;
  }
</style>
