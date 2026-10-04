'use strict';

// Embedded verbatim in n8n Code nodes by upgrade-reviewed-templates.js.
// Keep these functions independent of Node.js modules and workflow state.
function selectHiring(cfg, rows, now) {
  const text = value => String(value ?? '').trim();
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: cfg.timezone || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const iso = value => {
    const s = text(value);
    if (!s) return '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || new Date(s + 'T12:00:00Z').toISOString().slice(0, 10) !== s) throw new Error('Use YYYY-MM-DD for OpensOn and ClosesOn.');
    return s;
  };
  const seen = new Set(), tasks = [], skipped = [];
  for (const row of rows.filter(r => text(r.Role) || text(r.JobKey))) {
    const key = text(row.JobKey);
    if (!key || seen.has(key)) throw new Error('Every opening needs a unique JobKey; duplicate or missing key near ' + text(row.Role));
    seen.add(key);
    const status = text(row.RenderStatus).toLowerCase(), jobId = text(row.RenderJobId);
    let reason = '';
    if (text(row.VideoUrl)) reason = 'already_rendered';
    else if (cfg.dryRun === true && jobId) reason = 'saved_job_skipped_in_preview';
    else if (['submitting', 'failed', 'timed_out', 'needs_review'].includes(status)) reason = status + '_needs_review';
    else if (!jobId) {
      const opens = iso(row.OpensOn), closes = iso(row.ClosesOn);
      if (opens && closes && opens > closes) throw new Error('OpensOn is after ClosesOn for ' + key);
      if (text(row.Approval).toLowerCase() !== 'approved') reason = 'awaiting_approval';
      else if (opens && opens > today) reason = 'not_open_yet';
      else if (closes && closes < today) reason = 'closed';
      else if (!text(row.Role) || !/^https:\/\/[^\s/]+(?:\/\S*)?$/i.test(text(row.ApplyUrl))) reason = 'missing_role_or_https_apply_url';
    }
    if (reason) { skipped.push({ key, reason }); continue; }
    tasks.push({ ...row, key, matchColumn: 'JobKey', matchValue: key, variant: 'hiring', jobId,
      creditsRequired: Number(row.CreditsQuoted) || 0, savedCaption: text(row.Caption),
      stateFields: { status: 'RenderStatus', job: 'RenderJobId', credits: 'CreditsQuoted', video: 'VideoUrl', caption: 'Caption', at: 'RenderedAt' },
      priority: Number(row.Priority) || 0 });
  }
  tasks.sort((a, b) => Number(!!b.jobId) - Number(!!a.jobId) || b.priority - a.priority || a.key.localeCompare(b.key));
  const limit = Math.max(1, Math.min(20, Math.floor(Number(cfg.maxPerRun) || 3)));
  const audit = { totalRows: seen.size, eligible: tasks.length, deferred: Math.max(0, tasks.length - limit), skipped };
  return tasks.length ? tasks.slice(0, limit).map(task => ({ ...task, pendingCount: tasks.length, audit })) : [{pendingCount:0,status:'nothing_to_render',creditsSpent:0,audit,reason:'No approved, open, unfinished job videos. Review the skipped reasons.'}];
}

function selectWorkout(cfg, rows, now) {
  const text = value => String(value ?? '').trim();
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: cfg.timezone || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const dated = rows.filter(r => text(r.Date) || text(r.WorkoutKey)).map(row => {
    const date = text(row.Date);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(date + 'T12:00:00Z').toISOString().slice(0, 10) !== date) throw new Error('Date must be YYYY-MM-DD for workout ' + text(row.WorkoutKey));
    return { row, date };
  });
  const keys = new Set();
  for (const {row} of dated) {
    const key = text(row.WorkoutKey);
    if (!key || keys.has(key)) throw new Error('Every workout needs a unique WorkoutKey.');
    keys.add(key);
  }
  const selectedDate = dated.some(x => x.date === today) ? today : cfg.fallbackToLatest === true ? dated.filter(x => x.date < today).map(x => x.date).sort().pop() : null;
  if (!selectedDate) return [{ pendingCount: 0, status: 'nothing_to_render', reason: 'No workout for ' + today + '. Add today’s row or enable fallbackToLatest to reuse the latest past workout.', creditsSpent: 0 }];
  const hits = dated.filter(x => x.date === selectedDate);
  if (hits.length !== 1) throw new Error('Keep one training plan per Date; found ' + hits.length + ' for ' + selectedDate);
  const row = hits[0].row, key = text(row.WorkoutKey), tasks = [], skipped = [];
  if (!text(row.WorkoutName)) throw new Error('WorkoutName is required for ' + key);
  for (const variant of ['Standard', 'Scaled']) {
    if (variant === 'Scaled' && !text(row.ScaledEx1)) { skipped.push({variant, reason: 'no_coach_supplied_scaled_plan'}); continue; }
    const fields = {status: variant+'Status', job: variant+'JobId', credits: variant+'Credits', video: variant+'VideoUrl', caption: variant+'Caption', at: variant+'RenderedAt'};
    const jobId = text(row[fields.job]), status = text(row[fields.status]).toLowerCase();
    let reason = '';
    if (text(row[fields.video])) reason = 'already_rendered';
    else if (cfg.dryRun === true && jobId) reason = 'saved_job_skipped_in_preview';
    else if (['submitting','failed','timed_out','needs_review'].includes(status)) reason = status + '_needs_review';
    else if (!jobId && text(row.Approval).toLowerCase() !== 'approved') reason = 'awaiting_coach_approval';
    if (reason) { skipped.push({variant, reason}); continue; }
    const exercises = [];
    const prefix = variant === 'Scaled' ? 'ScaledEx' : 'Ex';
    if (!text(row[prefix+'1'])) throw new Error(prefix+'1 is required for ' + key);
    for (let i=1;i<=5;i++) {
      const cell = text(row[prefix+i]); if (!cell) continue;
      const separators = [...cell.matchAll(/\s[x×]\s/gi)], last = separators[separators.length-1];
      exercises.push(last ? {name:cell.slice(0,last.index).trim(),reps:cell.slice(last.index+last[0].length).trim()} : {name:cell,reps:''});
    }
    const dateLabel = new Date(selectedDate+'T12:00:00Z').toLocaleDateString(cfg.dateLocale || 'en-US',{timeZone:'UTC',weekday:'short',month:'short',day:'numeric'}).toUpperCase();
    tasks.push({ key, matchColumn:'WorkoutKey',matchValue:key,variant,jobId,stateFields:fields,
      creditsRequired:Number(row[fields.credits]) || 0,savedCaption:text(row[fields.caption]),
      workoutName:text(row.WorkoutName)+' · '+variant,focus:text(row.Focus),
      coachNote:text(variant === 'Scaled' ? row.ScaledCoachNote || row.CoachNote : row.CoachNote),
      dateIso:selectedDate,dateLabel,usedFallback:selectedDate!==today,exercises });
  }
  const audit={selectedDate,usedFallback:selectedDate!==today,skipped};
  return tasks.length ? tasks.map(t=>({...t,pendingCount:tasks.length,audit})) : [{pendingCount:0,status:'nothing_to_render',creditsSpent:0,audit,reason:'No approved, unfinished workout videos. Review the skipped reasons.'}];
}

function checkQuote(cfg, build, response) {
  const body = response.body || response;
  if (body.valid !== true) throw new Error('Zvid validation failed: '+JSON.stringify(body.errors || body.details || body).slice(0,1200));
  const credits = Number(body.creditsRequired), ceiling = Number(cfg.maxCreditsPerVideo);
  if (!Number.isFinite(credits) || credits < 0) throw new Error('Zvid did not return a valid credit quote.');
  if (!Number.isFinite(ceiling) || ceiling <= 0) throw new Error('Set maxCreditsPerVideo to a positive number.');
  if (credits > ceiling) throw new Error('Video needs '+credits+' credits; maxCreditsPerVideo is '+ceiling+'. No paid render submitted for this item.');
  return {...build,creditsRequired:credits,warnings:body.warnings || []};
}

function trackJob(context, response, now) {
  const jobId=String(response.jobId || response.id || context.jobId || '').trim();
  if (!jobId) throw new Error('No render job ID returned. The sheet stays submitting; inspect https://app.zvid.io before resetting it.');
  return {...context,jobId,pollStartedAt:now};
}

function classifyJob(context, response, now, timeoutMinutes) {
  const result=response.result;
  const url=typeof result==='string'?result:result?.url || result?.videoUrl || '';
  const state=String(response.state || response.status || '').toLowerCase();
  if (state==='completed') {
    if (!/^https:\/\/\S+$/i.test(url)) return {...context,status:'needs_review',reason:'Completed job has no HTTPS media URL. Inspect Zvid; do not resubmit.',videoUrl:null};
    return {...context,status:'completed',videoUrl:url,renderedAt:new Date(now).toISOString()};
  }
  if (['failed','cancelled','canceled'].includes(state)) return {...context,status:'failed',reason:String(response.failedReason || response.error || state),videoUrl:null};
  if (now-context.pollStartedAt >= Number(timeoutMinutes || 20)*60000) return {...context,status:'timed_out',reason:'Polling deadline reached. Keep the job ID and check Zvid before resuming.',videoUrl:null};
  if (!['waiting','queued','active','processing','rendering','pending'].includes(state)) return {...context,status:'needs_review',reason:'Unrecognized render state: '+state,videoUrl:null};
  return {...context,status:'rendering',videoUrl:null};
}

module.exports={selectHiring,selectWorkout,checkQuote,trackJob,classifyJob};
