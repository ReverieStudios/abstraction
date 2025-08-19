<script>
    import { marked } from 'marked';
    import DOMPurify from 'isomorphic-dompurify';

    export let value = '';

    $: html = DOMPurify.sanitize(marked.parse(value));
</script>

{@html html}
