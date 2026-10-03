import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fixture } from './foundry-fixture.js';

const feats = JSON.parse(await readFile(new URL('./fixtures/feat-effects.json', import.meta.url), 'utf8'));
const selections = { Resilient: 'Resilient (Con)', 'Skill Expert': 'Skill Expert (Wis)', Slasher: 'Slasher (Str)' };
const findEffect = (data, id) => data.effects.find((effect) => effect._id === id);

function selectEffect(template) {
	const local = structuredClone(template);
	const selected = local.effects.find((effect) => effect.name === selections[template.name]);
	selected.disabled = false;
	return { local, id: selected._id };
}

function registerBase(fx, source) {
	const base = new fx.Item(source);
	base.uuid = source.flags['item-linking'].baseItem;
	base.compendium = 'world.v3-feats';
	fx.documents.set(base.uuid, base);
	fx.resolver.setCachedBaseSource(base);
	return base;
}

function actorItem(fx, source, id = 'actor') {
	const actor = new fx.Actor({ _id: id, items: [source] });
	fx.game.actors.set(actor.id, actor);
	return actor.items.get(source._id);
}

for (const template of feats) {
	test(`${template.name}: startup and item refresh preserve the chosen variant while syncing its bonus`, async () => {
		const fx = await fixture();
		const { local, id } = selectEffect(template);
		const source = structuredClone(template);
		findEffect(source, id).changes[0].value = '2';
		const base = registerBase(fx, source);
		const item = actorItem(fx, local);
		await fx.resolver.hydrateAll();
		assert.equal(findEffect(item._source, id).disabled, false);
		assert.equal(findEffect(item._source, id).changes[0].value, '2');
		assert.equal(findEffect(item._source, id).origin, item.uuid);
		assert(item._source.effects.filter((effect) => effect.transfer && effect._id !== id).every((effect) => effect.disabled));
		await fx.resolver.hydrateItem(item);
		assert.equal(findEffect(item._source, id).disabled, false);
		assert.equal(findEffect(base._source, id).disabled, true);
	});

	test(`${template.name}: export and unlink retain the selection and updated definition`, async () => {
		const fx = await fixture();
		const { local, id } = selectEffect(template);
		const source = structuredClone(template);
		findEffect(source, id).changes[0].value = '2';
		registerBase(fx, source);
		const item = actorItem(fx, local);
		const exported = item.toObject(true);
		assert.equal(findEffect(exported, id).disabled, false);
		assert.equal(findEffect(exported, id).changes[0].value, '2');
		assert.equal(findEffect(item._source, id).changes[0].value, '1');
		const unlinked = await fx.resolver.createUnlinkUpdate(item);
		assert.equal(findEffect(unlinked, id).disabled, false);
		assert.equal(findEffect(unlinked, id).changes[0].value, '2');
		assert.equal(unlinked['flags.item-linking.isLinked'], false);
	});
}

test('matching by ID handles renamed/reordered effects and source additions/deletions', async () => {
	const fx = await fixture();
	const { local, id } = selectEffect(feats[0]);
	const source = structuredClone(feats[0]);
	const removedId = source.effects.find((effect) => effect._id !== id)._id;
	source.effects = source.effects.filter((effect) => effect._id !== removedId).reverse();
	findEffect(source, id).name = 'Renamed variant';
	source.effects.push({ _id: 'new-effect', name: 'New effect', disabled: true, transfer: true, changes: [] });
	const base = registerBase(fx, source);
	const item = actorItem(fx, local);
	await fx.resolver.hydrateItem(item);
	assert.equal(findEffect(item._source, id).disabled, false);
	assert.equal(findEffect(item._source, id).name, 'Renamed variant');
	assert.equal(findEffect(item._source, 'new-effect').disabled, true);
	assert.equal(findEffect(item._source, removedId), undefined);
	assert.equal(findEffect(base._source, id).disabled, true);
});

test('a locally disabled effect stays disabled when the template is enabled', async () => {
	const fx = await fixture();
	const local = structuredClone(feats[0]);
	const source = structuredClone(local);
	const id = source.effects[0]._id;
	findEffect(source, id).disabled = false;
	registerBase(fx, source);
	const item = actorItem(fx, local);
	await fx.resolver.hydrateItem(item);
	assert.equal(findEffect(item._source, id).disabled, true);
});

test('the updateItem hook refreshes definitions without resetting the selected variant', async () => {
	const fx = await fixture();
	const { local, id } = selectEffect(feats[0]);
	const source = structuredClone(feats[0]);
	findEffect(source, id).changes[0].value = '2';
	registerBase(fx, source);
	const item = actorItem(fx, local);
	await fx.load('item.js');
	for (const update of fx.hooks.get('updateItem')) update(item, { 'system.uses.value': 1 });
	await new Promise(setImmediate);
	assert.equal(findEffect(item._source, id).disabled, false);
	assert.equal(findEffect(item._source, id).changes[0].value, '2');
});

test('refreshing the source compendium updates every linked actor while keeping their own toggles', async () => {
	const fx = await fixture();
	const { local, id } = selectEffect(feats[0]);
	const base = registerBase(fx, feats[0]);
	const enabledItem = actorItem(fx, local, 'enabled-actor');
	const disabledItem = actorItem(fx, feats[0], 'disabled-actor');
	findEffect(base._source, id).changes[0].value = '2';
	await fx.resolver.refreshBaseItem(base, { render: false });
	assert.equal(findEffect(enabledItem._source, id).disabled, false);
	assert.equal(findEffect(disabledItem._source, id).disabled, true);
	assert.equal(findEffect(enabledItem._source, id).changes[0].value, '2');
	assert.equal(findEffect(disabledItem._source, id).changes[0].value, '2');
});

test('world items continue inheriting template disabled defaults in refresh, export, and unlink', async () => {
	const fx = await fixture();
	const { local, id } = selectEffect(feats[0]);
	registerBase(fx, feats[0]);
	const item = new fx.Item(local);
	assert.equal(findEffect(item.toObject(), id).disabled, true);
	assert.equal(findEffect(await fx.resolver.createUnlinkUpdate(item), id).disabled, true);
	await fx.resolver.hydrateItem(item);
	assert.equal(findEffect(item._source, id).disabled, true);
});

test('compendium documents serialize their own effect defaults', async () => {
	const fx = await fixture();
	const { local, id } = selectEffect(feats[0]);
	const item = new fx.Item(local);
	item.compendium = 'world.v3-feats';
	registerBase(fx, feats[0]);
	assert.equal(findEffect(item.toObject(), id).disabled, false);
	assert.equal(await fx.resolver.hydrateItem(item), false);
});

test('duplicating an actor preserves all three selections while syncing definitions', async () => {
	const fx = await fixture();
	const locals = feats.map((template) => {
		const { local, id } = selectEffect(template);
		const source = structuredClone(template);
		findEffect(source, id).changes[0].value = '2';
		registerBase(fx, source);
		return { local, id };
	});
	await fx.load('actor.js');
	for (const ready of [...fx.readyHooks, ...(fx.hooks.get('ready') ?? [])]) await ready();
	const copy = await fx.Actor.create({ _id: 'original', items: locals.map(({ local }) => local) }, {});
	assert.equal(copy.id, 'copied-actor');
	for (const { local, id } of locals) {
		const copied = copy.items.get(local._id);
		assert.equal(findEffect(copied._source, id).disabled, false);
		assert.equal(findEffect(copied._source, id).changes[0].value, '2');
	}
});

test('unlink includes a pending effect toggle', async () => {
	const fx = await fixture();
	const { local, id } = selectEffect(feats[0]);
	registerBase(fx, feats[0]);
	const item = actorItem(fx, local);
	const effects = structuredClone(local.effects);
	findEffect({ effects }, id).disabled = true;
	const unlinked = await fx.resolver.createUnlinkUpdate(item, { effects });
	assert.equal(findEffect(unlinked, id).disabled, true);
});

test('synthetic actors inherit their base actor selection without sharing template defaults', async () => {
	const fx = await fixture();
	const { local, id } = selectEffect(feats[0]);
	registerBase(fx, feats[0]);
	const originalItem = actorItem(fx, local, 'original');
	const token = { id: 'token', actorId: 'original', delta: { _source: { items: [] } } };
	const synthetic = new fx.Actor({ _id: 'original', items: [feats[0]] }, token);
	const item = synthetic.items.get(local._id);
	assert.equal(findEffect(item.toObject(), id).disabled, false);
	await fx.resolver.hydrateItem(item);
	assert.equal(findEffect(item._source, id).disabled, false);
	assert.equal(findEffect(originalItem._source, id).disabled, false);
});

test('synthetic token overrides remain distinct from the base actor selection', async () => {
	const fx = await fixture();
	const { local, id } = selectEffect(feats[0]);
	registerBase(fx, feats[0]);
	const originalItem = actorItem(fx, local, 'original');
	const tokenLocal = structuredClone(local);
	findEffect(tokenLocal, id).disabled = true;
	const token = { id: 'token', actorId: 'original', delta: { _source: { items: [tokenLocal] } } };
	const synthetic = new fx.Actor({ _id: 'original', items: [local] }, token);
	const item = synthetic.items.get(local._id);
	await fx.resolver.hydrateItem(item);
	assert.equal(findEffect(item._source, id).disabled, true);
	assert.equal(findEffect(item.toObject(), id).disabled, true);
	assert.equal(findEffect(await fx.resolver.createUnlinkUpdate(item), id).disabled, true);
	assert.equal(findEffect(originalItem._source, id).disabled, false);
});

test('missing IDs or disabled fields use template defaults; suppression stays source-defined', async () => {
	const fx = await fixture();
	const source = { effects: [{ _id: 'first', disabled: true, isSuppressed: false }, { _id: 'second', disabled: false }] };
	const local = { effects: [{ disabled: false }, { _id: 'first', isSuppressed: true }, { _id: 'second', disabled: 'true' }] };
	const result = fx.data.createEffectiveSource(local, source, false, { preserveEffectState: true });
	assert.equal(findEffect(result, 'first').disabled, true);
	assert.equal(findEffect(result, 'first').isSuppressed, false);
	assert.equal(findEffect(result, 'second').disabled, false);
	assert.doesNotThrow(() => fx.data.createEffectiveSource({}, source, false, { preserveEffectState: true }));
});

test('an explicit whole-effects exception still preserves the collection as before', async () => {
	const fx = await fixture();
	fx.settings.linkPropertyExceptions = 'effects';
	const { local, id } = selectEffect(feats[0]);
	const source = structuredClone(feats[0]);
	findEffect(source, id).changes[0].value = '2';
	registerBase(fx, source);
	const item = actorItem(fx, local);
	await fx.resolver.hydrateItem(item);
	assert.equal(findEffect(item._source, id).disabled, false);
	assert.equal(findEffect(item._source, id).changes[0].value, '1');
});
