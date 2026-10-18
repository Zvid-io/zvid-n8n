'use strict';

// Publication copy is kept separate from layout so maintenance never needs to
// infer instructions from old, potentially stale sticky notes.
const specs = {
  'reddit-story-video': {
    match: 'Fetch top stories', title: 'Create Reddit story videos',
    how: 'Use your own story text, or fetch a subreddit’s top posts through approved Reddit OAuth access. Generate narration, timed captions and stock footage, then render a vertical video for review.',
    setup: ['Default sourceMode=manual requires manualStoryTitle and manualStoryText in Config. For sourceMode=reddit, connect an approved Reddit OAuth2 app to Fetch top stories and set subreddit and redditUserAgent.', 'Set channelHandle and ctaText. Connect OpenRouter to Write script and ElevenLabs Header Auth (xi-api-key) to Generate voiceover.'],
    groups: [['story','Choose a source story','Manual mode needs your story text. Reddit mode needs approved OAuth access; HTTP 429 stops before paid steps. Review the source and retain attribution.','Manual story?|Fetch top stories|Pick story']],
  },
  'blog-to-video': {
    match: 'Prepare prompt', title: 'Turn a blog post into a video',
    how: 'Read your RSS feed, find a new post, and fetch the article text. Generate narration and stock footage, then render a captioned vertical summary. The feed excerpt is a fallback when the article cannot be fetched.',
    setup: ['Set feedUrl, brandName, colors and ctaText in Config.', 'Connect OpenRouter to Write script and ElevenLabs Header Auth (xi-api-key) to Generate voiceover.'],
    groups: [['feed','Find a new article','Read the configured RSS feed and skip posts already completed in production. An empty or inaccessible feed needs attention.','Read blog feed|Pick newest post|New post?|Nothing new today'],['article','Read the article','Fetch the full page when available. The prompt falls back to feed text and should not invent missing facts.','Fetch post page|Prepare prompt']],
  },
  'weekly-news-roundup': {
    match: 'Curate top five', title: 'Create a weekly news roundup',
    how: 'Pool recent headlines from your RSS feeds, curate a countdown, and generate timed narration. Zvid combines source labels, stock footage, captions and music into a vertical roundup for your review.',
    setup: ['Set feedUrls, niche, lookbackDays, brandName and ctaText in Config.', 'Connect OpenRouter to Curate top five and ElevenLabs Header Auth (xi-api-key) to Generate voiceover.'],
    groups: [['feeds','Collect recent headlines','Read each feed, remove duplicates and filter by the lookback window. Review source links before publishing the roundup.','Plan feeds|Read feeds|Pool headlines']],
  },
  'shopify-product-promo': {
    match: 'Poll new products', title: 'Create product promo videos',
    how: 'Take one product from Google Sheets or Shopify and render a vertical promo with photos, prices and a call to action. Sheet mode records the completed video URL on the same row.',
    setup: ['Connect Google Sheets and choose the same spreadsheet and tab in both sheet nodes. Default source is sheet.', 'For source=shopify, configure shopDomain and Shopify credentials on Poll new products. Set branding and storeUrl in Config.'],
    groups: [['source','Select a product source','Choose sheet or Shopify in Config. Configure only the source you use and keep your product photos publicly accessible.','Source?|Read products sheet|Pick next product|Poll new products|New product?'],['eligible','Check the product queue','Headers: Title, Price, CompareAtPrice, ImageUrl1, ImageUrl2, Tagline, Status, VideoUrl. Title and ImageUrl1 are required; leave Status empty. Use your own product photography.','Product found?|Nothing to render']],
  },
  'bulk-catalog-videos': {
    match: 'Get catalog rows', title: 'Create videos for a product catalog',
    how: 'Select unfinished product rows, build one shared design, and submit a bulk render. Completed video links are matched back to their product rows. When all rows already have videos, finish successfully without rendering. Review each output before using it in a campaign.',
    setup: ['Connect Google Sheets and select the same spreadsheet and tab in Get catalog rows and Write links to sheet.', 'Set brandName, website, colors and maxProducts in Config. Keep the batch size within your account’s limits.'],
    groups: [['queue','Prepare the product queue','Headers: Product, Price, CompareAtPrice, Feature1, Feature2, Feature3, ImageUrl1, ImageUrl2, CtaText, VideoUrl. Product must be unique; supply Price, ImageUrl1 and all three features. Leave VideoUrl empty for new renders. Completed catalogs exit successfully without spending credits.','Get catalog rows|Rows needing videos|Products need videos?|No pending products']],
  },
  'flash-sale-alert': {
    match: 'Poll price drops', title: 'Create a flash-sale video and banner',
    how: 'Read a sale from Google Sheets or Shopify and render a vertical video and email banner, one at a time. Wait when render capacity is full. Sheet mode saves both URLs; optional SMTP delivery sends the banner when configured.',
    setup: ['Connect Google Sheets and select the same spreadsheet and tab in both sheet nodes.', 'Set source, brandName, storeUrl and ctaText in Config. Shopify mode needs its credential; optional email needs SMTP and emailTo.'],
    groups: [['source','Find the next sale','Select sheet or Shopify in Config. Shopify mode compares prices between runs; sheet mode takes the next eligible row.','Source?|Poll price drops|Find price drops|Read sale sheet|Pick next sale'],['eligible','Check the sale details','Headers: Product, OldPrice, NewPrice, ImageUrl, EndsAt, Status, VideoUrl, BannerUrl. The first four are required. NewPrice must be lower than OldPrice; leave output columns empty.','Sale found?|Nothing to announce'],['deliver','Save both assets and optionally email','Write the video and banner links back in sheet mode. SMTP delivery runs only when emailTo is configured.','Collect outputs|Sheet mode?|Mark sale done|Email the banner?|Email the banner']],
  },
  'review-testimonial-video': {
    match: 'Fetch Judge.me reviews', title: 'Turn customer reviews into videos',
    how: 'Choose an eligible review from Google Sheets or Judge.me, shorten its wording, and render a vertical testimonial. The rating comes from the original review. Sheet mode marks the row done after rendering.',
    setup: ['Connect both Google Sheets nodes to the same spreadsheet and tab. Set brandName, storeUrl and minRating in Config.', 'Sheet mode and useLlm=false need no AI credential. Judge.me mode needs its token; optional AI trimming needs OpenRouter.'],
    groups: [['source','Load an eligible review','Choose sheet or Judge.me in Config. Judge.me requires its API credential and shop configuration.','Source?|Read reviews sheet|Pick next review|Fetch Judge.me reviews|Pick Judge.me review'],['eligible','Check the review queue','Headers: Reviewer, Rating, ReviewText, Product, ImageUrl, Status, VideoUrl. Reviewer, Rating and ReviewText are required. Use ratings 1–5; leave Status empty.','Review found?|Nothing to render today'],['quote','Keep the customer’s meaning','Clean and shorten the review. AI trimming is optional; review the final quote against the original before publishing.','Clean review text|Use AI?|Trim quote with AI|Use AI quote|Trim quote']],
  },
  'abandoned-cart-video': {
    match: 'Poll checkouts', title: 'Create personalized cart-recovery videos',
    how: 'Read an abandoned cart from Google Sheets or Shopify and render a video showing up to three items. Optional email includes the checkout link. The completed result is recorded for the selected source.',
    setup: ['Connect both Google Sheets nodes to the same spreadsheet and tab. Default source is sheet; Shopify mode requires its checkout access.', 'Set brandName, storeUrl and recovery copy in Config. Optional sending requires sendEmail=true, SMTP and an approved sender.'],
    groups: [['source','Load one abandoned cart','Select sheet or Shopify in Config. Connect the selected source and use only checkout data you are authorized to process.','Source?|Read carts sheet|Pick next cart|Poll checkouts|Pick abandoned checkout'],['eligible','Check the cart input','Headers: Email, FirstName, Item1, Item1Image, Item1Price, Item2, Item2Image, Item2Price, Item3, Item3Image, Item3Price, CheckoutUrl, Status, VideoUrl. Item1 is required; leave Status empty.','Cart found?|Nothing to recover'],['email','Prepare optional recovery delivery','Email and the checkout link are used for delivery, not rendered in the video. Enable SMTP sending only after a private test.','Prepare recovery email|Email the customer?|Send recovery email'],['record','Record the completed checkout','Save the result to the sheet or remember the Shopify checkout. This avoids selecting the same completed item again.','Sheet mode?|Mark cart recovered|Remember sent checkout']],
  },
  'cold-outreach-videos': {
    match: 'Read leads sheet', title: 'Create personalized outreach videos',
    how: 'Read pending leads, personalize a landscape video for each, and render them in one batch. Write each finished URL to the matching sheet row. Sending outreach is a separate step you can add after review.',
    setup: ['Connect Read leads sheet and Write URLs back to the same spreadsheet and tab.', 'Set senderName, senderCompany, pitchPoints and meetingUrl in Config. Set maxPerRun within your bulk-render limits.'],
    groups: [['queue','Prepare the lead queue','Headers: FirstName, Company, Website, LogoUrl, Role, Status, VideoUrl. FirstName and Company are required; leave Status empty. Use accurate company logos.','Read leads sheet|Pick batch|Leads found?|Nothing to send today']],
  },
  'welcome-video-on-signup': {
    match: 'On new signup', title: 'Create a welcome video for each signup',
    how: 'Receive signup details or run the sample, personalize a landscape welcome video, and return the video URL and editor link. Optional SMTP delivery sends the result to the new user.',
    setup: ['Set brandName, colors, onboarding cards, ctaText and ctaUrl in Config. Test with Sample signup first.', 'POST firstName plus optional plan, company and email to the production webhook. Allow enough caller time for rendering. Optional email requires SMTP and sendEmail=true.'],
    groups: [['signup','Prepare signup details','Use Sample signup for a manual test. The webhook expects firstName; plan, company and email are optional.','Sample signup|Signup data'],['draft','Save the editable draft','Save the project and return an editor link. dryRun=true returns the quote without submitting a render.','Save draft to editor|Editor link|Dry run?|Dry-run response'],['response','Return the result and optionally email','The webhook waits for the result. Configure SMTP and sendEmail before enabling welcome emails.','Render response|Respond to signup|Send email?|Send welcome email (SMTP)']],
  },
  'proposal-recap-video': {
    match: 'Deal webhook', title: 'Create a proposal recap video',
    how: 'Take a deal from Google Sheets or a webhook and render a landscape recap of its scope, amount, timeline and call to action. Save the URL to the sheet or return it to your CRM.',
    setup: ['Connect both Google Sheets nodes to the same spreadsheet and tab, or set source=webhook and POST dealName, company and amount.', 'Set senderName, senderCompany, meetingUrl and branding in Config. Amounts are formatted in the supplied currency, never converted.'],
    groups: [['source','Choose the deal input','Sheet headers: DealName, Company, ContactFirstName, Amount, Currency, ScopeLine1, ScopeLine2, ScopeLine3, TimelineWeeks, ValidUntil, Status, VideoUrl. DealName, Company and Amount are required; leave Status empty.','Source?|Webhook payload|Read deals sheet|Pick next deal'],['eligible','Check for a pending deal','Render only when a usable deal is found. Empty queues finish without a render.','Deal found?|Nothing to send'],['return','Save or return the video URL','Update the matching sheet row when present. Webhook callers receive the result after rendering; allow a suitable request timeout.','Video URL|Sheet row?|Mark deal sent|Respond with video']],
  },
  'no-show-reengagement': {
    match: 'No-show webhook', title: 'Create a rebooking video for no-shows',
    how: 'Read a recorded no-show from Google Sheets or a webhook and render a personalized invitation to rebook. Optionally email the video and record the result. The workflow does not detect attendance itself.',
    setup: ['Connect both Google Sheets nodes to the same spreadsheet and tab, or set source=webhook and POST inviteeFirstName and eventName.', 'Set presenterName, brandName, rebookUrl, highlights and timeZone in Config. Optional delivery needs SMTP and sendEmail=true.'],
    groups: [['source','Load recorded no-shows','Sheet headers: FirstName, Email, EventName, OriginalTime, RebookUrl, Status, VideoUrl. FirstName and EventName are required. Leave Status empty; trigger webhook mode from your actual attendance record.','Source?|Webhook payload|Read no-shows sheet|Pick next no-show'],['eligible','Check for a pending reminder','Proceed only when a no-show is available. An empty queue ends without rendering or sending.','No-show found?|Nothing to send'],['email','Optionally send the rebooking video','Configure SMTP and enable sendEmail to deliver the link. Confirm the booking URL and recipient in a private test.','Video URL|Send email?|Send re-book email (SMTP)'],['return','Record or return the result','Update the matching sheet row or respond to the webhook caller. Allow the caller time for video rendering.','Sheet row?|Mark row sent|Respond ok']],
  },
  'month-in-review-stats': {
    match: 'Normalize metrics', title: 'Create a month-in-review stats video',
    how: 'Load one customer’s usage metrics, build a vertical recap with animated numbers and delta indicators, and render it with Zvid. A bundled sample works when metricsUrl is empty; email delivery is optional.',
    setup: ['Set brandName, colors and timings in Config. Start with the bundled example, then connect metricsUrl using the documented metrics contract.', 'If delivery is needed, configure the email node, SMTP credential, sender and sendEmail option before activation.'],
    groups: [['metrics','Load the customer’s metrics','An empty metricsUrl uses the demo dataset. Supply actual period, customer and metric values when connecting your own endpoint.','Has metrics endpoint?|Fetch metrics|Normalize metrics']],
  },
  'podcast-audiogram-clips': {
    match: 'Read podcast feed', title: 'Create captioned podcast audiograms',
    how: 'Read the newest podcast episode, fetch an audio sample, transcribe it, and choose highlight moments. Zvid renders a vertical audiogram for each selected clip with captions aligned to the transcript.',
    setup: ['Set feedUrl, showNameOverride, handle and clip limits in Config. The default sample is 4 MiB; maxAudioBytes must fit your Zvid plan. Use media you have permission to repurpose.', 'Connect ElevenLabs Header Auth (xi-api-key) with Speech to Text permission to Transcribe (Scribe), and OpenRouter to Pick moments.'],
    groups: [['episode','Read and check the newest episode','Download a bounded audio sample and check its actual size before paid transcription. Hosts that ignore Range stop here. Highlights are limited to the material transcribed.','Read podcast feed|Pick latest episode|Fetch episode audio|Check audio sample'],['transcript','Transcribe and store the audio','Read word timings from Scribe and upload the audio for rendering. The published Zvid node lacks multipart upload, so this step uses HTTP Request.','Transcribe (Scribe)|Read transcript|Upload episode audio'],['clips','Select the highlight moments','Choose clips from the transcript and retain their source timing. Review the selected passages for context.','Pick moments|Prepare clips']],
  },
  'video-to-shorts': {
    match: 'Video webhook', title: 'Turn a long video into vertical Shorts',
    how: 'Receive a direct video URL or use the sample, transcribe its opening, and select highlight moments. Zvid renders captioned vertical clips and returns their URLs to the webhook caller.',
    setup: ['POST videoUrl with optional title and layout (fit or fill). Use a directly downloadable MP4, not a video-platform page.', 'Connect ElevenLabs Header Auth (xi-api-key) with Speech to Text permission to Transcribe (Scribe), and OpenRouter to Pick highlights. Set handle and brandAccent in Config.'],
    groups: [['request','Accept a direct video URL','Test with Sample video or POST to the webhook. Choose fit to retain the frame or fill to crop for portrait output.','Sample video|Video request'],['transcript','Transcribe the source sample','Only the fetched sample is transcribed and available for highlight selection. Speech-to-text can incur charges before rendering.','Fetch video sample|Transcribe (Scribe)|Read transcript'],['clips','Choose timed highlights','Keep the selected clips within the transcript’s source timestamps. Review that each excerpt preserves the speaker’s meaning.','Pick highlights|Prepare clips'],['response','Return the clip links','The webhook response contains the completed clip URLs. Allow sufficient caller timeout for transcription and rendering.','Clips response|Respond with clips']],
  },
  'testimonial-compilation': {
    match: 'Prepare compilation', title: 'Compile featured customer testimonials',
    how: 'Read featured testimonials from Google Sheets or Airtable and render one square compilation. The design expands with the selected quotes. Sheet mode marks the included rows compiled; Airtable results are reported without write-back.',
    setup: ['Connect both Google Sheets nodes to the same spreadsheet and tab. Set brandName, minQuotes, maxQuotes and the call to action in Config.', 'For source=airtable, set the base and table and attach a Bearer Auth token with read access to Fetch Airtable records.'],
    groups: [['source','Choose featured testimonials','Headers: Quote, Author, Role, Company, Rating, Featured, Status, VideoUrl. Quote and Author are required. Set Featured=true and leave Status empty. Airtable uses matching field names.','Source?|Read testimonials sheet|Pick this month\'s|Fetch Airtable records|Pick Airtable records'],['eligible','Prepare the compilation','Continue only when minQuotes is met. Ratings and attribution come from the supplied records; verify them before publishing.','Enough testimonials?|Nothing to compile|Prepare compilation'],['record','Record the included rows','Sheet mode marks each included row compiled and saves the shared video URL. Airtable mode requires a separate write-back if desired.','Rows to mark|Sheet mode?|Mark rows compiled']],
  },
  'blog-content-kit': {
    match: 'Write kit copy', title: 'Create a video and image kit from a blog post',
    how: 'Read a new blog article, generate social copy, and render three coordinated assets: a square LinkedIn video, a landscape teaser and an Open Graph image. Completed files are returned for review and distribution.',
    setup: ['Set feedUrl, brandName, domainOverride and brand colors in Config.', 'Connect OpenRouter to Write kit copy. Confirm the article is publicly accessible and review generated claims against the source.'],
    groups: [['feed','Find an unused blog post','Read the RSS feed and skip posts already completed in production. Empty or inaccessible feeds need attention.','Read blog feed|Pick newest post|New post?|Nothing new today'],['copy','Write copy from the article','Fetch the article and prepare the prompt, with feed text as fallback. One model response supplies the three deliverables.','Fetch post page|Prepare kit prompt|Write kit copy|Parse kit copy']],
  },
  'event-countdown-videos': {
    match: 'Which renders today?', title: 'Create event announcements and countdowns',
    how: 'Read events and determine which announcement, seven-day reminder or final-call video is due. Zvid renders each vertical promo. Sheet columns or workflow memory record which assets have already been completed.',
    setup: ['Connect both Google Sheets nodes to the same spreadsheet and tab. Set branding and timezoneOffsetHours in Config.', 'For source=eventbrite, set eventbriteOrgId and attach a Bearer Auth token. This path reads the first 50 live events.'],
    groups: [['source','Read the event calendar','Headers: EventName, DateISO, Venue, City, TicketUrl, ImageUrl, Status, PromoUrl, Video7d, Video1d. EventName and DateISO are required; leave result columns empty. Select sheet or Eventbrite in Config.','Source?|Fetch Eventbrite events|Read events sheet'],['due','Choose today’s event assets','Use timezoneOffsetHours for the event calendar. todayOverride lets you test the reminder dates; clear it for scheduled runs.','Which renders today?|Anything due?|Nothing due today'],['record','Record completed event assets','Write each URL to its matching column in sheet mode. Eventbrite mode remembers completed assets in workflow static data.','Prepare write-back|Sheet mode?|Update event row']],
  },
  'real-estate-listing-video': {
    match: 'Normalize listing', title: 'Create property listing videos',
    how: 'Take a pending listing from Google Sheets or Airtable and render a vertical photo tour with property facts and an agent contact card. Sheet mode stores the video URL; Airtable mode remembers processed records.',
    setup: ['Connect both Google Sheets nodes to the same spreadsheet and tab. Set brandName, contactUrl and colors in Config.', 'For source=airtable, configure the base, table and optional view and attach a read-enabled Bearer Auth token. Use factual listing data and authorized photos.'],
    groups: [['source','Read the listing source','Headers: Address, City, Price, Beds, Baths, Sqft, Photo1, Photo2, Photo3, Photo4, Photo5, AgentName, AgentPhone, AgentPhotoUrl, Status, VideoUrl. Require Address and two photos; leave Status empty.','Source?|Read listings sheet|Pick next listing|Fetch Airtable listings|Pick Airtable listing'],['eligible','Prepare the property facts','Use only the supplied photos and facts. Airtable mode does not write the video URL back; sheet mode does.','Listing found?|Nothing to render today|Normalize listing']],
  },
  'were-hiring-video': {
    match: 'Read job openings', title: 'Create videos for job openings',
    how: 'Read job openings without a video URL and process them one at a time. Zvid renders a vertical hiring video with the role, perks and application link, then writes the result to the matching row.',
    setup: ['Connect Read job openings and Write VideoUrl to sheet to the same spreadsheet and tab.', 'Set company details, logo, hero footage, branding and maxPerRun in Company Config. Use accurate role, salary and application information.'],
    groups: [['queue','Prepare the hiring queue','Headers: Role, Team, Location, SalaryRange, Perk1, Perk2, Perk3, ApplyUrl, VideoUrl. Require Role and ApplyUrl; leave VideoUrl empty. maxPerRun caps each run. Completed openings produce a no-work report; clear their VideoUrl only when intentionally rerendering.','Read job openings|Rows to render|Jobs need videos?|No pending job openings|One row at a time'],['record','Save each completed hiring video','Write the video URL to its source row and return a row report before the next opening is processed.','Write VideoUrl to sheet|Rendered row report']],
  },
  'restaurant-weekly-specials': {
    match: 'Read menu sheet', title: 'Create a weekly restaurant specials video',
    how: 'Read the menu rows marked for this week and render a vertical reel with a photo, description and price for each dish. A branded booking call to action closes the video for your review.',
    setup: ['Connect Google Sheets to Read menu sheet and select your spreadsheet and tab.', 'Set the restaurant name, handle, address, branding and timings in Config. Replace fallback media with your own dish photos where possible.'],
    groups: [['menu','Choose this week’s menu','Headers: Dish, Description, Price, PhotoUrl, ThisWeek. Mark ThisWeek=true; the first five marked rows are used. Bundled image URLs fit within 1920×1920 without distortion. Supply appropriately sized custom photos and review fallback photos before publishing.','Read menu sheet|Pick weekly dishes']],
  },
  'workout-of-the-day': {
    match: 'Read workout sheet', title: 'Create the workout-of-the-day video',
    how: 'Read today’s training row and render a vertical workout video with a footage hook, exercise board and coach note. The completed MP4 is ready to review and share with your members.',
    setup: ['Connect Google Sheets to Read workout sheet and choose your spreadsheet and tab.', 'Set gymName, handle, accent, heroVideo and timezone in Config. fallbackToLatest optionally uses the latest past row when today is missing.'],
    groups: [['workout','Read today’s training plan','Headers: Date, WorkoutName, Focus, Ex1, Ex2, Ex3, Ex4, Ex5, CoachNote. Use YYYY-MM-DD dates and supply Ex1. Format exercises as “Exercise x Reps”; the last separator is used.','Read workout sheet|Pick today\'s row']],
  },
  'quiz-shorts': {
    match: 'Get quiz rows', title: 'Create daily quiz Shorts',
    how: 'Take the next unused question from Google Sheets and render a vertical quiz with three options, a countdown and the correct answer. After rendering, save the URL and mark the row done.',
    setup: ['Connect Get quiz rows and Mark row done to the same spreadsheet and tab.', 'Set brand name, handle, colors and timings in Config. Verify the answer and fun fact before activating the schedule.'],
    groups: [['quiz','Prepare the next quiz question','Headers: Question, OptionA, OptionB, OptionC, CorrectLetter, FunFact, Status, VideoUrl. CorrectLetter must be A, B or C. Leave Status and VideoUrl empty.','Get quiz rows|Pick next question']],
  },
  'kpi-report-video': {
    match: 'Write narration', title: 'Create a weekly KPI report video',
    how: 'Load up to five metrics and render a landscape report with values, changes and optional history charts. Narration and Slack delivery are configurable. An empty metricsUrl uses a bundled demonstration dataset.',
    setup: ['Set company branding and metricsUrl in Config. Use actual history values when charts are needed.', 'For narrate=true, connect OpenRouter to Write narration and ElevenLabs Header Auth (xi-api-key) to Generate voiceover. Set slackWebhookUrl only for the intended Slack destination.'],
    groups: [['metrics','Load the report metrics','Supply period, company and metrics. Each metric supports label, value, unit, delta, lowerIsBetter and optional history. Missing history produces no invented chart.','Metrics source?|Fetch metrics|Prepare metrics'],['narration','Choose optional narration','Set narrate=false for a music-only report. When enabled, model and voice generation can incur charges even with dryRun=true.','Narrate?|Write narration|Parse narration']],
  },
  'daily-weather-video': {
    match: 'Find city', title: 'Create a local weather video',
    how: 'Find your city, retrieve its forecast from Open-Meteo, and render a vertical bulletin with a weather-dependent design. The finished MP4 can be reviewed in n8n before you share it.',
    setup: ['Set cityName, brandName, handle and locale in Config. Check that the geocoded city is the intended location.', 'The weather requests need no credential in this template. Zvid rendering still needs its API credential; check the workflow timezone before scheduling.'],
    groups: [['city','Resolve the intended city','Check the geocoding result before using the forecast. A city name can match more than one location.','Find city|Check city'],['forecast','Build the forecast design','Fetch the forecast and select the visual treatment from its weather code. Review the forecast date and units before sharing.','Get forecast|Weather look']],
  },
  'sports-recap-video': {
    match: 'Write recap', title: 'Create a weekly sports recap',
    how: 'Fetch recent final scores from TheSportsDB and generate short on-screen commentary. Zvid renders a vertical scoreboard recap with music. Match data supplies the score; generated text should be reviewed before publishing.',
    setup: ['Connect OpenRouter to Write recap. Set leagueId, brandName, handle and ctaText in Config.', 'Check the configured data endpoint and league before scheduling. The finished video is returned for review; social publishing is a separate step.'],
    groups: [['results','Read the final match results','Select the intended league in Config. Use the returned final scores as the source of truth for every scoreboard.','Fetch results|Prepare results']],
  },
  'birthday-greetings': {
    match: 'Read contacts', title: 'Create birthday and anniversary greetings',
    how: 'Read contacts whose celebration falls today, render a personal vertical greeting for each, and optionally email the result. LastSentYear records completed greetings so the same contact is skipped for that year.',
    setup: ['Connect Read contacts and Mark as sent to the same spreadsheet and tab. Set the workflow timezone for date matching.', 'Set brandName, colors and default messages in Config. Optional email needs sendEmail=true, SMTP and an approved sender.'],
    groups: [['contacts','Find today’s celebrations','Headers: Name, Type, Date, Years, Email, LastSentYear, Message. Use birthday or anniversary and YYYY-MM-DD dates. Leave LastSentYear empty; Years is optional for birthdays.','Read contacts|Find today\'s celebrations'],['deliver','Prepare and send optional greetings','Email is optional and uses the configured SMTP credential. The contact’s own message can replace the default greeting.','Prepare delivery|Send email?|Send greeting email|Mark as sent']],
  },
  'chat-video-agent': {
    match: 'Zvid AI Agent', title: 'Create videos through a Telegram chat',
    how: 'An AI agent finds a Zvid design, adapts an editable draft and returns a credit quote. Approve the quote to render; the native Zvid node waits for the accepted job. Watch opens that completed result. Chat reply explains why an unfinished run cannot be watched.',
    setup: ['Install **`@zvid/n8n-nodes-zvid`** from **Settings → Community nodes** before credentials. A workspace owner/admin may need to install it.', 'Attach a Zvid API credential (https://app.zvid.io/api-keys; Base URL https://api.zvid.io) to both Zvid nodes. Keep manualPreviewJobId empty for new videos; it is only for explicitly requested replays.', 'Connect OpenRouter to Chat model (OpenRouter). Attach Header Auth with header x-api-key and your Zvid key to Zvid MCP tools at https://mcp.zvid.io/mcp.', 'Set maxRenderCredits and retain the media allow-list. New renders spend credits after approval. Test brief needs no Telegram. For Telegram, connect its credentials, fill allowedChatIds and activate with a public webhook.'],
    groups: [['brief','Prepare and screen the brief','Test brief needs no Telegram connection. Live requests must pass allowedChatIds and include a usable brief.','Test brief|Prepare chat input|Screen request|Brief ready?'],['saved-preview','Preview an existing completed video','Manual tests with Config.manualPreviewJobId read that job through the Zvid node, bypassing AI, draft creation and paid rendering. Clear the field for new creative briefs. Telegram always follows the conversational path.','Preview a saved render?|Read saved render for preview|Explain the saved render preview'],['agent','Plan, quote and render with MCP','AI-agent exception: use the built-in MCP Client Tool for Zvid’s conversational tools. Approval is an agent instruction; maxRenderCredits supplies a server-enforced per-render ceiling. Model usage can still incur charges.','Zvid AI Agent|Chat model (OpenRouter)|Chat memory|Zvid MCP tools'],['wait-chat','Wait for the requested new video','Read the actual agent tool result. An accepted job waits through the native Zvid node, without another submission. Quotes and drafts skip waiting. Only a completed permitted MP4 reaches Watch video.','Read the agent render handoff|Wait for an accepted video render?|Wait for the newly accepted chat video|Attach the actual chat video result'],['telegram','Reply in the allowed chat','Return the quote or completed result. Only finished-video URLs matching the allow-list are sent as Telegram video.','Chat reply|Reply in Telegram?|Send reply|Video ready?|Send video']],
  },
  'shopify-catalog-videos': {
    match: 'Get Shopify catalog', title: 'Create and publish Shopify product videos',
    how: 'Select eligible Shopify products, render branded vertical videos in a batch, and return them for review. When publishing is enabled, stage the files in Shopify, attach them to matching products and tag accepted results.',
    setup: ['Set the canonical shopDomain, branding and maxProducts in Config. Keep publishToShopify=false while reviewing videos.', 'Create Header Auth named X-Shopify-Access-Token with an installed Shopify Admin token and assign it to the Shopify requests. The app needs read_products, write_products and write_files; refresh expiring tokens before scheduled runs.'],
    groups: [['catalog','Load eligible Shopify products','Require an active product with a title, public photo and priced variant. Skip already processed products and usable existing videos.','Get Shopify catalog|Rows needing videos|Products found?|Nothing to render'],['review','Review or begin publishing','publishToShopify=false returns videos for review. Enabling it changes product media in Shopify.','Collect video links|Publish automatically?|Rendered for review'],['headers','Check each video before upload','Read each completed file’s size and create a Shopify staged-upload target. Shopify media transfer requires HTTP Request nodes.','Get Zvid video headers|Check Zvid video headers|Create Shopify upload targets|Check Shopify upload targets'],['stage','Transfer videos to Shopify','Download each MP4, upload it to the staged target, and check that the transfer succeeded before attaching it.','Download videos for Shopify|Upload videos to Shopify staging|Check Shopify staged uploads'],['publish','Attach and tag accepted products','Associate staged videos with their matching product IDs. Tag accepted products only; Shopify processes the media asynchronously, so confirm READY in Shopify Admin.','Attach video to Shopify product|Check Shopify publish requests|Mark product processed']],
  },
  'shopify-abandoned-checkout-recovery': {
    match: 'Pick and lock one checkout', title: 'Recover abandoned Shopify checkouts',
    how: 'Find one eligible checkout, wait, and recheck conversion and inventory before rendering a personalized video. Optional recovery emails include its link. A later recheck prevents follow-up after conversion or other disqualifying changes.',
    setup: ['Set shopDomain and branding in Config. manualFixture=true uses sample data and short waits; switch it off for live Shopify.', 'Attach X-Shopify-Access-Token Header Auth to all three Shopify requests. Required scopes are read_orders, read_customers and read_products, with protected checkout access. Refresh expiring tokens.', 'SMTP is optional: connect both email nodes and configure emailFrom before setting sendEmail=true.'],
    groups: [['checkout','Find and lock one checkout','The fixture avoids Shopify; live mode reads abandoned checkouts. One in-flight lock prevents concurrent recovery of the same checkout.','Use manual fixture?|Create safe test checkout|Find open abandoned checkouts|Pick and lock one checkout|Checkout found?|Nothing to recover'],['recheck','Wait and recheck eligibility','Check conversion, inventory, newer abandonment and prior Shopify email before rendering. Ineligible checkouts stop here.','Wait before recovery check|Use fixture confirmation?|Approve checkout test fixture|Confirm no purchase and inventory|Check conversion and inventory|Still eligible after the wait?|Stop recovered or unavailable checkout'],['initial','Deliver the initial recovery message','Email, phone and the recovery URL stay out of the video payload. Enable SMTP delivery only after a private test.','Prepare private recovery delivery|Send initial recovery email?|Send initial recovery email|Record initial delivery result'],['followup','Recheck before any follow-up','After the optional delay, check Shopify again. The fixture can simulate conversion to demonstrate that follow-up stops.','Wait for a follow-up check?|Wait before follow-up|Use fixture follow-up?|Simulate conversion before follow-up|Confirm before follow-up|Check follow-up conversion'],['stop','Stop after conversion or deliver once','Skip the follow-up when the checkout is no longer eligible. Record handling after the optional final email.','Still abandoned at follow-up?|Stop follow-up after conversion|Send follow-up email?|Send follow-up recovery email|Remember checkout handled']],
  },
};

module.exports = { specs };
