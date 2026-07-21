/*
 * Copyright 2026 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

// Widgets / link-based blocks
const DEF_LINK_BLOCKS = [
  { 'lib-fragment': '/fragments/' },
  { 'lib-schedule': '/schedules/' },
  { 'lib-youtube': 'https://www.youtube' },
];

// Do not load styles
const DEF_COMPONENTS = ['fragment', 'schedule'];

const PROVIDERS = [
  { prefix: 'lib', pathPrefix: '/libs', local: 6456 },
  { prefix: 'blog', pathPrefix: '/blog', local: 2564, origin: 'https://main--ak-media--author-kit.aem.live' },
];

const LOG = async (ex, el) => (await import('./utils/error.js')).default(ex, el);

export function getMetadata(name) {
  const attr = name && name.includes(':') ? 'property' : 'name';
  const meta = document.head.querySelector(`meta[${attr}="${name}"]`);
  return meta && meta.content;
}

export function getLocale(locales = { '': {} }) {
  const { pathname } = window.location;
  const matches = Object.keys(locales).filter((locale) => pathname.startsWith(`${locale}/`));
  const prefix = getMetadata('locale') || matches.sort((a, b) => b.length - a.length)?.[0] || '';
  if (locales[prefix].lang) document.documentElement.lang = locales[prefix].lang;
  return { prefix, ...locales[prefix] };
}

function getEnv() {
  const { host } = window.location;
  if (!['--', 'local'].some((check) => host.includes(check))) return 'prod';
  if (['--'].some((check) => host.includes(check))) return 'stage';
  return 'dev';
}

export const [setConfig, getConfig] = (() => {
  let config;

  const libsBase = `${import.meta.url.replace('/scripts/ak.js', '')}`;

  return [
    (conf = {}) => {
      config = {
        ...conf,
        log: conf.log || LOG,
        env: getEnv(),
        linkBlocks: [...DEF_LINK_BLOCKS, ...conf.linkBlocks],
        components: [...DEF_COMPONENTS, ...conf.components],
        providers: PROVIDERS,
        locale: getLocale(conf.locales),
        codeBase: conf.codeBase ?? libsBase,
        libsBase,
      };
      return config;
    },
    () => (config || setConfig()),
  ];
})();

export async function loadStyle(href) {
  return new Promise((resolve) => {
    if (!document.querySelector(`head > link[href="${href}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.onload = resolve;
      link.onerror = resolve;
      document.head.append(link);
    } else {
      resolve();
    }
  });
}

function getCodeBase(env, libsBase, codeBase, provider) {
  // If no one to provide the experience, return the consuming codeBase.
  if (!provider) return codeBase;

  // Determine if testing against a branch
  const branch = new URLSearchParams(window.location.search).get(provider.prefix) || 'main';

  // If provider has no origin, it's libs
  if (!provider.origin) {
    return branch === 'local'
      ? `http://localhost:${provider.local}${provider.pathPrefix}`
      : libsBase;
  }

  // Always return the CDN mapped path if on a prod environment
  if (env === 'prod') return `${window.location.origin}${provider.pathPrefix}`;

  // Allow local dev on a custom port
  return branch === 'local'
    ? `http://localhost:${provider.local}${provider.pathPrefix}`
    : `${provider.origin.replace('main', branch)}${provider.pathPrefix}`;
}

export async function loadExperience(provider, type, el, name, opts) {
  const { log, env, codeBase, libsBase } = getConfig();

  const finalBase = getCodeBase(env, libsBase, codeBase, provider);

  const path = `${finalBase}/${type}/${name}/${name}`;
  const loading = [];
  if (opts.decorate) {
    loading.push(new Promise((resolve) => {
      (async () => {
        try {
          await (await import(`${path}.js`)).default(el);
        } catch (ex) { await log(ex, el); }
        resolve();
      })();
    }));
  }
  if (opts.style) loading.push(loadStyle(`${path}.css`));
  await Promise.all(loading);
  return el;
}

export async function loadBlock(block) {
  const { components } = getConfig();
  const { classList } = block;
  let name = classList[0];

  // See if a block provider owns the block
  const provider = PROVIDERS.find((pr) => name.startsWith(`${pr.prefix}-`));

  // Remove prefix if found in providers list
  name = provider ? name.replace(`${provider.prefix}-`, '') : name;
  block.dataset.blockName = name;

  const opts = { decorate: true, style: !components.some((cmp) => name === cmp) };
  return loadExperience(provider, 'blocks', block, name, opts);
}

function loadTemplate() {
  const meta = getMetadata('template');
  if (!meta) return;
  const template = meta.replaceAll(' ', '-').toLowerCase();
  const { codeBase } = getConfig();
  document.body.classList.add('has-template');
  loadStyle(`${codeBase}/templates/${template}/${template}.css`).then(() => {
    document.body.classList.add(`${template}-template`);
    document.body.classList.remove('has-template');
  });
}

function decoratePictures(el) {
  const pics = el.querySelectorAll('picture');
  for (const pic of pics) {
    const source = pic.querySelector('source');
    const clone = source.cloneNode();
    const [pathname, params] = clone.getAttribute('srcset').split('?');
    const search = new URLSearchParams(params);
    search.set('width', 3000);
    clone.setAttribute('srcset', `${pathname}?${search.toString()}`);
    clone.setAttribute('media', '(min-width: 1440px)');
    pic.prepend(clone);
  }
}

function decorateButton(link) {
  const isEm = link.closest('em');
  const isStrong = link.closest('strong');
  const isStrike = link.closest('del');
  const isUnder = link.querySelector('u');
  if (!(isEm || isStrong || isStrike || isUnder)) return;
  const trueParent = link.closest('p, li, div');
  if (!trueParent) return;
  const siblings = [...trueParent.childNodes];

  const hasSibling = siblings.every(
    (el) => el.nodeName === 'A'
    || el.nodeName === 'EM'
    || el.nodeName === 'STRONG'
    || el.nodeName === 'DEL'
    || !el.textContent.trim(),
  );
  if (!hasSibling) return;
  if (siblings.length > 1) trueParent.classList.add('btn-group');

  link.classList.add('btn');
  if (isStrike) {
    link.classList.add('btn-negative');
  } else if (isEm && isStrong) {
    link.classList.add('btn-accent');
  } else if (isStrong) {
    link.classList.add('btn-primary');
  } else if (isEm) {
    link.classList.add('btn-secondary');
  }
  if (isUnder) {
    link.classList.add('btn-outline');
    link.innerHTML = isUnder.innerHTML;
    isUnder.remove();
  }
  const toReplace = [isEm, isStrong, isStrike].find((el) => el?.parentNode === trueParent);
  if (toReplace) trueParent.replaceChild(link, toReplace);
}

export function localizeUrl({ config, url }) {
  const { locales, locale, providers } = config;

  // If in root locale, do nothing
  if (locale.prefix === '') return null;

  const { origin, pathname, search, hash } = url;

  // If the link is already localized, do nothing
  if (pathname.startsWith(`${locale.prefix}/`)) return null;

  const localized = Object.keys(locales).some(
    (key) => key !== '' && pathname.startsWith(`${key}/`),
  );
  if (localized) return null;

  const provider = providers.find((pr) => pathname.startsWith(`${pr.pathPrefix}/`));
  const providerOrigin = provider?.origin ?? origin;

  return new URL(`${providerOrigin}${locale.prefix}${pathname}${search}${hash}`);
}

function decorateHash(a, url) {
  const { hash } = url;
  if (!hash || hash === '#') return {};

  const findHash = (name) => {
    const found = hash.includes(name);
    if (found) a.href = a.href.replace(name, '');
    return found;
  };

  const blank = findHash('#_blank');
  if (blank) a.target = '_blank';

  const dnt = findHash('#_dnt');
  const dnb = findHash('#_dnb');
  return { dnt, dnb };
}

export function decorateLink(config, a) {
  try {
    const url = new URL(a.href);
    const hostMatch = config.hostnames.some((host) => url.hostname.endsWith(host));
    if (hostMatch) a.href = a.href.replace(url.origin, '');

    const isRelative = a.getAttribute('href').startsWith('/');
    const { dnt, dnb } = decorateHash(a, url);
    if (isRelative && !dnt) {
      const localized = localizeUrl({ config, url });
      if (localized) a.href = localized.href;
    }
    decorateButton(a);
    if (!dnb) {
      const href = a.getAttribute('href');
      const found = config.linkBlocks.some((pattern) => {
        const key = Object.keys(pattern)[0];
        if (!href.includes(pattern[key])) return false;
        a.classList.add(key, 'auto-block');
        return true;
      });
      if (found) return a;
    }
  } catch (ex) {
    config.log('Could not decorate link', ex);
  }
  return null;
}

function decorateLinks(el) {
  const config = getConfig();
  const anchors = [...el.querySelectorAll('a')];
  return anchors.reduce((acc, a) => {
    const decorated = decorateLink(config, a);
    if (decorated) acc.push(decorated);
    return acc;
  }, []);
}

function loadIcons(el) {
  const icons = el.querySelectorAll('span.icon');
  if (!icons.length) return;
  import('./utils/icons.js').then((mod) => mod.default(icons));
}

function groupChildren(section) {
  const children = section.querySelectorAll(':scope > *');
  const groups = [];
  let currentGroup = null;
  for (const child of children) {
    const isDiv = child.tagName === 'DIV';
    const currentType = currentGroup?.classList.contains('block-content');

    if (!currentGroup || currentType !== isDiv) {
      currentGroup = document.createElement('div');
      currentGroup.className = isDiv
        ? 'block-content' : 'default-content';
      groups.push(currentGroup);
    }

    currentGroup.append(child);
  }
  return groups;
}

function toClassName(name) {
  return typeof name === 'string'
    ? name
      .toLowerCase()
      .replace(/[^0-9a-z]/gi, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
    : '';
}

function decorateSection(section) {
  // Always add section class
  section.classList.add('section');

  // Find the legacy DOM-based metadata
  const metaEl = section.querySelector(':scope > .section-metadata');
  if (metaEl) {
    [...metaEl.children].forEach((row) => {
      const key = row.children[0].textContent.trim().toLowerCase();
      const content = row.children[1];
      if (content) {
        const text = content.querySelector('img')?.src ?? content.textContent.trim().toLowerCase();
        if (key && text) {
          if (key === 'style') {
            const styles = text.split(',').map((style) => toClassName(style));
            section.classList.add(...styles);
            return;
          }
          section.dataset[key] = text;
        }
      }
    });
    metaEl.remove();
  }

  // Determine if the section needs section-metadata.js
  const meta = section.classList.length > 1 || Object.keys(section.dataset).length;
  if (meta) section.dataset.meta = meta;
}

function decorateSections(parent, isDoc) {
  const selector = isDoc ? 'main > div' : ':scope > div';
  return [...parent.querySelectorAll(selector)].map((section) => {
    decorateSection(section);
    const groups = groupChildren(section);
    section.append(...groups);
    section.dataset.status = 'decorated';
    section.linkBlocks = decorateLinks(section);
    section.blocks = [...section.querySelectorAll('.block-content > div[class]')];
    return section;
  });
}

function decorateHeader() {
  const header = document.querySelector('header');
  if (!header) return;
  const meta = getMetadata('header') || 'lib-header';
  if (meta === 'off') {
    document.body.classList.add('no-header');
    header.remove();
    return;
  }
  header.className = meta;
  header.dataset.status = 'decorated';
  const breadcrumbs = document.body.querySelector('breadcrumbs');
  const breadcrumbsPath = getMetadata('breadcrumbs');
  if (!(breadcrumbs || breadcrumbsPath)) return;
  document.body.classList.add('has-breadcrumbs');
  if (breadcrumbs) header.append(breadcrumbs);
}

async function decorateSession() {
  const { libsBase } = getConfig();
  loadStyle(`${libsBase}/styles/fonts.css`);
  sessionStorage.setItem('session', true);
  document.body.classList.add('session');
}

function decorateDoc() {
  decorateHeader();
  loadTemplate();

  const scheme = localStorage.getItem('color-scheme');
  if (scheme) document.body.classList.add(scheme);

  const pageId = window.location.hash?.replace('#', '');
  if (pageId) localStorage.setItem('lazyhash', pageId);
}

export async function loadArea({ area } = { area: document }) {
  const isDoc = area === document;
  const isSession = sessionStorage.getItem('session');
  if (isDoc) {
    if (isSession) await decorateSession();
    decorateDoc();
  }
  decoratePictures(area);
  const { decorateArea, providers } = getConfig();
  if (decorateArea) decorateArea({ area });
  const sections = decorateSections(area, isDoc);
  for (const [idx, section] of sections.entries()) {
    loadIcons(section);
    await Promise.all(section.linkBlocks.map((block) => loadBlock(block)));
    await Promise.all(section.blocks.map((block) => loadBlock(block)));
    delete section.dataset.status;

    if (section.dataset.meta) {
      const opts = { decorate: true, style: true };
      await loadExperience(providers[0], 'blocks', section, 'section-metadata', opts);
      delete section.dataset.meta;
    }

    if (isDoc && idx === 0) {
      if (!isSession) decorateSession();
      import('./postlcp.js').then((mod) => mod.default());
    }
  }
  if (isDoc) import('./lazy.js');
}
