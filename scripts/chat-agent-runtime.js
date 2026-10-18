'use strict';

// Embedded in the Code node; only actual MCP status observations may enable a
// download. Assistant prose and example-preview URLs are not render evidence.
function completedAgentMedia(cfg, item, savedRender = null) {
	const unpack = (value, depth = 0) => {
		if (depth > 8 || value == null) return [];
		if (typeof value === 'string') {
			try { return unpack(JSON.parse(value), depth + 1); } catch { return []; }
		}
		if (Array.isArray(value)) return value.flatMap(v => unpack(v, depth + 1));
		if (typeof value !== 'object') return [];
		if (value.isError || value.error) {
			const detail = JSON.stringify(value.error || value.content || '');
			return [{ kind: 'tool_error', errorCode: /template limit (?:is )?reached/i.test(detail) ? 'template_limit' : '' }];
		}
		if (value.kind === 'render' || value.kind === 'draft') return [value];
		return ['structuredContent', 'response', 'content', 'text'].flatMap(k => unpack(value[k], depth + 1));
	};
	const observations = [];
	for (const step of Array.isArray(item.intermediateSteps) ? item.intermediateSteps : []) {
		const tool = String(step.action?.tool || '').replace(/^Zvid_MCP_tools_/, '');
		if (!['get_media', 'render_media', 'create_media_from_example', 'create_media', 'revise_media'].includes(tool)) continue;
		observations.push(...unpack(step.observation));
	}
	const latest = savedRender ? (savedRender.error ? { kind: 'tool_error' } : { kind: 'render', render: savedRender }) : observations.at(-1);
	const draft = latest?.kind === 'draft' && /^prj_[a-z0-9_-]+$/i.test(String(latest.draftId || ''))
		&& typeof latest.quoteToken === 'string' && latest.quoteToken.length > 0
		&& Number.isFinite(latest.estimatedCredits) && latest.estimatedCredits >= 0
		&& latest.editorUrl === 'https://editor.zvid.io/?project=' + latest.draftId ? latest : null;
	const render = latest?.kind === 'render' ? latest.render : null;
	const state = String(render?.state || render?.status || (latest?.jobId ? 'submitted' : '')).toLowerCase();
	const jobId = String(render?.jobId || render?.id || latest?.jobId || '');
	const url = state === 'completed' ? String((typeof render?.result === 'string' ? render.result : render?.result?.url || render?.result?.videoUrl) || render?.videoUrl || '').trim() : '';
	const prefixes = (Array.isArray(cfg.videoUrlPrefixes) ? cfg.videoUrlPrefixes : [])
		.map(p => String(p).trim()).filter(p => /^https:\/\/[a-z0-9.-]+\/[^?#]*\/$/i.test(p));
	const allowed = /^https:\/\/[^\s<>"']+\.mp4(?:\?[^\s<>"']*)?$/i.test(url)
		&& !/%2e|\/\.\.?\//i.test(url) && prefixes.some(p => url.startsWith(p));
	const videoUrl = allowed ? url : '';
	const mediaStatus = videoUrl ? 'completed' : state || (draft ? 'awaiting_approval' : latest?.kind === 'draft' ? 'incomplete_draft' : latest?.kind === 'tool_error' ? 'tool_error' : 'not_rendered');
	const watchReason = videoUrl ? 'Completed video returned by Zvid; ready to watch.'
		: state === 'completed' ? 'Zvid completed the job but returned no permitted MP4 URL. Inspect the job result and videoUrlPrefixes.'
		: ['failed', 'cancelled'].includes(state) ? 'The render ' + state + '. Inspect the job before requesting another paid render.'
		: state ? 'The render is still processing. Ask the agent to check job ' + (jobId || 'status') + '; this does not start another render.'
		: latest?.errorCode === 'template_limit' ? 'The reusable-template quota is full. Set Config.preferDirectDraft=true to prepare a one-off editor project. No draft was saved and no render was started.'
		: latest?.kind === 'tool_error' ? 'Zvid returned an error before a completed video was available. Read the agent reply for the account limit or service error; no video is ready to watch.'
		: draft ? 'Draft and quote prepared. Approve the quoted render; this workflow then waits for the accepted job and opens Watch video.'
		: latest?.kind === 'draft' ? 'Zvid did not return a complete saved draft and signed quote. No render approval can be requested yet.'
		: 'No completed render in this turn. The first brief prepares a draft and quote; a template suggestion alone cannot be watched.';
	return { videoUrl, hasVideo: !!videoUrl, mediaStatus, jobId, watchReason, errorCode: latest?.errorCode || '', videoUrlBlocked: !!url && !allowed,
		draftId: draft?.draftId || '', editorUrl: draft?.editorUrl || '', estimatedCredits: draft?.estimatedCredits ?? null };
}

function repairChatAgent(workflow) {
	const node = name => workflow.nodes.find(n => n.name === name);
	const agent = node('Zvid AI Agent'), reply = node('Chat reply');
	if (!agent || !reply || !node('Screen request')) return;
	const cfg = node('Config');
	const settings = JSON.parse(cfg.parameters.jsonOutput);
	if (!Object.hasOwn(settings, 'preferDirectDraft')) {
		settings.preferDirectDraft = false;
		cfg.parameters.jsonOutput = JSON.stringify(settings, null, 2);
	}
	if (!Object.hasOwn(settings, 'manualPreviewJobId')) {
		settings.manualPreviewJobId = '';
		cfg.parameters.jsonOutput = JSON.stringify(settings, null, 2);
	}
	if (!node('Preview a saved render?')) {
		const gate = structuredClone(node('Brief ready?'));
		gate.id = 'chat-saved-preview'; gate.name = 'Preview a saved render?';
		gate.parameters.conditions.conditions[0].id = 'chat-saved-preview-condition';
		gate.parameters.conditions.conditions[0].leftValue = "={{ !$json.isTelegram && Boolean(String($('Config').first().json.manualPreviewJobId || '').trim()) }}";
		workflow.nodes.push(gate, {
			id: 'chat-saved-get', name: 'Read saved render for preview', type: '@zvid/n8n-nodes-zvid.zvid', typeVersion: 1, position: [0, 0],
			parameters: { resource: 'render', operation: 'get', jobId: "={{ String($('Config').first().json.manualPreviewJobId || '').trim() }}", waitForCompletion: false },
			onError: 'continueRegularOutput', retryOnFail: false,
		}, {
			id: 'chat-saved-result', name: 'Explain the saved render preview', type: 'n8n-nodes-base.code', typeVersion: 2, position: [0, 0],
			parameters: { jsCode: "return [{json:{output:'Playback test of an existing render. No new video was created and no render credits were spent.',savedRender:$json}}];" },
		});
	}
	const edge = name => ({ node: name, type: 'main', index: 0 });
	workflow.connections['Brief ready?'].main[0] = [edge('Preview a saved render?')];
	workflow.connections['Preview a saved render?'] = { main: [[edge('Read saved render for preview')], [edge('Zvid AI Agent')]] };
	workflow.connections['Read saved render for preview'] = { main: [[edge('Explain the saved render preview')]] };
	workflow.connections['Explain the saved render preview'] = { main: [[edge('Chat reply')]] };
	const mcp = node('Zvid MCP tools');
	for (const tool of ['create_media', 'revise_media']) if (!mcp.parameters.includeTools.includes(tool)) mcp.parameters.includeTools.push(tool);
	if (!node('Read the agent render handoff')) {
		const gate = structuredClone(node('Brief ready?'));
		gate.id = 'chat-render-accepted'; gate.name = 'Wait for an accepted video render?';
		gate.parameters.conditions.conditions[0].id = 'chat-render-accepted-condition';
		gate.parameters.conditions.conditions[0].leftValue = "={{ Boolean($json.agentRender?.jobId) && ['submitted','waiting','queued','active','processing','rendering','pending'].includes($json.agentRender?.mediaStatus) }}";
		workflow.nodes.push({id:'chat-render-handoff',name:'Read the agent render handoff',type:'n8n-nodes-base.code',typeVersion:2,position:[0,0],parameters:{jsCode:''}},gate,{
			id:'chat-render-wait',name:'Wait for the newly accepted chat video',type:'@zvid/n8n-nodes-zvid.zvid',typeVersion:1,position:[0,0],parameters:{resource:'render',operation:'get',jobId:'={{ $json.agentRender.jobId }}',waitForCompletion:true,waitOptions:{pollInterval:10,maxWaitTime:600}},onError:'continueRegularOutput',retryOnFail:false,
		},{id:'chat-render-result',name:'Attach the actual chat video result',type:'n8n-nodes-base.code',typeVersion:2,position:[0,0],parameters:{jsCode:"const original=$('Read the agent render handoff').first().json;return [{json:{...original,output:$json.state==='completed'?'Your requested video has finished rendering.':original.output,completedChatRender:$json}}];"}});
	}
	node('Read the agent render handoff').parameters.jsCode = completedAgentMedia.toString()+"\nconst item=$input.first().json;return [{json:{...item,agentRender:completedAgentMedia($('Config').first().json,item)}}];";
	workflow.connections[agent.name].main = [[edge('Read the agent render handoff')],[edge('Chat reply')]];
	workflow.connections['Read the agent render handoff'] = {main:[[edge('Wait for an accepted video render?')]]};
	workflow.connections['Wait for an accepted video render?'] = {main:[[edge('Wait for the newly accepted chat video')],[edge('Chat reply')]]};
	workflow.connections['Wait for the newly accepted chat video'] = {main:[[edge('Attach the actual chat video result')]]};
	workflow.connections['Attach the actual chat video result'] = {main:[[edge('Chat reply')]]};
	agent.parameters.options.returnIntermediateSteps = true;
	let prompt = agent.parameters.options.systemMessage;
	if (!prompt.includes('FREE PREPARATION')) prompt = prompt.replace('QUOTE, THEN ASK',
		'FREE PREPARATION\nContinue through planning, start_from_example, adaptation and create_media_from_example in the same turn. Do not ask permission just to inspect or adapt a template. Stop only for missing essential input, a tool error, or the actual draft and credit quote. Free preparation is not render approval.\n\nQUOTE, THEN ASK');
	if (!prompt.includes('AUTONOMOUS VISUAL CHOICES')) prompt = prompt.replace('QUOTE, THEN ASK',
		'AUTONOMOUS VISUAL CHOICES\nThe user delegates routine creative choices to you. Choose the closest suitable template, stock footage, background, colors, font and music yourself. Do not stop to offer a shortlist or ask which hero/background clip to use. A request such as "12-second vertical teaser for FocusFlow, dark premium look" is enough to prepare the draft: pick suitable vertical footage or retain suitable example media and continue to create_media_from_example. Ask only for a missing factual detail that cannot safely be omitted or assumed, or for approval of the actual credit quote. If a previous turn asked for a routine visual choice, do not repeat that question: make the choice and continue. If the account template limit blocks drafting, report that limit directly; choosing another example does not bypass it.\n\nQUOTE, THEN ASK');
	prompt = prompt.replace(/8\. After render_media,[^\n]*/, '8. After render_media, report the accepted jobId and explain that rendering continues in the background. When the user asks for status or supplies a job ID, call get_media once for that job. Do not poll in an agent loop. Never start a replacement render for a status request.');
	prompt = prompt.replace(/- When the render is finished,[^\n]*/, '- When get_media returns a completed render, include its exact MP4 URL in your reply. The workflow also reads the structured tool result so a missing or formatted link does not lose the video.');
	if (!prompt.includes('DIRECT VIDEO DRAFT')) prompt += '\n\nDIRECT VIDEO DRAFT\nIf create_media_from_example returns Template limit reached, the temporary reusable-template slot is full, not necessarily the editor-project quota. Do not suggest another example or delete account assets. Take the actual start_from_example payload, adapt its content to this user brief while preserving its composition, replace all placeholders and resolve any template-only condition/iterate features into plain static scene elements, validate_project_json with remote=true, then call create_media with the complete validated payload and actual brief. This saves a one-off editor project and supplies the same signed quote; it does not create a reusable template. If the server reports a Project limit reached, report that distinct limit and stop. Never substitute an existing unrelated render. Continue to request explicit approval of the actual new draft quote before render_media. After render_media accepts a job, finish the agent turn; the downstream native Zvid node waits for that exact job and opens Watch video.\n';
	if (!prompt.includes('DRAFT COMPLETION CONTRACT')) prompt += '\n\nDRAFT COMPLETION CONTRACT\nvalidate_project_json is only a check; it does NOT create a draft. You MUST continue from successful validation to create_media with the exact full validated payload. Fix validation and layout warnings first, preserving the original field names from the example. Do not say "created a draft", ask for render approval, or finish the preparation turn until a create tool actually returns kind=draft, draftId, editorUrl and a signed credit quote. If those fields are missing, continue preparation or report the real blocking error. A number from validation is not a saved renderable quote.\n';
	prompt = prompt.replace('If the account template limit blocks drafting, report that limit directly; choosing another example does not bypass it.', 'If the account template limit blocks drafting, follow DIRECT VIDEO DRAFT below using the same suitable example.');
	if (!prompt.includes('COMPLETE STATIC PAYLOAD')) prompt += '\n\nCOMPLETE STATIC PAYLOAD\n{{ $("Config").first().json.preferDirectDraft ? "This installation uses one-off editor drafts: skip create_media_from_example and follow DIRECT VIDEO DRAFT immediately after start_from_example. The reusable-template quota is full, so another temporary template cannot be created." : "Use DIRECT VIDEO DRAFT when the reusable-template quota is full." }}\nKeep every scene an object and every visual an object. Never insert commentary, ellipses or abbreviated fragments into arrays. Do not invent a website, product URL or unrequested factual claim. For a fictional product, use its name as the CTA when no real URL was supplied. Remove optional music rather than inventing an audio URL. Prefer free examples; if an example is locked, select an available free match without asking another design-choice question. A recoverable validation error is an instruction to fix that payload and validate again, not to restart planning or ask permission to continue.\n';
	agent.parameters.options.systemMessage = prompt;
	if (!prompt.includes('EXPLICIT TEXT CONTRAST')) agent.parameters.options.systemMessage += '\n\nEXPLICIT TEXT CONTRAST\nWhen adapting a static payload, set each TEXT visual style.color to its actual readable foreground color, even when html repeats the color inline. If dark text sits on a bright card, set style.backgroundColor to that card color too. The layout checker reads these fields. Use adequate contrast and fix all returned layout warnings before asking for render approval.\n';
	const start = reply.parameters.jsCode.indexOf('// --- the video link');
	const end = reply.parameters.jsCode.indexOf('// --- Telegram parse mode');
	if (start < 0 || end < start) throw Error('Unrecognized Chat reply; review before repairing.');
	const replacement = `// --- the video link: verified MCP result -------------------------------\n${completedAgentMedia.toString()}\nconst savedRender = req.ok ? (item.completedChatRender || (!req.isTelegram && String(cfg.manualPreviewJobId || '').trim() ? item.savedRender : null)) : null;\nconst media = completedAgentMedia(cfg, req.ok ? item : {}, savedRender);\nconst { videoUrl, videoUrlBlocked } = media;\nif (media.errorCode === 'template_limit') { status = 'blocked'; reply = media.watchReason; }\nif (savedRender && !media.hasVideo) { status = 'preview_unavailable'; reply = media.watchReason; }\nif (videoUrl && !reply.includes(videoUrl)) reply += '\\n' + videoUrl;\n\n`;
	reply.parameters.jsCode = reply.parameters.jsCode.slice(0, start) + replacement + reply.parameters.jsCode.slice(end);
	reply.parameters.jsCode = reply.parameters.jsCode.replace("if (media.errorCode === 'template_limit')", "if (['tool_error', 'incomplete_draft'].includes(media.mediaStatus))");
	reply.parameters.jsCode = reply.parameters.jsCode.replace('// --- Telegram parse mode', "if (media.mediaStatus === 'awaiting_approval') { status = 'answered'; reply = 'Your new draft is saved. Render quote: ' + media.estimatedCredits + ' Zvid credits.\\n' + media.editorUrl + '\\nApprove this quote to render the video.'; }\n// --- Telegram parse mode");
	if (!reply.parameters.jsCode.includes('mediaStatus: media.mediaStatus')) reply.parameters.jsCode = reply.parameters.jsCode.replace('      videoUrlBlocked,', '      videoUrlBlocked,\n      mediaStatus: media.mediaStatus,\n      jobId: media.jobId,\n      watchReason: media.watchReason,');
	if (!reply.parameters.jsCode.includes('draftId: media.draftId')) reply.parameters.jsCode = reply.parameters.jsCode.replace('      watchReason: media.watchReason,', '      watchReason: media.watchReason,\n      draftId: media.draftId,\n      editorUrl: media.editorUrl,\n      estimatedCredits: media.estimatedCredits,');
	const gate = node('Video ready to watch?');
	if (gate) gate.parameters.conditions.conditions[0].leftValue = "={{ !$json.dryRun && $('Chat reply').first().json.hasVideo === true }}";
}

module.exports = { completedAgentMedia, repairChatAgent };
