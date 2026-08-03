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
	import UserSearch from '$lib/ui/UserSearch.svelte';

	const game: Game = $page.data.game;
	const gameID: string = $page.data.gameID;

	const sendNotification = getNotify();

	// ── Collections ────────────────────────────────────────────────────────────
	const relationshipSelectors = database.relationshipSelectors;
	const relationships = database.relationships;
	const relationshipAssignments = database.relationshipAssignments;
	const users = database.users;
	const characters = database.characters;

	// ── Derived lookups ────────────────────────────────────────────────────────
	const relationshipsById: Readable<Record<string, Docs.Relationship>> = derived(
		relationships ?? readable([]),
		($rels) => keyBy($rels ?? [], 'id')
	);

	const usersById: Readable<Record<string, Docs.User>> = derived(
		users ?? readable([]),
		($users) => keyBy($users ?? [], 'id')
	);

	const charactersById: Readable<Record<string, Docs.Character>> = derived(
		characters ?? readable([]),
		($chars) => keyBy($chars ?? [], 'id')
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
	let sharing: Record<string, boolean> = {};
	let deletingGroups: Record<string, boolean> = {};

	// ── Manual edit state ──────────────────────────────────────────────────────
	// Editing means: swap a specific user out of a specific relationship.
	// oldUserID === null means "add" mode (slot is empty due to deletion).
	interface EditingSlot {
		selectorID: string;
		relationshipID: string;
		oldUserID: string | null; // the user being replaced, or null in add mode
		currentRoster: string[];  // current members of this tuple
	}
	let editingSlot: EditingSlot | null = null;
	let replaceWithUserID: string = '';

	$: usersExcludingRoster = ($users ?? []).filter((u) => {
		if (editingSlot && editingSlot.currentRoster.includes(u.id)) return false;
		return true;
	});

	// ── User email helpers ─────────────────────────────────────────────────────
	const getUserEmail = (userID: string): string => {
		return $usersById[userID]?.data?.email ?? userID;
	};

	const getCharacterLabel = (userID: string): string => {
		const email = getUserEmail(userID);
		const charName = $charactersById[userID]?.data?.name;
		return charName ? `${email} (${charName})` : email;
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

	// ── Count participants with rankings but no assignment yet ─────────────────
	const countUnassigned = (selector: Docs.RelationshipSelector): number => {
		const selectorID = selector.id;
		const expectedCount = selector.data.relationshipsPerCharacter ?? 1;
		const assignments = $assignmentsBySelectorId[selectorID] ?? [];
		return assignments.filter(
			(a) =>
				Array.isArray(a.data.relationshipRankings) &&
				a.data.relationshipRankings.length > 0 &&
				((a.data.assignedRelationships ?? []).length < expectedCount)
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

	const tupleKey = (tuple: string[]): string => [...tuple].sort().join('|');

	// ── Delete one relationship group (tuple) only ───────────────────────────
	const deleteAssignedGroup = async (selectorID: string, relationshipID: string, tuple: string[]) => {
		if (!Array.isArray(tuple) || tuple.length === 0) return;
		const key = `${selectorID}:${relationshipID}:${tupleKey(tuple)}`;
		deletingGroups = { ...deletingGroups, [key]: true };
		try {
			const res = await fetch('/api/relationships/deleteAssignedGroup', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					gameID,
					relationshipSelectorID: selectorID,
					relationshipID,
					tupleUserIDs: tuple
				})
			});
			const body = await res.json();
			if (body.success) {
				sendNotification({ text: `Deleted group for ${body.updated} participant(s)` });
			} else {
				sendNotification({ text: `Error: ${body.message ?? 'Unknown error'}` });
			}
		} catch (err) {
			sendNotification({ text: 'Network error deleting assigned group' });
		} finally {
			deletingGroups = { ...deletingGroups, [key]: false };
		}
	};

	// ── Share assignments ──────────────────────────────────────────────────────
	const isSelectorShared = (selectorID: string): boolean => {
		const assignments = $assignmentsBySelectorId[selectorID] ?? [];
		const withAssignments = assignments.filter(
			(a) => Array.isArray(a.data.assignedRelationships) && a.data.assignedRelationships.length > 0
		);
		if (withAssignments.length === 0) return false;
		return withAssignments.every((a) =>
			(a.data.assignedRelationships ?? []).every((r) => r.shared === true)
		);
	};

	const isRelationshipShared = (selectorID: string, relationshipID: string): boolean => {
		const assignments = $assignmentsBySelectorId[selectorID] ?? [];
		for (const a of assignments) {
			const entry = (a.data.assignedRelationships ?? []).find(
				(r) => r.relationshipID === relationshipID
			);
			if (entry) return entry.shared === true;
		}
		return false;
	};

	const shareRelationships = async (selectorID: string, shared: boolean, relationshipID?: string) => {
		const key = relationshipID ? `${selectorID}:${relationshipID}` : selectorID;
		sharing = { ...sharing, [key]: true };
		try {
			const res = await fetch('/api/relationships/share', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					gameID,
					relationshipSelectorID: selectorID,
					shared,
					...(relationshipID ? { relationshipID } : {})
				})
			});
			const body = await res.json();
			if (body.success) {
				sendNotification({ text: shared ? 'Shared with participants' : 'Hidden from participants' });
			} else {
				sendNotification({ text: `Error: ${body.message ?? 'Unknown error'}` });
			}
		} catch (err) {
			sendNotification({ text: 'Network error sharing assignments' });
		} finally {
			sharing = { ...sharing, [key]: false };
		}
	};

	// ── Manual override: open edit modal ──────────────────────────────────────
	const openEdit = (selectorID: string, relationshipID: string, userID: string, roster: string[]) => {
		editingSlot = { selectorID, relationshipID, oldUserID: userID, currentRoster: roster };
		replaceWithUserID = '';
	};

	// ── Manual override: open add modal (empty slot due to deletion) ──────────
	const openAdd = (selectorID: string, relationshipID: string, roster: string[]) => {
		editingSlot = { selectorID, relationshipID, oldUserID: null, currentRoster: roster };
		replaceWithUserID = '';
	};

	// ── Manual override: save ─────────────────────────────────────────────────
	const saveEdit = async () => {
		if (!editingSlot || !replaceWithUserID) return;
		const { selectorID, relationshipID, oldUserID, currentRoster } = editingSlot;
		const isAddMode = oldUserID === null;

		if (!isAddMode) {
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
		}

		// Build new roster: add or swap
		const newRoster = isAddMode
			? [...currentRoster, replaceWithUserID]
			: currentRoster.map((id) => (id === oldUserID ? replaceWithUserID : id));

		// All users whose assignment docs need updating
		const allAffected = isAddMode
			? new Set(newRoster)
			: new Set([...newRoster, oldUserID as string]);
		const selectorAssignments = $assignmentsBySelectorId[selectorID] ?? [];

		try {
			await Promise.all(
				[...allAffected].map(async (uid) => {
					const existingDoc = selectorAssignments.find((a) => a.data.userID === uid);
					if (!isAddMode && uid === (oldUserID as string)) {
						// Remove this relationship from the old user's assignments
						if (!existingDoc) return;
						const updated = (existingDoc.data.assignedRelationships ?? []).filter(
							(r) => r.relationshipID !== relationshipID
						);
						await existingDoc.update({ assignedRelationships: updated });
					} else if (existingDoc) {
						// Merge the updated relationship into the existing doc
						const others = (existingDoc.data.assignedRelationships ?? []).filter(
							(r) => r.relationshipID !== relationshipID
						);
						const existingShared =
							(existingDoc.data.assignedRelationships ?? []).find(
								(r) => r.relationshipID === relationshipID
							)?.shared ?? false;
						await existingDoc.update({
							assignedRelationships: [
								...others,
								{ relationshipID, assignedUserIDs: newRoster, shared: existingShared }
							]
						});
					} else if (isAddMode && uid === replaceWithUserID) {
						// User has no assignment doc (e.g. deleted and re-created character).
						// Create one via update() — setDoc with merge:true creates if absent.
						const docID = `${selectorID}-${uid}`;
						const inheritedShared = isRelationshipShared(selectorID, relationshipID);
						await database.relationshipAssignments?.doc(docID)?.update({
							userID: uid,
							relationshipSelectorID: selectorID,
							relationshipRankings: [],
							assignedRelationships: [
								{ relationshipID, assignedUserIDs: newRoster, shared: inheritedShared }
							]
						} as any);
					}
				})
			);
			sendNotification({ text: isAddMode ? 'Participant added' : 'Assignment updated' });
			editingSlot = null;
		} catch (err) {
			sendNotification({ text: 'Error saving assignment' });
		}
	};

	// ── Build per-relationship roster display ─────────────────────────────────
	interface RosterEntry {
		relationshipID: string;
		userIDs: string[];    // flat list for count display
		tuples: string[][];   // actual paired groups from stored assignedUserIDs
	}

	const rostersBySelectorId: Readable<Record<string, RosterEntry[]>> = derived(
		[relationshipSelectors ?? readable([]), assignmentsBySelectorId],
		([$selectors, $assignments]) => {
			const result: Record<string, RosterEntry[]> = {};
			for (const selector of $selectors ?? []) {
				const relIDs: string[] = selector.data.relationshipIDs ?? [];
				const selectorAssignments = $assignments[selector.id] ?? [];
				const rosterMap = new Map<string, Set<string>>();
				const tupleSetByRelID = new Map<string, Map<string, string[]>>();
				for (const relID of relIDs) {
					rosterMap.set(relID, new Set());
					tupleSetByRelID.set(relID, new Map());
				}
				for (const assignment of selectorAssignments) {
					for (const ar of assignment.data.assignedRelationships ?? []) {
						if (!rosterMap.has(ar.relationshipID)) {
							rosterMap.set(ar.relationshipID, new Set());
							tupleSetByRelID.set(ar.relationshipID, new Map());
						}
						rosterMap.get(ar.relationshipID)!.add(assignment.data.userID);
						// Deduplicate tuples by their sorted member list
						const tupleSet = tupleSetByRelID.get(ar.relationshipID)!;
						const key = [...ar.assignedUserIDs].sort().join('|');
						if (!tupleSet.has(key)) {
							tupleSet.set(key, ar.assignedUserIDs);
						}
					}
				}
				result[selector.id] = relIDs.map((relID) => ({
					relationshipID: relID,
					userIDs: Array.from(rosterMap.get(relID) ?? []),
					tuples: [...(tupleSetByRelID.get(relID)?.values() ?? [])]
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
		{#if editingSlot.oldUserID !== null}
			<p class="mb1">
				Replacing <strong>{getUserName(editingSlot.oldUserID)}</strong>
				in <strong>{rel?.data?.name ?? editingSlot.relationshipID}</strong>
			</p>
		{:else}
			<p class="mb1">
				Adding to <strong>{rel?.data?.name ?? editingSlot.relationshipID}</strong>
			</p>
		{/if}
		<p class="muted h5 mb2">Current roster: {editingSlot.currentRoster.map(getUserName).join(', ')}</p>

		<UserSearch users={usersExcludingRoster} placeholder="Search for replacement…" let:filteredUsers>
			<div class="user-list mb2 divided">
				{#each filteredUsers as u (u.id)}
					<button
						class="user-option hover-bg-primary-light rounded bg-surface"
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
		</UserSearch>

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
				{@const unassignedCount = countUnassigned(selector)}
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
								{@const isSelectorSharedNow = isSelectorShared(selector.id)}
								<span class="chip bg-success text-on-success">
									<Icon>check_circle</Icon> Assigned
								</span>
								{#if sharing[selector.id]}
									<Spinner />
								{:else}
									<button
										class="share-toggle"
										class:active={isSelectorSharedNow}
										title={isSelectorSharedNow ? 'Unshare with participants' : 'Share with participants'}
										on:click={() => shareRelationships(selector.id, !isSelectorSharedNow)}
									>
										<Icon>{isSelectorSharedNow ? 'visibility' : 'visibility_off'}</Icon>
										{isSelectorSharedNow ? 'Shared' : 'Share with participants'}
									</button>
								{/if}
								<ConfirmButton on:confirm={() => clearAssignments(selector.id)} />
							{/if}
							{#if unassignedCount > 0}
								{#if isRunning}
									<Spinner />
									<span class="muted">Running…</span>
								{:else}
									<Button on:click={() => runAlgorithm(selector.id)}>
										<Icon>auto_awesome</Icon>
										{selectorHasAssignments ? 'Run for New Participants' : 'Run Algorithm'}
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
									{#each rosters as { relationshipID, userIDs, tuples } (relationshipID)}
										{@const rel = $relationshipsById[relationshipID]}
									{@const isRelShared = isRelationshipShared(selector.id, relationshipID)}
									<div class="roster-section mb3">
										<div class="flex items-center g1 mb1">
											<h3 class="my0">{rel?.data?.name ?? relationshipID}</h3>
											<span class="chip bg-secondary">
												{userIDs.length} / {rel?.data?.capacity > 0 ? rel.data.capacity : '∞'}
												· size {rel?.data?.size ?? 2}
											</span>
											{#if sharing[`${selector.id}:${relationshipID}`]}
												<Spinner />
											{:else}
												<button
													class="share-toggle share-toggle--sm"
													class:active={isRelShared}
													title={isRelShared ? 'Unshare with participants' : 'Share with participants'}
													on:click={() => shareRelationships(selector.id, !isRelShared, relationshipID)}
												>
													<Icon>{isRelShared ? 'visibility' : 'visibility_off'}</Icon>
												</button>
											{/if}
									</div>

{#if tuples.length === 0}
									<p class="muted h5">No one assigned yet.</p>
								{:else}
									{@const tupleSize = rel?.data?.size ?? 2}
									{#each tuples as tuple, tupleIndex}
										<div class="tuple-row flex items-center g1 mb1 p1 rounded bg-secondary">
											<span class="muted h5 tuple-label">Group {tupleIndex + 1}</span>
											<div class="flex flex-wrap g1 flex-auto">
												{#each tuple as userID}
												<div class="user-chip bg-surface flex items-center g1">
												<span>{getCharacterLabel(userID)}</span>
													<IconButton
														icon="edit"
														title="Replace this user"
														on:click={() => openEdit(selector.id, relationshipID, userID, tuple)}
													/>
												</div>
												{/each}
												{#if tuple.length < tupleSize}
													<button
														class="add-slot-btn"
														title="Add a participant to fill this empty slot"
														on:click={() => openAdd(selector.id, relationshipID, tuple)}
													>
														<Icon>person_add</Icon> Add person
													</button>
												{/if}
											</div>
											<div class="tuple-actions">
												{#if deletingGroups[`${selector.id}:${relationshipID}:${tupleKey(tuple)}`]}
													<Spinner />
												{:else}
													<ConfirmButton
														icon="delete"
														on:confirm={() => deleteAssignedGroup(selector.id, relationshipID, tuple)}
													/>
												{/if}
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

	.tuple-actions {
		display: inline-flex;
		align-items: center;
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

	.share-toggle {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		background: none;
		border: 1px solid var(--surface);
		border-radius: 12px;
		padding: 0.15rem 0.6rem;
		cursor: pointer;
		color: inherit;
		font-size: 0.8rem;
		white-space: nowrap;
	}

	.share-toggle.active {
		background: var(--primary);
		color: var(--on-primary);
		border-color: var(--primary);
	}

	.share-toggle--sm {
		padding: 0.1rem 0.35rem;
		font-size: 0.75rem;
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

	.add-slot-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		background: none;
		border: 1px dashed var(--surface);
		border-radius: 8px;
		padding: 0.2rem 0.5rem;
		cursor: pointer;
		color: inherit;
		font-size: 0.85rem;
		opacity: 0.7;
	}

	.add-slot-btn:hover {
		opacity: 1;
		background: var(--secondary);
	}
</style>
