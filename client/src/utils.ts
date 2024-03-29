export function getElem<T extends HTMLElement>(selector: string): T {
    const element = document.querySelector(selector);
    if (!(element instanceof HTMLElement)) {
        throw new Error(`Unknown element with selector: ${selector}`);
    }
    return element as T;
}
