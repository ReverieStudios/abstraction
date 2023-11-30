<script>
	import { marked } from 'marked';

	export let value = '';

	$: html = marked.parse(value);
</script>

{@html html}
