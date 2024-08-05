/**
 * Fixes for Core methods and functions
 */

function toObject(source = true) {
	const data = foundry.abstract.DataModel.prototype.toObject.call(this, source);
	if (this.compendium) {
		const uuid = getProperty(data, 'flags.dnd5e.sourceId') ?? this.uuid;
		setProperty(data, 'flags.core.sourceId', uuid);
	}
	return this.constructor.shimData(data);
}

foundry.abstract.Document.prototype.toObject = toObject;

function fromDropData() {
	const systemFromDropData = CONFIG.Item.documentClass.implementation.fromDropData;
	async function fromDropData(...args) {
		const document = await systemFromDropData.call(this, ...args);
		if (document?.compendium) {
			document.updateSource({ 'flags.core.sourceId': this.uuid });
		}
		return document;
	}

	CONFIG.Item.documentClass.implementation.fromDropData = fromDropData;
}

Hooks.once('ready', () => {
	fromDropData();
});
