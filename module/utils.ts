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
export function parseAsArray(obj) {
    if(!obj) {
      return [];
    }
    let arr = [];
    if (typeof  obj === 'string' || obj instanceof String) {
      arr =  obj.split(",");
    } else if(obj.constructor === Array) {
      arr = obj;
    } else {
      arr = [obj];
    }
    return arr;
}
export function stringIsUuid(inId) {
    return typeof inId === "string" && (inId.match(/\./g) || []).length && !inId.endsWith(".");
}
export async function getCompendiumCollectionAsync(target, ignoreError) {
    if(!target) {
        ui.notifications.error(`CompendiumCollection is undefined`);
		return null;
    }
    if (target instanceof CompendiumCollection) {
      return target;
    }
    // This is just a patch for compatibility with others modules
    if (target.document) {
      target = target.document;
    }
    if (target instanceof CompendiumCollection) {
      return target;
    }
    if (stringIsUuid(target)) {
      target = await fromUuid(target);
    } else {
      target = game.packs.get(target) ?? game.packs.getName(target);
    }
    if(!target) {
      if(ignoreError) {
        warn(`CompendiumCollection is not found`);
        return null;
      } else {
        ui.notifications.error(`CompendiumCollection is not found`);
		return null;
      }
    }
    // Type checking
    if (!(target instanceof CompendiumCollection)) {
        ui.notifications.error(`Invalid CompendiumCollection`);
		return null;
    }
    return target;
}

export async function getActorAsync(target, ignoreError) {
    if(!target) {
		ui.notifications.error(`Actor is undefined`);
		return null;
    }
    if (target instanceof Actor) {
      return target;
    }
    // This is just a patch for compatibility with others modules
    if (target.document) {
      target = target.document;
    }
    if (target instanceof Actor) {
      return target;
    }
    if (stringIsUuid(target)) {
      target = await fromUuid(target);
    } else {
      target = game.actors.get(target) ?? game.actors.getName(target);
    }
    if(!target) {
      if(ignoreError) {
		warn(`Actor is not found`);
        return null;
      } else {
        ui.notifications.error(`Actor is not found`);
		return null;
      }
    }
    // Type checking
    if (!(target instanceof Actor)) {
        ui.notifications.error(`Invalid Actor`);
		return null;
    }
    return target;
}