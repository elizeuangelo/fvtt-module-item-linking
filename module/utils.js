/**
 * Generates a new object that contains the keys from the original object that are not present in the other object.
 * @param {Object} original - The original object.
 * @param {Object} other - The other object.
 * @returns {Object} - The new object containing the deletion keys.
 */
export function deletionKeys(original, other) {
	return Object.keys(original).reduce((obj, key) => {
		if (!(key in other)) {
			obj['-=' + key] = null;
			return obj;
		}
		const t0 = foundry.utils.getType(original[key]);
		if (t0 !== 'Object') return obj;
		const inner = deletionKeys(original[key], other[key]);
		if (Object.keys(inner).length) obj[key] = inner;
		return obj;
	}, {});
}

/**
 * Checks if an item is a primary item.
 * @param {object} i - The item object to check.
 * @returns {boolean} - Returns true if the item is a primary item, false otherwise.
 */
export function isPrimaryItem(i) {
	return !i.parent?.token || Boolean(getActorItemSource(i) || getTokenDeltaItemSource(i));
}

export function getTokenDeltaItemSource(item) {
	const deltaItems = item.parent?.token?.delta?._source?.items;
	if (!deltaItems) return null;
	if (Array.isArray(deltaItems)) return deltaItems.find((i) => i._id === item.id) ?? null;
	return deltaItems.get?.(item.id)?._source ?? deltaItems[item.id] ?? null;
}

export function getActorItemSource(item) {
	const token = item.parent?.token;
	if (!token) return null;
	return game.actors.get(token.actorId)?.items.get(item.id)?._source ?? null;
}

export function getLocalItemSource(item) {
	const actorSource = getActorItemSource(item);
	const deltaSource = getTokenDeltaItemSource(item);
	if (!actorSource && !deltaSource) return item._source;
	const source = foundry.utils.deepClone(actorSource ?? item._source);
	if (deltaSource) {
		foundry.utils.mergeObject(source, foundry.utils.deepClone(deltaSource), {
			inplace: true,
			insertKeys: true,
			insertValues: true,
			overwrite: true,
			performDeletions: true,
		});
	}
	return source;
}

/**
 * Sleeps for a specified amount of time.
 * @param {number} ms - The number of milliseconds to sleep.
 * @returns {Promise<void>} A promise that resolves after the specified time.
 */
export function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Parses the given object as an array.
 * If the object is a string, it splits it by commas and returns an array.
 * If the object is already an array, it returns the same array.
 * If the object is neither a string nor an array, it wraps it in an array and returns it.
 * @param {string|Array|any} obj - The object to be parsed as an array.
 * @returns {Array} - The parsed array.
 */
export function parseAsArray(obj) {
	if (!obj) {
		return [];
	}
	let arr = [];
	if (typeof obj === 'string' || obj instanceof String) {
		arr = obj.split(',');
	} else if (obj.constructor === Array) {
		arr = obj;
	} else {
		arr = [obj];
	}
	return arr;
}
