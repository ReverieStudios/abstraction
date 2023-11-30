import { Collection } from './Collection';
import { CollectionDocument } from './CollectionDocument';
import { DocumentMap } from './DocumentMap';

import type { Asset } from './types/Assets';
import type { AssetType } from './types/AssetTypes';
import type { Character } from './types/Character';
import type { Decision } from './types/Decision';
import type { Favorites } from './types/Favorites';
import type { FavoriteCounts } from './types/FavoriteCounts';
import type { Flag } from './types/Flags';
import type { Form } from './types/Form';
import type { Game } from './types/Game';
import type { Lock } from './types/Lock';
import type { User } from './types/User';
import type { Token } from './types/Token';

interface Database {
	games: Collection<Game>;
	users: Collection<User>;
	forms: Collection<Form>;
	tokens: Collection<Token>;
	gameFlags: (gameID: string) => Database['flags'];

	game?: CollectionDocument<Game>;

	assets?: Collection<Asset>;
	assetTypes?: DocumentMap<AssetType>;
	characters?: Collection<Character>;
	decisionTree?: DocumentMap<Decision>;
	favorites?: CollectionDocument<Favorites>;
	allFavorites?: Collection<Favorites>;
	favoriteCounts?: CollectionDocument<FavoriteCounts>;
	flags?: DocumentMap<Flag>;
	locks?: Collection<Lock>;
}

const last = {
	gameID: null,
	userID: null
};
export const setGameID = (gameID: string) => {
	if (gameID === last.gameID) {
		return;
	}
	last.gameID = gameID;
	updateDatabase();
};
export const setUserID = (userID: string) => {
	if (userID === last.userID) {
		return;
	}
	last.userID = userID;
	updateDatabase();
};

const updateDatabase = () => {
	const { gameID, userID } = last;

	database.game = gameID ? new CollectionDocument(`games/${gameID}`, null) : null;
	database.assets = gameID
		? new Collection(`games/${gameID}/assets`, { sortBy: 'name', cacheField: 'lastUpdated' })
		: null;
	database.assetTypes = gameID ? new DocumentMap(`games/${gameID}/data/assetTypes`, 'name') : null;
	database.characters = gameID
		? new Collection(`games/${gameID}/characters`, { sortBy: 'name' })
		: null;
	database.decisionTree = gameID ? new DocumentMap(`games/${gameID}/data/decisionTree`) : null;
	database.favoriteCounts = gameID
		? new CollectionDocument(`games/${gameID}/data/favorites`)
		: null;
	database.flags = gameID ? new DocumentMap(`games/${gameID}/data/flags`, 'name') : null;
	database.locks = gameID
		? new Collection(`games/${gameID}/locks`, { sortBy: 'name', cacheField: 'lastUpdated' })
		: null;

	database.favorites =
		userID && gameID ? new CollectionDocument(`games/${gameID}/favorites/${userID}`) : null;
	database.allFavorites = gameID ? new Collection(`games/${gameID}/favorites`) : null;
};

export const database: Database = {
	forms: new Collection('forms', { sortBy: 'name', cacheField: 'lastUpdated' }),
	games: new Collection('games', { sortBy: 'name', cacheField: 'lastUpdated' }),
	tokens: new Collection('tokens', { sortBy: 'createdOn' }),
	users: new Collection('users', { sortBy: 'name' }),
	gameFlags: (gameID: string) => new DocumentMap(`games/${gameID}/data/flags`, 'name')
};
