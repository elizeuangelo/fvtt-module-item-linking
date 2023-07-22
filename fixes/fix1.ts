import { error } from '../module/utils.js';
import { setFlag } from '../module/flags.js';
import { findDerived } from '../module/item.js';

export async function fix1() {
	const rgx = /^(Compendium.[\w-]+.[\w-]+\.)(\w+)$/;
	const derivations = findDerived();
	const promises: Promise<any>[] = [];
	Object.entries(derivations).forEach(([key, items]) => {
		const match = rgx.exec(key);
		if (match === null) return;
		const new_key = match[1] + 'Item.' + match[2];
		items.forEach((i) => promises.push(setFlag(i, 'baseItem', new_key)));
	});
	return Promise.all(promises);
}
