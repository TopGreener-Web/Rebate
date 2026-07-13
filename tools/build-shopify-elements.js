const fs = require('fs');
const path = require('path');

const sourceDir =
  'C:\\Users\\stephen.deng\\Documents\\JS\\theme_export__lider-electric-store-myshopify-com-dawn__03JUN2026-1115am\\sections';
const outDir = path.join(process.cwd(), 'shopify elements');

const palette = {
  ink: '#1b1f22',
  muted: '#687076',
  teal: '#126a72',
  tealDark: '#0d5056',
  rust: '#b94735',
  gold: '#e0a430',
  paper: '#f6f2ea',
  panel: '#ffffff',
  line: '#d9d2c7',
};

const products = [
  ['Commercial LED Panel Light', '2x4 ft / 4000K', '$89.00'],
  ['Slim Recessed Downlight', '6 in / 5000K', '$18.50'],
  ['Outdoor Wall Pack', '60W / Bronze', '$74.00'],
  ['Emergency Exit Sign', 'Red letters', '$39.00'],
];

const collections = [
  ['Panel Lights', 'Flat panels for commercial ceilings'],
  ['Outdoor Lighting', 'Weather-ready fixtures'],
  ['Emergency Lights', 'Safety and exit fixtures'],
  ['Accessories', 'Drivers, trims, and mounting kits'],
];

const articles = [
  ['How to choose color temperature', 'A practical guide for warehouse, office, and retail projects.'],
  ['LED retrofit checklist', 'Parts and planning notes before replacing fluorescent fixtures.'],
  ['Contractor discount guide', 'How bundled orders can simplify project purchasing.'],
];

function svgData(label, color = palette.teal, accent = palette.gold) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="620" viewBox="0 0 900 620">
    <rect width="900" height="620" fill="#eef3f2"/>
    <rect x="70" y="66" width="760" height="488" rx="26" fill="#fff" stroke="${color}" stroke-width="8"/>
    <circle cx="716" cy="176" r="64" fill="${accent}" opacity=".72"/>
    <path d="M132 496 326 294l132 124 112-112 204 190z" fill="${color}" opacity=".58"/>
    <rect x="138" y="122" width="300" height="34" rx="17" fill="${color}" opacity=".25"/>
    <rect x="138" y="176" width="218" height="22" rx="11" fill="${color}" opacity=".18"/>
    <text x="450" y="586" font-family="Arial, Helvetica, sans-serif" font-size="36" text-anchor="middle" fill="#1b1f22">${label}</text>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function titleFromName(name) {
  return name
    .replace(/\.liquid$/, '')
    .replace(/^main-/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b[a-z]/gi, (letter) => letter.toUpperCase());
}

function htmlEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function productCard(product, index = 0) {
  const [name, variant, price] = product;
  return `<article class="product-card">
    <a class="product-card__media" href="#">
      <img src="${svgData(name, index % 2 ? palette.rust : palette.teal)}" alt="${htmlEscape(name)}">
      <span class="badge">${index === 0 ? 'Best seller' : 'In stock'}</span>
    </a>
    <div class="product-card__body">
      <p class="eyebrow">Lider Electric</p>
      <h3><a href="#">${name}</a></h3>
      <p>${variant}</p>
      <div class="price-row"><strong>${price}</strong><button type="button" class="small-button">Add</button></div>
    </div>
  </article>`;
}

function collectionCard(collection, index = 0) {
  const [name, description] = collection;
  return `<article class="collection-card">
    <img src="${svgData(name, index % 2 ? palette.rust : palette.teal, index % 2 ? palette.teal : palette.gold)}" alt="${htmlEscape(name)}">
    <div>
      <h3><a href="#">${name}</a></h3>
      <p>${description}</p>
    </div>
  </article>`;
}

function articleCard(article, index = 0) {
  const [title, excerpt] = article;
  return `<article class="article-card">
    <img src="${svgData(title, index % 2 ? palette.rust : palette.teal)}" alt="${htmlEscape(title)}">
    <div>
      <p class="eyebrow">Lighting guide</p>
      <h3><a href="#">${title}</a></h3>
      <p>${excerpt}</p>
      <a class="text-link" href="#">Read more</a>
    </div>
  </article>`;
}

function buttonRow() {
  return `<div class="button-row"><a class="button" href="#">Shop now</a><a class="button button--secondary" href="#">View catalog</a></div>`;
}

function sectionIntro(title, text) {
  return `<div class="section-heading">
    <p class="eyebrow">Shopify section</p>
    <h1>${title}</h1>
    <p>${text}</p>
  </div>`;
}

function productGrid(count = 4) {
  return `<div class="product-grid">${products.slice(0, count).map(productCard).join('\n')}</div>`;
}

function collectionGrid() {
  return `<div class="collection-grid">${collections.map(collectionCard).join('\n')}</div>`;
}

function articleGrid() {
  return `<div class="article-grid">${articles.map(articleCard).join('\n')}</div>`;
}

function heroSection(title = 'Commercial LED Lighting', text = 'Project-ready fixtures, contractor pricing, and fast quote support.') {
  return `<section class="hero-section">
    <img src="${svgData(title, palette.teal, palette.gold)}" alt="${htmlEscape(title)}">
    <div class="hero-section__content">
      <p class="eyebrow">Lider Electric</p>
      <h1>${title}</h1>
      <p>${text}</p>
      ${buttonRow()}
    </div>
  </section>`;
}

function splitSection(title = 'Built for job sites', reverse = false) {
  return `<section class="split-section ${reverse ? 'split-section--reverse' : ''}">
    <div>
      <p class="eyebrow">Featured section</p>
      <h1>${title}</h1>
      <p>Use this layout for product education, service highlights, or a collection promotion with strong imagery and direct calls to action.</p>
      ${buttonRow()}
    </div>
    <img src="${svgData(title, reverse ? palette.rust : palette.teal)}" alt="${htmlEscape(title)}">
  </section>`;
}

function cartItems() {
  return `<section class="cart-layout">
    <div class="cart-card">
      <h1>Your cart</h1>
      <div class="cart-line">
        <img src="${svgData('Panel Light')}" alt="Commercial LED Panel Light">
        <div>
          <p class="eyebrow">Lider Electric</p>
          <h3>Commercial LED Panel Light</h3>
          <p>Size: 2x4 ft<br>Color temperature: 4000K</p>
          <span class="discount">Spring contractor discount</span>
        </div>
        <div class="qty-control">
          <button type="button" data-qty-minus>-</button>
          <input value="1" aria-label="Quantity">
          <button type="button" data-qty-plus>+</button>
        </div>
        <strong>$89.00</strong>
      </div>
    </div>
    <aside class="summary-card">
      <h2>Order summary</h2>
      <label for="cart-note">Order special instructions</label>
      <textarea id="cart-note" placeholder="Order special instructions"></textarea>
      <div class="summary-line"><span>Subtotal</span><strong>$89.00</strong></div>
      <div class="summary-line discount"><span>Discount</span><strong>-$10.00</strong></div>
      <div class="summary-line total"><span>Estimated total</span><strong>$89.00 USD</strong></div>
      <button class="button" type="button">Check out</button>
    </aside>
  </section>`;
}

function cartDrawer() {
  return `<section class="demo-panel">
    <button class="button" type="button" data-open-drawer>Open cart drawer</button>
    <div class="drawer-sample" data-drawer>
      <div class="drawer-sample__header"><h2>Your cart</h2><button type="button" data-close-drawer>x</button></div>
      <div class="drawer-sample__body">
        <div class="cart-line cart-line--compact">
          <img src="${svgData('Panel Light')}" alt="Commercial LED Panel Light">
          <div><h3>Commercial LED Panel Light</h3><p>Qty 1</p></div>
          <strong>$89.00</strong>
        </div>
      </div>
      <div class="drawer-sample__footer"><div class="summary-line total"><span>Total</span><strong>$89.00 USD</strong></div><button class="button" type="button">Checkout</button></div>
    </div>
  </section>`;
}

function quickOrderList(title = 'Quick order list') {
  return `<section class="demo-panel">
    ${sectionIntro(title, 'A table-based ordering item with quantity, SKU, and line total samples.')}
    <table class="data-table">
      <thead><tr><th>Product</th><th>SKU</th><th>Qty</th><th>Total</th></tr></thead>
      <tbody>
        ${products
          .map(
            ([name, variant, price], index) =>
              `<tr><td><strong>${name}</strong><br><span>${variant}</span></td><td>LED-${1000 + index}</td><td><div class="qty-control"><button type="button" data-qty-minus>-</button><input value="1"><button type="button" data-qty-plus>+</button></div></td><td><strong>${price}</strong></td></tr>`,
          )
          .join('\n')}
      </tbody>
    </table>
  </section>`;
}

function productDetail(title = 'Commercial LED Panel Light') {
  return `<section class="product-detail">
    <div class="product-media-grid">
      <img class="product-media-grid__main" src="${svgData(title, palette.teal)}" alt="${htmlEscape(title)}">
      <img src="${svgData('Detail view', palette.rust)}" alt="Detail view">
      <img src="${svgData('Installed view', palette.tealDark, palette.gold)}" alt="Installed view">
    </div>
    <div class="product-info">
      <p class="eyebrow">Lider Electric</p>
      <h1>${title}</h1>
      <p class="large-price">$89.00</p>
      <p>Commercial grade flat panel with even illumination, selectable mounting options, and efficient LED performance.</p>
      <label for="variant">Variant</label>
      <select id="variant"><option>2x4 ft / 4000K</option><option>2x2 ft / 5000K</option></select>
      <label for="quantity">Quantity</label>
      <div class="qty-control"><button type="button" data-qty-minus>-</button><input id="quantity" value="1"><button type="button" data-qty-plus>+</button></div>
      <button class="button" type="button">Add to cart</button>
      <details open><summary>Product details</summary><p>Dimmable driver, low-profile frame, and a clean lens for commercial interiors.</p></details>
      <details><summary>Shipping</summary><p>Pickup and freight options are available for larger projects.</p></details>
    </div>
  </section>`;
}

function accountForm(title, submitLabel) {
  return `<section class="auth-card">
    <h1>${title}</h1>
    <p>Sample customer account form converted into regular HTML fields.</p>
    <form>
      <label>Email<input type="email" placeholder="customer@example.com"></label>
      <label>Password<input type="password" placeholder="Password"></label>
      <button class="button" type="submit">${submitLabel}</button>
    </form>
  </section>`;
}

const templates = {
  'announcement-bar': () => `<section class="announcement-slider" data-slider>
    <button type="button" data-slider-prev aria-label="Previous">‹</button>
    <div class="announcement-track">
      <p data-slide class="is-active">Free local pickup on contractor orders over $250</p>
      <p data-slide>Need a quote? Send us your lighting schedule today</p>
      <p data-slide>Spring contractor discount on select LED panels</p>
    </div>
    <button type="button" data-slider-next aria-label="Next">›</button>
  </section>`,
  apps: () => `<section class="app-grid">${['Reviews', 'Store pickup', 'Quote request'].map((name) => `<article class="app-card"><h3>${name}</h3><p>Embedded app block placeholder with useful store functionality.</p><button class="small-button" type="button">Open</button></article>`).join('')}</section>`,
  'bulk-quick-order-list': () => quickOrderList('Bulk quick order list'),
  'cart-drawer': cartDrawer,
  'cart-icon-bubble': () => `<header class="sample-header"><strong>Lider Electric</strong><nav><a href="#">Shop</a><a href="#">Projects</a><a href="#">Contact</a></nav><a class="cart-icon" href="#"><span>Cart</span><strong>3</strong></a></header>`,
  'cart-live-region-text': () => `<section class="live-region-demo"><div role="status" aria-live="polite">Cart updated. Commercial LED Panel Light quantity is now 2.</div>${cartItems()}</section>`,
  'cart-notification-button': () => `<section class="demo-panel"><h1>Cart notification buttons</h1><div class="button-row"><a class="button" href="#">View cart</a><button class="button button--secondary" type="button">Continue shopping</button></div></section>`,
  'cart-notification-product': () => `<section class="notification-card"><h2>Item added to your cart</h2><div class="cart-line cart-line--compact"><img src="${svgData('Panel Light')}" alt="Commercial LED Panel Light"><div><h3>Commercial LED Panel Light</h3><p>2x4 ft / 4000K</p></div><strong>$89.00</strong></div><div class="button-row"><a class="button" href="#">View cart</a><a class="button button--secondary" href="#">Checkout</a></div></section>`,
  collage: () => `<section class="collage-grid"><article class="collage-feature">${heroSection('LED panel sale', 'Clean commercial fixtures for offices and warehouses.')}</article>${products.slice(1).map(productCard).join('')}</section>`,
  'collapsible-content': () => `<section class="accordion-section">${sectionIntro('Frequently asked questions', 'Accordion content blocks with supporting imagery.')}<div class="accordion-layout"><img src="${svgData('FAQ')}" alt="FAQ image"><div>${['What color temperature should I use?', 'Can I pick up locally?', 'Do you offer contractor pricing?'].map((question, index) => `<details ${index === 0 ? 'open' : ''}><summary>${question}</summary><p>Use this area for practical store answers and product guidance.</p></details>`).join('')}</div></div></section>`,
  'collection-list': () => `<section>${sectionIntro('Shop by collection', 'Collection cards built from sample collection data.')}${collectionGrid()}</section>`,
  'contact-form': () => `<section class="contact-layout"><div>${sectionIntro('Contact us', 'Send project details, fixture counts, or quote requests.')}</div><form class="form-card"><label>Name<input placeholder="Your name"></label><label>Email<input type="email" placeholder="you@example.com"></label><label>Message<textarea placeholder="Tell us about the project"></textarea></label><button class="button" type="submit">Send message</button></form></section>`,
  'custom-liquid': () => `<section class="custom-html-block"><h1>Custom HTML block</h1><p>This sample shows where merchant-provided HTML from the Custom Liquid section would render.</p><div class="metric-row"><span><strong>24h</strong> quote response</span><span><strong>500+</strong> commercial SKUs</span><span><strong>Local</strong> pickup support</span></div></section>`,
  'email-signup-banner': () => `<section class="email-banner">${heroSection('Get contractor pricing updates', 'Join the list for project discounts and inventory alerts.')}<form class="floating-signup"><input type="email" placeholder="Email address"><button class="button" type="submit">Sign up</button></form></section>`,
  'featured-blog': () => `<section>${sectionIntro('Featured blog', 'Article cards with images, excerpts, and read-more links.')}${articleGrid()}</section>`,
  'featured-collection': () => `<section>${sectionIntro('Featured collection', 'A product grid using sample items and prices.')}${productGrid(4)}${buttonRow()}</section>`,
  'featured-product': () => productDetail('Featured LED panel'),
  footer: () => `<footer class="sample-footer"><div><h2>Lider Electric</h2><p>Commercial LED lighting, electrical supplies, and quote support.</p></div><nav><h3>Shop</h3><a href="#">Panel lights</a><a href="#">Outdoor lights</a><a href="#">Accessories</a></nav><form><h3>Newsletter</h3><input type="email" placeholder="Email address"><button class="small-button" type="submit">Join</button></form></footer>`,
  header: () => `<header class="sample-header"><strong>Lider Electric</strong><nav><a href="#">Home</a><a href="#">Shop</a><a href="#">Blog</a><a href="#">Contact</a></nav><form class="header-search"><input type="search" placeholder="Search products"></form><a class="cart-icon" href="#"><span>Cart</span><strong>1</strong></a></header>`,
  'image-banner': () => heroSection('Commercial lighting ready to ship', 'Use the image banner for homepage promotions and collection launches.'),
  'image-with-text': () => splitSection('Lighting support from quote to pickup'),
  'main-404': () => `<section class="empty-state"><h1>Page not found</h1><p>The page you were looking for does not exist.</p><form class="search-box"><input type="search" placeholder="Search products"><button class="button" type="submit">Search</button></form></section>`,
  'main-account': () => `<section>${sectionIntro('Account overview', 'Customer order history and account links.')}<div class="dashboard-grid"><article class="dashboard-card"><h3>Recent order</h3><p>#1024 - Fulfilled</p><strong>$356.00</strong></article><article class="dashboard-card"><h3>Default address</h3><p>123 Sample Street<br>Los Angeles, CA</p></article><article class="dashboard-card"><h3>Saved projects</h3><p>Warehouse retrofit quote</p></article></div></section>`,
  'main-activate-account': () => accountForm('Activate account', 'Activate account'),
  'main-addresses': () => `<section>${sectionIntro('Addresses', 'Customer address cards and edit form sample.')}<div class="dashboard-grid"><article class="dashboard-card"><h3>Default address</h3><p>Stephen Deng<br>123 Sample Street<br>Los Angeles, CA</p><button class="small-button">Edit</button></article><form class="form-card"><label>Address<input value="123 Sample Street"></label><label>City<input value="Los Angeles"></label><button class="button">Save address</button></form></div></section>`,
  'main-article': () => `<article class="article-detail"><img src="${svgData('Article')}" alt="Article hero"><p class="eyebrow">Lighting guide</p><h1>How to choose LED panel lights</h1><p class="lead">This article layout includes title, image, rich text, sharing, comments, and navigation samples.</p><p>Use wattage, ceiling height, and color temperature to match the fixture to the space. For commercial projects, confirm mounting and driver requirements before ordering.</p><blockquote>Tip: 4000K is a common neutral white choice for offices and retail spaces.</blockquote><form class="form-card"><h2>Leave a comment</h2><label>Name<input></label><label>Comment<textarea></textarea></label><button class="button">Post comment</button></form></article>`,
  'main-blog': () => `<section>${sectionIntro('Blog', 'A blog index with article previews.')}${articleGrid()}</section>`,
  'main-cart-footer': () => `<section class="summary-card summary-card--wide"><h1>Cart footer</h1><label>Order special instructions<textarea placeholder="Delivery notes"></textarea></label><div class="summary-line"><span>Subtotal</span><strong>$89.00</strong></div><div class="summary-line total"><span>Total</span><strong>$89.00 USD</strong></div><button class="button">Check out</button></section>`,
  'main-cart-items': cartItems,
  'main-collection-banner': () => `<section class="collection-banner"><p class="eyebrow">Collection</p><h1>Panel Lights</h1><p>Flat panel fixtures for offices, schools, warehouses, and commercial retrofits.</p></section>`,
  'main-collection-product-grid': () => `<section class="catalog-layout"><aside class="filter-panel"><h2>Filters</h2><label><input type="checkbox"> In stock</label><label><input type="checkbox"> Contractor discount</label><label>Sort<select><option>Featured</option><option>Price low to high</option></select></label></aside><div>${sectionIntro('Panel Lights', 'Collection grid with filters and product cards.')}${productGrid(4)}</div></section>`,
  'main-list-collections': () => `<section>${sectionIntro('All collections', 'A collection listing page.')}${collectionGrid()}</section>`,
  'main-login': () => accountForm('Log in', 'Sign in'),
  'main-order': () => `<section class="order-page">${sectionIntro('Order #1024', 'Order detail table with fulfillment and totals.')}<table class="data-table"><thead><tr><th>Product</th><th>Qty</th><th>Total</th></tr></thead><tbody><tr><td>Commercial LED Panel Light</td><td>4</td><td>$356.00</td></tr><tr><td>Slim Recessed Downlight</td><td>12</td><td>$222.00</td></tr></tbody></table><div class="summary-card"><div class="summary-line total"><span>Paid total</span><strong>$578.00 USD</strong></div></div></section>`,
  'main-page': () => `<section class="page-content">${sectionIntro('Sample page', 'A standard Shopify page with rich text and media.')}<img src="${svgData('Page content')}" alt="Page content"><p>Use pages for policies, store information, service areas, or project support details.</p></section>`,
  'main-password-footer': () => `<footer class="password-footer"><p>Opening soon</p><div class="social-row"><a href="#">Instagram</a><a href="#">Facebook</a><a href="#">YouTube</a></div></footer>`,
  'main-password-header': () => `<header class="password-header"><strong>Lider Electric</strong><button class="button button--secondary" type="button">Store password</button></header>`,
  'main-product': () => productDetail('Commercial LED Panel Light'),
  'main-register': () => `<section class="auth-card"><h1>Create account</h1><form><label>First name<input></label><label>Last name<input></label><label>Email<input type="email"></label><label>Password<input type="password"></label><button class="button">Create</button></form></section>`,
  'main-reset-password': () => `<section class="auth-card"><h1>Reset password</h1><p>Enter a new password for your account.</p><form><label>Password<input type="password"></label><label>Confirm password<input type="password"></label><button class="button">Reset password</button></form></section>`,
  'main-search': () => `<section>${sectionIntro('Search results', 'Search form, filters, and sample result cards.')}<form class="search-box"><input type="search" value="LED panel"><button class="button">Search</button></form>${productGrid(4)}${articleGrid()}</section>`,
  multicolumn: () => `<section>${sectionIntro('Why contractors choose us', 'A three-column content section with icons and links.')}<div class="feature-grid">${['Fast quote support', 'Project pricing', 'Pickup options'].map((item) => `<article class="feature-card"><span class="feature-icon">+</span><h3>${item}</h3><p>Short supporting copy for the feature block.</p><a href="#">Learn more</a></article>`).join('')}</div></section>`,
  multirow: () => `<section class="multirow">${splitSection('Warehouse lighting packages')}${splitSection('Emergency lighting support', true)}${splitSection('Outdoor fixture planning')}</section>`,
  newsletter: () => `<section class="newsletter-card"><h1>Newsletter</h1><p>Get inventory alerts, project pricing updates, and new product notices.</p><form><input type="email" placeholder="Email address"><button class="button">Subscribe</button></form></section>`,
  page: () => `<section class="page-content">${sectionIntro('Page template', 'The page section renders rich content from a Shopify page object.')}<p>This static example includes a media block, text content, and a call to action.</p>${buttonRow()}</section>`,
  'pickup-availability': () => `<section class="pickup-card"><h1>Pickup availability</h1><p><strong>Available today</strong> at Lider Electric warehouse.</p><p>Usually ready in 2 hours. Bring your order confirmation for pickup.</p><button class="button button--secondary">View store information</button></section>`,
  'predictive-search': () => `<section class="predictive-search-panel"><form class="search-box"><input type="search" value="panel light"><button class="button">Search</button></form><h2>Suggestions</h2><ul class="suggestion-list"><li>panel light 2x4</li><li>led panel 4000k</li><li>recessed lighting</li></ul><h2>Products</h2>${productGrid(3)}</section>`,
  'quick-order-list': () => quickOrderList('Quick order list'),
  'related-products': () => `<section>${sectionIntro('Related products', 'A recommendation grid.')}${productGrid(4)}</section>`,
  'rich-text': () => `<section class="rich-text-section"><p class="eyebrow">About Lider Electric</p><h1>Reliable commercial lighting supply</h1><p>Use rich text for a focused message, policy highlight, or store promise with a clear action.</p>${buttonRow()}</section>`,
  slideshow: () => `<section class="slideshow" data-slider><button type="button" data-slider-prev>‹</button><div class="slide-stage"><article data-slide class="slide is-active">${heroSection('Spring LED panel sale', 'Save on select commercial fixtures this month.')}</article><article data-slide class="slide">${heroSection('Outdoor lighting projects', 'Wall packs and security fixtures for building exteriors.')}</article><article data-slide class="slide">${heroSection('Emergency lighting', 'Exit signs and battery backup units for safety upgrades.')}</article></div><button type="button" data-slider-next>›</button></section>`,
  video: () => `<section class="video-section"><div class="video-frame"><button type="button" data-play-video>Play</button><img src="${svgData('Product video')}" alt="Video poster"></div><div>${sectionIntro('Product installation video', 'Use this section for YouTube, Vimeo, or uploaded video content.')}</div></section>`,
};

function fallbackSection(title) {
  return `<section class="demo-panel">
    ${sectionIntro(title, 'Static HTML item generated from the matching Shopify section file.')}
    ${splitSection(title)}
  </section>`;
}

function pageDocument(fileName, title, content) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title} - Shopify Element</title>
    <link rel="stylesheet" href="shopify-elements.css">
    <script src="shopify-elements.js" defer></script>
  </head>
  <body>
    <header class="element-topbar">
      <a href="index.html">Shopify elements</a>
      <span>${fileName}</span>
    </header>
    <main class="element-page">
      ${content}
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
    <link rel="stylesheet" href="shopify-elements.css">
  </head>
  <body>
    <main class="index-page">
      <p class="eyebrow">Dawn section conversions</p>
      <h1>Shopify Elements</h1>
      <p>Standalone visual HTML examples for each Liquid section in the exported Dawn theme. These are static samples, so Shopify data, routes, checkout, and real section rendering still require Shopify.</p>
      <div class="index-grid">
        ${items.join('\n')}
      </div>
    </main>
  </body>
</html>
`;
}

const css = `
:root {
  --ink: ${palette.ink};
  --muted: ${palette.muted};
  --teal: ${palette.teal};
  --teal-dark: ${palette.tealDark};
  --rust: ${palette.rust};
  --gold: ${palette.gold};
  --paper: ${palette.paper};
  --panel: ${palette.panel};
  --line: ${palette.line};
  --shadow: 0 18px 44px rgba(20, 24, 28, .12);
}

* { box-sizing: border-box; }
body { margin: 0; background: var(--paper); color: var(--ink); font-family: Arial, Helvetica, sans-serif; line-height: 1.5; }
a { color: var(--teal); text-decoration: none; }
a:hover { text-decoration: underline; }
img { max-width: 100%; display: block; }
button, input, select, textarea { font: inherit; }
input, select, textarea { width: 100%; border: 1px solid var(--line); border-radius: 6px; padding: 11px 12px; background: #fff; }
textarea { min-height: 96px; resize: vertical; }
label { display: grid; gap: 6px; color: var(--muted); font-size: 14px; font-weight: 700; }
h1, h2, h3, p { margin-top: 0; }
h1 { font-size: clamp(32px, 5vw, 56px); line-height: 1.02; margin-bottom: 14px; }
h2 { font-size: clamp(24px, 3vw, 34px); line-height: 1.12; }
h3 { font-size: 19px; line-height: 1.2; margin-bottom: 6px; }
.element-topbar { position: sticky; top: 0; z-index: 50; display: flex; justify-content: space-between; gap: 16px; padding: 13px 20px; border-bottom: 1px solid var(--line); background: rgba(255,255,255,.94); backdrop-filter: blur(12px); }
.element-topbar span { color: var(--muted); font-size: 13px; }
.element-page, .index-page { width: min(1160px, calc(100% - 32px)); margin: 0 auto; padding: 34px 0 70px; }
.index-page { padding-top: 54px; }
.index-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 10px; margin-top: 28px; }
.index-card { display: grid; gap: 4px; min-height: 84px; padding: 15px; border: 1px solid var(--line); border-radius: 8px; background: #fff; box-shadow: 0 8px 24px rgba(20,24,28,.06); }
.index-card strong { color: var(--teal); }
.index-card span { color: var(--muted); font-size: 13px; }
.eyebrow { color: var(--rust); font-size: 12px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; margin-bottom: 8px; }
.section-heading { max-width: 760px; margin-bottom: 24px; }
.section-heading p:last-child { color: var(--muted); font-size: 17px; }
.button-row { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-top: 18px; }
.button, .small-button { display: inline-flex; align-items: center; justify-content: center; border: 1px solid var(--teal); border-radius: 6px; background: var(--teal); color: #fff; font-weight: 800; cursor: pointer; text-decoration: none; }
.button { min-height: 46px; padding: 12px 18px; }
.small-button { min-height: 34px; padding: 8px 12px; font-size: 14px; }
.button:hover, .small-button:hover { background: var(--teal-dark); text-decoration: none; }
.button--secondary { background: #fff; color: var(--teal); }
.hero-section { position: relative; min-height: 460px; display: grid; align-items: end; overflow: hidden; border-radius: 8px; background: #101820; box-shadow: var(--shadow); }
.hero-section > img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: .62; }
.hero-section__content { position: relative; max-width: 680px; padding: clamp(26px, 5vw, 64px); color: #fff; }
.hero-section__content p { font-size: 18px; color: rgba(255,255,255,.88); }
.hero-section__content .eyebrow { color: #ffd98a; }
.split-section { display: grid; grid-template-columns: minmax(0, 1fr) minmax(280px, 48%); gap: 26px; align-items: center; padding: 26px; border: 1px solid var(--line); border-radius: 8px; background: #fff; box-shadow: var(--shadow); }
.split-section--reverse { grid-template-columns: minmax(280px, 48%) minmax(0, 1fr); }
.split-section--reverse > div { order: 2; }
.split-section img { border-radius: 8px; width: 100%; aspect-ratio: 4 / 3; object-fit: cover; }
.product-grid, .collection-grid, .article-grid, .feature-grid, .app-grid, .dashboard-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 16px; }
.product-card, .collection-card, .article-card, .feature-card, .app-card, .dashboard-card, .form-card, .summary-card, .auth-card, .demo-panel, .notification-card, .pickup-card, .newsletter-card, .custom-html-block, .rich-text-section { border: 1px solid var(--line); border-radius: 8px; background: #fff; box-shadow: var(--shadow); }
.product-card { overflow: hidden; }
.product-card__media { position: relative; display: block; background: #eef3f2; }
.product-card__media img { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; }
.badge { position: absolute; left: 12px; top: 12px; padding: 5px 8px; border-radius: 999px; background: var(--gold); color: #1b1f22; font-size: 12px; font-weight: 800; }
.product-card__body, .collection-card div, .article-card div, .feature-card, .app-card, .dashboard-card { padding: 15px; }
.product-card__body p, .collection-card p, .article-card p, .feature-card p, .app-card p, .dashboard-card p { color: var(--muted); }
.price-row { display: flex; justify-content: space-between; gap: 12px; align-items: center; margin-top: 12px; }
.collection-card, .article-card { overflow: hidden; }
.collection-card img, .article-card img { width: 100%; aspect-ratio: 16 / 10; object-fit: cover; }
.cart-layout { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 20px; align-items: start; }
.cart-card, .summary-card { padding: 22px; }
.cart-line { display: grid; grid-template-columns: 110px minmax(0, 1fr) 145px 90px; gap: 16px; align-items: center; padding: 16px 0; border-top: 1px solid var(--line); }
.cart-line--compact { grid-template-columns: 72px minmax(0, 1fr) 72px; border-top: 0; }
.cart-line img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 6px; }
.qty-control { display: inline-grid; grid-template-columns: 34px 52px 34px; border: 1px solid var(--line); border-radius: 6px; overflow: hidden; background: #fff; }
.qty-control button { border: 0; background: #f0ebe2; cursor: pointer; }
.qty-control input { border: 0; text-align: center; padding: 8px 4px; }
.summary-card { display: grid; gap: 13px; }
.summary-line { display: flex; justify-content: space-between; gap: 16px; padding-top: 10px; border-top: 1px solid var(--line); }
.summary-line.total { font-size: 19px; font-weight: 800; }
.discount { color: var(--teal-dark); }
.drawer-sample { margin-top: 18px; max-width: 430px; border: 1px solid var(--line); border-radius: 8px; background: #fff; box-shadow: var(--shadow); overflow: hidden; }
.drawer-sample__header, .drawer-sample__footer { padding: 16px; border-bottom: 1px solid var(--line); }
.drawer-sample__footer { border-top: 1px solid var(--line); border-bottom: 0; }
.drawer-sample__body { padding: 16px; }
.sample-header { display: flex; flex-wrap: wrap; gap: 16px; align-items: center; justify-content: space-between; padding: 18px 22px; border: 1px solid var(--line); border-radius: 8px; background: #fff; box-shadow: var(--shadow); }
.sample-header nav { display: flex; gap: 16px; flex-wrap: wrap; }
.header-search { width: min(260px, 100%); }
.cart-icon { display: inline-flex; gap: 8px; align-items: center; padding: 8px 12px; border: 1px solid var(--line); border-radius: 6px; color: var(--ink); }
.cart-icon strong { min-width: 22px; height: 22px; display: grid; place-items: center; border-radius: 999px; background: var(--teal); color: #fff; font-size: 12px; }
.announcement-slider, .slideshow { display: grid; grid-template-columns: 44px minmax(0, 1fr) 44px; align-items: center; gap: 10px; }
.announcement-slider button, .slideshow > button { height: 44px; border: 1px solid var(--line); border-radius: 6px; background: #fff; cursor: pointer; }
.announcement-track { border: 1px solid var(--line); border-radius: 8px; background: var(--teal); color: #fff; text-align: center; overflow: hidden; }
[data-slide] { display: none; }
[data-slide].is-active { display: block; }
.announcement-track p { margin: 0; padding: 15px; font-weight: 800; }
.slide-stage { min-width: 0; }
.slide { margin: 0; }
.collage-grid { display: grid; grid-template-columns: 1.3fr .7fr; gap: 16px; }
.collage-feature { grid-row: span 2; }
.accordion-layout { display: grid; grid-template-columns: 38% minmax(0, 1fr); gap: 20px; align-items: start; }
.accordion-layout img { border-radius: 8px; box-shadow: var(--shadow); }
details { border: 1px solid var(--line); border-radius: 8px; background: #fff; padding: 14px 16px; margin-bottom: 10px; }
summary { cursor: pointer; font-weight: 800; }
.contact-layout, .catalog-layout, .product-detail, .video-section { display: grid; grid-template-columns: minmax(0, 1fr) minmax(300px, 420px); gap: 22px; align-items: start; }
.form-card, .auth-card, .demo-panel, .notification-card, .pickup-card, .newsletter-card, .custom-html-block, .rich-text-section { padding: 22px; }
.form-card form, .auth-card form, .newsletter-card form, form.form-card { display: grid; gap: 14px; }
.email-banner { position: relative; }
.floating-signup { width: min(520px, calc(100% - 32px)); margin: -44px auto 0; position: relative; display: grid; grid-template-columns: 1fr auto; gap: 10px; padding: 14px; border: 1px solid var(--line); border-radius: 8px; background: #fff; box-shadow: var(--shadow); }
.metric-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-top: 18px; }
.metric-row span { padding: 16px; border-radius: 8px; background: #f1ece4; }
.metric-row strong { display: block; font-size: 26px; color: var(--teal); }
.sample-footer { display: grid; grid-template-columns: 1.2fr 1fr 1fr; gap: 24px; padding: 30px; border-radius: 8px; background: #172023; color: #fff; }
.sample-footer a, .sample-footer p { color: rgba(255,255,255,.78); display: block; margin-bottom: 8px; }
.product-detail { grid-template-columns: minmax(0, 1.15fr) minmax(320px, .85fr); }
.product-media-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.product-media-grid img { border-radius: 8px; aspect-ratio: 1; object-fit: cover; box-shadow: var(--shadow); }
.product-media-grid__main { grid-column: span 2; aspect-ratio: 4 / 3 !important; }
.product-info { display: grid; gap: 14px; padding: 24px; border: 1px solid var(--line); border-radius: 8px; background: #fff; box-shadow: var(--shadow); }
.large-price { font-size: 26px; font-weight: 800; color: var(--teal); }
.auth-card { width: min(480px, 100%); margin: 0 auto; }
.dashboard-grid { align-items: start; }
.article-detail, .page-content { max-width: 860px; margin: 0 auto; }
.article-detail img, .page-content img { width: 100%; border-radius: 8px; box-shadow: var(--shadow); margin-bottom: 22px; }
.lead { font-size: 20px; color: var(--muted); }
blockquote { margin: 24px 0; padding: 18px 22px; border-left: 4px solid var(--gold); background: #fff; }
.collection-banner { padding: clamp(30px, 6vw, 70px); border-radius: 8px; background: #172023; color: #fff; }
.collection-banner p { color: rgba(255,255,255,.8); max-width: 650px; }
.filter-panel { display: grid; gap: 12px; padding: 18px; border: 1px solid var(--line); border-radius: 8px; background: #fff; box-shadow: var(--shadow); }
.password-header, .password-footer { display: flex; justify-content: space-between; gap: 14px; align-items: center; padding: 20px; border-radius: 8px; background: #fff; box-shadow: var(--shadow); }
.social-row { display: flex; gap: 14px; flex-wrap: wrap; }
.search-box { display: grid; grid-template-columns: 1fr auto; gap: 10px; margin-bottom: 22px; }
.feature-icon { width: 42px; height: 42px; display: grid; place-items: center; border-radius: 999px; background: var(--gold); color: #1b1f22; font-weight: 900; margin-bottom: 14px; }
.multirow { display: grid; gap: 18px; }
.newsletter-card, .rich-text-section, .empty-state { text-align: center; max-width: 780px; margin: 0 auto; padding: clamp(26px, 6vw, 64px); }
.newsletter-card form { grid-template-columns: 1fr auto; margin-top: 20px; }
.empty-state { border: 1px solid var(--line); border-radius: 8px; background: #fff; box-shadow: var(--shadow); }
.predictive-search-panel h2 { margin-top: 26px; }
.suggestion-list { display: flex; flex-wrap: wrap; gap: 10px; padding: 0; list-style: none; }
.suggestion-list li { padding: 8px 12px; border: 1px solid var(--line); border-radius: 999px; background: #fff; }
.video-frame { position: relative; border-radius: 8px; overflow: hidden; box-shadow: var(--shadow); background: #111; }
.video-frame img { width: 100%; aspect-ratio: 16 / 9; object-fit: cover; opacity: .72; }
.video-frame button { position: absolute; inset: 50% auto auto 50%; transform: translate(-50%, -50%); z-index: 2; width: 78px; height: 78px; border: 0; border-radius: 999px; background: var(--gold); font-weight: 900; cursor: pointer; }
.data-table { width: 100%; border-collapse: collapse; overflow: hidden; border: 1px solid var(--line); border-radius: 8px; background: #fff; box-shadow: var(--shadow); }
.data-table th, .data-table td { padding: 14px; border-bottom: 1px solid var(--line); text-align: left; }
.data-table th { background: #f1ece4; font-size: 12px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); }
.live-region-demo [role="status"] { margin-bottom: 16px; padding: 13px 16px; border-radius: 8px; background: #fff7df; border: 1px solid #ecd28d; }
@media (max-width: 850px) {
  .cart-layout, .contact-layout, .catalog-layout, .product-detail, .video-section, .split-section, .split-section--reverse, .accordion-layout { grid-template-columns: 1fr; }
  .split-section--reverse > div { order: 0; }
  .cart-line { grid-template-columns: 84px minmax(0, 1fr); }
  .cart-line > strong, .cart-line .qty-control { grid-column: 2; }
  .collage-grid { grid-template-columns: 1fr; }
  .sample-footer { grid-template-columns: 1fr; }
  .floating-signup, .newsletter-card form, .search-box { grid-template-columns: 1fr; }
}
`;

const js = `
document.addEventListener('click', (event) => {
  const sliderButton = event.target.closest('[data-slider-next], [data-slider-prev]');
  if (sliderButton) {
    const slider = sliderButton.closest('[data-slider]');
    const slides = [...slider.querySelectorAll('[data-slide]')];
    const current = Math.max(0, slides.findIndex((slide) => slide.classList.contains('is-active')));
    const direction = sliderButton.matches('[data-slider-next]') ? 1 : -1;
    const next = (current + direction + slides.length) % slides.length;
    slides[current].classList.remove('is-active');
    slides[next].classList.add('is-active');
  }

  const qtyButton = event.target.closest('[data-qty-minus], [data-qty-plus]');
  if (qtyButton) {
    const control = qtyButton.closest('.qty-control');
    const input = control.querySelector('input');
    const step = qtyButton.matches('[data-qty-plus]') ? 1 : -1;
    input.value = Math.max(1, Number(input.value || 1) + step);
  }

  if (event.target.closest('[data-open-drawer]')) {
    document.querySelector('[data-drawer]')?.classList.add('is-open');
  }

  if (event.target.closest('[data-close-drawer]')) {
    document.querySelector('[data-drawer]')?.classList.remove('is-open');
  }

  if (event.target.closest('[data-play-video]')) {
    event.target.textContent = 'Playing';
  }
});
`;

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'shopify-elements.css'), css.trimStart(), 'utf8');
fs.writeFileSync(path.join(outDir, 'shopify-elements.js'), js.trimStart(), 'utf8');

const sourceFiles = fs
  .readdirSync(sourceDir)
  .filter((file) => file.endsWith('.liquid'))
  .sort();

const indexItems = [];

for (const fileName of sourceFiles) {
  const baseName = path.basename(fileName, '.liquid');
  const title = titleFromName(baseName);
  const content = (templates[baseName] || (() => fallbackSection(title)))();
  const outputName = `${baseName}.html`;

  fs.writeFileSync(path.join(outDir, outputName), pageDocument(fileName, title, content), 'utf8');
  indexItems.push(`<a class="index-card" href="${outputName}"><strong>${title}</strong><span>${fileName}</span></a>`);
}

fs.writeFileSync(path.join(outDir, 'index.html'), indexDocument(indexItems), 'utf8');
console.log(`Built ${sourceFiles.length} visual Shopify element files in ${outDir}`);
