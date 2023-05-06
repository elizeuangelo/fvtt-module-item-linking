import { findItem } from './packs.js';
async function getItem() {
    const linked = this.isLinked && this.baseItem !== null;
    const baseItem = linked ? (await findItem(this.baseItem)) ?? this : this;
    if (linked)
        return baseItem;
    const cls = getDocumentClass('Item');
    const itemData = baseItem.toObject();
    const overrides = cls.schema.clean(this.itemData, { partial: true });
    const error = cls.schema.validate(this.itemData, { partial: true });
    if (!error)
        foundry.utils.mergeObject(itemData, overrides);
    const item = new cls(itemData);
    item.reset();
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
