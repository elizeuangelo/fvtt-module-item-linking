import { TITLE } from './settings.js';
export const log = (message) => {
    console.log(`%c${TITLE} %c| ${message}`, 'color:orange;font-weight:bold', '');
};
export const warn = (message) => {
    console.warn(`%c${TITLE} %c| ${message}`, 'color:orange;font-weight:bold', '');
};
export const error = (message) => {
    console.error(`%c${TITLE} %c| ${message}`, 'color:orange;font-weight:bold', '');
};
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
