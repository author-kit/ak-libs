import { getConfig, getMetadata, localizeUrl } from '../../scripts/ak.js';
import { loadFragment } from '../fragment/fragment.js';

const config = getConfig();
const { libsBase } = config;

const FOOTER_PATH = `${libsBase}/fragments/nav/footer`;

/**
 * loads and decorates the footer
 * @param {Element} el The footer element
 */
export default async function init(el) {
  const footerMeta = getMetadata('footer');
  const path = footerMeta || FOOTER_PATH;
  const url = new URL(path);
  const localizedPath = localizeUrl({ config, url });
  const finishedPath = localizedPath ?? path;
  const fragment = await loadFragment(finishedPath);
  if (!fragment) {
    const p = document.createElement('p');
    p.textContent = `${localizedPath} not found.`;
    p.className = 'not-found';
    el.append(p);
    return;
  }
  fragment.classList.add('footer-content');

  const sections = [...fragment.querySelectorAll('.section')];

  const copyright = sections.pop();
  copyright.classList.add('section-copyright');

  const legal = sections.pop();
  legal.classList.add('section-legal');

  el.append(fragment);
}
