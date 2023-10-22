import { TITLE } from './settings.js';

export const log = (message: string) => {
	console.log(`%c${TITLE} %c| ${message}`, 'color:orange;font-weight:bold', '');
};
export const warn = (message: string) => {
	console.warn(`%c${TITLE} %c| ${message}`, 'color:orange;font-weight:bold', '');
};
export const error = (message: string) => {
	console.error(`%c${TITLE} %c| ${message}`, 'color:orange;font-weight:bold', '');
};

export function deletionKeys(original: Object, other: Object) {
	// Recursively call the _difference function
	return Object.keys(original).reduce((obj, key) => {
		if (!(key in other)) {
			obj['-=' + key] = null;
			return obj;
		}
		const t0 = getType(original[key]);
		//const t1 = getType(other[key]);

		if (t0 !== 'Object') return obj;

		const inner = deletionKeys(original[key], other[key]);
		if (Object.keys(inner).length) obj[key] = inner;
		return obj;
	}, {});
}

export function isPrimaryItem(i: ItemExtended) {
	return !i.parent?.token || i.parent!.token!.delta._source.items.includes(i._source);
}

export function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
