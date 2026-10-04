import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './foundry-fixture.js';

const baseUuid = 'Compendium.world.items.Item.template';
const source = (flags = {}) => ({
	_id: 'local-item', name: 'Custom item name',
	flags: { 'item-linking': { isLinked: true, baseItem: baseUuid, ...flags } },
});

async function readyFixture() {
	const fx = await fixture();
	for (const ready of fx.readyHooks) await ready();
	return fx;
}

test('chat and editor drops reference the base UUID for world, actor, and synthetic-token items', async () => {
	const fx = await readyFixture();
	const actor = new fx.Actor({ _id: 'actor', items: [source()] });
	const tokenActor = new fx.Actor({ _id: 'actor', items: [source()] }, { id: 'token' });
	const items = [new fx.Item(source()), actor.items.get('local-item'), tokenActor.items.get('local-item')];
	for (const item of items) {
		fx.documents.set(item.uuid, item);
		const dragData = item.toDragData();
		const expected = `@UUID[${baseUuid}]{Custom item name}`;
		assert.equal(await fx.TextEditor.getContentLink(dragData), expected);
		assert.equal(await fx.TextEditor.getContentLink(dragData, { relativeTo: item.parent ?? item }), expected);
		assert.equal(dragData.uuid, item.uuid);
		assert.equal(await fx.Item.fromDropData(dragData), item);
	}
});

test('ProseMirror custom labels are preserved, including an empty label', async () => {
	const fx = await readyFixture();
	const item = new fx.Item(source());
	fx.documents.set(item.uuid, item);
	for (const label of ['Selected editor text', '']) {
		assert.equal(await fx.TextEditor.getContentLink(item.toDragData(), { label }), `@UUID[${baseUuid}]{${label}}`);
	}
});

test('a drop containing inline item data also references its base without loading the template', async () => {
	const fx = await readyFixture();
	assert.equal(await fx.TextEditor.getContentLink({ type: 'Item', data: source() }), `@UUID[${baseUuid}]{Custom item name}`);
	assert.equal(fx.documents.size, 0);
});

test('unlinked and incomplete links delegate to the original method with its receiver and options', async () => {
	const fx = await fixture();
	const calls = [];
	fx.Item.prototype._createDocumentLink = function (...args) {
		calls.push({ item: this, args });
		return 'original-system-link';
	};
	for (const ready of fx.readyHooks) await ready();
	for (const flags of [{ isLinked: false }, { baseItem: null }, { baseItem: '' }]) {
		const item = new fx.Item(source(flags));
		const eventData = item.toDragData();
		const options = { relativeTo: item, label: 'Custom label' };
		assert.equal(item._createDocumentLink(eventData, options), 'original-system-link');
		const call = calls.at(-1);
		assert.equal(call.item, item);
		assert.equal(call.args[0], eventData);
		assert.equal(call.args[1], options);
	}
});

test('compendium items keep their own UUID even if they have old linking flags', async () => {
	const fx = await readyFixture();
	const item = new fx.Item(source());
	item.compendium = 'world.other-items';
	item.uuid = 'Compendium.world.other-items.Item.other-template';
	assert.equal(item._createDocumentLink(item.toDragData()), `@UUID[${item.uuid}]{Custom item name}`);
});

test('unlinked items keep Foundry relative links and labels', async () => {
	const fx = await readyFixture();
	const actor = new fx.Actor({ _id: 'actor', items: [source({ isLinked: false })] });
	const item = actor.items.get('local-item');
	fx.documents.set(item.uuid, item);
	assert.equal(await fx.TextEditor.getContentLink(item.toDragData()), `@UUID[${item.uuid}]{Custom item name}`);
	assert.equal(await fx.TextEditor.getContentLink(item.toDragData(), { relativeTo: actor, label: 'Label' }), '@UUID[.Item.local-item]{Label}');
});
