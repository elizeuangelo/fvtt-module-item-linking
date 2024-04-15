/**
 * Fixes for Core methods and functions
 */

function toObject(source = true) {
	const data = foundry.abstract.DataModel.prototype.toObject.call(this, source);
	if (this.compendium) setProperty(data, 'flags.core.sourceId', this.uuid);
	return this.constructor.shimData(data);
}

foundry.abstract.Document.prototype.toObject = toObject;
