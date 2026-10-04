import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './foundry-fixture.js';

const oldUuid = 'Compendium.world.old-items.Item.template';
const destination = { pack: 'world.new-items', keepId: true, relink: true };
const inventoryItem = (id, baseItem = oldUuid, isLinked = true) => ({
	_id: id, name: id, system: { quantity: 3 },
	flags: { 'item-linking': { baseItem, isLinked, custom: 'preserved' } },
});

async function moveFixture({ locked = false, items = [inventoryItem('linked')] } = {}) {
	const fx = await fixture();
	const events = [];
	const notifications = [];
	fx.context.ui = { notifications: Object.fromEntries(['info', 'warn', 'error'].map((level) => [
		level, (message) => notifications.push({ level, message }),
	])) };
	fx.game.packs = new Map();
	const actor = new fx.Actor({ _id: 'stored-actor', items });
	const pack = {
		collection: 'world.logged-off-players', documentName: 'Actor', locked,
		metadata: { packageType: 'world' },
		async getDocuments() { events.push('load actors'); return [actor]; },
		async configure() { assert.fail('compendium lock state was changed'); },
	};
	actor.compendium = pack;
	for (const item of actor.items.values()) {
		item.compendium = pack;
		item.setFlag = async (scope, key, value) => {
			assert.equal(pack.locked, false);
			// Persistence must finish before deletion, not just start before it.
			await new Promise((resolve) => setImmediate(resolve));
			fx.mergeObject(item._source, { [`flags.${scope}.${key}`]: value });
			events.push(`update ${item.id}`);
			return item;
		};
	}
	fx.game.packs.set(pack.collection, pack);
	const targetPack = {
		collection: destination.pack,
		getUuid: (id) => `Compendium.${destination.pack}.Item.${id}`,
	};
	fx.game.packs.set(targetPack.collection, targetPack);
	const template = new fx.Item({ _id: 'template', name: 'Template', flags: {} });
	template.uuid = oldUuid;
	template.toCompendium = () => template._source;
	fx.Item.create = async (_data, options) => {
		events.push('create destination');
		return { uuid: targetPack.getUuid(options.keepId ? template.id : 'generated-id') };
	};
	template.delete = async () => { events.push('delete source'); };
	const moves = await fx.load('moveToAnotherCompendium.js');
	return { ...fx, ...moves, actor, pack, template, events, notifications, targetPack, processor: {} };
}

test('single move updates loaded world items and unopened unlocked world actor packs before deleting the source', async () => {
	const fx = await moveFixture({ items: [
		inventoryItem('linked'), inventoryItem('disabled', oldUuid, false), inventoryItem('other', 'another-uuid'),
	] });
	const worldActor = new fx.Actor({ _id: 'world-actor', items: [inventoryItem('world-linked')] });
	const worldItem = worldActor.items.get('world-linked');
	worldItem.setFlag = async (scope, key, value) => {
		await new Promise((resolve) => setImmediate(resolve));
		fx.mergeObject(worldItem._source, { [`flags.${scope}.${key}`]: value });
		fx.events.push('update world');
	};
	fx.game.actors.set(worldActor.id, worldActor);
	const before = structuredClone(fx.actor.items.get('linked')._source);
	await fx.moveItem(fx.template, destination, fx.processor);
	const newUuid = fx.targetPack.getUuid('template');
	before.flags['item-linking'].baseItem = newUuid;
	assert.deepEqual(fx.actor.items.get('linked')._source, before);
	assert.equal(worldItem.getFlag('item-linking', 'baseItem'), newUuid);
	assert.equal(fx.actor.items.get('disabled').getFlag('item-linking', 'baseItem'), oldUuid);
	assert.equal(fx.actor.items.get('other').getFlag('item-linking', 'baseItem'), 'another-uuid');
	assert.deepEqual(fx.events, ['load actors', 'create destination', 'update world', 'update linked', 'delete source']);
	assert.equal(fx.pack.locked, false);
	assert.equal(fx.processor.label, 'Moving item... 100%');
});

test('single move uses the created UUID when keeping document IDs is disabled', async () => {
	const fx = await moveFixture({ locked: false });
	await fx.moveItem(fx.template, { ...destination, keepId: false }, fx.processor);
	assert.equal(fx.actor.items.get('linked').getFlag('item-linking', 'baseItem'), fx.targetPack.getUuid('generated-id'));
	assert.equal(fx.pack.locked, false);
	assert(!fx.events.includes('unlock'));
	assert(!fx.events.includes('lock'));
});

test('a failed inventory update preserves the lock state and retains the original item', async () => {
	const fx = await moveFixture();
	fx.actor.items.get('linked').setFlag = async () => { throw new Error('write failed'); };
	await assert.rejects(fx.moveItem(fx.template, destination, fx.processor), /write failed/);
	assert.equal(fx.pack.locked, false);
	assert.deepEqual(fx.events, ['load actors', 'create destination']);
});

test('relink disabled skips actor packs and their inventory updates', async () => {
	const fx = await moveFixture();
	fx.pack.getDocuments = () => assert.fail('actor pack was scanned');
	await fx.moveItem(fx.template, { ...destination, relink: false }, fx.processor);
	assert.equal(fx.actor.items.get('linked').getFlag('item-linking', 'baseItem'), oldUuid);
	assert.deepEqual(fx.events, ['create destination', 'delete source']);
});

test('no matching links leaves actor inventory unchanged', async () => {
	const fx = await moveFixture({ items: [inventoryItem('unrelated', 'another-uuid')] });
	await fx.moveItem(fx.template, destination, fx.processor);
	assert.deepEqual(fx.events, ['load actors', 'create destination', 'delete source']);
	assert.equal(fx.pack.locked, false);
	assert.equal(fx.actor.items.get('unrelated').getFlag('item-linking', 'baseItem'), 'another-uuid');
});

test('actor pack load errors abort before creating a copy or deleting the source', async () => {
	const fx = await moveFixture();
	fx.pack.getDocuments = async () => { throw new Error('read failed'); };
	await assert.rejects(fx.moveItem(fx.template, destination, fx.processor), /read failed/);
	assert.deepEqual(fx.events, []);
});

test('locked world Actor packs, module/system Actor packs, and non-Actor packs are never loaded', async () => {
	const fx = await moveFixture();
	for (const [collection, documentName, packageType, locked] of [
		['world.locked-actors', 'Actor', 'world', true],
		['module.actors', 'Actor', 'module', false],
		['system.actors', 'Actor', 'system', false],
		['world.items', 'Item', 'world', false],
		['world.journals', 'JournalEntry', 'world', false],
	]) {
		fx.game.packs.set(collection, {
			collection, documentName, metadata: { packageType }, locked,
			getDocuments() { assert.fail(`${collection} was scanned`); },
			configure() { assert.fail(`${collection} lock state was changed`); },
		});
	}
	await fx.moveItem(fx.template, destination, fx.processor);
	assert.equal(fx.actor.items.get('linked').getFlag('item-linking', 'baseItem'), fx.targetPack.getUuid('template'));
});

test('a locked world Actor pack with matching links is skipped', async () => {
	const fx = await moveFixture({ locked: true });
	fx.pack.getDocuments = () => assert.fail('locked pack was scanned');
	await fx.moveItem(fx.template, destination, fx.processor);
	assert.equal(fx.actor.items.get('linked').getFlag('item-linking', 'baseItem'), oldUuid);
	assert.equal(fx.pack.locked, true);
	assert.deepEqual(fx.events, ['create destination', 'delete source']);
});

test('every unlocked world Actor pack is scanned without relying on collection IDs', async () => {
	const fx = await moveFixture();
	const secondActor = new fx.Actor({ _id: 'second-actor', items: [inventoryItem('second-inventory')] });
	const secondItem = secondActor.items.get('second-inventory');
	secondItem.setFlag = async (scope, key, value) => {
		fx.mergeObject(secondItem._source, { [`flags.${scope}.${key}`]: value });
	};
	fx.game.packs.set('world.arbitrary-name', {
		collection: 'world.arbitrary-name', documentName: 'Actor', metadata: { packageType: 'world' }, locked: false,
		async getDocuments() { fx.events.push('load second actors'); return [secondActor]; },
		configure() { assert.fail('compendium lock state was changed'); },
	});
	await fx.moveItem(fx.template, destination, fx.processor);
	assert.equal(secondItem.getFlag('item-linking', 'baseItem'), fx.targetPack.getUuid('template'));
	assert.equal(fx.actor.items.get('linked').getFlag('item-linking', 'baseItem'), fx.targetPack.getUuid('template'));
	assert.equal(fx.events.filter((event) => event === 'load second actors').length, 1);
});

test('a pack locked after scanning aborts relinking without unlocking it or deleting the source', async () => {
	const fx = await moveFixture();
	const create = fx.Item.create;
	fx.Item.create = async (...args) => { fx.pack.locked = true; return create(...args); };
	await assert.rejects(fx.moveItem(fx.template, destination, fx.processor), /was locked during the move/);
	assert.equal(fx.pack.locked, true);
	assert.deepEqual(fx.events, ['load actors', 'create destination']);
});

async function folderFixture() {
	const secondUuid = 'Compendium.world.old-items.Item.second';
	const fx = await moveFixture({ items: [inventoryItem('linked'), inventoryItem('second-link', secondUuid)] });
	const sourcePack = {
		getUuid: (id) => `Compendium.world.old-items.Item.${id}`,
		async getDocuments({ folder }) { return [{ id: folder === 'root' ? 'template' : 'second' }]; },
	};
	fx.context.Folder = { async create() { return { id: 'target-folder' }; } };
	fx.folder = {
		id: 'root', name: 'Folder', compendium: sourcePack,
		children: [{ folder: { id: 'child', compendium: sourcePack, children: [] } }],
		async exportToCompendium() { fx.events.push('export folder'); },
		async delete(options) {
			assert.equal(options.deleteSubfolders, true);
			assert.equal(options.deleteContents, true);
			fx.events.push('delete folder');
		},
	};
	return fx;
}

test('folder moves scan unlocked world actors once and relink items from the folder and its children', async () => {
	const fx = await folderFixture();
	assert.equal(await fx.moveFolder(fx.folder, destination, fx.processor), true);
	assert.equal(fx.actor.items.get('linked').getFlag('item-linking', 'baseItem'), fx.targetPack.getUuid('template'));
	assert.equal(fx.actor.items.get('second-link').getFlag('item-linking', 'baseItem'), fx.targetPack.getUuid('second'));
	assert.deepEqual(fx.events, ['load actors', 'export folder', 'update linked', 'update second-link', 'delete folder']);
	assert.equal(fx.processor.label, 'Moving folder... 100%');
});

test('folder update failures preserve the lock state and retain the source folder', async () => {
	const fx = await folderFixture();
	fx.actor.items.get('linked').setFlag = async () => { throw new Error('write failed'); };
	assert.equal(await fx.moveFolder(fx.folder, destination, fx.processor), false);
	assert.equal(fx.pack.locked, false);
	assert(!fx.events.includes('delete folder'));
	assert(fx.notifications.some(({ level }) => level === 'error'));
});
