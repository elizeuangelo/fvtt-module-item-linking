import { TITLE, MODULE } from './settings.js';

export function deletionKeys(original, other) {
    return Object.keys(original).reduce((obj, key) => {
        if (!(key in other)) {
            obj['-=' + key] = null;
            return obj;
        }
        const t0 = getType(original[key]);
        if (t0 !== 'Object')
            return obj;
        const inner = deletionKeys(original[key], other[key]);
        if (Object.keys(inner).length)
            obj[key] = inner;
        return obj;
    }, {});
}
export function isPrimaryItem(i) {
    return !i.parent?.token || i.parent.token.delta._source.items.includes(i._source);
}
export function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
export function parseAsArray(obj) {
    if (!obj) {
        return [];
    }
    let arr = [];
    if (typeof obj === 'string' || obj instanceof String) {
        arr = obj.split(",");
    }
    else if (obj.constructor === Array) {
        arr = obj;
    }
    else {
        arr = [obj];
    }
    return arr;
}