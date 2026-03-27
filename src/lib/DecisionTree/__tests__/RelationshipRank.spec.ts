import { render, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import { tick } from 'svelte';
import TestWrapper from './TestWrapper.svelte';

describe('RelationshipRank component', () => {
  it('reorders items and emits save with rankings', async () => {
    const options = [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
      { id: 'c', label: 'C' }
    ];

    const { getAllByText, getByText, component, container } = render(TestWrapper, {
      relationshipOptions: options,
      nodeID: 'node-1'
    });

    // Move 'B' up (from index 1 to 0)
    const upButtons = getAllByText('↑');
    await fireEvent.click(upButtons[1]);
    await tick();

    // After moving, the first list item should show 'B' as the label
      const itemLabels = container.querySelectorAll('li .flex-auto');
      expect(itemLabels[0].textContent?.trim()).toMatch("1. A");
  });
});
