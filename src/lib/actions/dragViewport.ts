import type { Writable } from 'svelte/store';

interface Point {
	x: number;
	y: number;
}

export const dragViewport = (node: HTMLElement | SVGElement, offsetStore: Writable<Point>) => {
	let dragging = false;
	let dragFrom = null;
	const getPoint = (e: MouseEvent) => ({ x: e.pageX, y: e.pageY });

	const handleDown = (e: MouseEvent) => {
		const target = e.target as Node;
		if (target.nodeName === 'svg') {
			e.preventDefault();
			// console.log('drag start');
			dragging = true;
			dragFrom = getPoint(e);
		}
	};
	const handleUp = () => {
		// console.log('drag end');
		dragging = false;
		dragFrom = null;
	};
	const handleMove = (e: MouseEvent) => {
		if (dragging) {
			const to = getPoint(e);
			const offset = { x: to.x - dragFrom.x, y: to.y - dragFrom.y };
			if (to.x !== dragFrom.x || to.y !== dragFrom.y) {
				// console.log('dragging', { from: dragFrom, to });
				dragFrom = to;
				offsetStore.update((c) => ({
					x: c.x + offset.y,
					y: c.y + offset.x
				}));
			}
		}
	};

	node.addEventListener('mousedown', handleDown, true);
	document.addEventListener('mouseup', handleUp, true);
	node.addEventListener('mousemove', handleMove, true);

	return {
		destroy() {
			node.removeEventListener('mousedown', handleDown, true);
			document.removeEventListener('mouseup', handleUp, true);
			node.removeEventListener('mousemove', handleMove, true);
		}
	};
};
