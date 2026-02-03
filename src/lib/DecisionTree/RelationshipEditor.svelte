<script lang="ts">
  import Form from '$lib/form/Form.svelte';
  import Button from '$lib/form/Button.svelte';
  import SimpleList from '$lib/form/SimpleList.svelte';
  import TextField from '$lib/form/TextField.svelte';
  import type { Docs } from '$lib/database/types';
  import { isRelationshipNode } from '$lib/database/types/Decision';

  export let node: Docs.Decision | null = null;

  const onSubmit = async (values: any) => {
    if (!node) return;
    const update: any = {};
    if (values.relationshipIDs !== undefined) update.relationshipIDs = values.relationshipIDs;
    if (values.connectionSettings) update.connectionSettings = values.connectionSettings;
    await node.update(update);
  };
</script>

{#if node}
  <Form
    initialValues={{ relationshipIDs: isRelationshipNode(node.data) ? node.data.relationshipIDs ?? [] : [] }}
    on:submit={(e) => onSubmit(e.detail)}
  >
    <div class="p-3">
      <SimpleList name="relationshipIDs" itemTemplate={"new-id"} let:remove let:namePrefix>
        <div class="flex items-center g2">
          <TextField name="{namePrefix}" label="Relationship ID" />
          <Button type="button" on:click={remove}>Remove</Button>
        </div>
      </SimpleList>

      <div class="mt2">
        <TextField name="connectionSettings.maxSelections" label="Max selections per user" />
      </div>

      <div class="mt2">
        <Button type="submit">Save Relationship Node</Button>
      </div>
    </div>
  </Form>
{/if}

<style>
  .g2 { gap: 0.5rem; }
  .mt2 { margin-top: 0.5rem }
</style>
