<script context="module" lang="ts">
	import { database } from '$lib/database';

	import { anyAdminRoles } from '$lib/permissions';
	import type { Load } from '@sveltejs/kit';

	export const load: Load = async ({ session }) => {
		if (!session?.user?.uid) {
			return { redirect: '/home', status: 302 };
		}
		const user = await database.users.doc(session.user.uid).read();
		if (!anyAdminRoles(user?.data?.roles)) {
			return { redirect: '/home', status: 302 };
		}
		return {};
	};
</script>

<slot />
