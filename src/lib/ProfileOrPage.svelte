<script lang="ts">
	import UserProfile from './UserProfile.svelte';

	export let userID;
</script>

<UserProfile
	{userID}
	title="Please create your user profile"
	subtitle="This can be edited at any point in the future"
/>
