export function getElem(selector: string): HTMLElement {
    const element = document.querySelector(selector);
    if (!element) throw new Error(`Unknown element with selector: ${selector}`);
    return element as HTMLElement;
}
