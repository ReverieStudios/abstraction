<script lang="ts">
	import type { Docs, KeyMaps } from '$lib/database/types';
	import { stratify, cluster } from 'd3-hierarchy';
	import { dragViewport } from '$lib/actions/dragViewport';
	import { writable } from 'svelte/store';
	import { isAssetNode, isStartNode } from '$lib/database/types/Decision';
	import { getNodeName, type ExitNode, type TreeNode } from './helpers';
	import { keyBy } from 'lodash-es';
	import type { State } from './helpers';
	import type { Writable } from 'svelte/store';

	export let nodes: Docs.Decision[];
	export let assetsById: KeyMaps.Asset;
	export let state: Writable<State>;

	$: selected = $state.selected;
	$: drawTreeID = $state.drawTreeID;

	const offset = writable({ x: 0, y: 0 });
	const isExitNode = (node: TreeNode): node is ExitNode => {
		return typeof (node as ExitNode).exit === 'boolean';
	};

	const createTree = (nodes: Docs.Decision[], treeID: string) => {
		offset.set({ x: height / -2, y: 50 + width / -2 });
		const treeNodes = nodes.filter((n) => n.data.treeID === treeID);
		if (treeNodes.length === 0) {
			return {
				descendants: () => [],
				links: () => []
			};
		}
		const hierarchical = stratify()
			.id((d: Docs.Decision) => d.id)
			.parentId((d: Docs.Decision) => {
				if (isAssetNode(d.data)) {
					return d.data.parentID;
				} else if (isExitNode(d)) {
					if (d.id !== 'fake_root') {
						return 'fake_root';
					}
				}
			})(treeNodes);
		hierarchical.treeID = treeNodes[0].data.treeID;
		// @ts-ignore
		treeNodes[0].data.entry = true;
		const layout = cluster()
			.nodeSize([7.5, 7.5])
			.separation((a, b) => (a.parent === b.parent ? 10 : 20));
		layout(hierarchical);
		return hierarchical;
	};

	const selectNode = (doc) => {
		if (doc.exit) {
			state.update((c) => ({ ...c, drawTreeID: doc.id }));
		} else {
			state.update((c) => ({ ...c, selected: doc }));
		}
	};
	const unselect = () => {
		state.update((c) => ({ ...c, selected: null }));
	};

	let width = 600;
	let height = width;
	let dots = [];
	let links = [];

	$: tree = createTree(nodes, drawTreeID);
	$: {
		const treeNodes = tree.descendants();
		const ids = new Set(treeNodes.map((n) => n.id));
		const exitNodes: ExitNode[] = nodes
			.map((node) => {
				if (isStartNode(node.data) && node.data.parentIDs.some((id) => ids.has(id))) {
					return {
						id: node.id,
						name: node.data.name,
						data: { treeID: drawTreeID },
						exit: true,
						parentIDs: node.data.parentIDs
					};
				}
			})
			.filter(Boolean);
		let exitDots = [];
		let exitLinks = [];
		if (exitNodes.length > 0) {
			const treeNodesById = keyBy(treeNodes, 'id');
			const maxDepth = Math.max(0, ...treeNodes.map((n) => n.depth));
			const startX = ((exitNodes.length - 1) / 2) * -150;
			exitDots = exitNodes.map((node, i) => ({
				depth: maxDepth + 1,
				data: node,
				height: 0,
				id: node.id,
				x: startX + i * 150,
				y: 0
			}));
			exitLinks = exitDots.flatMap((exit) =>
				exit.data.parentIDs.map((parentID) => ({ source: treeNodesById[parentID], target: exit }))
			);
		}
		dots = [
			...treeNodes.map((dot) => {
				if (dot.data === selected) {
					return { ...dot, selected: true };
				}
				return dot;
			}),
			...exitDots
		];
		links = [...tree.links(), ...exitLinks].filter((l) => l.source && l.target);
	}

	const radialDistance = 200;

	type Point = { x?: number; y?: number; depth?: number };

	const moveViewport = (point: Point) => `transform: translate(${point.y}px, ${point.x}px)`;
	const getCoord = (point: Point) => ({ x: point.depth * radialDistance, y: point.x });
	const move = (point: Point) => {
		const { x, y } = getCoord(point);
		return `transform: translate(${x}px, ${y}px)`;
	};

	const getCurvedLine = ({ source, target }) => {
		const { x, y } = getCoord(target);
		const { x: pX, y: pY } = getCoord(source);
		return `M${x},${y}C${pX + 50},${y} ${pX + 150},${pY} ${pX},${pY}`;
	};
</script>

<figure
	class="graph border fill m0 p0 flex"
	bind:clientWidth={width}
	bind:clientHeight={height}
	on:click|self={unselect}
>
	<svg use:dragViewport={offset} {width} {height}>
		<g class="centerer">
			<g class="viewport" style={moveViewport($offset)}>
				<g name="links">
					{#each links as link}
						<path class="link" d={getCurvedLine(link)} />
					{/each}
				</g>
				<g name="dots">
					{#each dots as { x, depth, id, data, selected } (id)}
						<g
							class="node"
							class:selected
							class:entry={data?.entry}
							class:exit={data?.exit}
							style={move({ x, depth })}
							on:click={() => selectNode(data)}
						>
							<circle r={6} />
							<text y="20" class="nodeName">{getNodeName(data, assetsById)}</text>
						</g>
					{/each}
				</g>
			</g>
		</g>
	</svg>
</figure>

<style>
	.graph {
		height: 70vh;
	}
	.centerer {
		pointer-events: painted;
		transform: translate(55%, 100%);
	}
	.viewport {
		pointer-events: painted;
	}
	.node {
		position: relative;
		cursor: pointer;
	}
	.entry circle {
		fill: var(--primary);
	}
	.exit circle {
		fill: var(--secondary);
	}
	.selected circle {
		fill: red;
	}
	.link {
		pointer-events: none;
		stroke: var(--accent-dark);
		stroke-opacity: 0.6;
		stroke-width: 2;
		fill: none;
	}
	.node {
		fill: var(--accent-light);
		stroke: var(--accent-light);
		stroke-opacity: 0.8;
		stroke-width: 2;
	}
	.nodeName {
		fill: #fff;
		stroke-width: 0;
		text-anchor: middle;
	}
</style>
