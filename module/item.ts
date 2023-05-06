/**
 * Item Linking Implementation
 */

import { findItem } from './packs.js';

/**
 * Create a synthetic Actor using a provided Token instance
 * If the Token data is linked, return the true Actor document
 * If the Token data is not linked, create a synthetic Actor using the Token's actorData override
 */
async function getItem(this: ItemExtended) {
	const linked = this.isLinked && this.baseItem !== null;
	const baseItem = linked ? (await findItem(this.baseItem as string)) ?? this : this;
	if (linked) return baseItem;

	// Get base item data
	const cls = getDocumentClass('Item') as typeof ItemExtended;
	const itemData = baseItem.toObject();

	// Clean and validate the override data
	const overrides = cls.schema.clean(this.itemData, { partial: true });
	const error = cls.schema.validate(this.itemData, { partial: true });
	if (!error) foundry.utils.mergeObject(itemData, overrides);

	// Create a synthetic item
	const item = new cls(itemData);
	item.reset(); // FIXME why is this necessary?
	return item;
}

Object.defineProperties(Item.prototype, {
	baseItem: {
		value: null,
		writable: true,
	},
	documentLink: {
		value: false,
		writable: true,
	},
	isLinked: {
		get: function isLinked() {
			return this.documentLink;
		},
	},
	itemData: {
		value: {},
		writable: true,
	},
	getItem: {
		value: getItem,
	},
});
