import { isStartNode, isAssetNode } from '$lib/database/types/Decision';
import { store, generateID } from '$lib/firebase';
import { database } from '$lib/database';
import type { KeyGroups, Docs, KeyMaps } from '$lib/database/types';
import type { Decision } from '$lib/database/types/Decision';
import type { FieldValue } from 'firebase/firestore';
import { transform } from 'lodash-es';

export const TREE_TYPE = 'TREE_TYPE';
export const START_ID = 'START_NODE';

export interface State {
	selected: Docs.Decision;
	drawTreeID: string;
}

type UpdateDoc = Record<string, Decision | FieldValue>;

export interface ExitNode {
	id: string;
	name: string;
	data: {
		treeID: string;
	};
	exit: boolean;
	parentIDs: string[];
}
export type TreeNode = Docs.Decision | ExitNode;
const isExitNode = (node: TreeNode): node is ExitNode => {
	return (node as ExitNode)?.exit === true;
};

export const deleteNodeAndChildren = (root: Docs.Decision, nodesByParentId: KeyGroups.Decision) => {
	const update = {
		[root.id]: store.fieldValues.delete()
	} as UpdateDoc;

	recursiveDelete(root, nodesByParentId, update, nodesByParentId[root.id] ?? []);

	return database.decisionTree.set(update);
};

export const recursiveDelete = (
	parentDoc: Docs.Decision,
	nodesByParentId: KeyGroups.Decision,
	updateObj: UpdateDoc,
	childDocs: Docs.Decision[],
	initial: boolean = true
) => {
	if (childDocs.length === 0) {
		return;
	}

	childDocs.forEach((childDoc) => {
		if (isStartNode(childDoc.data)) {
			const currentParentIDs =
				(updateObj?.[childDoc.id] as Decision.StartNode)?.parentIDs || childDoc.data.parentIDs;
			updateObj[childDoc.id] = {
				...childDoc.data,
				parentIDs: currentParentIDs.filter((id) => id !== parentDoc.id)
			};
			if (initial) {
				recursiveDelete(
					childDoc,
					nodesByParentId,
					updateObj,
					nodesByParentId[childDoc.id] ?? [],
					false
				);
			}
		} else if (isAssetNode(childDoc.data)) {
			updateObj[childDoc.id] = store.fieldValues.delete();
			recursiveDelete(
				childDoc,
				nodesByParentId,
				updateObj,
				nodesByParentId[childDoc.id] ?? [],
				false
			);
		}
	});
};

export const getNodeName = (node: TreeNode, assetMap: KeyMaps.Asset) => {
	if (isExitNode(node)) {
		return node.name;
	} else if (isStartNode(node.data)) {
		return node.data.name;
	} else if (isAssetNode(node.data)) {
		const assetID = node.data.assetID;
		return assetMap?.[assetID]?.data?.name ?? 'Loading';
	}
	return 'Unknown';
};

const getChildType = (children: Docs.Decision[], assetsByID: KeyMaps.Asset) => {
	const child = children[0];
	if (child) {
		if (isStartNode(child.data)) {
			return TREE_TYPE;
		} else if (isAssetNode(child.data)) {
			const asset = assetsByID[child.data.assetID];
			return asset?.data?.type;
		}
	}
};

const addChildren = (
	updateObj: UpdateDoc,
	parent: Docs.Decision,
	selectedType: string,
	newChildIDs: string[],
	nodesById: KeyMaps.Decision
) => {
	const treeID = parent.data.treeID;
	if (selectedType === TREE_TYPE) {
		newChildIDs.forEach((id) => {
			const node = nodesById[id];
			if (isStartNode(node.data)) {
				updateObj[id] = {
					...node.data,
					parentIDs: [...node.data.parentIDs, parent.id]
				};
			}
		});
	} else {
		newChildIDs.forEach((assetID) => {
			const newNode: Decision.AssetNode = {
				assetID,
				parentID: parent.id,
				treeID
			};
			updateObj[generateID()] = newNode;
		});
	}
};

export const updateSelectedNode = (
	selected: Docs.Decision,
	newChildIDs: string[],
	loops: string,
	childConditions: Record<string, string>,
	selectedType: string,
	nodesById: KeyMaps.Decision,
	nodesByParentId: KeyGroups.Decision,
	assetsByID: KeyMaps.Asset
) => {
	// get current type
	const currentChildNodes = nodesByParentId[selected.id] ?? [];
	const currentType = getChildType(currentChildNodes, assetsByID);

	const updateObj = {} as UpdateDoc;

	if (isStartNode(selected.data)) {
		updateObj[selected.id] = {
			...selected.data,
			loops
		};
	}
	updateObj[selected.id] = {
		...selected.data,
		childConditions
	};

	let nodesToRemove = [];
	let childIDsToAdd = [];

	if (currentType !== selectedType) {
		// if new type is different, unset all present, just set new
		nodesToRemove = currentChildNodes;
		childIDsToAdd = newChildIDs;
	} else if (selectedType === TREE_TYPE) {
		// for tree type, everything is already nodeIDs
		const currentChildIdSet = new Set(currentChildNodes.map((n) => n.id));
		const newChildIdSet = new Set(newChildIDs);
		nodesToRemove = currentChildNodes.filter((n) => !newChildIdSet.has(n.id));
		childIDsToAdd = newChildIDs.filter((id) => !currentChildIdSet.has(id));
	} else {
		// for assets, map current back to assets and compare
		const currentChildIdSet = new Set(
			currentChildNodes
				.map((node) => {
					if (isAssetNode(node.data)) {
						return node.data.assetID;
					}
				})
				.filter(Boolean)
		);
		const newChildIdSet = new Set(newChildIDs);
		nodesToRemove = currentChildNodes.filter((node) => {
			if (isAssetNode(node.data)) {
				return !newChildIdSet.has(node.data.assetID);
			} else {
				// shouldn't really happen
				return true;
			}
		});
		childIDsToAdd = newChildIDs.filter((id) => !currentChildIdSet.has(id));
	}
	recursiveDelete(selected, nodesByParentId, updateObj, nodesToRemove);
	addChildren(updateObj, selected, selectedType, childIDsToAdd, nodesById);

	return database.decisionTree.set(updateObj, false);
};

export const groupByParentId = (decisions: Docs.Decision[]) =>
	transform(
		decisions,
		(acc, node: Docs.Decision) => {
			let parentIDs = [];
			if (isStartNode(node.data)) {
				parentIDs = node.data.parentIDs;
			} else if (isAssetNode(node.data)) {
				parentIDs = [node.data.parentID];
			}

			parentIDs.forEach((id) => {
				if (!acc[id]) {
					acc[id] = [node];
				} else {
					acc[id].push(node);
				}
			});
		},
		{}
	);
