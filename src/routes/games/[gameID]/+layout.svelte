<script lang="ts">
	import { page } from "$app/stores";
	import { database } from "lib/database";

	const userID: string = $page.data.userID;

	const character = database.characters?.doc(userID);
	character?.subscribe(() => {});
</script>

<slot />
