import { getConfig } from '../ak.js';

const { libsBase, log } = getConfig();

const injectIcon = async (path) => {
  const resp = await fetch(path);
  if (!resp.ok) {
    log(`Could not fetch icon from ${path}`);
    return;
  }

  /** Create a hidden container to hold all icons */
  let container = document.querySelector('#icon-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'icon-container';
    document.body.append(container);
  }

  try {
    const text = await resp.text();
    const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
    const svg = doc.querySelector('svg');
    container.append(svg);
  } catch {
    log(`Could not make SVG from ${path}`);
  }
};

export default function loadIcons(icons) {
  for (const icon of icons) {
    const name = icon.classList[1].substring(5);

    // Async inject the icon into the DOM
    injectIcon(`${libsBase}/img/icons/${name}.svg`);

    // Reference it
    const svg = `<svg class="${icon.className}">
        <use href="#${name}"></use>
    </svg>`;
    icon.insertAdjacentHTML('afterend', svg);
    icon.remove();
  }
}
