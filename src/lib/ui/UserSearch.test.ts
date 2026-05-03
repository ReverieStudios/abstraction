/// <reference types="@testing-library/jest-dom" />
import { render, screen, fireEvent } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import UserSearchTestWrapper from './UserSearch.test.svelte';

const mockUsers = [
	{ id: '1', data: { name: 'Alice Smith', email: 'alice@example.com' } },
	{ id: '2', data: { name: 'Bob Jones', email: 'bob@example.com' } },
	{ id: '3', data: { name: 'Carol White', email: 'carol@example.com' } },
	{ id: '4', data: { name: null, email: 'noname@example.com' } }
];

const getItems = () => screen.queryAllByTestId('user-item');
const getInput = () => screen.getByRole('textbox');

describe('UserSearch', () => {
	it('renders a search input', () => {
		render(UserSearchTestWrapper, { users: mockUsers });
		expect(getInput()).toBeInTheDocument();
	});

	it('shows all users when query is empty', () => {
		render(UserSearchTestWrapper, { users: mockUsers });
		expect(getItems()).toHaveLength(mockUsers.length);
	});

	it('filters by name (case-insensitive)', async () => {
		render(UserSearchTestWrapper, { users: mockUsers });
		const input = getInput();
		await fireEvent.input(input, { target: { value: 'alice' } });
		expect(getItems()).toHaveLength(1);
		expect(getItems()[0]).toHaveAttribute('data-userid', '1');
	});

	it('filters by email (case-insensitive)', async () => {
		render(UserSearchTestWrapper, { users: mockUsers });
		const input = getInput();
		await fireEvent.input(input, { target: { value: 'BOB@' } });
		expect(getItems()).toHaveLength(1);
		expect(getItems()[0]).toHaveAttribute('data-userid', '2');
	});

	it('returns multiple matches when query is partial', async () => {
		render(UserSearchTestWrapper, { users: mockUsers });
		await fireEvent.input(getInput(), { target: { value: 'example.com' } });
		expect(getItems()).toHaveLength(mockUsers.length);
	});

	it('returns no results when nothing matches', async () => {
		render(UserSearchTestWrapper, { users: mockUsers });
		await fireEvent.input(getInput(), { target: { value: 'zzznomatch' } });
		expect(getItems()).toHaveLength(0);
	});

	it('shows all users again after clearing the query', async () => {
		render(UserSearchTestWrapper, { users: mockUsers });
		const input = getInput();
		await fireEvent.input(input, { target: { value: 'alice' } });
		expect(getItems()).toHaveLength(1);
		await fireEvent.input(input, { target: { value: '' } });
		expect(getItems()).toHaveLength(mockUsers.length);
	});

	it('handles users with no name by matching on email', async () => {
		render(UserSearchTestWrapper, { users: mockUsers });
		await fireEvent.input(getInput(), { target: { value: 'noname' } });
		expect(getItems()).toHaveLength(1);
		expect(getItems()[0]).toHaveAttribute('data-userid', '4');
	});

	it('shows all users when passed an empty list', () => {
		render(UserSearchTestWrapper, { users: [] });
		expect(getItems()).toHaveLength(0);
	});

	it('accepts a custom placeholder', () => {
		render(UserSearchTestWrapper, { users: mockUsers, placeholder: 'Find someone…' });
		expect(screen.getByText('Find someone…')).toBeInTheDocument();
	});

	it('uses the default placeholder when none is provided', () => {
		render(UserSearchTestWrapper, { users: mockUsers });
		expect(screen.getByText('Search by name or email…')).toBeInTheDocument();
	});
});
