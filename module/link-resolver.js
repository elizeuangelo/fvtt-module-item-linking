import { MODULE_ID } from './settings.js';
import { createEffectiveSource, createUnlinkUpdate, mergePendingUpdate } from './link-data.js';
import { isPrimaryItem } from './utils.js';
import Logger from './lib/Logger.js';

class LinkedItemResolver {
	static #baseSources = new Map();
	static #basePromises = new Map();

	static isLinked(item) {
		return Boolean(item?.getFlag?.(MODULE_ID, 'isLinked') && item?.getFlag?.(MODULE_ID, 'baseItem'));
	}

	static getBaseUuid(item) {
		return item?.getFlag?.(MODULE_ID, 'baseItem') ?? null;
	}

	static getCachedBaseSource(uuid) {
		return this.#baseSources.get(uuid) ?? null;
	}

	static setCachedBaseSource(item) {
		if (!item?.uuid || !item?._source) return null;
		const source = foundry.utils.deepClone(item._source);
		this.#baseSources.set(item.uuid, source);
		return source;
	}

	static invalidate(uuid) {
		if (!uuid) return;
		this.#baseSources.delete(uuid);
		this.#basePromises.delete(uuid);
	}

	static async getBaseItem(uuid) {
		if (!uuid) return null;
		if (this.#basePromises.has(uuid)) return this.#basePromises.get(uuid);
		const promise = fromUuid(uuid)
			.then((item) => {
				if (item) this.setCachedBaseSource(item);
				return item;
			})
			.catch((err) => {
				Logger.warn(`Failed to retrieve linked base item ${uuid}`, false, err);
				return null;
			})
			.finally(() => this.#basePromises.delete(uuid));
		this.#basePromises.set(uuid, promise);
		return promise;
	}

	static async getBaseSource(uuid) {
		if (!uuid) return null;
		const cached = this.getCachedBaseSource(uuid);
		if (cached) return cached;
		const item = await this.getBaseItem(uuid);
		return item?._source ? foundry.utils.deepClone(item._source) : null;
	}

	static getLinkedItems() {
		const items = game.items?.contents ?? [];
		const tokens = (game.scenes?.contents ?? [])
			.map((s) => s.tokens.contents.filter((t) => t.isLinked === false && t.actor).map((t) => t.actor))
			.flat();
		const embedded = [...(game.actors?.values() ?? []), ...tokens]
			.map((a) => a.items.contents)
			.flat()
			.filter(Boolean);
		return [...items, ...embedded].filter((item) => this.isLinked(item) && isPrimaryItem(item));
	}

	static async hydrateItem(item, { render = false } = {}) {
		if (!this.isLinked(item) || item.compendium) return false;
		const baseUuid = this.getBaseUuid(item);
		const baseSource = await this.getBaseSource(baseUuid);
		if (!baseSource) return false;
		this.applyBaseSource(item, baseSource);
		if (render) this.renderItem(item);
		return true;
	}

	static hydrateItemFromCache(item, { render = false } = {}) {
		if (!this.isLinked(item) || item.compendium) return false;
		const baseSource = this.getCachedBaseSource(this.getBaseUuid(item));
		if (!baseSource) return false;
		this.applyBaseSource(item, baseSource);
		if (render) this.renderItem(item);
		return true;
	}

	static applyBaseSource(item, baseSource) {
		const effective = createEffectiveSource(item._source, baseSource, false, { origin: item.uuid });
		const changes = foundry.utils.diffObject(item._source, effective, { deletionKeys: true });
		if (foundry.utils.isEmpty(changes)) return false;
		item.updateSource(changes, { recursive: true });
		return true;
	}

	static async hydrateAll({ render = false } = {}) {
		const linked = this.getLinkedItems();
		const baseUuids = new Set(linked.map((item) => this.getBaseUuid(item)).filter(Boolean));
		await Promise.all([...baseUuids].map((uuid) => this.getBaseSource(uuid)));
		for (const item of linked) this.hydrateItemFromCache(item, { render });
		return linked.length;
	}

	static async hydrateDerivations(baseUuid, { render = true } = {}) {
		if (!baseUuid) return 0;
		const baseSource = await this.getBaseSource(baseUuid);
		if (!baseSource) return 0;
		let count = 0;
		for (const item of this.getLinkedItems()) {
			if (this.getBaseUuid(item) !== baseUuid) continue;
			if (this.applyBaseSource(item, baseSource)) count++;
			if (render) this.renderItem(item);
		}
		return count;
	}

	static async refreshBaseItem(baseItem, { render = true } = {}) {
		if (!baseItem?.uuid) return 0;
		this.invalidate(baseItem.uuid);
		this.setCachedBaseSource(baseItem);
		return this.hydrateDerivations(baseItem.uuid, { render });
	}

	static async createUnlinkUpdate(item, changes = {}) {
		const expandedChanges = foundry.utils.expandObject(foundry.utils.deepClone(changes));
		const baseUuid = expandedChanges.flags?.[MODULE_ID]?.baseItem ?? this.getBaseUuid(item);
		const pending = mergePendingUpdate(item._source, changes);
		const baseSource = await this.getBaseSource(baseUuid);
		if (!baseSource) {
			const update = foundry.utils.flattenObject(pending);
			update[`flags.${MODULE_ID}.baseItem`] = baseUuid ?? null;
			update[`flags.${MODULE_ID}.isLinked`] = false;
			return update;
		}
		return createUnlinkUpdate(pending, baseSource, { origin: item.uuid });
	}

	static renderItem(item) {
		item.sheet?.rendered && item.sheet.render(false);
		item.parent?.sheet?.rendered && item.parent.sheet.render(false);
	}
}

export default LinkedItemResolver;
