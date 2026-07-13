const fs = require('fs');
const path = require('path');

const sourceDir =
  'C:\\Users\\stephen.deng\\Documents\\JS\\theme_export__lider-electric-store-myshopify-com-dawn__03JUN2026-1115am\\sections';
const themeFolderName = 'theme_export__lider-electric-store-myshopify-com-dawn__03JUN2026-1115am';
const assetPrefix = `../../JS/${themeFolderName}/assets`;
const outDir = path.join(process.cwd(), 'shopify elements');

const sampleImage =
  'data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%22900%22%20height=%22600%22%20viewBox=%220%200%20900%20600%22%3E%3Crect%20width=%22900%22%20height=%22600%22%20fill=%22%23e8eeee%22/%3E%3Crect%20x=%2272%22%20y=%2270%22%20width=%22756%22%20height=%22460%22%20rx=%2228%22%20fill=%22%23ffffff%22%20stroke=%22%23126a72%22%20stroke-width=%226%22/%3E%3Ccircle%20cx=%22710%22%20cy=%22176%22%20r=%2262%22%20fill=%22%23c9dfdf%22/%3E%3Cpath%20d=%22M120%20485L330%20280L475%20415L575%20318L780%20485Z%22%20fill=%22%23126a72%22%20opacity=%220.55%22/%3E%3Ctext%20x=%22450%22%20y=%22562%22%20font-family=%22Arial%22%20font-size=%2240%22%20text-anchor=%22middle%22%20fill=%22%231b1f22%22%3ESample%20image%3C/text%3E%3C/svg%3E';

function toTitleText(value) {
  const cleaned = String(value || 'Sample')
    .replace(/^t:/, '')
    .replace(/^main[-_]/, '')
    .replace(/^section[-_]/, '')
    .replace(/['"]/g, '')
    .trim();
  const parts = cleaned.split(/[._]/).filter(Boolean);
  const text = (parts.length > 1 ? parts[parts.length - 1] : cleaned)
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return text.replace(/\b[a-z]/gi, (letter) => letter.toUpperCase());
}

function displayTitle(fileBase) {
  return fileBase
    .replace(/^main-/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b[a-z]/gi, (letter) => letter.toUpperCase());
}

function sampleProductCard() {
  return `
<article class="card-wrapper product-card-wrapper shopify-sample-card">
  <div class="card card--standard card--media">
    <div class="card__inner color-scheme-2 gradient ratio">
      <div class="card__media">
        <div class="media media--transparent media--hover-effect">
          <img class="shopify-sample-image" src="${sampleImage}" alt="Sample product">
        </div>
      </div>
    </div>
    <div class="card__content">
      <div class="card__information">
        <h3 class="card__heading h5"><a href="#" class="full-unstyled-link">Commercial LED Panel Light</a></h3>
        <div class="price"><span class="price-item price-item--regular">$89.00</span></div>
      </div>
    </div>
  </div>
</article>`;
}

function sampleCollectionCard() {
  return `
<article class="card-wrapper collection-card-wrapper shopify-sample-card">
  <div class="card card--standard card--media">
    <div class="card__inner color-scheme-2 gradient ratio">
      <div class="card__media">
        <div class="media media--transparent media--hover-effect">
          <img class="shopify-sample-image" src="${sampleImage}" alt="Sample collection">
        </div>
      </div>
    </div>
    <div class="card__content">
      <div class="card__information">
        <h3 class="card__heading"><a href="#" class="full-unstyled-link">Sample Collection</a></h3>
      </div>
    </div>
  </div>
</article>`;
}

function sampleArticleCard() {
  return `
<article class="article-card shopify-sample-card">
  <div class="article-card__image-wrapper card__media">
    <img class="shopify-sample-image" src="${sampleImage}" alt="Sample article">
  </div>
  <div class="article-card__info">
    <h3 class="article-card__title">Sample article title</h3>
    <p class="article-card__excerpt rte-width">This is sample blog text converted from Shopify Liquid.</p>
  </div>
</article>`;
}

function getRenderReplacement(snippet) {
  if (snippet === 'card-product') return sampleProductCard();
  if (snippet === 'card-collection') return sampleCollectionCard();
  if (snippet === 'article-card') return sampleArticleCard();
  if (snippet === 'price') {
    return '<div class="price"><span class="price-item price-item--regular">$89.00</span></div>';
  }
  if (snippet === 'header-search') {
    return '<form class="search search-modal__form" role="search"><input class="search__input field__input" type="search" placeholder="Search"><button class="search__button field__button" type="submit">Search</button></form>';
  }
  if (['header-drawer', 'header-dropdown-menu', 'header-mega-menu'].includes(snippet)) {
    return '<nav class="header__inline-menu"><ul class="list-menu list-menu--inline"><li><a class="header__menu-item list-menu__item link" href="#">Home</a></li><li><a class="header__menu-item list-menu__item link" href="#">Shop</a></li><li><a class="header__menu-item list-menu__item link" href="#">Contact</a></li></ul></nav>';
  }
  if (snippet === 'cart-notification') {
    return '<div class="cart-notification focus-inset"><h2 class="cart-notification__heading">Item added to cart</h2><a class="button" href="#">View cart</a></div>';
  }
  if (snippet === 'quick-order-list') {
    return '<div class="quick-order-list"><table><tr><th>Product</th><th>Qty</th><th>Total</th></tr><tr><td>Commercial LED Panel Light</td><td>1</td><td>$89.00</td></tr></table></div>';
  }
  if (snippet === 'product-media-gallery') {
    return `<media-gallery class="product__media-gallery"><div class="product__media media"><img class="shopify-sample-image" src="${sampleImage}" alt="Sample product"></div></media-gallery>`;
  }
  if (snippet === 'product-media-modal') {
    return '<product-modal class="product-media-modal"><div class="product-media-modal__content">Product media modal placeholder</div></product-modal>';
  }
  if (snippet === 'product-variant-picker') {
    return '<variant-selects><label for="sample-variant">Variant</label><select id="sample-variant"><option>2x4 ft / 4000K</option></select></variant-selects>';
  }
  if (snippet === 'icon-with-text') {
    return '<div class="icon-with-text"><span class="svg-wrapper">*</span><span>Sample feature</span></div>';
  }
  if (snippet === 'share-button') {
    return '<share-button><button class="share-button__button" type="button">Share</button></share-button>';
  }
  if (snippet === 'facets') {
    return '<aside class="facets-wrapper"><details class="facets__disclosure"><summary>Filter</summary><label><input type="checkbox"> In stock</label></details></aside>';
  }
  if (snippet === 'pagination') {
    return '<nav class="pagination" role="navigation"><a href="#">Previous</a><span>1</span><a href="#">Next</a></nav>';
  }
  if (snippet === 'country-localization') {
    return '<select class="localization-selector"><option>United States</option></select>';
  }
  if (snippet === 'language-localization') {
    return '<select class="localization-selector"><option>English</option></select>';
  }
  if (['mask-arch', 'mask-blobs'].includes(snippet)) return '';
  if (snippet.startsWith('icon-')) return '<span class="svg-wrapper" aria-hidden="true">+</span>';
  return `<!-- rendered snippet: ${snippet} -->`;
}

function getSampleValue(expression, sectionId, sectionTitle) {
  const expr = String(expression || '').replace(/\s+/g, ' ').trim();

  if (/shopify_attributes/.test(expr)) return '';
  if (/placeholder_svg_tag/.test(expr)) return '<div class="shopify-placeholder-svg" aria-label="Placeholder image"></div>';
  if (/image_tag|image_url|img_url|avatar/.test(expr)) {
    return `<img class="shopify-sample-image" src="${sampleImage}" alt="Sample image">`;
  }
  if (expr === 'content_for_index') return '<p>Sample page content.</p>';
  if (/routes\.root_url/.test(expr)) return './index.html';
  if (/routes\.|\.url\b|url\b|link\b|href\b/.test(expr)) return '#';
  if (/section\.id|section\.index/.test(expr)) return sectionId;
  if (/forloop\.index|forloop\.rindex|paginate\.current_page|paginate\.pages/.test(expr)) return '1';
  if (/cart\.item_count|item_count|quantity|count|size|columns|limit/.test(expr)) return '1';
  if (/price|money|subtotal|total|amount/.test(expr)) return '$89.00';
  if (/shop\.name/.test(expr)) return 'Lider Electric';
  if (/customer\.first_name/.test(expr)) return 'Stephen';
  if (/customer|account|login/.test(expr)) return 'Account';
  if (/address/.test(expr)) return '123 Sample Street';
  if (/phone/.test(expr)) return '(555) 010-1000';
  if (/email/.test(expr)) return 'customer@example.com';
  if (/product\.title|card_product\.title|product_title/.test(expr)) return 'Commercial LED Panel Light';
  if (/product\.vendor|vendor/.test(expr)) return 'Lider Electric';
  if (/product\.description|description|body|content|text|message/.test(expr)) {
    return 'Sample text for this Shopify section.';
  }
  if (/collection\.title|collection\.name/.test(expr)) return 'Sample Collection';
  if (/article\.title|blog\.title/.test(expr)) return 'Sample Article';
  if (/page\.title/.test(expr)) return 'Sample Page';
  if (/page\.content|article\.content|article\.excerpt/.test(expr)) {
    return '<p>Sample content converted from the Liquid section.</p>';
  }
  if (/heading_size/.test(expr)) return 'h2';
  if (/color_scheme/.test(expr)) return 'scheme-1';
  if (/image_height/.test(expr)) return 'medium';
  if (/desktop_content_position|content_position/.test(expr)) return 'middle-center';
  if (/desktop_content_alignment|mobile_content_alignment|alignment/.test(expr)) return 'center';
  if (/button_label|view_all/.test(expr)) return 'Shop now';
  if (/title|heading|name|label/.test(expr)) return sectionTitle;
  if (/\|\s*t\b/.test(expr)) {
    const quoted = expr.match(/['"]([^'"]+)['"]\s*\|/);
    if (quoted) return toTitleText(quoted[1]);
  }
  const literal = expr.match(/^\s*['"]([^'"]+)['"]\s*(\||$)/);
  if (literal) return toTitleText(literal[1]);
  if (/padding|margin|opacity|width|height|ratio|times|divided_by|round/.test(expr)) return '24';

  return 'Sample';
}

function convertSectionMarkup(raw, safeName, sectionTitle) {
  const sectionId = `sample-${safeName}`;
  let markup = raw;

  markup = markup.replace(/\{%-?\s*schema\s*-?%\}[\s\S]*?\{%-?\s*endschema\s*-?%\}/gi, '');
  markup = markup.replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/gi, '');
  markup = markup.replace(
    /<\/\{%-?\s*if\s+section\.settings\.sticky_header_type\s*!=\s*'none'\s*-?%\}sticky-header\{%-?\s*else\s*-?%\}div\{%-?\s*endif\s*-?%\}>/gi,
    '</div>',
  );
  markup = markup.replace(
    /<\{%-?\s*if\s+section\.settings\.sticky_header_type\s*!=\s*'none'\s*-?%\}[\s\S]*?\{%-?\s*endif\s*-?%\}/gi,
    '<div',
  );

  markup = markup
    .replace(/\{%-?\s*style\s*-?%\}/gi, '<style>')
    .replace(/\{%-?\s*endstyle\s*-?%\}/gi, '</style>')
    .replace(/\{%-?\s*stylesheet\s*-?%\}/gi, '<style>')
    .replace(/\{%-?\s*endstylesheet\s*-?%\}/gi, '</style>')
    .replace(/\{%-?\s*javascript\s*-?%\}/gi, '<script>')
    .replace(/\{%-?\s*endjavascript\s*-?%\}/gi, '</script>');

  markup = markup.replace(
    /\{\{-?\s*['"]([^'"]+\.css)['"]\s*\|\s*asset_url\s*\|\s*stylesheet_tag\s*-?\}\}/gi,
    (_match, fileName) => `<link rel="stylesheet" href="${assetPrefix}/${fileName}">`,
  );
  markup = markup.replace(
    /\{\{-?\s*['"]([^'"]+\.js)['"]\s*\|\s*asset_url\s*\|\s*script_tag\s*-?\}\}/gi,
    (_match, fileName) => `<script src="${assetPrefix}/${fileName}" defer></script>`,
  );
  markup = markup.replace(
    /\{\{-?\s*['"]([^'"]+)['"]\s*\|\s*asset_url\s*-?\}\}/gi,
    (_match, fileName) => `${assetPrefix}/${fileName}`,
  );

  markup = markup.replace(/\{%-?\s*render\s+'([^']+)'\b[\s\S]*?-?%\}/gi, (_match, snippet) =>
    getRenderReplacement(snippet),
  );
  markup = markup.replace(/\{%-?\s*render\s+block\s*-?%\}/gi, '<!-- app block placeholder -->');
  markup = markup.replace(
    /\{%-?\s*form\s+'([^']+)'\b[\s\S]*?-?%\}/gi,
    (_match, kind) => `<form class="shopify-form shopify-form--${kind}">`,
  );
  markup = markup.replace(/\{%-?\s*endform\s*-?%\}/gi, '</form>');
  markup = markup.replace(/\{%-?\s*liquid\b[\s\S]*?-?%\}/gi, '');
  markup = markup.replace(/\{\{-?\s*([\s\S]*?)\s*-?\}\}/g, (_match, expression) =>
    getSampleValue(expression, sectionId, sectionTitle),
  );
  markup = markup.replace(
    /\{%-?\s*(if|unless|elsif|else|endif|endunless|for|endfor|case|when|endcase|assign|capture|endcapture|paginate|endpaginate|tablerow|endtablerow|break|continue)\b[\s\S]*?-?%\}/gi,
    '',
  );
  markup = markup.replace(/\{%-?[\s\S]*?-?%\}/g, '');
  markup = markup.replace(/\s+(class|id|href|src|alt|aria-label)="\s+"/g, ' $1=""');
  markup = markup.replace(/\n{3,}/g, '\n\n');

  return markup.trim();
}

function htmlDocument(fileName, sectionTitle, safeName, converted) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${sectionTitle} - Shopify Element</title>
    <link rel="stylesheet" href="${assetPrefix}/base.css">
    <script src="${assetPrefix}/constants.js" defer></script>
    <script src="${assetPrefix}/pubsub.js" defer></script>
    <script src="${assetPrefix}/global.js" defer></script>
    <style>
      body { margin: 0; background: #f6f2ea; color: #1b1f22; }
      .shopify-elements-topbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 20px; border-bottom: 1px solid #d9d2c7; background: #fff; position: sticky; top: 0; z-index: 30; }
      .shopify-elements-topbar a { color: #126a72; text-decoration: none; }
      .shopify-elements-demo { padding: 24px 0 56px; }
      .shopify-conversion-note { width: min(1120px, calc(100% - 32px)); margin: 0 auto 18px; padding: 12px 14px; border: 1px solid #d9d2c7; border-radius: 8px; background: #fff; font-size: 14px; color: #687076; }
      .shopify-sample-image { width: 100%; height: auto; display: block; object-fit: cover; }
      .shopify-placeholder-svg { min-height: 220px; border: 1px dashed #9bbabb; border-radius: 8px; background: linear-gradient(135deg, #e8eeee, #ffffff); display: grid; place-items: center; }
      .shopify-placeholder-svg::before { content: "Sample image"; color: #126a72; font-weight: 700; }
      .shopify-sample-card { min-width: 0; }
      .shopify-form input, .shopify-form textarea, .shopify-form select { max-width: 100%; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border-bottom: 1px solid #d9d2c7; padding: 10px; text-align: left; }
    </style>
  </head>
  <body>
    <header class="shopify-elements-topbar">
      <strong>${sectionTitle}</strong>
      <a href="index.html">All Shopify elements</a>
    </header>
    <main class="shopify-elements-demo">
      <p class="shopify-conversion-note">Static HTML conversion of <code>${fileName}</code>. Shopify Liquid data and snippets were replaced with sample placeholders.</p>
      <section id="shopify-section-sample-${safeName}" class="shopify-section section">
${converted}
      </section>
    </main>
  </body>
</html>
`;
}

function indexDocument(items) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Shopify Elements</title>
    <style>
      body { margin: 0; font-family: Arial, Helvetica, sans-serif; background: #f6f2ea; color: #1b1f22; }
      main { width: min(1100px, calc(100% - 32px)); margin: 0 auto; padding: 42px 0 64px; }
      h1 { margin: 0 0 10px; font-size: clamp(32px, 5vw, 56px); }
      p { color: #687076; max-width: 760px; }
      ul { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 10px; padding: 0; margin: 28px 0 0; list-style: none; }
      li { display: grid; gap: 4px; padding: 14px; border: 1px solid #d9d2c7; border-radius: 8px; background: #fff; }
      a { color: #126a72; font-weight: 700; text-decoration: none; }
      a:hover { text-decoration: underline; }
      span { color: #687076; font-size: 13px; }
    </style>
  </head>
  <body>
    <main>
      <h1>Shopify Elements</h1>
      <p>Converted static HTML examples from the Dawn theme section Liquid files. These are examples for structure and styling; live Shopify data, forms, routes, and section rendering still require Shopify.</p>
      <ul>
${items.join('\n')}
      </ul>
    </main>
  </body>
</html>
`;
}

fs.mkdirSync(outDir, { recursive: true });

const files = fs
  .readdirSync(sourceDir)
  .filter((file) => file.endsWith('.liquid'))
  .sort();
const indexItems = [];

for (const fileName of files) {
  const sourcePath = path.join(sourceDir, fileName);
  const raw = fs.readFileSync(sourcePath, 'utf8');
  const safeName = path.basename(fileName, '.liquid');
  const sectionTitle = displayTitle(safeName);
  const converted = convertSectionMarkup(raw, safeName, sectionTitle);
  const outputName = `${safeName}.html`;
  const outputPath = path.join(outDir, outputName);

  fs.writeFileSync(outputPath, htmlDocument(fileName, sectionTitle, safeName, converted), 'utf8');
  indexItems.push(`<li><a href="${outputName}">${sectionTitle}</a> <span>${fileName}</span></li>`);
}

fs.writeFileSync(path.join(outDir, 'index.html'), indexDocument(indexItems), 'utf8');

console.log(`Converted ${files.length} Liquid section files into ${outDir}`);
