import { getFlag } from './flags.js';
import { MODULE_ID } from './settings.js';

/**
 * Actors stored in world Actor compendiums keep a summary of their linked items in an
 * actor flag. The flag is requested as a compendium index field, so derivations can be
 * counted without loading the archived actors themselves.
 */
const FIELD = `flags.${MODULE_ID}.links`;

export function isArchivePack(pack) {
	return pack?.documentName === 'Actor' && pack.metadata.packageType === 'world';
}

function archivePacks() {
	return [...game.packs.values()].filter(isArchivePack);
}

function linkedItems(actor) {
	return actor.items.contents.filter((i) => getFlag(i, 'isLinked') && getFlag(i, 'baseItem'));
}

/** Base item UUIDs of an actor's linked items, repeated once per linked item. */
function actorLinks(actor) {
	return linkedItems(actor)
		.map((i) => getFlag(i, 'baseItem'))
		.sort();
}

/** The summary stored on an actor or index entry; undefined means it was never synced. */
function storedLinks(source) {
	const links = foundry.utils.getProperty(source, FIELD);
	return Array.isArray(links) ? links : undefined;
}

function sameLinks(a, b) {
	return a.length === b?.length && a.every((uuid, i) => uuid === b[i]);
}

// Core only refreshes index keys an entry already has, so the summary is copied manually.
function patchIndex(pack, id, links) {
	const entry = pack?.index.get(id);
	if (entry && links) foundry.utils.setProperty(entry, FIELD, [...links]);
}

/**
 * Rewrites outdated summaries of loaded actors. Locked packs only get their index patched.
 * @returns {Promise<number>} The number of actors updated.
 */
export async function syncActors(pack, actors) {
	const updates = [];
	for (const actor of actors) {
		const links = actorLinks(actor);
		patchIndex(pack, actor.id, links);
		if (!sameLinks(links, storedLinks(actor))) updates.push({ _id: actor.id, [FIELD]: links });
	}
	if (!updates.length || pack.locked) return 0;
	await CONFIG.Actor.documentClass.updateDocuments(updates, { pack: pack.collection });
	return updates.length;
}

/** Requests the summaries of all archived actors. Only GMs pay for the extra index field. */
export async function loadArchiveIndex() {
	if (!game.user.isGM) return;
	await Promise.allSettled(archivePacks().map((pack) => pack.getIndex({ fields: [FIELD] })));
}

/**
 * Counts archived linked items from the compendium indexes.
 * @returns {Object} The number of archived derivations, by base item UUID.
 */
export function countArchived() {
	const frequency = {};
	for (const pack of archivePacks()) {
		for (const entry of pack.index.values()) {
			for (const uuid of storedLinks(entry) ?? []) frequency[uuid] = (frequency[uuid] ?? 0) + 1;
		}
	}
	return frequency;
}

/**
 * Loads the archived actors that hold derivations of a base item, or were never synced,
 * and fixes their summaries along the way.
 * @returns {Promise<Item[]>} The archived items linked to the base item.
 */
export async function findArchivedItems(baseUuid) {
	const items = [];
	for (const pack of archivePacks()) {
		const ids = [...pack.index.values()]
			.filter((entry) => storedLinks(entry)?.includes(baseUuid) ?? true)
			.map((entry) => entry._id);
		if (!ids.length) continue;
		const actors = await pack.getDocuments({ _id__in: ids });
		await syncActors(pack, actors);
		for (const actor of actors) {
			items.push(...linkedItems(actor).filter((i) => getFlag(i, 'baseItem') === baseUuid));
		}
	}
	return items;
}

/**
 * Loads every unlocked world Actor compendium and rewrites outdated summaries.
 * @returns {Promise<number>} The number of actors updated.
 */
export async function rebuildArchiveLinks() {
	let updated = 0;
	for (const pack of archivePacks()) {
		if (pack.locked) continue;
		updated += await syncActors(pack, await pack.getDocuments());
	}
	return updated;
}

const renderItemCompendiums = foundry.utils.debounce(() => {
	Object.values(ui.windows).forEach((app) => {
		if (app instanceof Compendium && app.collection.documentName === 'Item') app.render();
	});
}, 100);

const pending = new Map();
const syncPending = foundry.utils.debounce(async () => {
	const packs = new Map();
	for (const actor of pending.values()) {
		if (!packs.has(actor.compendium)) packs.set(actor.compendium, []);
		packs.get(actor.compendium).push(actor);
	}
	pending.clear();
	for (const [pack, actors] of packs) await syncActors(pack, actors);
}, 250);

// The user who changed the inventory of an archived actor also refreshes its summary.
function itemChanged(item, ...args) {
	const actor = item.parent;
	if (args.at(-1) !== game.user.id || !isArchivePack(actor?.compendium)) return;
	pending.set(actor.uuid, actor);
	syncPending();
}

function preCreateActor(actor) {
	if (isArchivePack(actor.compendium)) actor.updateSource({ [FIELD]: actorLinks(actor) });
	else if (storedLinks(actor)) actor.updateSource({ [`flags.${MODULE_ID}.-=links`]: null });
}

function createActor(actor) {
	if (!game.user.isGM || !isArchivePack(actor.compendium)) return;
	patchIndex(actor.compendium, actor.id, storedLinks(actor));
	renderItemCompendiums();
}

function updateActor(actor, changes) {
	if (!game.user.isGM || !isArchivePack(actor.compendium)) return;
	if (!foundry.utils.hasProperty(changes, FIELD)) return;
	patchIndex(actor.compendium, actor.id, storedLinks(actor));
	renderItemCompendiums();
}

function deleteActor(actor) {
	if (game.user.isGM && isArchivePack(actor.compendium)) renderItemCompendiums();
}

/** -------------------------------------------- */
Hooks.on('preCreateActor', preCreateActor);
Hooks.on('createActor', createActor);
Hooks.on('updateActor', updateActor);
Hooks.on('deleteActor', deleteActor);
Hooks.on('createItem', itemChanged);
Hooks.on('updateItem', itemChanged);
Hooks.on('deleteItem', itemChanged);
