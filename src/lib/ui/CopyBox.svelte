<script lang="ts">
	import IconButton from '$lib/ui/IconButton.svelte';

	export let label = null;
	export let content = null;
	export let iconOnly = false;

	const doCopy = () => {
		// @ts-ignore
		navigator.permissions.query({ name: 'clipboard-write' }).then((result) => {
			if (result.state == 'granted' || result.state == 'prompt') {
				navigator.clipboard.writeText(content);
			}
		});
	};
</script>

{#if content}
	{#if iconOnly}
		<IconButton icon="content_copy" on:click={doCopy} />
	{:else}
		<div class="wrapper">
			<IconButton class="copy-btn" icon="content_copy" on:click={doCopy} />
			<pre><code
					>{#if label}{label}: {/if}{content}</code
				></pre>
		</div>
	{/if}
{/if}

<style>
	.wrapper {
		position: relative;
		padding-right: 50px;
	}
	:global(.copy-btn) {
		position: absolute;
		top: 0;
		right: 0;
	}
	pre {
		white-space: pre-wrap;
		word-break: break-all;
	}
</style>
