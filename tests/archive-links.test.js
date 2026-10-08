import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './foundry-fixture.js';

const sword = 'Compendium.world.items.Item.sword';
const shield = 'Compendium.world.items.Item.shield';
const inventoryItem = (id, baseItem = sword, isLinked = true) => ({
	_id: id, name: id, flags: { 'item-linking': { baseItem, isLinked } },
});
const actorSource = (id, items, links) => ({
	_id: id, items, flags: links ? { 'item-linking': { links } } : {},
});
// Values created inside the module's VM context have foreign prototypes.
const plain = (value) => JSON.parse(JSON.stringify(value));
const tick = () => new Promise((resolve) => setImmediate(resolve));

async function archiveFixture() {
	const fx = await fixture();
	const events = [];
	fx.game.packs = new Map();
	fx.context.ui = { windows: {} };
	fx.context.Compendium = class {};
	Object.assign(fx.context.foundry.utils, {
		debounce: (callback) => callback,
		hasProperty: (object, path) => path.split('.').every((key) => (object = object?.[key]) !== undefined),
	});
	Object.defineProperty(fx.Actor.prototype, 'flags', { get() { return this._source.flags; } });
	fx.Actor.shimData = (data) => data;
	fx.Actor.prototype.updateSource = function (changes) { fx.mergeObject(this._source, changes); };
	fx.Actor.updateDocuments = async (updates, { pack }) => {
		events.push(`update ${pack}: ${updates.map((update) => update._id).join(', ')}`);
		for (const update of updates) {
			const { _id, ...changes } = update;
			fx.mergeObject(fx.game.packs.get(pack).actors.get(_id)._source, changes);
		}
	};
	// Index entries mirror what the server returns: never-synced actors have no summary.
	fx.addPack = (collection, sources, { documentName = 'Actor', packageType = 'world', locked = false } = {}) => {
		const pack = {
			collection, documentName, locked, title: collection, metadata: { packageType },
			actors: new Map(), index: new Map(),
			async getIndex({ fields }) { events.push(`index ${collection}: ${fields}`); return pack.index; },
			async getDocuments(query = {}) {
				const ids = query._id__in ?? [...pack.actors.keys()];
				events.push(`load ${collection}: ${ids.join(', ')}`);
				return ids.map((id) => pack.actors.get(id));
			},
		};
		for (const source of sources) {
			const actor = new fx.Actor(source);
			actor.compendium = pack;
			pack.actors.set(actor.id, actor);
			pack.index.set(actor.id, structuredClone({ _id: actor.id, flags: source.flags }));
		}
		fx.game.packs.set(collection, pack);
		return pack;
	};
	const archive = await fx.load('archive-links.js');
	const hook = (name, ...args) => fx.hooks.get(name).forEach((callback) => callback(...args));
	return { ...fx, ...archive, events, hook };
}

test('archived derivations are counted from world Actor pack indexes without loading documents', async () => {
	const fx = await archiveFixture();
	fx.addPack('world.archive', [
		actorSource('twin', [], [sword, sword]),
		actorSource('mixed', [], [shield, sword]),
		actorSource('unsynced', [inventoryItem('hidden')]),
	]);
	fx.addPack('world.locked', [actorSource('guard', [], [shield])], { locked: true });
	fx.addPack('module.actors', [actorSource('other', [], [sword])], { packageType: 'module' });
	fx.addPack('world.items', [actorSource('item', [], [sword])], { documentName: 'Item' });
	assert.deepEqual(plain(fx.countArchived()), { [sword]: 3, [shield]: 2 });
	assert.deepEqual(fx.events, []);
});

test('only GMs request the summary index field, and only for world Actor packs', async () => {
	const fx = await archiveFixture();
	fx.addPack('world.archive', []);
	fx.addPack('module.actors', [], { packageType: 'module' });
	fx.game.user.isGM = false;
	await fx.loadArchiveIndex();
	assert.deepEqual(fx.events, []);
	fx.game.user.isGM = true;
	await fx.loadArchiveIndex();
	assert.deepEqual(fx.events, ['index world.archive: flags.item-linking.links']);
});

test('find items loads only matching and never-synced actors and repairs their summaries', async () => {
	const fx = await archiveFixture();
	const pack = fx.addPack('world.archive', [
		actorSource('holder', [inventoryItem('a'), inventoryItem('b', shield)], [shield, sword]),
		actorSource('stale', [inventoryItem('c', shield)], [sword]),
		actorSource('unsynced', [inventoryItem('d'), inventoryItem('unlinked', sword, false)]),
		actorSource('unrelated', [inventoryItem('e', shield)], [shield]),
	]);
	const items = await fx.findArchivedItems(sword);
	assert.deepEqual(plain(items.map((item) => item.uuid)), ['Actor.holder.Item.a', 'Actor.unsynced.Item.d']);
	assert.deepEqual(fx.events, [
		'load world.archive: holder, stale, unsynced',
		'update world.archive: stale, unsynced',
	]);
	assert.deepEqual(plain(pack.actors.get('stale').flags['item-linking'].links), [shield]);
	assert.deepEqual(plain(pack.actors.get('unsynced').flags['item-linking'].links), [sword]);
	assert.deepEqual(plain(fx.countArchived()), { [sword]: 2, [shield]: 3 });
});

test('locked packs are searched and counted for the session but never written', async () => {
	const fx = await archiveFixture();
	const pack = fx.addPack('world.locked', [actorSource('unsynced', [inventoryItem('a')])], { locked: true });
	const items = await fx.findArchivedItems(sword);
	assert.equal(items.length, 1);
	assert.deepEqual(fx.events, ['load world.locked: unsynced']);
	assert.equal(pack.actors.get('unsynced').flags['item-linking'], undefined);
	assert.deepEqual(plain(fx.countArchived()), { [sword]: 1 });
});

test('rebuild loads every unlocked world Actor pack and updates only outdated actors', async () => {
	const fx = await archiveFixture();
	fx.addPack('world.archive', [
		actorSource('current', [inventoryItem('a')], [sword]),
		actorSource('unsynced', [inventoryItem('b', shield)]),
		actorSource('empty', []),
	]);
	fx.addPack('world.locked', [actorSource('guard', [inventoryItem('c')])], { locked: true });
	assert.equal(await fx.rebuildArchiveLinks(), 2);
	assert.deepEqual(fx.events, [
		'load world.archive: current, unsynced, empty',
		'update world.archive: unsynced, empty',
	]);
	assert.equal(await fx.rebuildArchiveLinks(), 0);
});

test('actors created in an archive receive a summary and lose it when imported elsewhere', async () => {
	const fx = await archiveFixture();
	const pack = fx.addPack('world.archive', []);
	const archived = new fx.Actor(actorSource('new', [inventoryItem('a'), inventoryItem('b', shield, false)]));
	archived.compendium = pack;
	fx.hook('preCreateActor', archived);
	assert.deepEqual(plain(archived.flags['item-linking'].links), [sword]);
	const imported = new fx.Actor(actorSource('world', [inventoryItem('a')], [sword]));
	fx.hook('preCreateActor', imported);
	assert.deepEqual(plain(imported.flags['item-linking']), {});
});

test('inventory changes on an archived actor refresh its summary once, from the acting client', async () => {
	const fx = await archiveFixture();
	const pack = fx.addPack('world.archive', [actorSource('holder', [inventoryItem('a')], [sword, sword])]);
	const item = pack.actors.get('holder').items.get('a');
	fx.hook('deleteItem', item, {}, 'another-user');
	await tick();
	assert.deepEqual(fx.events, []);
	fx.hook('updateItem', item, {}, {}, 'gm');
	await tick();
	assert.deepEqual(fx.events, ['update world.archive: holder']);
	assert.deepEqual(plain(pack.actors.get('holder').flags['item-linking'].links), [sword]);
	const worldActor = new fx.Actor(actorSource('world', [inventoryItem('w')]));
	fx.hook('updateItem', worldActor.items.get('w'), {}, {}, 'gm');
	await tick();
	assert.equal(fx.events.length, 1);
});

test('summary updates reach index entries that did not have the field yet', async () => {
	const fx = await archiveFixture();
	const pack = fx.addPack('world.archive', [actorSource('holder', [inventoryItem('a')])]);
	const actor = pack.actors.get('holder');
	actor.updateSource({ 'flags.item-linking.links': [sword] });
	fx.hook('updateActor', actor, { name: 'renamed' });
	assert.deepEqual(plain(fx.countArchived()), {});
	fx.hook('updateActor', actor, { flags: { 'item-linking': { links: [sword] } } });
	assert.deepEqual(plain(fx.countArchived()), { [sword]: 1 });
});

test('an archived actor is serialized with its summary instead of an item self-link', async () => {
	const fx = await archiveFixture();
	const pack = fx.addPack('world.archive', [actorSource('holder', [inventoryItem('a')], [sword])]);
	const data = pack.actors.get('holder').toObject();
	assert.deepEqual(plain(data.flags['item-linking']), { links: [sword] });
});
