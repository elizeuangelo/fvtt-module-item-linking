import { TITLE, MODULE } from './settings.js';
export function debug(msg, ...args) {
    try {
        if (game.modules.get("_dev-mode")?.api?.getPackageDebugValue(MODULE, "boolean")) {
            console.log(`DEBUG | %c${TITLE}%c | ${msg}`, ...args);
        }
    }
    catch (e) {
        console.error(e.message);
    }
    return msg;
}
export function log(message, ...args) {
    try {
        message = `%c${TITLE}%c | ${message}`;
        console.log(message.replace("<br>", "\n"), ...args);
    }
    catch (e) {
        console.error(e.message);
    }
    return message;
}
export function notify(message, ...args) {
    try {
        message = `%c${TITLE}%c | ${message}`;
        ui.notifications?.notify(message);
        console.log(message.replace("<br>", "\n"), ...args);
    }
    catch (e) {
        console.error(e.message);
    }
    return message;
}
export function info(info, notify = false, ...args) {
    try {
        info = `%c${TITLE}%c | ${info}`;
        if (notify) {
            ui.notifications?.info(info);
        }
        console.log(info.replace("<br>", "\n"), ...args);
    }
    catch (e) {
        console.error(e.message);
    }
    return info;
}
export function warn(warning, notify = false, ...args) {
    try {
        warning = `%c${TITLE}%c | ${warning}`;
        if (notify) {
            ui.notifications?.warn(warning);
        }
        console.warn(warning.replace("<br>", "\n"), ...args);
    }
    catch (e) {
        console.error(e.message);
    }
    return warning;
}
export function error(error, notify = true, ...args) {
    try {
        error = `%c${TITLE}%c | ${error}`;
        if (notify) {
            ui.notifications?.error(error);
        }
        console.error(error.replace("<br>", "\n"), ...args);
    }
    catch (e) {
        console.error(e.message);
    }
    return new Error(error.replace("<br>", "\n"));
}
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
export function stringIsUuid(inId) {
    return typeof inId === "string" && (inId.match(/\./g) || []).length && !inId.endsWith(".");
}
export async function getCompendiumCollectionAsync(target, ignoreError = false, ignoreName = true) {
    let targetTmp = target;
    if (!targetTmp) {
        throw error(`CompendiumCollection is undefined`, true, targetTmp);
    }
    if (targetTmp instanceof CompendiumCollection) {
        return targetTmp;
    }
    if (targetTmp.document) {
        targetTmp = targetTmp.document;
    }
    if (targetTmp.uuid) {
        targetTmp = targetTmp.uuid;
    }
    if (targetTmp instanceof CompendiumCollection) {
        return targetTmp;
    }
    targetTmp = game.packs.get(targetTmp);
    if (!targetTmp && !ignoreName) {
        targetTmp = game.packs.getName(targetTmp);
    }
    if (!targetTmp) {
        if (ignoreError) {
            warn(`CompendiumCollection is not found`, false, targetTmp);
            return;
        }
        else {
            throw error(`CompendiumCollection is not found`, true, targetTmp);
        }
    }
    if (!(targetTmp instanceof CompendiumCollection)) {
        if (ignoreError) {
            warn(`Invalid CompendiumCollection`, true, targetTmp);
            return;
        }
        else {
            throw error(`Invalid CompendiumCollection`, true, targetTmp);
        }
    }
    return targetTmp;
}
export function getActorSync(target, ignoreError = false, ignoreName = true) {
    let targetTmp = target;
    if (!targetTmp) {
        throw error(`Actor is undefined`, true, targetTmp);
    }
    if (targetTmp instanceof Actor) {
        return targetTmp;
    }
    if (targetTmp.document) {
        targetTmp = targetTmp.document;
    }
    if (targetTmp.uuid) {
        targetTmp = targetTmp.uuid;
    }
    if (targetTmp instanceof Actor) {
        return targetTmp;
    }
    if (stringIsUuid(targetTmp)) {
        targetTmp = fromUuidSync(targetTmp);
    }
    else {
        targetTmp = game.actors.get(targetTmp);
        if (!targetTmp && !ignoreName) {
            targetTmp = game.actors.getName(targetTmp);
        }
    }
    if (!targetTmp) {
        if (ignoreError) {
            warn(`Actor is not found`, false, targetTmp);
            return;
        }
        else {
            throw error(`Actor is not found`, true, targetTmp);
        }
    }
    if (!(targetTmp instanceof Actor)) {
        if (ignoreError) {
            warn(`Invalid Actor`, true, targetTmp);
            return;
        }
        else {
            throw error(`Invalid Actor`, true, targetTmp);
        }
    }
    return targetTmp;
}
export async function getActorAsync(target, ignoreError = false, ignoreName = true) {
    let targetTmp = target;
    if (!targetTmp) {
        throw error(`Actor is undefined`, true, targetTmp);
    }
    if (targetTmp instanceof Actor) {
        return targetTmp;
    }
    if (targetTmp.document) {
        targetTmp = targetTmp.document;
    }
    if (targetTmp.uuid) {
        targetTmp = targetTmp.uuid;
    }
    if (targetTmp instanceof Actor) {
        return targetTmp;
    }
    if (stringIsUuid(targetTmp)) {
        targetTmp = await fromUuid(targetTmp);
    }
    else {
        targetTmp = game.actors.get(targetTmp);
        if (!targetTmp && !ignoreName) {
            targetTmp = game.actors.getName(targetTmp);
        }
    }
    if (!targetTmp) {
        if (ignoreError) {
            warn(`Actor is not found`, false, targetTmp);
            return;
        }
        else {
            throw error(`Actor is not found`, true, targetTmp);
        }
    }
    if (!(targetTmp instanceof Actor)) {
        if (ignoreError) {
            warn(`Invalid Actor`, true, targetTmp);
            return;
        }
        else {
            throw error(`Invalid Actor`, true, targetTmp);
        }
    }
    return targetTmp;
}
export function getItemSync(target, ignoreError = false, ignoreName = true) {
    let targetTmp = target;
    if (!targetTmp) {
        throw error(`Item is undefined`, true, targetTmp);
    }
    if (targetTmp instanceof Item) {
        return targetTmp;
    }
    if (targetTmp.document) {
        targetTmp = targetTmp.document;
    }
    if (targetTmp.uuid) {
        targetTmp = targetTmp.uuid;
    }
    if (targetTmp instanceof Item) {
        return targetTmp;
    }
    if (stringIsUuid(targetTmp)) {
        targetTmp = fromUuidSync(targetTmp);
    }
    else {
        targetTmp = game.items.get(targetTmp);
        if (!targetTmp && !ignoreName) {
            targetTmp = game.items.getName(targetTmp);
        }
    }
    if (!targetTmp) {
        if (ignoreError) {
            warn(`Item is not found`, false, targetTmp);
            return;
        }
        else {
            throw error(`Item is not found`, true, targetTmp);
        }
    }
    if (!(targetTmp instanceof Item)) {
        if (ignoreError) {
            warn(`Invalid Item`, true, targetTmp);
            return;
        }
        else {
            throw error(`Invalid Item`, true, targetTmp);
        }
    }
    return targetTmp;
}
export async function getItemAsync(target, ignoreError = false, ignoreName = true) {
    let targetTmp = target;
    if (!targetTmp) {
        throw error(`Item is undefined`, true, targetTmp);
    }
    if (targetTmp instanceof Item) {
        return targetTmp;
    }
    if (targetTmp.document) {
        targetTmp = targetTmp.document;
    }
    if (targetTmp.uuid) {
        targetTmp = targetTmp.uuid;
    }
    if (targetTmp instanceof Item) {
        return targetTmp;
    }
    if (stringIsUuid(targetTmp)) {
        targetTmp = await fromUuid(targetTmp);
    }
    else {
        targetTmp = game.items.get(targetTmp);
        if (!targetTmp && !ignoreName) {
            targetTmp = game.items.getName(targetTmp);
        }
    }
    if (!targetTmp) {
        if (ignoreError) {
            warn(`Item is not found`, false, targetTmp);
            return;
        }
        else {
            throw error(`Item is not found`, true, targetTmp);
        }
    }
    if (!(targetTmp instanceof Item)) {
        if (ignoreError) {
            warn(`Invalid Item`, true, targetTmp);
            return;
        }
        else {
            throw error(`Invalid Item`, true, targetTmp);
        }
    }
    return targetTmp;
}
