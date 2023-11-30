import type { WithFieldValue } from 'firebase/firestore';
import type { DocType } from '../DocType';
import type { SubDocType } from '../DocumentMap';
import type { Asset as _Asset } from './Assets';
import type { AssetType as _AssetType } from './AssetTypes';
import type { Character as _Character } from './Character';
import type { Decision as _Decision } from './Decision';
import type { Favorites as _Favorites } from './Favorites';
import type { Flag as _Flag } from './Flags';
import type { Game as _Game } from './Game';
import type { Lock as _Lock } from './Lock';
import type { Token as _Token } from './Token';
import type { User as _User } from './User';

type key = string | number | symbol;

type DocMap<K extends key, T> = Record<K, DocType<T>>;
type DocKeyGroup<K extends key, T> = Record<K, DocType<T>[]>;
type SubDocMap<K extends key, T> = Record<K, SubDocType<T>>;
type SubDocKeyGroup<K extends key, T> = Record<K, SubDocType<T>[]>;
type Updater<T> = WithFieldValue<Partial<T>>;

export namespace Docs {
	export type Asset = DocType<_Asset>;
	export type AssetType = SubDocType<_AssetType>;
	export type Character = DocType<_Character>;
	export type Decision = SubDocType<_Decision>;
	export type Favorites = DocType<_Favorites>;
	export type Flag = SubDocType<_Flag>;
	export type Game = DocType<_Game>;
	export type Lock = DocType<_Lock>;
	export type Token = DocType<_Token>;
	export type User = DocType<_User>;
}

export namespace Updaters {
	export type Asset = Updater<_Asset>;
	export type AssetType = Updater<_AssetType>;
	export type Character = Updater<_Character>;
	export type Decision = Updater<_Decision>;
	export type Favorites = Updater<_Favorites>;
	export type Flag = Updater<_Flag>;
	export type Game = Updater<_Game>;
	export type Lock = Updater<_Lock>;
	export type Token = Updater<_Token>;
	export type User = Updater<_User>;
}

export namespace KeyMaps {
	export type Asset<T extends key = string> = DocMap<T, _Asset>;
	export type AssetType<T extends key = string> = SubDocMap<T, _AssetType>;
	export type Character<T extends key = string> = DocMap<T, _Character>;
	export type Decision<T extends key = string> = SubDocMap<T, _Decision>;
	export type Favorites<T extends key = string> = DocMap<T, _Favorites>;
	export type Flag<T extends key = string> = SubDocMap<T, _Flag>;
	export type Game<T extends key = string> = DocMap<T, _Game>;
	export type Lock<T extends key = string> = DocMap<T, _Lock>;
	export type Token<T extends key = string> = DocMap<T, _Token>;
	export type User<T extends key = string> = DocMap<T, _User>;
}

export namespace KeyGroups {
	export type Asset<T extends key = string> = DocKeyGroup<T, _Asset>;
	export type AssetType<T extends key = string> = SubDocKeyGroup<T, _AssetType>;
	export type Character<T extends key = string> = DocKeyGroup<T, _Character>;
	export type Decision<T extends key = string> = SubDocKeyGroup<T, _Decision>;
	export type Favorites<T extends key = string> = DocKeyGroup<T, _Favorites>;
	export type Flag<T extends key = string> = SubDocKeyGroup<T, _Flag>;
	export type Game<T extends key = string> = DocKeyGroup<T, _Game>;
	export type Lock<T extends key = string> = DocKeyGroup<T, _Lock>;
	export type Token<T extends key = string> = DocKeyGroup<T, _Token>;
	export type User<T extends key = string> = DocKeyGroup<T, _User>;
}
