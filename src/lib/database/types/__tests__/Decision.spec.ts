import { describe, it, expect } from 'vitest';
import { isStartNode, isAssetNode, isRelationshipNode } from '../Decision';

describe('Decision typeguards', () => {
  it('detects a StartNode', () => {
    const start = { treeID: 't1', name: 'Start', parentIDs: [] } as any;
    expect(isStartNode(start)).toBe(true);
    expect(isAssetNode(start)).toBe(false);
    expect(isRelationshipNode(start)).toBe(false);
  });

  it('detects an AssetNode', () => {
    const asset = { treeID: 't1', assetID: 'asset:1', parentID: 'p1' } as any;
    expect(isAssetNode(asset)).toBe(true);
    expect(isStartNode(asset)).toBe(false);
    expect(isRelationshipNode(asset)).toBe(false);
  });

  it('detects a RelationshipNode', () => {
    const rel = { treeID: 't1', parentID: 'p1', relationshipSelectorID: 'selector-1' } as any;
    expect(isRelationshipNode(rel)).toBe(true);
    expect(isAssetNode(rel)).toBe(false);
    expect(isStartNode(rel)).toBe(false);
  });
});
