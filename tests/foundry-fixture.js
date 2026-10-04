import { readFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import vm from 'node:vm';

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const getProperty = (value, path) => path.split('.').reduce((object, key) => object?.[key], value);

function setProperty(value, path, data) {
	const parts = path.split('.');
	let object = value;
	for (const part of parts.slice(0, -1)) object = object[part] ??= {};
	object[parts.at(-1)] = data;
}

function expandObject(source) {
	const expanded = {};
	for (const [path, value] of Object.entries(source)) {
		setProperty(expanded, path, isObject(value) ? expandObject(value) : structuredClone(value));
	}
	return expanded;
}

function mergeObject(target, source, options = {}) {
	if (options.inplace === false) target = structuredClone(target);
	for (const [key, value] of Object.entries(expandObject(source))) {
		if (key.startsWith('-=')) {
			delete target[key.slice(2)];
			continue;
		}
		if (isObject(value) && isObject(target[key])) mergeObject(target[key], value, options);
		else target[key] = structuredClone(value);
	}
	return target;
}

function diffObject(before, after) {
	const output = {};
	for (const [key, value] of Object.entries(after)) {
		if (isDeepStrictEqual(before[key], value)) continue;
		output[key] = isObject(value) && isObject(before[key]) ? diffObject(before[key], value) : structuredClone(value);
	}
	for (const key of Object.keys(before)) if (!(key in after)) output[`-=${key}`] = null;
	return output;
}

function flattenObject(object, prefix = '', output = {}) {
	for (const [key, value] of Object.entries(object)) {
		const path = prefix ? `${prefix}.${key}` : key;
		if (isObject(value)) flattenObject(value, path, output);
		else output[path] = value;
	}
	return output;
}

function collection(values = []) {
	const result = new Map(values.map((value) => [value.id, value]));
	Object.defineProperty(result, 'contents', { get: () => [...result.values()] });
	return result;
}

// Only Foundry's host APIs are mocked. The linking, serialization, actor-copy,
// and token-source modules under test are loaded unchanged as ES modules.
export async function fixture() {
	const settings = { linkHeader: true, linkPropertyExceptions: '', enforceActorsFXs: false };
	const hooks = new Map();
	const readyHooks = [];
	const game = { actors: collection(), items: collection(), scenes: { contents: [] }, user: { id: 'gm', isGM: true } };
	class Document {
		getFlag(moduleId, key) { return getProperty(this._source, `flags.${moduleId}.${key}`); }
		get name() { return this._source.name; }
		toDragData() { return { type: this.constructor.name, uuid: this.uuid }; }
		_createDocumentLink(eventData, { relativeTo, label } = {}) {
			const uuid = relativeTo && relativeTo === this.parent ? `.Item.${this.id}` : this.uuid;
			return `@UUID[${uuid}]{${label ?? this.name}}`;
		}
	}
	class Actor extends Document {
		constructor(source = { _id: 'actor', items: [] }, token) {
			super();
			this._source = structuredClone(source);
			this.id = source._id;
			this.uuid = token ? `Scene.test.Token.${token.id}.Actor.${this.id}` : `Actor.${this.id}`;
			this.token = token;
			this.items = collection((source.items ?? []).map((data) => new Item(data, this)));
		}
		static async createDocuments(data) { return data.map((source) => new Actor(source)); }
	}
	class Item extends Document {
		static metadata = { embedded: { ActiveEffect: 'effects' } };
		static get implementation() { return this; }
		static shimData(data) { return data; }
		static async fromDropData(data) { return data.data ? new this(data.data) : documents.get(data.uuid); }
		constructor(source, parent) {
			super();
			this._source = structuredClone(source);
			this.id = source._id;
			this.parent = parent;
			this.uuid = parent ? `${parent.uuid}.Item.${this.id}` : `Item.${this.id}`;
		}
		updateSource(changes) { mergeObject(this._source, changes); }
		prepareFinalAttributes() {}
	}
	const documents = new Map();
	const TextEditor = {
		async getContentLink(eventData, options = {}) {
			const cls = { Item, Actor }[eventData.type];
			if (!cls) return null;
			const document = await cls.fromDropData(eventData);
			return document?._createDocumentLink(eventData, options) ?? null;
		},
	};
	const context = vm.createContext({
		console, structuredClone, game, randomID: () => 'copied-actor', fromUuid: async (uuid) => documents.get(uuid),
		CONFIG: { Actor: { documentClass: Actor }, Item: { documentClass: Item } },
		Hooks: {
			on(name, callback) { const callbacks = hooks.get(name) ?? []; callbacks.push(callback); hooks.set(name, callbacks); },
			once(name, callback) { if (name === 'ready') readyHooks.push(callback); },
		},
		foundry: {
			abstract: { Document, DataModel: { prototype: { toObject() { return structuredClone(this._source); } } } },
			utils: {
				getType: (value) => value === null ? 'null' : Array.isArray(value) ? 'Array' : isObject(value) ? 'Object' : typeof value,
				deepClone: structuredClone, getProperty, setProperty, expandObject, mergeObject, diffObject, flattenObject,
				isEmpty: (value) => Object.keys(value).length === 0,
			},
		},
	});
	const systemSource = await readFile(new URL('../module/systems/dnd5e.js', import.meta.url), 'utf8');
	const keep = vm.runInNewContext(systemSource.match(/export const KEEP = \[[\s\S]*?\];/)[0].replace('export ', '') + '\nKEEP;');
	const stubs = new Map([
		['settings.js', { MODULE_ID: 'item-linking', getSetting: (key) => settings[key] }],
		['system.js', { keepPropertiesOverride: (data) => [...keep, ...(data.flags?.['item-linking']?.linkPropertyExceptions ?? '').split(',').filter(Boolean)] }],
		['flags.js', { getFlag: (item, key) => item.getFlag('item-linking', key) }],
		['lib/Logger.js', { default: { warn() {} } }],
	]);
	const modules = new Map();
	async function getModule(url) {
		if (modules.has(url.href)) return modules.get(url.href);
		const stub = [...stubs].find(([suffix]) => url.href.endsWith(`/module/${suffix}`))?.[1];
		const module = stub ? new vm.SyntheticModule(Object.keys(stub), function () {
			for (const [key, value] of Object.entries(stub)) this.setExport(key, value);
		}, { context, identifier: url.href }) : new vm.SourceTextModule(await readFile(url, 'utf8'), { context, identifier: url.href });
		modules.set(url.href, module);
		return module;
	}
	async function load(path) {
		const module = await getModule(new URL(`../module/${path}`, import.meta.url));
		if (module.status === 'unlinked') await module.link((specifier, parent) => getModule(new URL(specifier, parent.identifier)));
		if (module.status === 'linked') await module.evaluate();
		return module.namespace;
	}
	const data = await load('link-data.js');
	const resolver = (await load('link-resolver.js')).default;
	await load('core.js');
	return { settings, hooks, readyHooks, game, Actor, Item, TextEditor, documents, data, resolver, load, mergeObject };
}
