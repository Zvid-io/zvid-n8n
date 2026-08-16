const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const sourcePath = path.join(root, 'workflows', 'zvid-shopify-catalog-videos.json');
const outputPath = path.join(root, 'workflows', 'zvid-shopify-dynamic-product-ad-factory.json');
const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));

const cloneNode = (name, newName = name) => {
  const node = source.nodes.find((entry) => entry.name === name);
  if (!node) throw new Error(`Missing source node: ${name}`);
  const copy = JSON.parse(JSON.stringify(node));
  copy.name = newName;
  return copy;
};

const node = (name, type, position, parameters, extra = {}) => ({
  parameters,
  type,
  typeVersion: extra.typeVersion || ({
    'n8n-nodes-base.code': 2,
    'n8n-nodes-base.if': 2.2,
    'n8n-nodes-base.httpRequest': 4.2,
    'n8n-nodes-base.set': 3.4,
    'n8n-nodes-base.stickyNote': 1,
  }[type] || 1),
  position,
  id: extra.id,
  name,
  ...Object.fromEntries(Object.entries(extra).filter(([key]) => !['id', 'typeVersion'].includes(key))),
});

const sticky = (id, name, position, width, height, content, color = 5) => node(
  name,
  'n8n-nodes-base.stickyNote',
  position,
  { content, height, width, color },
  { id, typeVersion: 1 },
);

const manual = cloneNode('Test manually');
manual.id = 'zvid-da-0001';
manual.position = [-1500, 300];

const schedule = cloneNode('Every day at 6am', 'Every Monday at 9am');
schedule.id = 'zvid-da-0002';
schedule.position = [-1500, 480];
schedule.parameters.rule.interval[0].expression = '0 9 * * 1';

const config = node('Config', 'n8n-nodes-base.set', [-1280, 390], {
  mode: 'raw',
  jsonOutput: JSON.stringify({
    editorUrl: 'https://editor.zvid.io',
    shopDomain: 'your-store',
    shopifyApiVersion: '2026-07',
    shopifyProductQuery: 'status:active',
    scanLimit: 50,
    maxProducts: 3,
    variantsPerProduct: 3,
    maxTotalAds: 5,
    brandName: 'YOUR BRAND',
    website: 'your-store.com',
    ctaText: 'Shop now',
    accentColor: '#C96F4A',
    paleAccentColor: '#F1C7B3',
    backgroundColor: '#2B1D18',
    creamColor: '#FAFAF7',
    resolution: 'instagram-post',
    musicUrl: '',
    musicVolume: 0.16,
    hookTemplates: [
      'Meet your next everyday favorite.',
      'A fresh look at {{product}}.',
      '{{product}} belongs in the rotation.',
    ],
    creativeFormats: ['product-first', 'benefit-first', 'offer-first'],
    dryRun: true,
    deliveryWebhookUrl: '',
    bulkName: 'Shopify dynamic product ads',
    pollSeconds: 10,
    timeoutMinutes: 20,
  }, null, 2),
  options: {},
}, { id: 'zvid-da-0003' });

const getCatalog = cloneNode('Get Shopify catalog');
getCatalog.id = 'zvid-da-0004';
getCatalog.position = [-1060, 390];
getCatalog.parameters.jsonBody = "={{ JSON.stringify({ query: `query AdCandidates($first: Int!, $query: String!) { shop { name currencyCode primaryDomain { url } } products(first: $first, query: $query, sortKey: UPDATED_AT, reverse: true) { nodes { id title handle description vendor productType tags status featuredImage { url(transform: { maxWidth: 1600, maxHeight: 1600, preferredContentType: WEBP }) altText } images(first: 3) { nodes { url(transform: { maxWidth: 1600, maxHeight: 1600, preferredContentType: WEBP }) altText } } variants(first: 1) { nodes { title price compareAtPrice } } } } }`, variables: { first: Math.min(250, Math.max(1, Number($('Config').first().json.scanLimit || 50))), query: String($('Config').first().json.shopifyProductQuery || 'status:active') } }) }}";

const buildConceptsCode = String.raw`const cfg = $('Config').first().json;
const res = $input.first().json || {};
const status = Number(res.statusCode || 200);
const body = res.body === undefined ? res : res.body;
if (status !== 200) throw new Error('Shopify catalog query failed (HTTP ' + status + '): ' + JSON.stringify(body).slice(0, 700));
if (Array.isArray(body.errors) && body.errors.length) throw new Error('Shopify GraphQL error: ' + body.errors.map((e) => e.message).join('; '));
const data = body.data || {};
const products = data.products && Array.isArray(data.products.nodes) ? data.products.nodes : [];
const clean = (value) => String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
const trim = (value, max) => { const text = clean(value); if (text.length <= max) return text; const cut = text.slice(0, max - 1); const at = cut.lastIndexOf(' '); return (at > max * 0.55 ? cut.slice(0, at) : cut).replace(/[\s,;:.—-]+$/, '') + '…'; };
const currency = clean(data.shop && data.shop.currencyCode) || 'USD';
const money = (value) => { const amount = Number(value); if (!Number.isFinite(amount)) return clean(value); try { return new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount); } catch { return '$' + amount.toFixed(2); } };
const storefront = clean(data.shop && data.shop.primaryDomain && data.shop.primaryDomain.url).replace(/\/+$/, '') || ('https://' + cfg.shopDomain + '.myshopify.com');
const hookTemplates = Array.isArray(cfg.hookTemplates) && cfg.hookTemplates.length ? cfg.hookTemplates : ['Meet your next everyday favorite.'];
const creativeFormats = Array.isArray(cfg.creativeFormats) && cfg.creativeFormats.length ? cfg.creativeFormats : ['product-first'];
const maxProducts = Math.max(1, Math.floor(Number(cfg.maxProducts || 3)));
const variantsPerProduct = Math.max(1, Math.floor(Number(cfg.variantsPerProduct || 3)));
const maxTotalAds = Math.max(1, Math.floor(Number(cfg.maxTotalAds ?? cfg.maxAdVariants ?? 5)));
const selected = [];
const skipped = [];
for (const product of products) {
  if (selected.length >= maxProducts) break;
  const title = clean(product.title);
  const variant = product.variants && Array.isArray(product.variants.nodes) ? product.variants.nodes[0] : null;
  const images = [
    clean(product.featuredImage && product.featuredImage.url),
    ...((product.images && Array.isArray(product.images.nodes) ? product.images.nodes : []).map((entry) => clean(entry && entry.url))),
  ].filter((url, index, all) => /^https?:\/\//i.test(url) && all.indexOf(url) === index);
  if (!title || !variant || clean(variant.price) === '' || !images.length) {
    skipped.push({ productId: product.id, title: title || '(untitled)', reason: !images.length ? 'missing public image' : !variant ? 'missing priced variant' : 'missing title' });
    continue;
  }
  selected.push({ product, title, variant, images });
}
const ads = [];
for (let variantIndex = 0; variantIndex < variantsPerProduct && ads.length < maxTotalAds; variantIndex += 1) {
  for (const entry of selected) {
    if (ads.length >= maxTotalAds) break;
    const { product, title, variant, images } = entry;
    const price = Number(variant.price);
    const compareAt = Number(variant.compareAtPrice);
    const hasDiscount = Number.isFinite(compareAt) && compareAt > price;
    const savingPercent = hasDiscount ? Math.round((1 - price / compareAt) * 100) : 0;
    const description = trim(product.description, 92) || 'Designed to earn a place in your everyday rotation.';
    const offerOptions = [
      hasDiscount ? ('Save ' + savingPercent + '% — now ' + money(price)) : (money(price) + ' — available now'),
      'Discover ' + title + ' for ' + money(price),
      hasDiscount ? ('Was ' + money(compareAt) + '. Yours for ' + money(price)) : ('A standout pick at ' + money(price)),
    ];
    const format = creativeFormats[variantIndex % creativeFormats.length];
    let hook = clean(hookTemplates[variantIndex % hookTemplates.length]).replace(/\{\{product\}\}/g, title);
    const offer = offerOptions[variantIndex % offerOptions.length];
    if (format === 'benefit-first') hook = description;
    if (format === 'offer-first') hook = hasDiscount ? ('Save ' + savingPercent + '% on ' + title) : (title + ' for ' + money(price));
    const angleLabel = format === 'benefit-first' ? 'WHY YOU WILL LOVE IT' : format === 'offer-first' ? 'THE OFFER' : 'THE NEW EDIT';
    const openerHeadline = format === 'benefit-first'
      ? 'Why you will love it'
      : format === 'offer-first'
        ? (hasDiscount ? ('Save ' + savingPercent + '% today') : ('Available for ' + money(price)))
        : title;
    const openerSubheadline = format === 'benefit-first'
      ? description
      : format === 'offer-first'
        ? title
        : hook;
    const storyKicker = format === 'benefit-first' ? 'WHY IT STANDS OUT' : format === 'offer-first' ? 'SHOP THE OFFER' : 'THE PRODUCT';
    const storyCopy = format === 'offer-first' ? offer : description;
    const benefits = format === 'benefit-first'
      ? [
          { title: 'Why it stands out', detail: description },
          { title: 'Ready when you are', detail: offer },
        ]
      : format === 'offer-first'
        ? [
            { title: hasDiscount ? ('Save ' + savingPercent + '%') : money(price), detail: offer },
            { title: 'Worth a closer look', detail: description },
          ]
        : [
            { title: 'Made for the rotation', detail: description },
            { title: 'Available now', detail: offer },
          ];
    const conceptId = String(product.id).split('/').pop() + '-' + String(variantIndex + 1).padStart(2, '0');
    ads.push({
      conceptId,
      trackingKey: 'zvid-ad-' + conceptId,
      shopifyProductId: product.id,
      product: title,
      handle: product.handle,
      productUrl: storefront + '/products/' + product.handle,
      creativeFormat: format,
      audienceHook: trim(hook, 72),
      openerHeadline: trim(openerHeadline, 62),
      openerSubheadline: trim(openerSubheadline, 84),
      storyKicker,
      storyCopy: trim(storyCopy, 92),
      offer: trim(offer, 72),
      price: money(price),
      compareAtPrice: hasDiscount ? money(compareAt) : '',
      ctaText: cfg.ctaText || 'Shop now',
      productImage: images[0],
      productImage2: images[1] || images[0],
      productImage3: images[2] || images[1] || images[0],
      angleLabel,
      description,
      benefits,
      variantLabel: format + ' · ' + conceptId,
    });
  }
}
const variantDistribution = selected.map((entry) => ({
  productId: entry.product.id,
  product: entry.title,
  variants: ads.filter((ad) => ad.shopifyProductId === entry.product.id).length,
  formats: ads.filter((ad) => ad.shopifyProductId === entry.product.id).map((ad) => ad.creativeFormat),
}));
return [{ json: {
  ready: ads.length > 0,
  ads,
  skipped,
  productsScanned: products.length,
  productsSelected: selected.length,
  requested: { maxProducts, variantsPerProduct, maxTotalAds },
  variantDistribution,
  allocation: 'round-robin-by-variant',
} }];`;

const buildConcepts = node('Create ad concepts', 'n8n-nodes-base.code', [-840, 390], { jsCode: buildConceptsCode }, { id: 'zvid-da-0005' });

const conceptsFound = cloneNode('Products found?', 'Ads found?');
conceptsFound.id = 'zvid-da-0006';
conceptsFound.position = [-620, 390];
conceptsFound.parameters.conditions.conditions[0].leftValue = '={{ $json.ready }}';

const nothing = node('Nothing to render', 'n8n-nodes-base.code', [-400, 620], {
  jsCode: "const data = $input.first().json; return [{ json: { status: 'nothing_to_render', productsScanned: data.productsScanned, skipped: data.skipped, message: 'No eligible Shopify products were found. Products need a title, priced variant, and public image.' } }];",
}, { id: 'zvid-da-0007' });

const buildProjectCode = String.raw`const cfg = $('Config').first().json;
const source = $('Create ad concepts').first().json;
const ads = source.ads || [];
if (!ads.length) throw new Error('No ad concepts to build.');
const first = ads[0];
const safeJobName = (value) => String(value || '').normalize('NFKD').replace(/[^a-zA-Z0-9_ -]+/g, '-').replace(/\s+/g, ' ').replace(/-+/g, '-').trim().slice(0, 120) || 'Shopify product ad';
const background = cfg.backgroundColor || '#2B1D18';
const accent = cfg.accentColor || '#C96F4A';
const paleAccent = cfg.paleAccentColor || '#F1C7B3';
const cream = cfg.creamColor || '#FAFAF7';
const payload = {
  name: 'shopify-atelier-editorial-ad',
  resolution: cfg.resolution || 'instagram-post',
  frameRate: 30,
  backgroundColor: cream,
  outputFormat: 'mp4',
  variables: {
    brandName: cfg.brandName,
    productName: first.product,
    angleLabel: first.angleLabel,
    openerHeadline: first.openerHeadline,
    openerSubheadline: first.openerSubheadline,
    storyKicker: first.storyKicker,
    storyCopy: first.storyCopy,
    ctaText: first.ctaText,
    price: first.price,
    offer: first.offer,
    productImage: first.productImage,
    detailImage: first.productImage2,
    textureImage: first.productImage3,
    benefits: first.benefits,
    website: cfg.website,
    variantLabel: first.variantLabel,
    musicUrl: cfg.musicUrl || '',
  },
  scenes: [
    { id: 'opener', duration: 3.6, backgroundColor: cream, transition: 'fade', transitionId: 'about', transitionDuration: 0.5, visuals: [
      { type: 'IMAGE', src: '{{productImage}}', width: 1080, height: 1080, position: 'center-center', resize: 'cover', zoom: true, track: 0, enterBegin: 0, exitEnd: 3.6 },
      { type: 'SVG', width: 1080, height: 1080, track: 1, enterBegin: 0, exitEnd: 3.6, svg: "<svg width='1080' height='1080' viewBox='0 0 1080 1080' xmlns='http://www.w3.org/2000/svg'><defs><linearGradient id='editorialOpen' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='" + background + "' stop-opacity='.42'/><stop offset='.5' stop-color='" + background + "' stop-opacity='.2'/><stop offset='1' stop-color='" + background + "' stop-opacity='.9'/></linearGradient></defs><rect width='1080' height='1080' fill='" + background + "' fill-opacity='.18'/><rect width='1080' height='1080' fill='url(#editorialOpen)'/></svg>" },
      { type: 'TEXT', x: 70, y: 690, width: 940, anchor: 'top-left', track: 2, enterBegin: 0.3, enterEnd: 0.75, enterAnimation: 'smoothup', exitEnd: 3.6, style: { fontFamily: 'Manrope', color: '#FFFFFF' }, html: "<div style='color:" + paleAccent + ";font-size:20px;font-weight:800;letter-spacing:4px;'>{{angleLabel}}</div><div style='margin-top:12px;color:#FFFFFF;font-size:54px;line-height:1.08;font-weight:800;letter-spacing:-1px;overflow-wrap:anywhere;'>{{openerHeadline}}</div><div style='margin-top:14px;color:#F7EDE8;font-size:27px;line-height:1.3;font-weight:600;'>{{openerSubheadline}}</div><div style='margin-top:16px;color:" + paleAccent + ";font-size:19px;font-weight:700;letter-spacing:2px;'>{{brandName}} · {{productName}}</div>" },
    ] },
    { id: 'about', duration: 4.2, backgroundColor: cream, transition: 'smoothleft', transitionId: 'benefit', transitionDuration: 0.5, visuals: [
      { type: 'IMAGE', src: '{{detailImage}}', width: 1080, height: 1080, position: 'center-center', resize: 'cover', zoom: true, track: 0, enterEnd: 0.5, enterAnimation: 'smoothright', exitEnd: 4.2 },
      { type: 'SVG', width: 1080, height: 1080, track: 1, enterBegin: 0, exitEnd: 4.2, svg: "<svg width='1080' height='1080' viewBox='0 0 1080 1080' xmlns='http://www.w3.org/2000/svg'><defs><linearGradient id='productReadability' x1='0' y1='0' x2='1' y2='0'><stop offset='0' stop-color='#211612' stop-opacity='.82'/><stop offset='.48' stop-color='#211612' stop-opacity='.38'/><stop offset='.78' stop-color='#211612' stop-opacity='.05'/><stop offset='1' stop-color='#211612' stop-opacity='0'/></linearGradient><linearGradient id='productBottom' x1='0' y1='0' x2='0' y2='1'><stop offset='.45' stop-color='#211612' stop-opacity='0'/><stop offset='1' stop-color='#211612' stop-opacity='.58'/></linearGradient></defs><rect width='1080' height='1080' fill='url(#productReadability)'/><rect width='1080' height='1080' fill='url(#productBottom)'/></svg>" },
      { type: 'TEXT', x: 72, y: 720, width: 520, anchor: 'top-left', track: 2, enterBegin: 0.4, enterEnd: 0.85, enterAnimation: 'smoothup', exitEnd: 4.2, style: { fontFamily: 'Manrope', color: '#FFFFFF' }, html: "<div style='color:" + paleAccent + ";font-size:20px;font-weight:800;letter-spacing:4px;'>{{storyKicker}}</div><div style='margin-top:14px;color:#FFFFFF;font-size:34px;line-height:1.35;font-weight:700;'>{{storyCopy}}</div>" },
    ] },
    { id: 'benefit', iterate: 'benefits', iterateAs: 'benefit', duration: 3, backgroundColor: '#F4E6DA', transition: 'smoothleft', transitionId: 'offer', transitionDuration: 0.5, visuals: [
      { type: 'SVG', width: 1080, height: 1080, track: 0, enterBegin: 0, exitEnd: 3, svg: "<svg width='1080' height='1080' viewBox='0 0 1080 1080' xmlns='http://www.w3.org/2000/svg'><rect width='1080' height='1080' fill='#F4E6DA'/><circle cx='540' cy='385' r='120' fill='" + accent + "'/><path d='M485 385 L525 427 L600 343' stroke='#FFFFFF' stroke-width='16' fill='none' stroke-linecap='round' stroke-linejoin='round'/><circle cx='540' cy='385' r='150' fill='none' stroke='" + accent + "' stroke-opacity='.35' stroke-width='2'/></svg>" },
      { type: 'TEXT', x: 540, y: 590, width: 880, anchor: 'top-center', track: 2, enterBegin: 0.25, enterEnd: 0.7, enterAnimation: 'smoothup', exitEnd: 3, style: { fontFamily: 'Manrope', color: background }, html: "<div style='text-align:center;color:" + background + ";font-size:52px;line-height:1.1;font-weight:800;'>{{benefit.title}}</div><div style='margin-top:16px;text-align:center;color:#6C554C;font-size:27px;line-height:1.4;font-weight:600;'>{{benefit.detail}}</div>" },
      { type: 'TEXT', x: 540, y: 80, anchor: 'center-center', track: 1, enterBegin: 0, exitEnd: 3, style: { fontFamily: 'Manrope', color: '#6C554C' }, html: "<div style='color:#6C554C;font-size:19px;font-weight:700;letter-spacing:5px;'>{{brandName}} · {{productName}}</div>" },
    ] },
    { id: 'offer', duration: 3.8, backgroundColor: cream, transition: 'fade', transitionId: 'outro', transitionDuration: 0.5, visuals: [
      { type: 'IMAGE', src: '{{textureImage}}', width: 1080, height: 1080, position: 'center-center', resize: 'cover', zoom: true, track: 0, enterBegin: 0, exitEnd: 3.8 },
      { type: 'SVG', width: 1080, height: 1080, track: 1, enterBegin: 0, exitEnd: 3.8, svg: "<svg width='1080' height='1080' viewBox='0 0 1080 1080' xmlns='http://www.w3.org/2000/svg'><defs><linearGradient id='offerShade' x1='0' y1='1' x2='0' y2='0'><stop offset='0' stop-color='" + background + "' stop-opacity='.88'/><stop offset='.6' stop-color='" + background + "' stop-opacity='.16'/><stop offset='1' stop-color='" + background + "' stop-opacity='.34'/></linearGradient></defs><rect width='1080' height='1080' fill='url(#offerShade)'/></svg>" },
      { type: 'TEXT', x: 70, y: 720, width: 940, anchor: 'top-left', track: 2, enterBegin: 0.3, enterEnd: 0.75, enterAnimation: 'smoothup', exitEnd: 3.8, style: { fontFamily: 'Manrope', color: '#FFFFFF' }, html: "<div style='color:" + paleAccent + ";font-size:21px;font-weight:800;letter-spacing:4px;'>THE OFFER</div><div style='margin-top:12px;color:#FFFFFF;font-size:52px;line-height:1.15;font-weight:800;'>{{offer}}</div>" },
    ] },
    { id: 'outro', duration: 3.8, backgroundColor: background, visuals: [
      { type: 'SVG', width: 1080, height: 1080, track: 0, enterBegin: 0, exitEnd: 3.8, svg: "<svg width='1080' height='1080' viewBox='0 0 1080 1080' xmlns='http://www.w3.org/2000/svg'><defs><radialGradient id='editorialOut' cx='.5' cy='.4' r='.9'><stop offset='0' stop-color='#5A3326'/><stop offset='1' stop-color='" + background + "'/></radialGradient></defs><rect width='1080' height='1080' fill='url(#editorialOut)'/><rect x='300' y='210' width='480' height='130' rx='65' fill='none' stroke='" + paleAccent + "' stroke-opacity='.82' stroke-width='2'/></svg>" },
      { type: 'TEXT', x: 540, y: 275, width: 420, anchor: 'center-center', track: 1, enterBegin: 0.2, enterEnd: 0.6, enterAnimation: 'fade', exitEnd: 3.8, style: { fontFamily: 'Cormorant Garamond', color: paleAccent }, html: "<div style='text-align:center;color:" + paleAccent + ";font-size:52px;line-height:1;font-weight:700;white-space:nowrap;'>{{brandName}}</div>" },
      { type: 'TEXT', x: 540, y: 460, width: 920, anchor: 'top-center', track: 2, enterBegin: 0.45, enterEnd: 0.9, enterAnimation: 'smoothup', exitEnd: 3.8, style: { fontFamily: 'Manrope', color: '#FFFFFF' }, html: "<div style='text-align:center;color:#FFFFFF;font-size:44px;line-height:1.12;font-weight:800;'>{{productName}}</div><div style='margin-top:18px;text-align:center;color:" + paleAccent + ";font-size:66px;font-weight:800;'>{{price}}</div>" },
      { type: 'TEXT', x: 540, y: 710, anchor: 'top-center', track: 3, enterBegin: 0.9, enterEnd: 1.3, enterAnimation: 'circleopen', exitEnd: 3.8, style: { fontFamily: 'Manrope', color: '#FFFFFF' }, html: "<div style='display:inline-block;border:2px solid " + paleAccent + ";color:#FFFFFF;border-radius:999px;padding:22px 58px;font-size:32px;font-weight:800;'>{{ctaText}} →</div>" },
      { type: 'TEXT', x: 540, y: 900, width: 900, anchor: 'top-center', track: 4, enterBegin: 1.1, enterEnd: 1.5, enterAnimation: 'fade', exitEnd: 3.8, style: { fontFamily: 'Manrope', color: '#D8C9C1' }, html: "<div style='text-align:center;color:#D8C9C1;font-size:20px;'>{{website}} · {{variantLabel}}</div>" },
    ] },
  ],
  audios: cfg.musicUrl ? [{ src: '{{musicUrl}}', volume: Number(cfg.musicVolume || 0.16), track: 0 }] : [],
};
const items = ads.map((ad) => ({
  name: safeJobName(ad.product + ' - ' + ad.creativeFormat + ' - ' + ad.conceptId),
  variables: { brandName: cfg.brandName, productName: ad.product, angleLabel: ad.angleLabel, openerHeadline: ad.openerHeadline, openerSubheadline: ad.openerSubheadline, storyKicker: ad.storyKicker, storyCopy: ad.storyCopy, ctaText: ad.ctaText, price: ad.price, offer: ad.offer, productImage: ad.productImage, detailImage: ad.productImage2, textureImage: ad.productImage3, benefits: ad.benefits, website: cfg.website, variantLabel: ad.variantLabel, musicUrl: cfg.musicUrl || '' },
}));
return [{ json: { payload, items, meta: { approvedTemplate: 'Atelier Editorial · Contrast Fix', designBasisTemplateId: 'tpl_EghDTSfEMbc4Jh7MGCHh', ads, skipped: source.skipped, productsScanned: source.productsScanned, productsSelected: source.productsSelected, approxVideoSeconds: 18.9 } } }];`;

const buildProject = node('Build ad template', 'n8n-nodes-base.code', [-400, 280], { jsCode: buildProjectCode }, { id: 'zvid-da-0008' });

const validate = node('Validate project (free)', '@zvid/n8n-nodes-zvid.zvid', [-160, 280], {
  resource: 'render',
  operation: 'validate',
  source: 'json',
  projectJson: '={{ $json.payload }}',
  validationVariables: '={{ $json.items[0].variables }}',
  additionalFields: {},
}, { id: 'zvid-da-0009', typeVersion: 1 });

const checkValidation = cloneNode('Check validation');
checkValidation.id = 'zvid-da-0010';
checkValidation.position = [80, 280];
checkValidation.parameters.jsCode = String.raw`const result = $input.first().json || {};
if (!result.valid) {
  const details = Array.isArray(result.errors)
    ? result.errors.map((entry) => '  - ' + (entry.field || 'project') + ': ' + entry.message).join('\n')
    : JSON.stringify(result).slice(0, 500);
  throw new Error('Zvid rejected the project: ' + (result.message || result.error || 'Validation failed') + '\n' + details);
}
const build = $('Build ad template').first().json;
const perVideo = Number(result.creditsRequired) || 0;
return [{ json: {
  ...build,
  creditsPerVideo: perVideo,
  totalCredits: perVideo * build.items.length,
  warnings: result.warnings || [],
  resolvedFirst: result.payload,
  schemaVersion: result.schemaVersion,
} }];`;

const dryRun = cloneNode('Dry run?');
dryRun.id = 'zvid-da-0011';
dryRun.position = [320, 280];

const saveDraft = node('Save draft to editor', '@zvid/n8n-nodes-zvid.zvid', [560, 80], {
  resource: 'project',
  operation: 'create',
  projectName: "={{ ('Ad preview - ' + ($json.meta.ads[0] ? $json.meta.ads[0].product : 'first concept')).slice(0, 120) }}",
  projectJson: '={{ $json.resolvedFirst }}',
}, {
  id: 'zvid-da-0012',
  typeVersion: 1,
  onError: 'continueRegularOutput',
  alwaysOutputData: true,
  retryOnFail: true,
  maxTries: 3,
  waitBetweenTries: 5000,
});

const drySummary = cloneNode('Dry run summary');
drySummary.id = 'zvid-da-0013';
drySummary.position = [800, 80];
drySummary.parameters.jsCode = String.raw`const cfg = $('Config').first().json;
const d = $('Check validation').first().json;
let editorLink = null;
let editorDraftError = null;
const cleanDraftError = (error) => {
  const text = String((error && error.message) || error || 'Unknown editor draft error');
  if (/Project limit reached/i.test(text)) return 'Project limit reached. Delete an old saved project in Zvid, then run the dry test again.';
  return text.slice(0, 500);
};
try {
  const saved = $('Save draft to editor').first().json;
  const project = saved.project;
  if (project && project.id) editorLink = String(cfg.editorUrl).replace(/\/+$/, '') + '/?project=' + project.id;
  if (saved.error) editorDraftError = cleanDraftError(saved.error);
} catch (error) { editorDraftError = cleanDraftError(error); }
const conceptPlan = $('Create ad concepts').first().json;
return [{ json: { dryRun: true, productsSelected: conceptPlan.productsSelected, adVariantsPlanned: d.items.length, requested: conceptPlan.requested, allocation: conceptPlan.allocation, variantDistribution: conceptPlan.variantDistribution, concepts: d.meta.ads.map((ad) => ({ trackingKey: ad.trackingKey, product: ad.product, creativeFormat: ad.creativeFormat, hook: ad.audienceHook, openerHeadline: ad.openerHeadline, openerSubheadline: ad.openerSubheadline, storyKicker: ad.storyKicker, storyCopy: ad.storyCopy, offer: ad.offer })), creditsPerVideo: d.creditsPerVideo, totalCredits: d.totalCredits, approxSecondsPerVideo: d.meta.approxVideoSeconds, skipped: d.meta.skipped, warnings: d.warnings, editorLink, editorDraftError, nextStep: editorDraftError ? 'Resolve editorDraftError, then run again with dryRun still true.' : 'Review editorLink, then set dryRun to false. Add deliveryWebhookUrl only when your asset store or social scheduler is ready to accept the rendered manifest.' } }];`;

const submit = cloneNode('Submit bulk render');
submit.id = 'zvid-da-0014';
submit.position = [560, 400];
delete submit.parameters.jsonBody;

const accepted = cloneNode('Check batch accepted');
accepted.id = 'zvid-da-0015';
accepted.position = [800, 400];
accepted.parameters.jsCode = String.raw`const res = $input.first().json;
    const build = $('Check validation').first().json;
if (!res || !res.bulkId) throw new Error('Bulk submit returned no bulkId: ' + JSON.stringify(res).slice(0, 400));
const jobIndexById = {};
for (const job of res.jobs || []) jobIndexById[job.jobId] = job.index;
const rejected = (res.errors || []).map((error) => { const ad = build.meta.ads[error.item] || {}; return { trackingKey: ad.trackingKey, product: ad.product, creativeFormat: ad.creativeFormat, error: error.error, details: error.details }; });
return [{ json: { bulkId: res.bulkId, totalJobs: res.totalJobs, creditsReserved: res.creditsReserved, queueAhead: res.queueAhead, jobIndexById, rejected } }];`;

const wait = cloneNode('Wait');
wait.id = 'zvid-da-0016';
wait.position = [1040, 400];
const getStatus = node('Get batch status', '@zvid/n8n-nodes-zvid.zvid', [1280, 400], {
  resource: 'render',
  operation: 'getBulk',
  bulkId: "={{ $('Check batch accepted').first().json.bulkId }}",
}, {
  id: 'zvid-da-0017',
  typeVersion: 1,
  retryOnFail: true,
  maxTries: 3,
  waitBetweenTries: 5000,
});
const finished = cloneNode('Batch finished?');
finished.id = 'zvid-da-0018';
finished.position = [1520, 400];
const still = cloneNode('Still rendering?');
still.id = 'zvid-da-0019';
still.position = [1520, 620];

const collect = node('Collect rendered ads', 'n8n-nodes-base.code', [1760, 300], {
  jsCode: String.raw`const poll = $input.first().json;
const sub = $('Check batch accepted').first().json;
const build = $('Check validation').first().json;
const completed = [];
const failures = [...(sub.rejected || [])];
for (const job of poll.jobs || []) {
  const index = sub.jobIndexById[job.id];
  const ad = index == null ? null : build.meta.ads[index];
  if (!ad) continue;
  if (job.status === 'completed' && job.outputUrl) completed.push({ ...ad, videoUrl: job.outputUrl, jobId: job.id, creditsUsed: Number(job.creditsConsumed) || null });
  else failures.push({ trackingKey: ad.trackingKey, product: ad.product, creativeFormat: ad.creativeFormat, status: job.status, error: job.errorMessage || null });
}
if (!completed.length) throw new Error('The batch finished without a video URL. ' + JSON.stringify(failures).slice(0, 700));
return completed.map((ad) => ({ json: { ...ad, renderFailures: failures } }));`,
}, { id: 'zvid-da-0020' });

const manifest = node('Build delivery manifest', 'n8n-nodes-base.code', [2000, 300], {
  jsCode: String.raw`const cfg = $('Config').first().json;
const rendered = $input.all().map((item) => item.json);
const failures = rendered[0] && Array.isArray(rendered[0].renderFailures) ? rendered[0].renderFailures : [];
return [{ json: { source: 'zvid-n8n-shopify-dynamic-ad-factory', generatedAt: new Date().toISOString(), campaign: cfg.bulkName, destination: cfg.deliveryWebhookUrl || null, assets: rendered.map((ad) => ({ trackingKey: ad.trackingKey, productId: ad.shopifyProductId, product: ad.product, productUrl: ad.productUrl, creativeFormat: ad.creativeFormat, hook: ad.audienceHook, offer: ad.offer, videoUrl: ad.videoUrl, jobId: ad.jobId, performance: { status: 'not_published', impressions: 0, clicks: 0, conversions: 0, spend: 0, revenue: 0 } })), failures, creditsUsed: rendered.reduce((sum, ad) => sum + (Number(ad.creditsUsed) || 0), 0) } }];`,
}, { id: 'zvid-da-0021' });

const deliveryConfigured = cloneNode('Publish automatically?', 'Delivery configured?');
deliveryConfigured.id = 'zvid-da-0022';
deliveryConfigured.position = [2240, 300];
deliveryConfigured.parameters.conditions.conditions[0].leftValue = "={{ Boolean($('Config').first().json.deliveryWebhookUrl) }}";

const sendDelivery = node('Send to asset store or scheduler', 'n8n-nodes-base.httpRequest', [2480, 180], {
  method: 'POST',
  url: "={{ $('Config').first().json.deliveryWebhookUrl }}",
  sendBody: true,
  specifyBody: 'json',
  jsonBody: '={{ JSON.stringify($json) }}',
  options: { response: { response: { fullResponse: true, neverError: true } }, timeout: 60000 },
}, { id: 'zvid-da-0023', retryOnFail: true, maxTries: 3, waitBetweenTries: 5000 });

const deliverySummary = node('Delivery summary', 'n8n-nodes-base.code', [2720, 180], {
  jsCode: String.raw`const response = $input.first().json || {};
const manifest = $('Build delivery manifest').first().json;
const statusCode = Number(response.statusCode || 0);
if (statusCode < 200 || statusCode >= 300) throw new Error('Delivery webhook rejected the manifest (HTTP ' + statusCode + '): ' + JSON.stringify(response.body || response).slice(0, 500));
return [{ json: { delivered: true, destination: manifest.destination, assetCount: manifest.assets.length, trackingKeys: manifest.assets.map((asset) => asset.trackingKey), creditsUsed: manifest.creditsUsed, webhookStatus: statusCode } }];`,
}, { id: 'zvid-da-0024' });

const reviewSummary = node('Rendered for review', 'n8n-nodes-base.code', [2480, 440], {
  jsCode: "const manifest = $input.first().json; return [{ json: { delivered: false, assetCount: manifest.assets.length, assets: manifest.assets, failures: manifest.failures, creditsUsed: manifest.creditsUsed, nextStep: 'Review the videos. Set Config.deliveryWebhookUrl to send this exact manifest to an asset store or social scheduler.' } }];",
}, { id: 'zvid-da-0025' });

const watch = cloneNode('▶ Watch video');
watch.id = 'zvid-da-0026';
watch.position = [2000, 40];
watch.parameters.url = '={{ $json.videoUrl }}';

const notes = [
  sticky('zvid-da-n001', 'Overview and safety', [-1900, -980], 620, 820, "## Dynamic Product Ad Factory\n\nReads selected Shopify products, creates product-first, benefit-first, and offer-first concepts, renders them as one Zvid bulk job, and builds a scheduler-neutral delivery/performance manifest.\n\n### Required community node\nBefore configuring credentials or running the workflow, open **Settings → Community nodes → Install** and install the exact package **`@zvid/n8n-nodes-zvid`**. A workspace owner or admin may need to do this.\n\n**Safe first run:** `dryRun` defaults to `true`. Validation and the editor draft are free. Set it to `false` only after checking the quote and preview.\n\nThis workflow is intentionally independent and contains all setup instructions on its canvas. Shopify access is **read-only**: it reads catalog data but does not attach videos to products. Leave `deliveryWebhookUrl` blank unless you have an asset store or scheduler ready."),
  sticky('zvid-da-n002', 'Create the Shopify app', [-1260, -980], 700, 700, "## 1 · Create a Shopify app (2026+)\n\nIn Shopify Admin open **Settings → Apps → Develop apps → Build apps in Dev Dashboard**. In Dev Dashboard:\n1. Select **Apps → Create app → Start from Dev Dashboard**.\n2. Name the app.\n3. Open **Versions** and create a version.\n4. For an API-only app, keep Shopify's default app-home URL.\n5. Add only the Admin API scope **`read_products`**.\n6. Select **Release**.\n7. Open **Home → Install app**, select the store, and approve installation.\n\nNew custom apps can no longer be created directly in Shopify Admin. Existing admin-created apps may continue using their installed Admin API token.\n\nOfficial guide: https://shopify.dev/docs/apps/build/dev-dashboard/create-apps-using-dev-dashboard"),
  sticky('zvid-da-n002b', 'Get the Shopify token', [-540, -980], 760, 700, "## 2 · Get `X-Shopify-Access-Token`\n\nThe Client ID and Client secret are **not** the access token. In Dev Dashboard open the app → **Settings**, copy both, then exchange them:\n\n```bash\ncurl -X POST \\\n  https://YOUR_STORE.myshopify.com/admin/oauth/access_token \\\n  -H 'Content-Type: application/x-www-form-urlencoded' \\\n  -d 'grant_type=client_credentials' \\\n  -d 'client_id=YOUR_CLIENT_ID' \\\n  -d 'client_secret=YOUR_CLIENT_SECRET'\n```\n\nCopy `access_token` from the JSON response. Never paste the Client secret into this workflow JSON. Dev Dashboard client-credentials tokens expire after **24 hours**; request a new token and update the n8n credential before a later run. For unattended scheduling, implement secure token refresh. The client-credentials grant is for an app and store owned by the same Shopify organization; use Shopify's OAuth installation flow for other merchants.\n\nOfficial guide: https://shopify.dev/docs/apps/build/dev-dashboard/get-api-access-tokens?lang=curl"),
  sticky('zvid-da-n002c', 'Connect Shopify in n8n', [240, -980], 660, 700, "## 3 · Connect Shopify in n8n\n\nOpen **Credentials → New credential → Header Auth** and enter:\n- **Name:** `X-Shopify-Access-Token`\n- **Value:** the returned `access_token`\n\nOpen **Get Shopify catalog**, choose that credential, and save the node.\n\nIn **Config** set:\n- `shopDomain`: prefix only; use `example` for `example.myshopify.com`\n- `shopifyProductQuery`: default `status:active`; change it to target a vendor, tag, product type, or another Shopify Admin filter\n- `scanLimit`: products fetched from Shopify\n- `maxProducts`: eligible products selected\n- `variantsPerProduct`: maximum variants for each selected product\n- `maxTotalAds`: total video cap across all products\n\nThe planner allocates one variant to each selected product before starting the second round. For 2 products × 2 variants, set `maxTotalAds` to 4. Set it to 2 for one variant per product.\n\nA `401 Unauthorized` usually means the wrong value was used or the 24-hour token expired. A `403` usually means `read_products` was not granted or the new app version was not approved."),
  sticky('zvid-da-n003', 'Install and connect Zvid', [920, -980], 620, 820, "## 4 · Install and connect Zvid\n\nThe Zvid nodes are supplied by a community package and are required by this workflow. Before running it:\n1. Open **Settings → Community nodes** in n8n.\n2. Select **Install**.\n3. Enter the exact package name **`@zvid/n8n-nodes-zvid`**.\n4. Confirm the installation. If you cannot install community nodes, ask the n8n workspace owner or admin.\n\nCreate an API key at **https://app.zvid.io/api-keys**. In n8n create a **Zvid API** credential and enter:\n- **API Key:** your `zvid_…` key\n- **Base URL:** keep `https://api.zvid.io`\n\nAssign the same credential to all four native Zvid nodes:\n- **Validate project (free)** — Render → Validate\n- **Save draft to editor** — Project → Create Editor Project\n- **Submit bulk render** — Render → Create Bulk\n- **Get batch status** — Render → Get Bulk\n\nThen set your brand, website, colors, CTA, and optional licensed `musicUrl` in **Config**. Keep `dryRun: true`, run **Test manually**, review the exact credit quote and editor link, then set it to `false` to render."),
  sticky('zvid-da-n004', 'Concept strategy', [1560, -980], 600, 700, "## Concept matrix\n\nFor each selected product the workflow rotates through:\n1. **product-first** — product-led headline and price context\n2. **benefit-first** — benefit headline and Shopify description\n3. **offer-first** — price or real compare-at savings\n\nEach format supplies distinct opener, story, benefit, and offer copy to Zvid. The planner uses round-robin allocation across products: every selected product receives its first variant before any product receives a second. The total is capped by `maxTotalAds` (default 5).\n\nExample: `maxProducts: 2`, `variantsPerProduct: 2`, `maxTotalAds: 4` creates 4 ads. A total cap of 2 creates 2 ads: one per product.\n\nNo unsupported discount is invented. Shopify's product connection does not support `BEST_SELLING`; use `UPDATED_AT` plus your query or feed it sales-ranked IDs from another workflow."),
  sticky('zvid-da-n005', 'Delivery and tracking', [2180, -980], 650, 700, "## Delivery contract\n\nLeave `deliveryWebhookUrl` blank to receive review links in n8n. Add an HTTPS endpoint only when it is ready to accept one JSON manifest containing every rendered asset. Add any destination credential to **Send to asset store or scheduler**.\n\nEach asset includes a stable `trackingKey`, Shopify product ID/URL, format, hook, offer, video URL, job ID, and zeroed performance fields. Store the tracking key beside the platform post/ad ID so a later reporting workflow can join metrics to the exact creative.\n\nThis template does **not** publish an ad or collect live metrics by itself. It hands off assets and a tracking contract to the destination. With no webhook, the tested review branch returns all URLs and plays the MP4s inside n8n."),
  sticky('zvid-da-n006', 'Product example', [2850, -980], 620, 700, "## Approved Atelier Editorial design\n\nA product such as **Harbor Stripe Breton Tee — Navy & Ivory** at **$36** produces up to three editorial variants:\n- Product-first: direct new-edit framing\n- Benefit-first: description-led benefits\n- Offer-first: price or real compare-at savings\n\nThe design uses up to three Shopify images across an image-led opener, product story, benefits, offer, and CTA. If only one image exists, it is safely reused. The first scene uses a full-frame dark wash plus a strong bottom gradient; the second uses a dark two-axis overlay behind white copy. The end-card brand sits inside a wide bordered capsule that accommodates realistic brand names.\n\nThe design resolves to about **18.9 seconds** with two benefit cards. Always use the free validation quote returned by your own dry run before rendering."),
  sticky('zvid-da-n007', 'Section 1 — Select and plan', [-1540, 220], 1160, 300, "### 1 · Select and plan\nRecently updated Shopify products matching `shopifyProductQuery` → validated creative concepts. Products without a title, priced variant, or public image are reported and skipped."),
  sticky('zvid-da-n008', 'Section 2 — Build and validate', [-460, 180], 980, 300, "### 2 · Build and validate\nThe approved **Atelier Editorial · Contrast Fix** design is built once, with Shopify copy/media supplied as per-concept variables. The first and second product-image scenes have dark readability overlays, and the end-card brand uses a wide bordered capsule. The first concept is validated for free before any credits can be spent."),
  sticky('zvid-da-n009', 'Section 3 — Preview or bulk render', [500, 0], 1180, 760, "### 3 · Preview or render\n`dryRun: true` saves the first resolved ad as an editor draft and returns the exact quote. `dryRun: false` submits all concepts as one bulk render and polls one batch."),
  sticky('zvid-da-n010', 'Section 4 — Deliver and measure', [1700, 0], 1240, 760, "### 4 · Deliver and measure\nRendered MP4s branch to n8n's inline player and a portable manifest. With no webhook, review links are returned. With a webhook, the manifest is posted to your asset store or social scheduler."),
];

const nodes = [manual, schedule, config, getCatalog, buildConcepts, conceptsFound, nothing, buildProject, validate, checkValidation, dryRun, saveDraft, drySummary, submit, accepted, wait, getStatus, finished, still, collect, manifest, deliveryConfigured, sendDelivery, deliverySummary, reviewSummary, watch, ...notes];
const connections = {
  'Test manually': { main: [[{ node: 'Config', type: 'main', index: 0 }]] },
  'Every Monday at 9am': { main: [[{ node: 'Config', type: 'main', index: 0 }]] },
  Config: { main: [[{ node: 'Get Shopify catalog', type: 'main', index: 0 }]] },
  'Get Shopify catalog': { main: [[{ node: 'Create ad concepts', type: 'main', index: 0 }]] },
  'Create ad concepts': { main: [[{ node: 'Ads found?', type: 'main', index: 0 }]] },
  'Ads found?': { main: [[{ node: 'Build ad template', type: 'main', index: 0 }], [{ node: 'Nothing to render', type: 'main', index: 0 }]] },
  'Build ad template': { main: [[{ node: 'Validate project (free)', type: 'main', index: 0 }]] },
  'Validate project (free)': { main: [[{ node: 'Check validation', type: 'main', index: 0 }]] },
  'Check validation': { main: [[{ node: 'Dry run?', type: 'main', index: 0 }]] },
  'Dry run?': { main: [[{ node: 'Save draft to editor', type: 'main', index: 0 }], [{ node: 'Submit bulk render', type: 'main', index: 0 }]] },
  'Save draft to editor': { main: [[{ node: 'Dry run summary', type: 'main', index: 0 }]] },
  'Submit bulk render': { main: [[{ node: 'Check batch accepted', type: 'main', index: 0 }]] },
  'Check batch accepted': { main: [[{ node: 'Wait', type: 'main', index: 0 }]] },
  Wait: { main: [[{ node: 'Get batch status', type: 'main', index: 0 }]] },
  'Get batch status': { main: [[{ node: 'Batch finished?', type: 'main', index: 0 }]] },
  'Batch finished?': { main: [[{ node: 'Collect rendered ads', type: 'main', index: 0 }], [{ node: 'Still rendering?', type: 'main', index: 0 }]] },
  'Still rendering?': { main: [[{ node: 'Wait', type: 'main', index: 0 }]] },
  'Collect rendered ads': { main: [[{ node: 'Build delivery manifest', type: 'main', index: 0 }, { node: '▶ Watch video', type: 'main', index: 0 }]] },
  'Build delivery manifest': { main: [[{ node: 'Delivery configured?', type: 'main', index: 0 }]] },
  'Delivery configured?': { main: [[{ node: 'Send to asset store or scheduler', type: 'main', index: 0 }], [{ node: 'Rendered for review', type: 'main', index: 0 }]] },
  'Send to asset store or scheduler': { main: [[{ node: 'Delivery summary', type: 'main', index: 0 }]] },
};

const workflow = {
  name: 'Create dynamic Shopify product ad variants with Zvid',
  nodes,
  pinData: {},
  connections,
  active: false,
  settings: { executionOrder: 'v1' },
  versionId: '6a1fb92d-5e91-4bb4-b2aa-98bbd47eef01',
  meta: { templateCredsSetupCompleted: false },
  tags: [],
};

fs.writeFileSync(outputPath, JSON.stringify(workflow, null, 2) + '\n');
console.log(`Wrote ${outputPath} (${nodes.length} nodes)`);
