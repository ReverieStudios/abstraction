<script lang="ts">
	import { database } from '$lib/database';
	import { page } from '$app/stores';
	import { derived, readable, writable, type Readable } from 'svelte/store';
	import { keyBy, groupBy } from 'lodash-es';
	import type { Docs } from '$lib/database/types';
	import type { Game } from '$lib/database/types/Game';
	import Spinner from '$lib/Spinner.svelte';
	import Button from '$lib/ui/Button.svelte';
	import ConfirmButton from '$lib/ConfirmButton.svelte';
	import Icon from '$lib/ui/Icon.svelte';
	import IconButton from '$lib/ui/IconButton.svelte';
	import Modal from '$lib/ui/Modal.svelte';
	import { getNotify } from '$lib/ui/Notifications.svelte';
	import { slide } from 'svelte/transition';

	const game: Game = $page.data.game;
	const gameID: string = $page.data.gameID;

	const sendNotification = getNotify();

	// ── Collections ────────────────────────────────────────────────────────────
	const relationshipSelectors = database.relationshipSelectors;
	const relationships = database.relationships;
	const relationshipAssignments = database.relationshipAssignments;
	const users = database.users;

	// ── Derived lookups ────────────────────────────────────────────────────────
	const relationshipsById: Readable<Record<string, Docs.Relationship>> = derived(
		relationships ?? readable([]),
		($rels) => keyBy($rels ?? [], 'id')
	);

	const usersById: Readable<Record<string, Docs.User>> = derived(
		users ?? readable([]),
		($users) => keyBy($users ?? [], 'id')
	);

	// Group assignments by selectorID for quick lookup
	const assignmentsBySelectorId: Readable<Record<string, Docs.RelationshipAssignment[]>> = derived(
		relationshipAssignments ?? readable([]),
		($assignments) => groupBy($assignments ?? [], 'data.relationshipSelectorID')
	);

	// ── Per-selector state ──────────────────────────────────────────────────────
	// Track which selector panels are expanded
	const expanded = writable<Record<string, boolean>>({});
	const toggleExpanded = (selectorID: string) => {
		expanded.update((s) => ({ ...s, [selectorID]: !s[selectorID] }));
	};

	// ── Algorithm execution state ──────────────────────────────────────────────
	let running: Record<string, boolean> = {};
	let clearing: Record<string, boolean> = {};

	// ── Manual edit state ──────────────────────────────────────────────────────
	// Editing means: swap a specific user out of a specific relationship
	interface EditingSlot {
		selectorID: string;
		relationshipID: string;
		oldUserID: string;       // the user being replaced
		currentRoster: string[]; // full roster for this relationship
	}
	let editingSlot: EditingSlot | null = null;
	let replaceWithUserID: string = '';
	let userSearch: string = '';

	$: filteredUsers = ($users ?? []).filter((u) => {
		// Exclude all current roster members (including the old user — re-selecting is a no-op)
		if (editingSlot) {
			if (editingSlot.currentRoster.includes(u.id)) return false;
		}
		if (!userSearch) return true;
		const q = userSearch.toLowerCase();
		return (
			u.data.name?.toLowerCase().includes(q) ||
			u.data.email?.toLowerCase().includes(q)
		);
	});

	// ── User email helpers ─────────────────────────────────────────────────────
	const getUserEmail = (userID: string): string => {
		return $usersById[userID]?.data?.email ?? userID;
	};

	const getUserName = (userID: string): string => {
		const u = $usersById[userID]?.data;
		if (!u) return userID;
		return u.name || u.email || userID;
	};

	// ── Check if any assignments exist for a selector ──────────────────────────
	const hasAssignments = (selectorID: string): boolean => {
		const assignments = $assignmentsBySelectorId[selectorID] ?? [];
		return assignments.some(
			(a) =>
				Array.isArray(a.data.assignedRelationships) && a.data.assignedRelationships.length > 0
		);
	};

	// ── Count participants who have submitted rankings ─────────────────────────
	const countRankings = (selectorID: string): number => {
		const assignments = $assignmentsBySelectorId[selectorID] ?? [];
		return assignments.filter(
			(a) =>
				Array.isArray(a.data.relationshipRankings) && a.data.relationshipRankings.length > 0
		).length;
	};

	// ── Run the matching algorithm ─────────────────────────────────────────────
	const runAlgorithm = async (selectorID: string) => {
		running = { ...running, [selectorID]: true };
		try {
			const res = await fetch('/api/relationships/assignRelationships', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ gameID, relationshipSelectorID: selectorID })
			});
			const body = await res.json();
			if (body.success) {
				sendNotification({ text: `Assigned ${body.assignments} participant(s)` });
				expanded.update((s) => ({ ...s, [selectorID]: true }));
			} else {
				sendNotification({ text: `Error: ${body.message ?? 'Unknown error'}` });
			}
		} catch (err) {
			sendNotification({ text: 'Network error running algorithm' });
		} finally {
			running = { ...running, [selectorID]: false };
		}
	};

	// ── Clear assignments ──────────────────────────────────────────────────────
	const clearAssignments = async (selectorID: string) => {
		clearing = { ...clearing, [selectorID]: true };
		try {
			const res = await fetch('/api/relationships/clearAssignments', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ gameID, relationshipSelectorID: selectorID })
			});
			const body = await res.json();
			if (body.success) {
				sendNotification({ text: `Cleared ${body.cleared} assignment(s)` });
			} else {
				sendNotification({ text: `Error: ${body.message ?? 'Unknown error'}` });
			}
		} catch (err) {
			sendNotification({ text: 'Network error clearing assignments' });
		} finally {
			clearing = { ...clearing, [selectorID]: false };
		}
	};

	// ── Manual override: open edit modal ──────────────────────────────────────
	const openEdit = (selectorID: string, relationshipID: string, userID: string, roster: string[]) => {
		editingSlot = { selectorID, relationshipID, oldUserID: userID, currentRoster: roster };
		replaceWithUserID = '';
		userSearch = '';
	};

	// ── Manual override: save ─────────────────────────────────────────────────
	const saveEdit = async () => {
		if (!editingSlot || !replaceWithUserID) return;
		const { selectorID, relationshipID, oldUserID, currentRoster } = editingSlot;

		// Guard: new user must not already be in the roster
		if (currentRoster.filter((id) => id !== oldUserID).includes(replaceWithUserID)) {
			sendNotification({ text: 'That user is already in this relationship' });
			return;
		}

		// No-op: same user selected — just close
		if (replaceWithUserID === oldUserID) {
			editingSlot = null;
			return;
		}

		// New roster: swap old user out, new user in
		const newRoster = currentRoster.map((id) => (id === oldUserID ? replaceWithUserID : id));

		// All users whose assignment docs need updating:
		// everyone in the new roster + the old user (to remove the relationship)
		const allAffected = new Set([...newRoster, oldUserID]);
		const selectorAssignments = $assignmentsBySelectorId[selectorID] ?? [];

		try {
			await Promise.all(
				[...allAffected].map(async (uid) => {
					const doc = selectorAssignments.find((a) => a.data.userID === uid);
					if (!doc) return;
					const existing = doc.data.assignedRelationships ?? [];
					let updated: { relationshipID: string; assignedUserIDs: string[] }[];
					if (uid === oldUserID) {
						// Remove this relationship from the old user's assignments
						updated = existing.filter((r) => r.relationshipID !== relationshipID);
					} else {
						// Add or update this relationship with the new roster for everyone else
						const others = existing.filter((r) => r.relationshipID !== relationshipID);
						updated = [...others, { relationshipID, assignedUserIDs: newRoster }];
					}
					await doc.update({ assignedRelationships: updated });
				})
			);
			// If the new user has no assignment doc yet, we can't create one here easily —
			// warn the editor if that was the case
			const newUserHasDoc = selectorAssignments.some((a) => a.data.userID === replaceWithUserID);
			if (!newUserHasDoc) {
				sendNotification({ text: 'Warning: new user has no rankings doc — assignment saved to existing members only' });
			} else {
				sendNotification({ text: 'Assignment updated' });
			}
			editingSlot = null;
		} catch (err) {
			sendNotification({ text: 'Error saving assignment' });
		}
	};

	// ── Build per-relationship roster display ─────────────────────────────────
	interface RosterEntry {
		relationshipID: string;
		userIDs: string[];
	}

	const rostersBySelectorId: Readable<Record<string, RosterEntry[]>> = derived(
		[relationshipSelectors ?? readable([]), assignmentsBySelectorId],
		([$selectors, $assignments]) => {
			const result: Record<string, RosterEntry[]> = {};
			for (const selector of $selectors ?? []) {
				const relIDs: string[] = selector.data.relationshipIDs ?? [];
				const selectorAssignments = $assignments[selector.id] ?? [];
				const rosterMap = new Map<string, Set<string>>();
				for (const relID of relIDs) rosterMap.set(relID, new Set());
				for (const assignment of selectorAssignments) {
					for (const ar of assignment.data.assignedRelationships ?? []) {
						if (!rosterMap.has(ar.relationshipID)) rosterMap.set(ar.relationshipID, new Set());
						rosterMap.get(ar.relationshipID)!.add(assignment.data.userID);
					}
				}
				result[selector.id] = relIDs.map((relID) => ({
					relationshipID: relID,
					userIDs: Array.from(rosterMap.get(relID) ?? [])
				}));
			}
			return result;
		}
	);
</script>

<svelte:head>
	<title>{game?.name ?? 'Game'} – Relationship Assignments</title>
</svelte:head>

<!-- Edit assignment modal -->
<Modal
	title="Edit Assignment"
	open={!!editingSlot}
	on:close={() => (editingSlot = null)}
	let:closeModal
>
	{#if editingSlot}
		{@const rel = $relationshipsById[editingSlot.relationshipID]}
		<p class="mb1">
			Replacing <strong>{getUserName(editingSlot.oldUserID)}</strong>
			in <strong>{rel?.data?.name ?? editingSlot.relationshipID}</strong>
		</p>
		<p class="muted h5 mb2">Current roster: {editingSlot.currentRoster.map(getUserName).join(', ')}</p>

		<label for="user-search" class="h4">Search for replacement:</label>
		<input
			id="user-search"
			type="text"
			placeholder="Name or email…"
			bind:value={userSearch}
			class="input mb1"
		/>

		<div class="user-list mb2">
			{#each filteredUsers as u (u.id)}
				<button
					class="user-option"
					class:selected={replaceWithUserID === u.id}
					on:click={() => (replaceWithUserID = u.id)}
				>
					<span class="bold">{u.data.name || '(no name)'}</span>
					<span class="muted h5">{u.data.email}</span>
				</button>
			{:else}
				<p class="muted h5">No users match.</p>
			{/each}
		</div>

		<div class="flex g1">
			<Button disabled={!replaceWithUserID} on:click={saveEdit}>Save</Button>
			<Button on:click={closeModal}>Cancel</Button>
		</div>
	{/if}
</Modal>

<div class="content">
	<h1>{game?.name} – Relationship Assignments</h1>
	<p class="muted mb3">
		Run the matching algorithm to assign relationships based on participant rankings. After running,
		you can manually adjust individual assignments below.
	</p>

	{#if !$relationshipSelectors}
		<div class="flex items-center g2 py3">
			<Spinner />
			<span>Loading selectors…</span>
		</div>
	{:else if ($relationshipSelectors ?? []).length === 0}
		<p class="muted">No relationship selectors found for this game.</p>
	{:else}
		<div class="selectors">
			{#each $relationshipSelectors as selector (selector.id)}
				{@const selectorHasAssignments = hasAssignments(selector.id)}
				{@const rankingCount = countRankings(selector.id)}
				{@const isRunning = running[selector.id]}
				{@const isClearing = clearing[selector.id]}
				{@const isExpanded = $expanded[selector.id] ?? false}

				<div class="selector-card rounded mb2">
					<!-- Header row -->
					<div class="selector-header bg-secondary flex items-center g2 p2">
						<button
							class="expand-btn"
							aria-expanded={isExpanded}
							on:click={() => toggleExpanded(selector.id)}
						>
							<Icon>{isExpanded ? 'expand_less' : 'expand_more'}</Icon>
						</button>

						<div class="flex-auto">
							<h2 class="my0">{selector.data.name}</h2>
							<p class="muted my0 h5">
								{rankingCount} participant{rankingCount !== 1 ? 's' : ''} with rankings ·
								{selector.data.relationshipsPerCharacter} relationship{selector.data.relationshipsPerCharacter !== 1 ? 's' : ''} per character ·
								{(selector.data.relationshipIDs ?? []).length} relationship{(selector.data.relationshipIDs ?? []).length !== 1 ? 's' : ''} available
							</p>
						</div>

						<div class="flex g1 items-center">
							{#if selectorHasAssignments}
								<span class="chip bg-success text-on-success">
									<Icon>check_circle</Icon> Assigned
								</span>
							<ConfirmButton on:confirm={() => clearAssignments(selector.id)} />
							{:else}
								{#if isRunning}
									<Spinner />
									<span class="muted">Running…</span>
								{:else}
									<Button
										disabled={rankingCount === 0}
										on:click={() => runAlgorithm(selector.id)}
									>
										<Icon>auto_awesome</Icon> Run Algorithm
									</Button>
								{/if}
							{/if}
						</div>
					</div>

					<!-- Expanded content: rosters by relationship -->
					{#if isExpanded}
						<div class="selector-body bg-surface p2 pt0" transition:slide|global>
							{#if !selectorHasAssignments && !isRunning}
								<p class="muted">
									{#if rankingCount === 0}
										No participants have submitted rankings yet.
									{:else}
										Click "Run Algorithm" to compute assignments.
									{/if}
								</p>
							{:else}
								{@const rosters = $rostersBySelectorId[selector.id] ?? []}
								<div class="rosters">
									{#each rosters as { relationshipID, userIDs } (relationshipID)}
										{@const rel = $relationshipsById[relationshipID]}
										<div class="roster-section mb3">
											<div class="flex items-center g1 mb1">
												<h3 class="my0">{rel?.data?.name ?? relationshipID}</h3>
												<span class="chip bg-secondary">
													{userIDs.length} / {rel?.data?.capacity > 0 ? rel.data.capacity : '∞'}
													· size {rel?.data?.size ?? 2}
												</span>
											</div>

											{#if userIDs.length === 0}
												<p class="muted h5">No one assigned yet.</p>
											{:else}
												<!-- Group into tuples of `size` -->
												{@const tupleSize = rel?.data?.size ?? 2}
												{#each Array.from({ length: Math.ceil(userIDs.length / tupleSize) }, (_, i) => userIDs.slice(i * tupleSize, (i + 1) * tupleSize)) as tuple, tupleIndex}
													<div class="tuple-row flex items-center g1 mb1 p1 rounded bg-secondary">
														<span class="muted h5 tuple-label">Group {tupleIndex + 1}</span>
														<div class="flex flex-wrap g1 flex-auto">
															{#each tuple as userID}
															<div class="user-chip bg-surface flex items-center g1">
																<span>{getUserEmail(userID)}</span>
																<IconButton
																	icon="edit"
																	title="Replace this user"
																	on:click={() => openEdit(selector.id, relationshipID, userID, userIDs)}
																/>
															</div>
														{/each}
														</div>
													</div>
												{/each}
											{/if}
										</div>
									{/each}
								</div>

								<!-- Unassigned participants -->
								{@const assignedUsers = new Set(
									(($assignmentsBySelectorId[selector.id] ?? []))
										.filter((a) => Array.isArray(a.data.assignedRelationships) && a.data.assignedRelationships.length > 0)
										.map((a) => a.data.userID)
								)}
								{@const unassigned = ($assignmentsBySelectorId[selector.id] ?? []).filter(
									(a) =>
										(!Array.isArray(a.data.assignedRelationships) ||
											a.data.assignedRelationships.length === 0) &&
										Array.isArray(a.data.relationshipRankings) &&
										a.data.relationshipRankings.length > 0
								)}
								{#if unassigned.length > 0}
									<div class="unassigned mt3">
										<h3 class="my0 mb1">Unassigned participants ({unassigned.length})</h3>
										<div class="flex flex-wrap g1">
											{#each unassigned as assignment}
												<div class="user-chip bg-surface">
													<span>{getUserEmail(assignment.data.userID)}</span>
												</div>
											{/each}
										</div>
									</div>
								{/if}
							{/if}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.selector-card {
		border: 1px solid var(--surface);
		overflow: hidden;
	}

	.selector-header {
		border-bottom: 1px solid var(--surface);
	}

	.expand-btn {
		background: none;
		border: none;
		cursor: pointer;
		padding: 0;
		display: flex;
		align-items: center;
		color: inherit;
	}

	.chip {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.15rem 0.5rem;
		border-radius: 12px;
		font-size: 0.75rem;
		white-space: nowrap;
	}

	.tuple-label {
		min-width: 4.5rem;
	}

	.tuple-row {
		border: 1px solid var(--surface);
	}

	.user-chip {
		border: 1px solid var(--surface);
		border-radius: 8px;
		padding: 0.2rem 0.5rem;
		font-size: 0.85rem;
	}

	.unassigned {
		border-top: 1px solid var(--surface);
		padding-top: 1rem;
	}

	.rosters {
		padding-top: 1rem;
	}

	.input {
		display: block;
		width: 100%;
		padding: 0.5rem;
		border: 1px solid var(--surface);
		border-radius: 4px;
		font-size: 1rem;
		box-sizing: border-box;
	}

	.user-list {
		max-height: 16rem;
		overflow-y: auto;
		border: 1px solid var(--surface);
		border-radius: 4px;
	}

	.user-option {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		width: 100%;
		text-align: left;
		background: none;
		border: none;
		border-bottom: 1px solid var(--surface);
		padding: 0.5rem 0.75rem;
		cursor: pointer;
	}

	.user-option:last-child {
		border-bottom: none;
	}

	.user-option:hover {
		background: var(--secondary);
	}

	.user-option.selected {
		background: var(--primary);
		color: var(--on-primary);
	}
</style>
