'use strict';

// Pure domain functions are also embedded verbatim into the published Code nodes.
function campaignState(key, ledger, dryRun) {
  const records = ledger.filter(r => String(r.CampaignKey || '').trim() === key);
  if (records.length > 1) throw new Error('Duplicate CampaignKey in campaign log: ' + key);
  const record = records[0];
  if (!record) return null;
  const status = String(record.Status || '').toLowerCase();
  const stop = reason => ({ ready: false, campaignKey: key, status: 'nothing_to_render', reason, videoUrl: record.VideoUrl || null });
  if (record.VideoUrl || status === 'completed') return stop('This campaign is already complete. Use its saved video; create a new campaign key only for an intentional new campaign.');
  if (['submitting', 'failed', 'timed_out', 'needs_review'].includes(status)) return stop('Inspect the saved campaign in Zvid before clearing its uncertain or failed state.');
  if (record.JobId) {
    if (dryRun) return stop('Preview skips an existing paid job. Set dryRun=false to resume it.');
    let plan;
    try { plan = JSON.parse(record.PlanJson); } catch { throw new Error('Saved campaign PlanJson is missing or invalid; inspect the existing job instead of resubmitting.'); }
    if (!plan.payload || plan.campaignKey !== key) throw new Error('Saved campaign snapshot does not match its key.');
    return { ...plan, ready: true, jobId: String(record.JobId), creditsRequired: Number(record.CreditsQuoted), resumed: true };
  }
  throw new Error('Campaign key already exists without a recoverable job. Inspect the log before deliberately clearing that row.');
}

function trackedLink(raw, campaign, content) {
  const url = String(raw || '').trim();
  if (!/^https:\/\/[a-z0-9.-]+(?::\d+)?(?:[/?#][^\s]*)?$/i.test(url)) throw new Error('A public HTTPS application or booking URL is required.');
  const hash = url.indexOf('#'), fragment = hash < 0 ? '' : url.slice(hash), base = hash < 0 ? url : url.slice(0, hash);
  const q = base.indexOf('?'), path = q < 0 ? base : base.slice(0, q);
  const query = (q < 0 ? '' : base.slice(q + 1)).split('&').filter(Boolean).filter(p => !/^utm_(source|medium|campaign|content)=/i.test(p));
  query.push('utm_source=social', 'utm_medium=video', 'utm_campaign=' + encodeURIComponent(campaign), 'utm_content=' + encodeURIComponent(content));
  return path + '?' + query.join('&') + fragment;
}

function planHiring(cfg, brief, rows, ledger, now) {
  const text = v => String(v ?? '').trim();
  const key = text(brief.CampaignKey);
  if (!/^[a-zA-Z0-9_-]{3,64}$/.test(key)) throw new Error('CampaignKey must be 3–64 letters, numbers, underscores or hyphens. Reuse it to resume; change it only for a new campaign.');
  const previous = campaignState(key, ledger, cfg.dryRun === true);
  if (previous) return previous;
  const mode = text(brief.Mode).toLowerCase();
  if (!['spotlight', 'roundup'].includes(mode)) throw new Error('Mode must be spotlight or roundup.');
  const requested = text(brief.JobKeys).split(',').map(text).filter(Boolean);
  if (mode === 'spotlight' && requested.length !== 1) throw new Error('Spotlight requires exactly one JobKey in the brief.');
  const max = Math.floor(Number(brief.MaxRoles || cfg.maxRoles || 4));
  if (!Number.isFinite(max) || max < 1 || max > 4) throw new Error('MaxRoles must be between 1 and 4.');
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: cfg.timezone || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const date = (v, name) => { const s = text(v); if (s && (!/^\d{4}-\d{2}-\d{2}$/.test(s) || !Number.isFinite(Date.parse(s)) || new Date(s).toISOString().slice(0, 10) !== s)) throw new Error(name + ' must be a real YYYY-MM-DD date.'); return s; };
  const seen = new Set(), skipped = [], eligible = [];
  for (const row of rows.filter(r => text(r.JobKey) || text(r.Role))) {
    const id = text(row.JobKey);
    if (!id || seen.has(id)) throw new Error('Every catalog role needs a unique JobKey.');
    seen.add(id);
    let reason = '';
    const opens = date(row.OpensOn, id + ' OpensOn'), closes = date(row.ClosesOn, id + ' ClosesOn');
    if (opens && closes && opens > closes) throw new Error(id + ': OpensOn is after ClosesOn.');
    if (requested.length && !requested.includes(id)) reason = 'outside_requested_job_keys';
    else if (text(brief.Team) && text(row.Team).toLowerCase() !== text(brief.Team).toLowerCase()) reason = 'outside_team';
    else if (text(brief.Location) && text(row.Location).toLowerCase() !== text(brief.Location).toLowerCase()) reason = 'outside_location';
    else if (text(row.Approval).toLowerCase() !== 'approved') reason = 'awaiting_editorial_approval';
    else if (opens && opens > today) reason = 'not_open_yet';
    else if (closes && closes < today) reason = 'closed';
    else if (!text(row.Role) || text(row.Role).length > 90) reason = 'role_title_missing_or_over_90_characters';
    else if (text(row.Team).length > 80 || text(row.Location).length > 100 || text(row.SalaryRange).length > 80 || [row.Perk1,row.Perk2,row.Perk3].some(v=>text(v).length>160)) reason = 'role_details_exceed_card_limits';
    let applyUrl;
    if (!reason) { try { applyUrl = trackedLink(row.ApplyUrl, key, id); } catch { reason = 'missing_public_https_application_link'; } }
    if (reason) { skipped.push({ key: id, reason }); continue; }
    eligible.push({ jobKey: id, role: text(row.Role), team: text(row.Team), location: text(row.Location), salary: text(row.SalaryRange), perks: [row.Perk1, row.Perk2, row.Perk3].map(text).filter(Boolean), closesOn: closes, priority: Number(row.Priority) || 0, applyUrl });
  }
  const missing = requested.filter(k => !eligible.some(r => r.jobKey === k));
  if (missing.length) return { ready: false, status: 'brief_needs_revision', campaignKey: key, missingJobKeys: missing, skipped, reason: 'Requested roles are missing, outside the brief, unapproved or closed. Nothing was rendered.' };
  eligible.sort((a, b) => (a.closesOn || '9999').localeCompare(b.closesOn || '9999') || b.priority - a.priority || a.jobKey.localeCompare(b.jobKey));
  if (requested.length > max) throw new Error('The brief requests more JobKeys than MaxRoles; narrow the brief rather than silently omitting requested roles.');
  const roles = eligible.slice(0, mode === 'spotlight' ? 1 : max);
  if (!roles.length) return { ready: false, status: 'nothing_to_render', campaignKey: key, skipped, reason: 'No approved open roles match this brief.' };
  const careersUrl = mode === 'roundup' ? trackedLink(cfg.careersUrl, key, 'roundup') : roles[0].applyUrl;
  const caption = [cfg.companyName + ' is hiring — ' + (mode === 'spotlight' ? roles[0].role : roles.length + ' open roles'), ...roles.map(r => [r.role, r.location, r.salary, r.closesOn ? 'Apply by ' + r.closesOn : '', r.applyUrl].filter(Boolean).join(' · ')), 'Application details and eligibility are listed on each role page.'].join('\n\n');
  const referralMessage = ['Know someone who may be interested in joining ' + cfg.companyName + '?', ...roles.map(r => r.role + (r.location ? ' — ' + r.location : '') + '\n' + r.applyUrl), 'Please share the relevant role page. Applications go directly to our hiring team.'].join('\n\n');
  return { ready: true, campaignKey: key, mode, roles, careersUrl, caption, referralMessage, skipped, deferredJobKeys: eligible.slice(roles.length).map(r => r.jobKey), today, jobId: null, creditsRequired: 0 };
}

function planRestaurant(cfg, rows, ledger, now) {
  const text = v => String(v ?? '').trim(), yes = v => ['true','yes','1','x'].includes(text(v).toLowerCase());
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: cfg.timezone || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const monday = new Date(today + 'T12:00:00Z'); monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
  const addDays = n => { const d = new Date(monday); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0,10); };
  const weekStart = addDays(0), weekEnd = addDays(6), revision = text(cfg.campaignRevision || '1');
  if (!/^[a-zA-Z0-9_-]{1,24}$/.test(revision)) throw new Error('campaignRevision must be a short letter/number/underscore/hyphen value.');
  const key = 'menu-' + weekStart + '-' + revision;
  const previous = campaignState(key, ledger, cfg.dryRun === true);
  if (previous) return previous;
  const max = Math.floor(Number(cfg.maxDishes ?? 5)), min = Math.floor(Number(cfg.minDishes ?? 3)), minCategories = Math.floor(Number(cfg.minCategories ?? 2));
  if (![max,min,minCategories].every(Number.isFinite) || min < 1 || max > 5 || max < min || minCategories < 1 || minCategories > max) throw new Error('Require 1 <= minDishes <= maxDishes <= 5 and minCategories <= maxDishes.');
  const lastKeys = new Set();
  for (const record of ledger.filter(r => r.Status === 'completed')) {
    try { const plan = JSON.parse(record.PlanJson); if (plan.weekStart === addDays(-7)) for (const d of plan.dishes || []) lastKeys.add(d.key); } catch { /* Old unrelated log rows do not define menu history. */ }
  }
  const date = (v, name) => { const s = text(v); if (s && (!/^\d{4}-\d{2}-\d{2}$/.test(s) || !Number.isFinite(Date.parse(s)) || new Date(s).toISOString().slice(0,10) !== s)) throw new Error(name + ' must be a real YYYY-MM-DD date.'); return s; };
  const seen = new Set(), skipped = [], eligible = [];
  for (const row of rows.filter(r => text(r.DishKey) || text(r.Dish))) {
    const id = text(row.DishKey);
    if (!id || seen.has(id)) throw new Error('Every menu row needs a unique DishKey.');
    seen.add(id);
    const from = date(row.AvailableFrom, id + ' AvailableFrom'), until = date(row.AvailableUntil, id + ' AvailableUntil');
    if (from && until && from > until) throw new Error(id + ': AvailableFrom is after AvailableUntil.');
    let reason = '';
    if (!yes(row.ThisWeek)) reason = 'not_nominated';
    else if (text(row.Approval).toLowerCase() !== 'approved') reason = 'awaiting_menu_approval';
    else if (!yes(row.InStock)) reason = 'unavailable';
    else if ((from && from > weekStart) || (until && until < weekEnd)) reason = 'not_available_for_entire_campaign_week';
    else if (![row.Dish,row.Category,row.Price].every(v => text(v))) reason = 'missing_dish_category_or_price';
    else if (text(row.Dish).length > 70 || text(row.Description).length > 180 || text(row.Price).length > 18) reason = 'copy_exceeds_card_limits';
    else if (!/^https:\/\/[^\s]+$/i.test(text(row.PhotoUrl))) reason = 'missing_https_dish_photo';
    if (reason) { skipped.push({ key: id, reason }); continue; }
    eligible.push({ key:id, name:text(row.Dish), category:text(row.Category), description:text(row.Description), price:text(row.Price), photo:text(row.PhotoUrl), priority:Number(row.Priority) || 0, featuredLastWeek:lastKeys.has(id) });
  }
  eligible.sort((a,b) => b.priority-a.priority || Number(a.featuredLastWeek)-Number(b.featuredLastWeek) || a.key.localeCompare(b.key));
  const picked = [], categories = new Set();
  for (const d of eligible) if (!categories.has(d.category.toLowerCase()) && picked.length < max) { picked.push(d); categories.add(d.category.toLowerCase()); }
  for (const d of eligible) if (!picked.includes(d) && picked.length < max) picked.push(d);
  if (picked.length < min || categories.size < minCategories) return { ready:false, campaignKey:key, status:'menu_needs_revision', reason:'Not enough approved, available dishes or category variety for this weekly campaign.', eligibleCount:eligible.length, categoryCount:categories.size, requiredDishes:min, requiredCategories:minCategories, skipped };
  const bookingUrl = trackedLink(cfg.bookingUrl, key, 'weekly-menu');
  const weekLabel = 'WEEK OF ' + weekStart;
  const menu = picked.map(d => d.name + ' · ' + d.price).join('\n');
  const caption = [cfg.restaurantName + ' · ' + weekLabel, menu, 'Available ' + weekStart + ' to ' + weekEnd + ', while available.', 'Reserve: ' + bookingUrl].join('\n\n');
  const posts = [
    {date:addDays(0),purpose:'Weekly menu launch',caption},
    {date:addDays(2),purpose:'Midweek dish spotlight',caption:[picked[0].name + ' · ' + picked[0].price,picked[0].description,'On the menu through ' + weekEnd,'Reserve: ' + trackedLink(cfg.bookingUrl,key,'midweek-' + picked[0].key)].filter(Boolean).join('\n\n')},
    {date:addDays(4),purpose:'Weekend reservation reminder',caption:[cfg.restaurantName + ' · Make a plan for the weekend',menu,'This week’s menu ends ' + weekEnd,'Reserve: ' + trackedLink(cfg.bookingUrl,key,'weekend')].join('\n\n')},
  ].map(p => ({...p,reviewStatus:p.date < today ? 'past_date_do_not_publish' : 'review_before_scheduling'}));
  return {ready:true,campaignKey:key,weekStart,weekEnd,weekLabel,dishes:picked,bookingUrl,caption,posts,skipped,deferredDishKeys:eligible.filter(d=>!picked.includes(d)).map(d=>d.key),jobId:null,creditsRequired:0};
}

function buildHiringCampaign(cfg, plan) {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const accent = /^#[\da-f]{6}$/i.test(cfg.accentColor) ? cfg.accentColor : '#FF6B57';
  const bg = /^#[\da-f]{6}$/i.test(cfg.backgroundColor) ? cfg.backgroundColor : '#0E0F14';
  const text = (id,html,y,size=48) => ({type:'TEXT',x:90,y,width:900,anchor:'top-left',track:id,enterBegin:0.2,exitEnd:7,style:{fontFamily:cfg.font || 'Poppins',color:'#FFFFFF'},html:`<div style="font-size:${size}px;line-height:1.25;font-weight:600;overflow-wrap:break-word;">${html}</div>`});
  const scene = (id,kicker,title,body,footer,duration=7) => ({id,duration,backgroundColor:bg,visuals:[
    {type:'SVG',width:1080,height:1920,track:0,svg:`<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920"><rect width="1080" height="1920" fill="${bg}"/><rect x="60" y="80" width="8" height="1760" fill="${accent}"/><circle cx="1020" cy="180" r="220" fill="${accent}" fill-opacity="0.08"/></svg>`},
    text(1,`<span style="color:${accent};letter-spacing:3px;">${esc(kicker).slice(0,220)}</span>`,180,28),
    text(2,esc(title),400,title.length>55?58:76),text(3,body,820,36),text(4,esc(footer),1690,26)
  ].map(v=>({...v,...(v.exitEnd?{exitEnd:duration}:{})}))});
  const scenes = [];
  if (plan.mode === 'roundup') scenes.push(scene('campaign','JOIN '+cfg.companyName,plan.roles.length+' open roles',esc('Explore opportunities'+(plan.roles[0].team?' with our teams.':'.')),'Application links in the caption',3));
  for (const r of plan.roles) {
    const facts = [r.team,r.location,r.salary,r.closesOn ? 'Apply by '+r.closesOn : ''].filter(Boolean);
    scenes.push(scene('role-'+(scenes.length+1),'WE ARE HIRING',r.role,facts.map(esc).join('<br/><br/>'),cfg.companyName));
    if (plan.mode === 'spotlight' && r.perks.length) scenes.push(scene('benefits','THE ROLE', 'What you can expect',r.perks.map(p=>'• '+esc(p)).join('<br/><br/>'),'See the role page for full details'));
  }
  scenes.push(scene('apply','TAKE THE NEXT STEP','Find your next role',esc(plan.mode==='spotlight'?'Apply using the role link in the caption.':'Explore each opening using the application links in the caption.'),cfg.companyName,3));
  return {...plan,payload:{name:('hiring-'+plan.campaignKey).slice(0,60),resolution:'instagram-reel',frameRate:30,outputFormat:'mp4',backgroundColor:bg,scenes},meta:{mode:plan.mode,roleCount:plan.roles.length,sceneCount:scenes.length}};
}

module.exports = {campaignState,trackedLink,planHiring,planRestaurant,buildHiringCampaign};
