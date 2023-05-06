export function findItem(code) {
    return fromUuid(code);
}
export async function stringifyItem(item) {
    let baseItem = null;
    while (item.baseItem !== null) {
        baseItem = await findItem(item.baseItem);
        if (baseItem === null)
            break;
        item = baseItem;
    }
    return item.uuid;
}
