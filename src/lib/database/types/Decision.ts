export type Decision = Decision.StartNode | Decision.AssetNode | Decision.RelationshipNode;

export namespace Decision {
	interface DecisionNode {
		treeID: string;
		childConditions?: Record<string, string>;
	}

	export interface StartNode extends DecisionNode {
		name: string;
		parentIDs: string[];
		loops?: string;
	}

	export type Variable = { name: string; value: string | number };

	export interface AssetNode extends DecisionNode {
		assetID: string;
		parentID: string;
		setVariables?: Variable[];
	}

	export interface RelationshipNode extends DecisionNode {
		parentID: string;
		relationshipIDs: string[];
		setVariables?: Variable[];
	}
}

export const isStartNode = (node: Decision): node is Decision.StartNode => {
	return (node as Decision.StartNode).name !== undefined;
};

export const isAssetNode = (node: Decision): node is Decision.AssetNode => {
	return (node as Decision.AssetNode).assetID !== undefined;
};

export const isRelationshipNode = (node: Decision): node is Decision.RelationshipNode => {
	return (node as Decision.RelationshipNode).relationshipIDs !== undefined;
};
