<script lang="ts">
	import Form from '$lib/form/Form.svelte';
	import ImageSelector from '$lib/form/ImageSelector.svelte';
</script>

<Form initialValues={{ image: null }}>
	<ImageSelector name="image" />
</Form>
