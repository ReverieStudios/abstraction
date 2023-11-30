import { DocType } from './DocType';
import type { Snapshot } from './DocType';
import { Subscribable } from './Subscribable';

export class CollectionDocument<T = Object> extends Subscribable<T> {
	protected wrapDoc(doc: Snapshot) {
		return new DocType<T>(doc, this.cacheField);
	}
}
