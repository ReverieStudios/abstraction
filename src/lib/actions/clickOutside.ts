export const clickOutside = (node: HTMLElement) => {
	const handleClick = (e: MouseEvent) => {
		const target = e.target as HTMLElement;
		if (!node.contains(target) && !target.closest('.mdc-dialog')) {
			node.dispatchEvent(new CustomEvent('outclick'));
		}
	};

	document.addEventListener('click', handleClick, true);

	return {
		destroy() {
			document.removeEventListener('click', handleClick, true);
		}
	};
};
