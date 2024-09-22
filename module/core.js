/**
 * Fixes for Core methods and functions
 */

function toObject(source = true) {
	const data = foundry.abstract.DataModel.prototype.toObject.call(this, source);
	if (this.compendium && !data.flags['item-linking']?.baseItem) {
		foundry.utils.setProperty(data, 'flags.item-linking', {
			baseItem: this.uuid,
			isLinked: true,
		});
	}
	return this.constructor.shimData(data);
}

foundry.abstract.Document.prototype.toObject = toObject;

function fromDropData() {
	const systemFromDropData = CONFIG.Item.documentClass.implementation.fromDropData;
	async function fromDropData(...args) {
		const document = await systemFromDropData.call(this, ...args);
		if (document?.compendium) {
			document.updateSource({
				'flags.item-linking': {
					baseItem: document.uuid,
					isLinked: true,
				},
			});
		}
		return document;
	}

	CONFIG.Item.documentClass.implementation.fromDropData = fromDropData;
}

Hooks.once('ready', () => {
	fromDropData();
});
