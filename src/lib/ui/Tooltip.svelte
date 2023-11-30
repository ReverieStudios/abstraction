<script lang="ts">
	import Tooltip, { Content, Wrapper } from '@smui/tooltip';

	type XPosition = 'detected' | 'start' | 'center' | 'end';
	type YPosition = 'detected' | 'above' | 'below';

	export let rich = false;
	export let interactive = false;
	export let persistent = false;
	export let text = '';
	export let xPos: XPosition = 'detected';
	export let yPos: YPosition = 'detected';
</script>

<Wrapper {rich} class={$$restProps.class ?? ''}>
	<slot />
	<Tooltip {interactive} {persistent} {xPos} {yPos}>
		<Content>
			<div class="text-on-secondary">
				<slot name="tooltip">
					{text}
				</slot>
			</div>
		</Content>
	</Tooltip>
</Wrapper>

<style>
</style>
