<script lang="ts">
	export let icon = null;
</script>

<!-- https://fonts.google.com/icons?icon.query=up -->
<div {...$$restProps} class="material-icons mdc-icon-button__ripple {$$restProps.class || ''}">
	{#if icon}{icon}{:else}<slot />{/if}
</div>
