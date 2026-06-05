import { loadStyle, getConfig } from '../ak.js';
import ENV from './env.js';

const { libsBase } = getConfig();

export default async function error(ex, el) {
  // eslint-disable-next-line no-console
  console.log(ex);
  if (el && ENV !== 'prod') {
    await loadStyle(`${libsBase}/styles/error.css`);
    const wrapper = document.createElement('div');
    wrapper.className = 'has-error';

    const title = document.createElement('p');
    title.style = 'margin: 0;';
    title.className = 'title';
    title.textContent = 'Error';

    const desc = document.createElement('p');
    desc.style = 'font-size: 12px; margin: 0;';
    desc.textContent = ex;

    el.insertAdjacentElement('afterend', wrapper);
    wrapper.append(title, desc, el);
  }
}
