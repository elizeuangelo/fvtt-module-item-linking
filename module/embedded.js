import { getSetting } from './settings.js';
import LinkedItemResolver from './link-resolver.js';

function preCreate(document, data, context) {
	if (getSetting('enforceActorsFXs') && document.parent instanceof CONFIG.Actor.documentClass) {
		if (document.parent.effects.get(data._id)) return false;
		context.keepId = true;
	}
}

function preUpdate(_document, _changes) {}

/**
 * Prevents removing an enforced actor effect while another linked item still references it.
 * @param {Document} document - The document to be deleted.
 * @returns {boolean|undefined} - Returns `false` if the document is linked to other items, otherwise `undefined`.
 */
function preDelete(document) {
	if (
		!document.isEmbedded ||
		!(document.parent instanceof CONFIG.Item.documentClass) ||
		!document.compendium ||
		document.parent.isEmbedded
	) {
		if (
			document.parent instanceof CONFIG.Actor.documentClass &&
			'origin' in document &&
			getSetting('enforceActorsFXs')
		) {
			const existsInOther = document.parent.items.contents.find((i) =>
				i.effects.find((fx) => fx.id === document.id)
			);
			if (existsInOther) {
				document.update({ origin: existsInOther.uuid });
				return false;
			}
		}
		return;
	}
}

function refreshParentItem(document) {
	if (
		!document.isEmbedded ||
		!(document.parent instanceof CONFIG.Item.documentClass) ||
		!document.compendium ||
		document.parent.isEmbedded
	)
		return;
	LinkedItemResolver.refreshBaseItem(document.parent, { render: true });
}

/** -------------------------------------------- */
Object.keys(CONFIG.Item.documentClass.metadata.embedded).forEach((type) => {
	Hooks.on(`preCreate${type}`, preCreate);
	Hooks.on(`preUpdate${type}`, preUpdate);
	Hooks.on(`preDelete${type}`, preDelete);
	Hooks.on(`create${type}`, refreshParentItem);
	Hooks.on(`update${type}`, refreshParentItem);
	Hooks.on(`delete${type}`, refreshParentItem);
});
