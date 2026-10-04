'use strict';

// Editorial and learning workflows. Stage functions are embedded verbatim in n8n
// Code nodes, so each function has its own helpers and no module dependencies.
const fs = require('node:fs');
const path = require('node:path');

function reviewSource(state) {
  const r=state.request,now=Date.parse(state.config.nowISO||new Date().toISOString());
  const fail=reason=>({...state,status:'review',reason});
  if(!r||!/^[-a-zA-Z0-9_]{3,100}$/.test(String(r.source_id||''))||!/^[-a-zA-Z0-9_.]{1,40}$/.test(String(r.revision||'')))return fail('An immutable source_id and revision are required.');
  if(r.approval!=='approved')return {...state,status:'skip',reason:'The editor or teacher has not approved this revision.'};
  if(['cancelled','withdrawn'].includes(r.status))return {...state,status:'skip',reason:'The source request has been withdrawn.'};
  if(!Number.isFinite(now)||!Number.isFinite(Date.parse(r.updated_at))||Date.parse(r.updated_at)>now)return fail('The source update date is missing, invalid or in the future.');
  if(r.publish_at&&(!Number.isFinite(Date.parse(r.publish_at))||Date.parse(r.publish_at)>now))return {...state,status:'skip',reason:'The editorial slot is not due.'};
  if(r.expires_at&&(!Number.isFinite(Date.parse(r.expires_at))||Date.parse(r.expires_at)<=now))return {...state,status:'skip',reason:'This lesson or editorial slot has expired.'};
  if(!/^https:\/\//.test(String(r.source_url||'')))return fail('A source or teacher-approved reference URL is required.');
  const rows=state.records.filter(x=>String(x.parent_id)===String(r.source_id)&&String(x.revision)===String(r.revision));
  const keys=new Set();
  for(const x of rows){if(!x.record_id||keys.has(x.record_id))return fail('Joined records need unique record_id values.');keys.add(x.record_id);}
  const evidence=rows.filter(x=>x.kind==='evidence');
  if(!evidence.length||evidence.some(x=>x.approval!=='approved'||!x.claim||!/^https:\/\//.test(String(x.url||''))))return fail('Every editorial source needs an approved claim and HTTPS evidence URL.');
  const media=rows.filter(x=>x.kind==='media');
  if(media.some(x=>x.approval!=='approved'||!x.rights||!/^https:\/\//.test(String(x.url||''))))return fail('Media rights and approval must be recorded for every supplied photograph or audio.');
  if(state.history.some(x=>x.source_id===r.source_id&&x.revision===r.revision&&x.status==='delivered'))return {...state,status:'skip',reason:'This editorial revision has already been delivered.'};
  return {...state,records:rows,status:'ready',reason:'',decision:{...state.decision,sourceCount:evidence.length,sourceUrls:evidence.map(x=>x.url),mediaCredits:media.map(x=>x.rights),editorialRevision:r.revision}};
}

function calculateContent(state) {
  if(state.status!=='ready')return state;
  const r=state.request,rows=state.records,day=DAY_NUMBER;
  const v={},proof={family:day};
  const pick=kind=>rows.filter(x=>x.kind===kind).sort((a,b)=>Number(a.position||0)-Number(b.position||0));
  const text=(value,label,max=180)=>{if(typeof value!=='string'||!value.trim()||value.length>max||/[<>]|\{\{/.test(value))throw Error(label+' must be plain text within '+max+' characters.');return value.trim();};
  const num=(value,label,min=0,max=10000)=>{if(value===undefined||value===null||typeof value==='boolean'||(typeof value==='string'&&!value.trim())||!['number','string'].includes(typeof value))throw Error(label+' requires a number.');const n=Number(value);if(!Number.isFinite(n)||n<min||n>max)throw Error(label+' is out of range.');return n;};
  const integer=(value,label,min=0,max=10000)=>{const n=num(value,label,min,max);if(!Number.isInteger(n))throw Error(label+' must be an integer.');return n;};
  const exact=(xs,n,label)=>{if(xs.length!==n)throw Error(label+' requires exactly '+n+' source records.');return xs;};
  const unique=(xs,field)=>{if(new Set(xs.map(x=>String(x[field]))).size!==xs.length)throw Error('Duplicate '+field+' values are ambiguous.');};
  const upper=x=>text(x,'Display name',60).toUpperCase();
  const optional=(key,max=180)=>{if(r[key]!==undefined&&String(r[key]).trim())v[key]=text(r[key],key,max);};
  try {
    if(day===51){
      const loans=exact(pick('loan'),4,'Four-loan career story');unique(loans,'club');
      const starts=loans.map(x=>integer(x.start_year,'Loan year',1850,2200)),ends=loans.map(x=>integer(x.end_year,'Loan end year',1850,2200));
      if(starts.some((n,i)=>n>ends[i]||(i&&n<starts[i-1])))throw Error('Loan chronology is inconsistent.');
      const season=exact(pick('season'),1,'Breakthrough season')[0];
      const total=integer(season.all_goals,'All-competition goals'),league=integer(season.league_goals,'League goals');
      if(league>total)throw Error('League goals cannot exceed all-competition goals.');
      if(integer(r.breakthrough_year,'Breakthrough year',1850,2200)<Math.max(...ends))throw Error('Breakthrough must follow the loan sequence.');
      Object.assign(v,{player:upper(r.player),loanYears:Math.min(...starts)+'–'+Math.max(...ends),breakoutYear:text(season.label,'Season',30),goals:String(total),leagueGoals:league+' IN THE PREMIER LEAGUE'});
      loans.forEach((x,i)=>v['loanClub'+(i+1)]=upper(x.club));
      for(const k of ['hook','startYear','startHeadline','startDetail','closing','credit'])optional(k,k==='credit'?600:180);
      Object.assign(proof,{loans:loans.map(x=>({club:x.club,start:x.start_year,end:x.end_year})),allGoals:total,leagueGoals:league,otherCompetitionGoals:total-league});
    } else if(day===52){
      const goals=exact(pick('goal'),3,'Three-goal comeback');
      let home=integer(r.half_home,'Half-time home goals',0,20),away=integer(r.half_away,'Half-time away goals',0,20);
      if(home-away!==3)throw Error('This three-goal comeback family requires a three-goal half-time deficit.');
      const minutes=goals.map(x=>integer(x.minute,'Goal minute',46,120));
      if(minutes.some((n,i)=>i&&n<=minutes[i-1]))throw Error('Goal minutes must be strictly increasing.');
      Object.assign(v,{teamOne:upper(r.team_one),teamTwo:upper(r.team_two),match:upper(r.team_one)+' vs '+upper(r.team_two),halfTime:home+' – '+away,hook:(minutes[2]-minutes[0])+' MINUTES.\nTHREE GOALS.'});
      const words=['One','Two','Three'];goals.forEach((x,i)=>{if(x.team!==r.team_two)throw Error('Every comeback goal must belong to the trailing team.');away++;v['minute'+words[i]]=minutes[i]+'′';v['player'+words[i]]=upper(x.player);v['moment'+words[i]]=text(x.description,'Goal description',100);v['score'+words[i]]=home+' – '+away;});
      if(home!==away||Number(r.final_home)!==home||Number(r.final_away)!==away)throw Error('Final score and event-derived equalizer disagree.');
      const ph=integer(r.shootout_home,'Shoot-out home score',0,20),pa=integer(r.shootout_away,'Shoot-out away score',0,20);if(pa<=ph)throw Error('The trailing team must be the verified shoot-out winner.');
      Object.assign(v,{fullTime:home+' – '+away,shootoutScore:pa+' – '+ph,final:upper(r.team_two)+' WIN'});
      for(const k of ['date','credit','finalDetail','halfTimeDetail'])optional(k,k==='credit'?600:180);
      Object.assign(proof,{elapsedMinutes:minutes[2]-minutes[0],scoreProgression:goals.map((_,i)=>home+'-'+(Number(r.half_away)+i+1)),finalScore:[home,away],shootoutWinner:r.team_two});
    } else if(day===53){
      if(r.topic_id!=='merseyside-origins')throw Error('The approved location diagram is for the Merseyside origins family.');
      const events=exact(pick('historical_event'),4,'Origins chronology');
      const expected=['formed','anfield_move','goodison_move','liverpool_formed'];
      if(events.some((x,i)=>x.event!==expected[i]))throw Error('Founding, shared ground, departure and successor club must be sourced separately.');
      const years=events.map(x=>integer(x.year,'Event year',1800,2100));
      if(years.some((x,i)=>i&&x<years[i-1])||years[2]!==years[3])throw Error('Origin chronology or shared split year is inconsistent.');
      if(new Set(pick('evidence').map(x=>String(x.url).match(/^https:\/\/([^/]+)/)[1].toLowerCase())).size<2)throw Error('Both clubs must be represented by independent primary source domains.');
      Object.assign(v,{originYear:String(years[0]),sharedYear:String(years[1]),splitYear:String(years[2])});
      for(const k of ['hook','origin','sharedGround','split','newClub','closing','credit'])optional(k,k==='credit'?650:180);
      Object.assign(proof,{chronology:events.map(x=>({event:x.event,year:x.year})),sharedGroundYears:years[2]-years[1],twoClubEvidence:true});
    } else if(day===54){
      if(r.pattern!=='third-man-return-pass')throw Error('This choreography supports the third-man return-pass family.');
      const players=exact(pick('player'),3,'Three-player combination');unique(players,'number');
      const phases=exact(pick('phase'),3,'Pass, set and run phases');
      const [a,b,c]=players.map(x=>String(integer(x.number,'Shirt number',1,99)));
      const expected=[[a,b],[b,a],[a,c]];
      if(phases.some((x,i)=>String(x.from)!==expected[i][0]||String(x.to)!==expected[i][1]))throw Error('The pass graph must be A→B, B→A, A→C.');
      const distance=Number(r.runner_end_x)-Number(r.runner_start_x);if(Number(r.runner_start_x)!==40||Number(r.runner_end_x)!==75)throw Error('This reviewed schematic uses the 40-to-75 forward channel. New coordinates require a matching diagram revision.');
      Object.assign(v,{playerA:a,playerB:b,playerC:c,setup:'A defender steps toward '+b+'. A third player attacks the space behind.',pass:a+' finds '+b+' between the lines. Defender 4 steps toward the receiver.',layoff:b+' sets it back to '+a+'. The first passer can now face forward.',run:c+' attacks the vacated channel. '+a+' passes into the run.'});
      optional('title',60);optional('lesson');
      Object.assign(proof,{passGraph:expected,runnerAdvance:distance,geometry:'Approved schematic positions; not live match tracking.'});
    } else if(day===55){
      const clubs=exact(pick('standing'),4,'Title and survival analysis');unique(clubs,'role');
      const by=Object.fromEntries(clubs.map(x=>[x.role,x]));for(const k of ['leader','chaser','safe','danger'])if(!by[k])throw Error('Missing '+k+' standing.');
      if(clubs.some(x=>integer(x.remaining,'Remaining fixtures',0,38)!==1))throw Error('The approved layout compares one remaining match per club.');
      const p=Object.fromEntries(clubs.map(x=>[x.role,integer(x.points,'Points',0,150)]));if(p.leader<p.chaser||p.safe<p.danger)throw Error('The supplied standings roles contradict their points.');
      const verdict=(points,ceiling)=>points>ceiling?'GUARANTEED':points===ceiling?'TIE-BREAK POSSIBLE':'OTHER RESULT NEEDED';
      Object.assign(v,{leader:upper(by.leader.club),chaser:upper(by.chaser.club),leaderPoints:String(p.leader),chaserPoints:String(p.chaser),chaserMax:String(p.chaser+3),winPoints:String(p.leader+3),drawPoints:String(p.leader+1),lossPoints:String(p.leader),safeClub:upper(by.safe.club),dangerClub:upper(by.danger.club),safePoints:String(p.safe),dangerPoints:String(p.danger),dangerMax:String(p.danger+3),safeWin:String(p.safe+3),safeDraw:String(p.safe+1),safeLoss:String(p.safe)});
      const title=[3,1,0].map(delta=>verdict(p.leader+delta,p.chaser+3)),survival=[3,1,0].map(delta=>verdict(p.safe+delta,p.danger+3));
      const gap=p.leader-p.chaser;
      const lossText=gap===0?'RIVAL LOSS + TIE-BREAK NEEDED':gap===1?'RIVAL DRAW NEEDS TIE-BREAK':gap===2?'NEED '+upper(by.chaser.club)+' NOT TO WIN':gap===3?'RIVAL WIN NEEDS TIE-BREAK':'TITLE GUARANTEED';
      v.winText='WIN → '+(title[0]==='GUARANTEED'?'TITLE GUARANTEED':title[0]);v.drawText='DRAW → '+title[1];v.lossText='LOSS → '+lossText;
      v.survivalText=survival[0]==='GUARANTEED'?'A win puts '+text(by.safe.club,'Club',35)+" beyond "+text(by.danger.club,'Club',35)+"'s maximum.":'A win does not alone guarantee survival; check the other result and tie-break rules.';
      const resultGrid=[3,1,0].flatMap(leaderDelta=>[3,1,0].map(chaserDelta=>({leaderDelta,chaserDelta,leaderPoints:p.leader+leaderDelta,chaserPoints:p.chaser+chaserDelta,result:p.leader+leaderDelta>p.chaser+chaserDelta?'leader ahead':p.leader+leaderDelta===p.chaser+chaserDelta?'tie-break required':'chaser ahead'})));
      optional('league',100);optional('rules',180);Object.assign(proof,{points:p,titleVerdicts:title,survivalVerdicts:survival,resultGrid,scope:'Two specified title contenders and one specified survival boundary pair.',pointsSystem:{win:3,draw:1,loss:0},tieBreaks:'Equal points never imply a guaranteed position.'});
    } else if(day===56){
      const attempts=pick('assessment');if(!attempts.length)throw Error('Aggregate assessment counts are required to justify a targeted revision lesson.');
      const total=attempts.reduce((s,x)=>s+integer(x.count,'Attempt count',0,100000),0);if(!total)throw Error('An empty assessment cohort has no misconception signal.');
      const mistaken=attempts.filter(x=>x.error_type==='add_denominators').reduce((s,x)=>s+Number(x.count),0);
      const threshold=num(r.minimum_error_rate,'Minimum error rate',0,1);if(mistaken/total<threshold)return {...state,status:'skip',reason:'Denominator-addition errors are below the teacher threshold.',decision:{...state.decision,totalAttempts:total,misconceptionRate:mistaken/total}};
      // This worked-example family deliberately keeps its explanatory sixth strips.
      const fractions=exact(pick('fraction_problem'),2,'Worked and transfer examples');
      const expected=[[1,2,1,3],[1,4,1,2]];
      if(fractions.some((x,i)=>['a','b','c','d'].some((key,j)=>Number(x[key])!==expected[i][j])))throw Error('This diagram family uses 1/2+1/3 and transfer 1/4+1/2. A different problem needs a matching diagram revision.');
      const gcd=(a,b)=>{while(b){const t=b;b=a%b;a=t;}return a;};
      const answers=fractions.map(x=>{const n=Number(x.a)*Number(x.d)+Number(x.c)*Number(x.b),d=Number(x.b)*Number(x.d),g=gcd(n,d);return n/g+'/'+d/g;});
      Object.assign(v,{question:'1/2 + 1/3',wrongAnswer:'2/5',commonForm:'3/6 + 2/6',answer:answers[0],transfer:'1/4 + 1/2',transferAnswer:answers[1]});
      optional('prompt',120);Object.assign(proof,{totalAttempts:total,misconceptionAttempts:mistaken,misconceptionRate:mistaken/total,answers,teacherThreshold:threshold});
    } else if(day===57){
      const clues=exact(pick('clue'),3,'Progressive-clue quiz');
      const scores=clues.map(x=>num(x.specificity,'Clue specificity',0,100));if(scores.some((x,i)=>i&&x<=scores[i-1]))throw Error('Each clue must become more specific.');
      const answer=upper(r.country);if(clues.some(x=>String(x.text).toUpperCase().includes(answer)))throw Error('A clue leaks the country answer before the reveal.');
      const cooldown=integer(r.repeat_after_days,'Country repeat cooldown',1,365);
      if(state.history.some(x=>(x.country_code||x.decision?.countryCode)===r.country_code&&x.status==='delivered'&&Date.parse(x.completed_at||x.updated_at)>Date.parse(state.config.nowISO)-cooldown*86400000))return {...state,status:'skip',reason:'This country is still inside the quiz rotation cooldown.'};
      const shapes=exact(pick('map'),1,'Country outline')[0];
      if(shapes.approval!=='approved'||!/^https:\/\/[^\s/@<>]+(?:\/[^\s<>]*)?$/.test(String(shapes.url||'')))throw Error('Country outline requires approved map provenance with an HTTPS source URL.');
      const mapRights=text(shapes.rights,'Map rights',300);
      let polygons;try{polygons=JSON.parse(shapes.polygons_json);}catch{throw Error('Map coordinates must be a numeric polygon array.');}
      if(!Array.isArray(polygons)||!polygons.length||polygons.length>25)throw Error('Country outline polygon count is invalid.');
      let count=0;for(const polygon of polygons){if(!Array.isArray(polygon)||polygon.length<3)throw Error('Invalid country polygon.');for(const point of polygon){if(!Array.isArray(point)||point.length!==2)throw Error('Invalid map point.');num(point[0],'Map x',0,980);num(point[1],'Map y',0,900);if(++count>1500)throw Error('Map has too many points.');}}
      const paths=polygons.map(poly=>'<path d="M'+poly.map(p=>p.map(n=>Number(n).toFixed(1)).join(',')).join(' L')+' Z" fill="#e79d55" stroke="#552e1b" stroke-width="3"/>').join('');
      const marker='<circle cx="'+num(shapes.capital_x,'Capital x',0,980)+'" cy="'+num(shapes.capital_y,'Capital y',0,900)+'" r="18" fill="#efede1" stroke="#552e1b" stroke-width="6"/>';
      Object.assign(v,{clueOne:text(clues[0].text,'Clue',120),clueTwo:text(clues[1].text,'Clue',120),clueThree:text(clues[2].text,'Clue',120),answer,location:upper(r.location),countryMap:'<svg width="980" height="900" viewBox="0 0 980 900" xmlns="http://www.w3.org/2000/svg">'+paths+'</svg>',markedMap:'<svg width="980" height="900" viewBox="0 0 980 900" xmlns="http://www.w3.org/2000/svg">'+paths+marker+'</svg>'});
      optional('credit',500);Object.assign(proof,{countryCode:text(r.country_code,'Country code',3),clueSpecificity:scores,mapPoints:count,mapSourceUrl:shapes.url,mapRights,answerHiddenUntilReveal:true});
    } else if(day===58){
      const choices=exact(pick('choice'),3,'Listening answers');unique(choices,'label');
      const correct=choices.filter(x=>x.correct===true||x.correct==='true');if(correct.length!==1)throw Error('Exactly one listening answer must be marked correct.');
      const transcript=text(r.transcript,'Transcript',280),start=text(r.transcriptStart,'Opening transcript',140),turn=text(r.transcriptTurn,'Changed-plan transcript',140);
      if((start+' '+turn).replace(/\s+/g,' ')!==transcript.replace(/\s+/g,' '))throw Error('Transcript segments must reproduce the reviewed recording exactly.');
      if(!/but|instead|however/i.test(turn))throw Error('This challenge requires an explicit change-of-plan cue.');
      Object.assign(v,{prompt:upper(r.prompt),firstChoice:upper(choices[0].label),secondChoice:upper(choices[1].label),thirdChoice:upper(choices[2].label),answer:upper(correct[0].label),transcriptStart:start,transcriptTurn:turn,explanation:text(r.explanation,'Explanation',180),closing:text(r.closing,'Closing',100)});
      const signal=exact(pick('recording'),1,'Reviewed listening recording')[0];let bins;try{bins=JSON.parse(signal.rms_bins_json);}catch{throw Error('Measured RMS bins are required.');}
      if(!Array.isArray(bins)||bins.length!==64||bins.some(x=>!Number.isFinite(Number(x))||Number(x)<0||Number(x)>1))throw Error('Waveform must have 64 measured normalized RMS bins.');
      const seconds=num(signal.seconds,'Recording duration',1,5.5);if(signal.transcript!==transcript||signal.approval!=='approved'||!signal.rights||!/^https:\/\//.test(String(signal.url)))throw Error('Approved recording, rights and exact transcript do not match.');
      v.audioUrl=signal.url;v.audioLabel=text(signal.voice_label,'Voice label',100);v.waveform='<svg width="1140" height="180" viewBox="0 0 1140 180" xmlns="http://www.w3.org/2000/svg">'+bins.map((value,i)=>{const h=Math.max(8,Number(value)*160);return '<rect x="'+(7+i*17.5)+'" y="'+((180-h)/2).toFixed(1)+'" width="10" height="'+h.toFixed(1)+'" rx="5" fill="#44685f"/>';}).join('')+'</svg>';
      // Both plays must use the approved file's full duration. Keep the quiz
      // scene boundaries unchanged, retaining at least half a second after each
      // recording and the complete intervening answer-selection interval.
      const project=JSON.parse(JSON.stringify(state.template)),playbackCues=[];
      project.scenes.forEach((scene,sceneIndex)=>{for(const audio of scene.audios||[]){if(audio.src!=='{{audioUrl}}')continue;const enter=Number(audio.enter);if(!Number.isFinite(enter)||enter<0||enter+seconds>Number(scene.duration)-0.5)throw Error('Listening recording leaves too little time before the next scene.');audio.audioBegin=0;audio.audioEnd=seconds;audio.exit=Number((enter+seconds).toFixed(6));playbackCues.push({sceneIndex,enter,exit:audio.exit,audioBegin:0,audioEnd:seconds});}});
      if(playbackCues.length!==2||playbackCues[0].sceneIndex!==0||playbackCues[1].sceneIndex!==2)throw Error('This listening design requires the two approved playback scenes.');
      state.project=project;
      Object.assign(proof,{transcript,recordingSeconds:seconds,correctChoice:correct[0].label,choiceCount:3,plays:2,playbackCues,answerRevealAtSeconds:project.scenes.slice(0,3).reduce((sum,x)=>sum+Number(x.duration),0)});
    } else if(day===59){
      if(r.concept!=='earth-seasons'||r.diagram_hemisphere!=='north')throw Error('This diagram family explains Earth seasons from the northern-hemisphere view.');
      const votes=exact(pick('prediction'),2,'Prediction choices');unique(votes,'cause');const tilt=votes.find(x=>x.cause==='tilt'),distance=votes.find(x=>x.cause==='distance');if(!tilt||!distance)throw Error('Collect both tilt and distance predictions.');
      const tiltCount=integer(tilt.count,'Tilt predictions',0,100000),distanceCount=integer(distance.count,'Distance predictions',0,100000),total=tiltCount+distanceCount;
      if(total<integer(r.minimum_responses,'Minimum responses',1,100000))return {...state,status:'skip',reason:'Wait for enough learner predictions before generating the explanation.'};
      const facts=exact(pick('science_fact'),2,'Mechanism evidence');
      if(!facts.some(x=>x.fact==='axial_tilt'&&Math.abs(Number(x.value)-23.5)<0.1)||!facts.some(x=>x.fact==='hemispheres'&&x.value==='opposite'))throw Error('The source must verify 23.5-degree tilt and opposite hemisphere seasons.');
      optional('question',80);optional('credit',500);
      Object.assign(proof,{totalResponses:total,distanceMisconceptionRate:distanceCount/total,teachingFocus:distanceCount>tiltCount?'Correct the distance misconception':'Explain why the tilt mechanism works',mechanism:['sunlight angle','day length'],diagramNotToScale:true});
    } else if(day===60){
      const a=integer(r.rows,'Rows',2,10),b=integer(r.columns,'Columns',2,10),split=integer(r.split_rows,'Split rows',1,9);
      if(a%2||split>=a)throw Error('Two methods require an even row count and a smaller positive split.');
      const assessments=pick('mastery');if(!assessments.length)throw Error('Mastery observations are required to choose a useful model.');
      const needed=assessments.some(x=>x.skill==='explain_multiplication'&&num(x.accuracy,'Accuracy',0,1)<num(r.mastery_threshold,'Mastery threshold',0,1));
      if(!needed)return {...state,status:'skip',reason:'The cohort already meets the explanation mastery threshold.'};
      const product=a*b,left=split*b,right=(a-split)*b,half=(a/2)*b;
      const svg=mode=>{const gap=10,w=Math.min(88,(710-(b-1)*gap)/b),h=Math.min(56,(400-(a-1)*12)/a);let cells='';for(let y=0;y<a;y++)for(let x=0;x<b;x++){const color=mode==='split'&&y>=split?'#dd8b5b':mode==='double'&&y>=a/2?'#9369aa':'#468fa3';cells+='<rect class="cell" x="'+(15+x*(w+gap)).toFixed(1)+'" y="'+(12+y*(h+12)).toFixed(1)+'" width="'+w.toFixed(1)+'" height="'+h.toFixed(1)+'" rx="9" fill="'+color+'" style="animation-delay:'+(y*.14+x*.05).toFixed(2)+'s"/>';}return '<svg width="740" height="450" viewBox="0 0 740 450" xmlns="http://www.w3.org/2000/svg">'+cells+'</svg>';};
      Object.assign(v,{problem:a+' × '+b,methodOne:'SPLIT '+a+' INTO '+split+' + '+(a-split),methodOneEquation:left+' + '+right+' = '+product,methodOneExplanation:split+' rows of '+b+',\nplus '+(a-split)+' more '+(a-split===1?'row.':'rows.'),methodTwo:'DOUBLE '+(a/2)+' × '+b,methodTwoEquation:half+' + '+half+' = '+product,methodTwoExplanation:'Two equal groups.\nSame total.',answer:String(product),arrayModel:svg('all'),decomposedModel:svg('split'),doubledModel:svg('double')});
      Object.assign(proof,{rows:a,columns:b,product,distributive:[left,right],doubling:[half,half],cellsPerModel:a*b});
    }
    // A media register supplies approved replacement images rather than allowing
    // arbitrary URL fields to leak into a finished project.
    for(const row of pick('media'))if(Object.hasOwn(state.defaults,row.variable))v[row.variable]=row.url;
    const trustedMarkupVariables=day===57?['countryMap','markedMap']:day===58?['waveform']:day===60?['arrayModel','decomposedModel','doubledModel']:[];
    return {...state,variables:{...state.variables,...v},trustedMarkupVariables,decision:{...state.decision,...proof}};
  }catch(error){return {...state,status:'review',reason:error.message};}
}

function bindApprovedAudio(state) {
  if(state.status!=='ready')return state;
  // Pure SHA-256 permits identical fingerprinting in module-free n8n Code nodes.
  function sha256(value){const bytes=unescape(encodeURIComponent(value)),words=[],K=[],H=[];let count=0;for(let candidate=2;count<64;candidate++){let prime=true;for(let divisor=2;divisor*divisor<=candidate;divisor++)if(candidate%divisor===0){prime=false;break;}if(prime){if(count<8)H[count]=(Math.sqrt(candidate)%1*4294967296)|0;K[count++]=(Math.cbrt(candidate)%1*4294967296)|0;}}for(let i=0;i<bytes.length;i++)words[i>>2]=(words[i>>2]||0)|bytes.charCodeAt(i)<<(24-(i%4)*8);words[bytes.length>>2]=(words[bytes.length>>2]||0)|128<<(24-(bytes.length%4)*8);words[(((bytes.length+8)>>6)+1)*16-1]=bytes.length*8;const rr=(x,n)=>(x>>>n)|(x<<(32-n));for(let offset=0;offset<words.length;offset+=16){const w=[],h=H.slice();for(let i=0;i<64;i++){if(i<16)w[i]=words[offset+i]|0;else{const a=w[i-15],b=w[i-2];w[i]=((rr(a,7)^rr(a,18)^(a>>>3))+w[i-16]+(rr(b,17)^rr(b,19)^(b>>>10))+w[i-7])|0;}const t1=(h[7]+(rr(h[4],6)^rr(h[4],11)^rr(h[4],25))+((h[4]&h[5])^(~h[4]&h[6]))+K[i]+w[i])|0,t2=((rr(h[0],2)^rr(h[0],13)^rr(h[0],22))+((h[0]&h[1])^(h[0]&h[2])^(h[1]&h[2])))|0;h.pop();h.unshift((t1+t2)|0);h[4]=(h[4]+t1)|0;}for(let i=0;i<8;i++)H[i]=(H[i]+h[i])|0;}return H.map(x=>(x>>>0).toString(16).padStart(8,'0')).join('');}
  const canonical=value=>{if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));return value;};
  const day=DAY_NUMBER,variables={...state.defaults,...state.variables};
  const content=Object.fromEntries(Object.entries(variables).filter(([k])=>!/(?:AudioBegin|AudioEnd|narrationUrl|narrationSeconds)$/.test(k)));
  const script=String(state.request.approved_script||'').trim();
  const design=state.project||state.template;
  const timeline=design.scenes.map(x=>Number(x.duration));
  const designGeometry=sha256(JSON.stringify(design.scenes.map(({audios,...scene})=>scene)));
  const binding={content:canonical(content),script,sceneSeconds:timeline,designGeometry};
  if(day===58)binding.listeningAudio={url:variables.audioUrl,seconds:state.decision.recordingSeconds,cues:state.decision.playbackCues};
  const fingerprint=sha256(JSON.stringify(binding));
  const artifact={kind:'editorial-script',contentFingerprint:fingerprint,sourceId:state.request.source_id,revision:state.request.revision,script,sceneSeconds:timeline,variables:state.variables,proof:state.decision,requires:'An editor-approved recording, exact source revision and matching content fingerprint. Preserve the approved scene cues and intentional quiz pauses.'};
  if(!script)return {...state,status:'review',reason:'An editor-approved narration script is required.',artifacts:[...state.artifacts,artifact]};
  const recordings=state.records.filter(x=>x.kind==='narration');
  const record=recordings.length===1?recordings[0]:null;
  if(!record||record.approval!=='approved'||record.content_fingerprint!==fingerprint||record.script!==script||!/^https:\/\//.test(String(record.url||''))||!record.rights||record.cues_verified!==true&&record.cues_verified!=='true')return {...state,status:'review',reason:'Narration approval does not match this exact content and timeline. Review the script artifact and supply its matching recording.',artifacts:[...state.artifacts,artifact],decision:{...state.decision,contentFingerprint:fingerprint}};
  const duration=Number(record.seconds),total=timeline.reduce((a,b)=>a+b,0);
  if(!Number.isFinite(duration)||duration<=0||duration>total+1.5)return {...state,status:'review',reason:'The approved recording duration does not fit the scene timeline.',artifacts:[...state.artifacts,artifact]};
  if(day===58&&(record.url!==variables.audioUrl||duration!==state.decision.recordingSeconds||script!==state.decision.transcript))return {...state,status:'review',reason:'Listening audio approval must match the exact played file, full duration and transcript.',artifacts:[...state.artifacts,artifact]};
  if(day!==58)variables.narrationUrl=record.url;
  if(Object.hasOwn(variables,'narrationSeconds'))variables.narrationSeconds=duration;
  return {...state,variables,status:'ready',reason:'Approved source content, calculations and matched audio are ready.',decision:{...state.decision,contentFingerprint:fingerprint,narrationBound:true,narrationSeconds:duration},artifacts:[...state.artifacts,artifact]};
}

const metadata=[
 [51,'football-career-turning-point','Turn verified player milestones into a career story','Football editors need sourced career stories without mixing statistics from different seasons.','Private career video, fact trail, competition-total reconciliation and an approved narration handoff.',['Verify career source records','Reconcile loans and breakthrough statistics','Bind the approved career narration']],
 [52,'football-comeback-event-reconstruction','Reconstruct a historic comeback from verified match events','A football channel needs an accurate event sequence, score progression and winner rather than an invented dramatic summary.','Private comeback video plus score reconstruction, time-window calculations and source evidence.',['Check match report and goal evidence','Rebuild the comeback score by score','Match commentary to the reconstructed events']],
 [53,'football-rivalry-origin-editorial','Build an evidence-checked Merseyside origins story','Football history editors need to reconcile two clubs’ accounts and distinguish later venue photographs from historical events.','Private origins video with ordered dates, two-club sources and rights-aware media evidence.',['Verify the two clubs and venue rights','Reconcile founding and ground chronology','Bind the approved historical commentary']],
 [54,'football-third-man-coaching-pattern','Turn a coach-approved pass pattern into a tactical lesson','Coaches need a repeatable tactical explanation whose player roles and pass sequence agree with its diagram.','Private third-man lesson, pass graph, runner movement check and coach-approved commentary.',['Check the coach-approved pattern','Validate pass graph and forward run','Synchronize the lesson and commentary']],
 [55,'football-title-survival-scenarios','Calculate title and survival scenarios for the final match','Football editors must distinguish guaranteed outcomes from those depending on other results or tie-breaks.','Private scenarios video with calculated points ceilings and a result-by-result decision table.',['Read approved standings and competition rules','Calculate title and survival ceilings','Match the scenario commentary']],
 [56,'education-fraction-misconception-revision','Create targeted fraction revision from assessment errors','Teachers need to prioritize a demonstrated denominator-addition misconception using aggregate assessment evidence.','Private misconception video, exact worked and transfer answers, and a cohort-level teaching decision.',['Check teacher approval and assessment aggregates','Measure the misconception and prove the answers','Verify worked-example audio alignment']],
 [57,'education-country-clue-rotation','Build progressive country quizzes with a rotation cooldown','Educational channels need increasingly revealing clues, a correct outline and a rotation policy that avoids repeated countries.','Private quiz video, source-derived outline, clue-order proof and a withheld-answer check.',['Verify country facts and map rights','Sequence clues and build the country outline','Bind quiz narration and reveal timing']],
 [58,'education-listening-change-of-plan','Create a listening challenge from a reviewed change-of-plan recording','Language teachers need a listening exercise whose choices, transcript, waveform and correct answer agree with the actual recording.','Private listening video with measured waveform, transcript checks and one verified answer.',['Check recording rights and teacher approval','Reconcile transcript, options and measured waveform','Approve the recording and listening timeline']],
 [59,'education-seasons-prediction-explanation','Respond to learner predictions with an Earth seasons lesson','Science teachers need to address real learner predictions and demonstrate sunlight angle and day length without reinforcing a distance misconception.','Private seasons explanation and a prediction-analysis report based on aggregated learner responses.',['Check scientific sources and prediction counts','Choose the teaching focus from learner evidence','Protect the corrected seasons narration']],
 [60,'education-multiplication-two-models','Generate two visual multiplication proofs from mastery data','Teachers need to respond to weak multiplication explanations with two internally consistent visual proofs.','Private multiplication lesson with regenerated arrays, distributive and doubling proofs, and mastery evidence.',['Review teacher-approved mastery evidence','Compute both proofs and rebuild all arrays','Match the lesson narration to the generated models']],
];
const baseRequest=['source_id','revision','approval','status','updated_at','source_url','publish_at','expires_at','approved_script'];
const fields={51:['player','breakthrough_year','hook','startYear','startHeadline','startDetail','closing','credit'],52:['team_one','team_two','half_home','half_away','final_home','final_away','shootout_home','shootout_away','date','credit','finalDetail','halfTimeDetail'],53:['topic_id','hook','origin','sharedGround','split','newClub','closing','credit'],54:['pattern','runner_start_x','runner_end_x','title','lesson'],55:['league','rules'],56:['minimum_error_rate','prompt'],57:['country','country_code','location','repeat_after_days','credit'],58:['prompt','transcript','transcriptStart','transcriptTurn','explanation','closing'],59:['concept','diagram_hemisphere','minimum_responses','question','credit'],60:['rows','columns','split_rows','mastery_threshold']};
const recordFields=['parent_id','revision','record_id','kind','position','approval','claim','url','rights','variable','content_fingerprint','script','seconds','cues_verified'];
const specificFields={51:['club','start_year','end_year','label','all_goals','league_goals'],52:['minute','team','player','description'],53:['event','year'],54:['number','from','to'],55:['role','club','points','remaining'],56:['error_type','count','a','b','c','d'],57:['specificity','text','polygons_json','capital_x','capital_y'],58:['label','correct','rms_bins_json','transcript','voice_label'],59:['cause','count','fact','value'],60:['skill','accuracy']};

function embedded(fn,day){return new Function('state',fn.toString().slice(fn.toString().indexOf('{')+1,-1).replaceAll('DAY_NUMBER',String(day)));}
// The reviewed photos are unchanged. Use verified official 1280px thumbnails
// in source samples so each decoded edge remains within the 1920px image limit.
// The approved raw designs stay intact; makeSample binds the same audio/script
// and scene cues to these exact source-media URLs below.
const samplePhotoUrls={
  51:{playerPhoto:'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0b/England_striker_Harry_Kane_and_France_midfielder_Morgan_Schneiderlin_%2822721788819%29.jpg/1280px-England_striker_Harry_Kane_and_France_midfielder_Morgan_Schneiderlin_%2822721788819%29.jpg'},
  52:{stadiumPhoto:'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4e/Istanbul_Atat%C3%BCrk_Olympic_Stadium_1.jpg/1280px-Istanbul_Atat%C3%BCrk_Olympic_Stadium_1.jpg'},
  53:{anfieldPhoto:'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4a/The_Kop_end.jpg/1280px-The_Kop_end.jpg',goodisonPhoto:'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a4/Outside_Goodison_Park_%2851930122219%29.jpg/1280px-Outside_Goodison_Park_%2851930122219%29.jpg'},
};
function makeSample(day,defaults,payload,scripts){
  const request={source_id:'qa-studio-'+day,revision:'r1',approval:'approved',status:'ready',updated_at:'2026-10-02T09:00:00Z',source_url:'https://docs.zvid.io',publish_at:'',expires_at:'',approved_script:scripts['d'+day]||'I was going to take the bus, but I decided to walk instead.'};
  const records=[];let id=0;const add=(kind,value)=>records.push({parent_id:request.source_id,revision:'r1',record_id:'r'+(++id),kind,position:id,approval:'approved',...value});
  add('evidence',{claim:'Editor reviewed the exact supplied lesson and cited its underlying source.',url:day===59?'https://spaceplace.nasa.gov/seasons/en/':day===57?'https://www.japan.go.jp/japan/index.html':day<=55?'https://www.tottenhamhotspur.com/the-club/history/':'https://docs.zvid.io'});
  const copy=keys=>keys.forEach(k=>request[k]=defaults[k]);
  if(day===51){Object.assign(request,{player:'Harry Kane',breakthrough_year:2014});copy(['hook','startYear','startHeadline','startDetail','closing','credit']);['Leyton Orient','Millwall','Norwich City','Leicester City'].forEach((club,i)=>add('loan',{club,start_year:[2011,2012,2012,2013][i],end_year:[2011,2012,2013,2013][i]}));add('season',{label:'2014 / 15',all_goals:31,league_goals:21});}
  if(day===52){Object.assign(request,{team_one:'Milan',team_two:'Liverpool',half_home:3,half_away:0,final_home:3,final_away:3,shootout_home:2,shootout_away:3});copy(['date','credit','finalDetail','halfTimeDetail']);['One','Two','Three'].forEach((word,i)=>add('goal',{minute:[54,56,60][i],team:'Liverpool',player:defaults['player'+word],description:defaults['moment'+word]}));records[0].url='https://www.uefa.com/uefachampionsleague/match/80813--milan-vs-liverpool/';}
  if(day===53){request.topic_id='merseyside-origins';copy(['hook','origin','sharedGround','split','newClub','closing','credit']);['formed','anfield_move','goodison_move','liverpool_formed'].forEach((event,i)=>add('historical_event',{event,year:[1878,1884,1892,1892][i]}));records[0].url='https://www.liverpoolfc.com/info/1892-1959';add('evidence',{claim:'Everton founding and Anfield to Goodison history.',url:'https://www.evertonfc.com/club/history'});}
  if(day===54){Object.assign(request,{pattern:'third-man-return-pass',runner_start_x:40,runner_end_x:75});copy(['title','lesson']);[8,10,7].forEach(number=>add('player',{number}));[[8,10],[10,8],[8,7]].forEach(([from,to])=>add('phase',{from,to}));}
  if(day===55){copy(['league','rules']);[['leader','Alder',72],['chaser','Beacon',70],['safe','Marsh',33],['danger','Coast',32]].forEach(([role,club,points])=>add('standing',{role,club,points,remaining:1}));records[0].claim='Teacher-authored fictional standings with 3/1/0 points; no real competition claim.';}
  if(day===56){request.minimum_error_rate=.25;copy(['prompt']);add('assessment',{error_type:'add_denominators',count:18});add('assessment',{error_type:'correct',count:12});[[1,2,1,3],[1,4,1,2]].forEach(([a,b,c,d])=>add('fraction_problem',{a,b,c,d}));records[0].claim='Teacher verified exact rational arithmetic and anonymized cohort counts.';}
  if(day===57){Object.assign(request,{country:'Japan',country_code:'JP',location:defaults.location,repeat_after_days:30,credit:defaults.credit});['One','Two','Three'].forEach((word,i)=>add('clue',{text:defaults['clue'+word],specificity:20+i*35}));const paths=[...defaults.countryMap.matchAll(/d="M([^\"]+)Z"/g)].map(m=>[...m[1].matchAll(/([\d.]+),([\d.]+)/g)].map(n=>[Number(n[1]),Number(n[2])]));add('map',{polygons_json:JSON.stringify(paths),capital_x:615.6,capital_y:582.4,rights:'Natural Earth public-domain geometry',url:'https://www.naturalearthdata.com/about/terms-of-use/'});}
  if(day===58){copy(['prompt','transcriptStart','transcriptTurn','explanation','closing']);request.transcript=defaults.transcriptStart+' '+defaults.transcriptTurn;['firstChoice','secondChoice','thirdChoice'].forEach((key,i)=>add('choice',{label:defaults[key],correct:i===1}));const bins=[...defaults.waveform.matchAll(/height="([\d.]+)" rx=/g)].map(m=>Number(m[1])/160);add('recording',{rms_bins_json:JSON.stringify(bins),url:defaults.audioUrl,seconds:4.416,transcript:request.transcript,voice_label:defaults.audioLabel,rights:'Approved synthetic demonstration recording'});}
  if(day===59){Object.assign(request,{concept:'earth-seasons',diagram_hemisphere:'north',minimum_responses:10});copy(['question','credit']);add('prediction',{cause:'distance',count:18});add('prediction',{cause:'tilt',count:12});add('science_fact',{fact:'axial_tilt',value:23.5});add('science_fact',{fact:'hemispheres',value:'opposite'});}
  if(day===60){Object.assign(request,{rows:6,columns:7,split_rows:5,mastery_threshold:.8});add('mastery',{skill:'explain_multiplication',accuracy:.52});records[0].claim='Teacher verified integer distributive and doubling arithmetic and aggregate mastery.';}
  for(const key of ['playerPhoto','stadiumPhoto','anfieldPhoto','goodisonPhoto'])if(defaults[key])add('media',{variable:key,url:samplePhotoUrls[day]?.[key]||defaults[key],rights:defaults.credit||'Approved source photograph'});
  // Sample recordings have been reviewed against these exact approved designs.
  // New source content must obtain a new matching approval, not reuse this binding.
  const state={request,records,history:[],config:{nowISO:'2026-10-03T12:00:00Z'},defaults,template:payload,variables:{},decision:{},artifacts:[]};
  const prepared=embedded(calculateContent,day)(reviewSource(state));
  if(prepared.status!=='ready')throw Error('Invalid D'+day+' sample: '+prepared.reason);
  const review=embedded(bindApprovedAudio,day)(prepared),fingerprint=review.artifacts.at(-1).contentFingerprint;
  const durations={51:26.784,52:32.64,53:24.72,54:25.344,55:30.288,56:30.792,57:31.2,58:4.416,59:34,60:29.16};
  add('narration',{url:defaults.narrationUrl||defaults.audioUrl,seconds:durations[day],content_fingerprint:fingerprint,script:request.approved_script,rights:'Approved synthetic narration supplied with the reviewed Zvid design',cues_verified:true});
  return {request,records};
}

const designRoot=path.join(__dirname,'assets');
const scripts=Object.assign({},...['narration-scripts.json','narration-scripts-53-55.json','narration-scripts-56-60.json'].map(file=>JSON.parse(fs.readFileSync(path.join(designRoot,file),'utf8'))));
module.exports=metadata.map(([day,slug,title,need,outcome,stageNames])=>{const payload=JSON.parse(fs.readFileSync(path.join(designRoot,'day-'+day+'.json'),'utf8'));return {day,slug,title,need,outcome,stageNames,requestFields:[...baseRequest,...fields[day]],recordFields:[...recordFields,...specificFields[day]],sample:makeSample(day,payload.variables,payload,scripts),stages:[reviewSource,embedded(calculateContent,day),embedded(bindApprovedAudio,day)]};});
