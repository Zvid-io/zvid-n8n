import type { INodeType, INodeTypeDescription } from 'n8n-workflow';

import {
	addRenderListQuery,
	buildBulkRenderBody,
	buildCreativePlanBody,
	buildPreviewBody,
	buildRepairBody,
	buildRenderBody,
	buildTemplateCreateBody,
	buildTemplateUpdateBody,
	normalizeValidationResponse,
	waitForRenderCompletion,
} from './GenericFunctions';

export class Zvid implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Zvid',
		name: 'zvid',
		icon: 'file:zvid.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Render videos and images from JSON or templates with the Zvid API',
		defaults: {
			name: 'Zvid',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'zvidApi',
				required: true,
			},
		],
		requestDefaults: {
			baseURL: '={{$credentials.baseUrl.replace(new RegExp("/+$"), "")}}',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
			},
		},
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Authoring',
						value: 'authoring',
					},
					{
						name: 'Creative Library',
						value: 'creativeLibrary',
					},
					{
						name: 'Credit',
						value: 'credit',
					},
					{
						name: 'Render',
						value: 'render',
					},
					{
						name: 'Stock Media',
						value: 'stockMedia',
					},
					{
						name: 'Template',
						value: 'template',
					},
				],
				default: 'render',
			},

			// ----------------------------------
			//         authoring operations
			// ----------------------------------
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['authoring'],
					},
				},
				options: [
					{
						name: 'Plan Creative Video',
						value: 'planCreativeVideo',
						action: 'Plan a professional creative video',
						description:
							'Create a plan-aware storyboard, creative direction, library searches, and anti-repetition strategy before authoring project JSON',
						routing: {
							request: {
								method: 'POST',
								url: '/api/render/creative-plan/api-key',
							},
							send: { preSend: [buildCreativePlanBody] },
						},
					},
					{
						name: 'Get Project Schema',
						value: 'getSchema',
						action: 'Get the project JSON schema',
						description:
							'Get the plan-aware JSON Schema, validation notes, professional authoring guidelines, and required workflow before composing a project',
						routing: {
							request: {
								method: 'GET',
								url: '/api/render/schema/api-key',
								qs: {
									target: '={{$parameter.schemaTarget}}',
								},
							},
						},
					},
					{
						name: 'List Supported Elements',
						value: 'listElements',
						action: 'List supported project elements',
						description:
							'List visual, audio, subtitle, and scene elements with required fields and professional layout guidance',
						routing: {
							request: {
								method: 'GET',
								url: '/api/render/elements/api-key',
							},
						},
					},
					{
						name: 'Get Element Documentation',
						value: 'getElementDocs',
						action: 'Get element documentation',
						description:
							'Get every field, constraint, gotcha, and a valid example for one project element type',
						routing: {
							request: {
								method: 'GET',
								url: '=/api/render/elements/{{$parameter.elementType}}/api-key',
							},
						},
					},
					{
						name: 'Get Example Project',
						value: 'getExample',
						action: 'Get a validated example project',
						description:
							'Get a validated, layout-clean starting point that demonstrates professional Zvid composition patterns',
						routing: {
							request: {
								method: 'GET',
								url: '={{$parameter.exampleName === "all" ? "/api/render/examples/api-key" : "/api/render/examples/" + $parameter.exampleName + "/api-key"}}',
							},
						},
					},
					{
						name: 'Repair Project JSON',
						value: 'repair',
						action: 'Repair project JSON',
						description:
							'Conservatively fix mechanical JSON mistakes and return every change, remaining error, and professional layout warning',
						routing: {
							request: {
								method: 'POST',
								url: '/api/render/repair/api-key',
							},
							send: {
								preSend: [buildRepairBody],
							},
						},
					},
				],
				default: 'getSchema',
			},

			// ----------------------------------
			//         creative library operations
			// ----------------------------------
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['creativeLibrary'] } },
				options: [
					{
						name: 'Search',
						value: 'search',
						action: 'Search the creative library',
						description:
							'Search complete project examples, animated design templates, canvas presets, or shapes and inspect their preview metadata',
						routing: {
							request: {
								method: 'GET',
								url: '=/api/library/{{$parameter.libraryKind}}',
								qs: {
									q: '={{$parameter.libraryQuery}}',
									limit: '={{$parameter.libraryLimit}}',
									offset: '={{$parameter.libraryOffset}}',
								},
							},
						},
					},
					{
						name: 'Get Metadata',
						value: 'getMetadata',
						action: 'Get creative asset metadata',
						description:
							'Get title, description, preview, thumbnail, content URL, and other metadata',
						routing: {
							request: {
								method: 'GET',
								url: '=/api/library/{{$parameter.libraryKind}}/{{$parameter.librarySlug}}',
							},
						},
					},
					{
						name: 'Get Content',
						value: 'getContent',
						action: 'Get creative asset content',
						description:
							'Get the full JSON content: complete project JSON for examples or a reusable design/canvas/shape module for other kinds',
						routing: {
							request: {
								method: 'GET',
								url: '=/api/library/{{$parameter.libraryKind}}/{{$parameter.librarySlug}}/content',
							},
						},
					},
				],
				default: 'search',
			},

			// ----------------------------------
			//         stock media operations
			// ----------------------------------
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['stockMedia'] } },
				options: [
					{
						name: 'List Providers',
						value: 'listProviders',
						action: 'List stock media providers',
						description: 'List configured providers for images, videos, GIFs, and audio',
						routing: { request: { method: 'GET', url: '/api/stock/providers' } },
					},
					{
						name: 'Search',
						value: 'search',
						action: 'Search stock media',
						description:
							'Search normalized stock image, video, GIF, or music results with preview and full-quality render URLs',
						routing: {
							request: {
								method: 'GET',
								url: '/api/stock/search',
								qs: {
									type: '={{$parameter.stockType}}',
									provider: '={{$parameter.stockProvider}}',
									query: '={{$parameter.stockQuery}}',
									page: '={{$parameter.stockPage}}',
									perPage: '={{$parameter.stockPerPage}}',
								},
							},
						},
					},
				],
				default: 'search',
			},

			// ----------------------------------
			//         render operations
			// ----------------------------------
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['render'],
					},
				},
				options: [
					{
						name: 'Create',
						value: 'create',
						action: 'Create a render',
						description: 'Queue a video or image render from a project JSON or a template',
						routing: {
							request: {
								method: 'POST',
								url: '={{$parameter.renderType === "image" ? "/api/render/image/api-key" : "/api/render/api-key"}}',
							},
							send: {
								preSend: [buildRenderBody],
							},
							output: {
								postReceive: [waitForRenderCompletion],
							},
						},
					},
					{
						name: 'Create Bulk',
						value: 'createBulk',
						action: 'Create a bulk render',
						description: 'Queue many renders from one template/payload and per-item variables',
						routing: {
							request: {
								method: 'POST',
								url: '={{$parameter.renderType === "image" ? "/api/render/image/bulk/api-key" : "/api/render/bulk/api-key"}}',
							},
							send: {
								preSend: [buildBulkRenderBody],
							},
						},
					},
					{
						name: 'Get',
						value: 'get',
						action: 'Get a render',
						description:
							'Get a render job status and output URL, optionally waiting for completion',
						routing: {
							request: {
								method: 'GET',
								url: '=/api/jobs/{{$parameter.jobId}}',
							},
							output: {
								postReceive: [waitForRenderCompletion],
							},
						},
					},
					{
						name: 'Validate',
						value: 'validate',
						action: 'Validate a render payload',
						description:
							'Run the real backend validation (template resolution + your plan limits) without rendering or spending credits — returns valid or field-level errors',
						routing: {
							request: {
								method: 'POST',
								url: '/api/render/validate/api-key',
								ignoreHttpStatusErrors: true,
							},
							send: {
								preSend: [buildRenderBody],
							},
							output: {
								postReceive: [normalizeValidationResponse],
							},
						},
					},
					{
						name: 'Get Many',
						value: 'getAll',
						action: 'Get many renders',
						description: 'List render jobs on the account',
						routing: {
							request: {
								method: 'GET',
								url: '/api/jobs',
							},
							send: {
								preSend: [addRenderListQuery],
							},
							output: {
								postReceive: [
									{
										type: 'rootProperty',
										properties: {
											property: 'jobs',
										},
									},
								],
							},
						},
					},
				],
				default: 'create',
			},

			// ----------------------------------
			//         template operations
			// ----------------------------------
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['template'],
					},
				},
				options: [
					{
						name: 'Create',
						value: 'create',
						action: 'Create a template',
						description:
							'Create and validate a reusable video or image template from AI-authored project JSON',
						routing: {
							request: { method: 'POST', url: '/api/templates' },
							send: { preSend: [buildTemplateCreateBody] },
						},
					},
					{
						name: 'Get',
						value: 'get',
						action: 'Get a template',
						description: 'Get a template including its project JSON and variables',
						routing: {
							request: {
								method: 'GET',
								url: '=/api/templates/{{$parameter.templateId}}',
							},
						},
					},
					{
						name: 'Get Many',
						value: 'getAll',
						action: 'Get many templates',
						description: 'List templates on the account',
						routing: {
							request: {
								method: 'GET',
								url: '/api/templates',
								qs: {
									limit: '={{$parameter.limit}}',
								},
							},
							output: {
								postReceive: [
									{
										type: 'rootProperty',
										properties: {
											property: 'templates',
										},
									},
								],
							},
						},
					},
					{
						name: 'Update',
						value: 'update',
						action: 'Update a template',
						description:
							'Update the name, description, and/or validated project JSON of an owned active template',
						routing: {
							request: {
								method: 'PUT',
								url: '=/api/templates/{{$parameter.templateId}}',
							},
							send: { preSend: [buildTemplateUpdateBody] },
						},
					},
					{
						name: 'Delete (Archive)',
						value: 'delete',
						action: 'Archive a template',
						description:
							'Archive an owned active template so it can no longer be rendered or updated',
						routing: {
							request: {
								method: 'DELETE',
								url: '=/api/templates/{{$parameter.templateId}}',
							},
						},
					},
					{
						name: 'Duplicate',
						value: 'duplicate',
						action: 'Duplicate a template',
						description:
							'Create an active editable copy of an owned template, including an archived template',
						routing: {
							request: {
								method: 'POST',
								url: '=/api/templates/{{$parameter.templateId}}/duplicate',
							},
						},
					},
					{
						name: 'Preview',
						value: 'preview',
						action: 'Preview a template',
						description: 'Dry-run variable resolution and validation without rendering',
						routing: {
							request: {
								method: 'POST',
								url: '=/api/templates/{{$parameter.templateId}}/preview',
							},
							send: {
								preSend: [buildPreviewBody],
							},
						},
					},
					{
						name: 'Render',
						value: 'render',
						action: 'Render from a template',
						description: 'Queue a render from a template with variable values',
						routing: {
							request: {
								method: 'POST',
								url: '={{$parameter.renderType === "image" ? "/api/render/image/api-key" : "/api/render/api-key"}}',
							},
							send: {
								preSend: [buildRenderBody],
							},
							output: {
								postReceive: [waitForRenderCompletion],
							},
						},
					},
				],
				default: 'render',
			},

			// ----------------------------------
			//         credit operations
			// ----------------------------------
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['credit'],
					},
				},
				options: [
					{
						name: 'Get Balance',
						value: 'getBalance',
						action: 'Get the credit balance',
						description: 'Get the account credit balance',
						routing: {
							request: {
								method: 'GET',
								url: '/api/credits/balance',
							},
						},
					},
				],
				default: 'getBalance',
			},

			// ----------------------------------
			//         render: create fields
			// ----------------------------------
			{
				displayName: 'Creative Brief',
				name: 'creativeBrief',
				type: 'string',
				typeOptions: { rows: 4 },
				default: '',
				required: true,
				description: 'What the video should communicate, for whom, and the desired outcome',
				displayOptions: { show: { resource: ['authoring'], operation: ['planCreativeVideo'] } },
			},
			{
				displayName: 'Variation Mode',
				name: 'variationMode',
				type: 'options',
				options: [
					{
						name: 'Fresh',
						value: 'fresh',
						description: 'Create a new direction and avoid recent assets',
					},
					{
						name: 'Consistent',
						value: 'consistent',
						description: 'Use a stable seed for repeatable automation output',
					},
					{
						name: 'Explore',
						value: 'explore',
						description: 'Return several materially different directions',
					},
				],
				default: 'fresh',
				displayOptions: { show: { resource: ['authoring'], operation: ['planCreativeVideo'] } },
			},
			{
				displayName: 'Variation Seed',
				name: 'variationSeed',
				type: 'string',
				default: '',
				description: 'Optional reproducible seed; reuse it for the same composition',
				displayOptions: { show: { resource: ['authoring'], operation: ['planCreativeVideo'] } },
			},
			{
				displayName: 'Explore Count',
				name: 'exploreCount',
				type: 'number',
				typeOptions: { minValue: 2, maxValue: 5 },
				default: 3,
				displayOptions: {
					show: {
						resource: ['authoring'],
						operation: ['planCreativeVideo'],
						variationMode: ['explore'],
					},
				},
			},
			{
				displayName: 'Aspect Ratio',
				name: 'creativeAspectRatio',
				type: 'options',
				options: ['16:9', '9:16', '1:1', '4:5', 'custom'].map((value) => ({ name: value, value })),
				default: '16:9',
				displayOptions: { show: { resource: ['authoring'], operation: ['planCreativeVideo'] } },
			},
			{
				displayName: 'Duration (Seconds)',
				name: 'creativeDuration',
				type: 'number',
				typeOptions: { minValue: 0.1 },
				default: 15,
				displayOptions: { show: { resource: ['authoring'], operation: ['planCreativeVideo'] } },
			},
			{
				displayName: 'Style',
				name: 'creativeStyle',
				type: 'options',
				options: [
					{ name: 'Adaptive Modern', value: 'adaptive-modern' },
					{ name: 'Auto', value: 'auto' },
					{ name: 'Bold Commerce', value: 'bold-commerce' },
					{ name: 'Editorial Data', value: 'editorial-data' },
					{ name: 'Luxury Minimal', value: 'luxury-minimal' },
					{ name: 'Modern SaaS', value: 'modern-saas' },
					{ name: 'Social Kinetic', value: 'social-kinetic' },
				],
				default: 'auto',
				displayOptions: { show: { resource: ['authoring'], operation: ['planCreativeVideo'] } },
			},
			{
				displayName: 'Motion Intensity',
				name: 'motionIntensity',
				type: 'options',
				options: [
					{ name: 'Auto From Style', value: 'auto' },
					{ name: 'Restrained', value: 'restrained' },
					{ name: 'Balanced', value: 'balanced' },
					{ name: 'Energetic', value: 'energetic' },
				],
				default: 'auto',
				displayOptions: { show: { resource: ['authoring'], operation: ['planCreativeVideo'] } },
			},
			{
				displayName: 'Preferred Media',
				name: 'preferredMedia',
				type: 'options',
				options: [
					{ name: 'Mixed', value: 'mixed' },
					{ name: 'Video', value: 'video' },
					{ name: 'Image', value: 'image' },
				],
				default: 'mixed',
				displayOptions: { show: { resource: ['authoring'], operation: ['planCreativeVideo'] } },
			},
			{
				displayName: 'Recent Asset Slugs',
				name: 'recentAssetSlugs',
				type: 'json',
				default: '[]',
				description:
					'JSON array of recently used creative-library slugs to avoid in fresh or explore mode',
				displayOptions: { show: { resource: ['authoring'], operation: ['planCreativeVideo'] } },
			},
			{
				displayName: 'Brand Kit',
				name: 'brandKit',
				type: 'json',
				default: '{}',
				description: 'Optional JSON with name, colors, headlineFont, bodyFont, and logoUrl',
				displayOptions: { show: { resource: ['authoring'], operation: ['planCreativeVideo'] } },
			},

			// creative library fields
			{
				displayName: 'Library Kind',
				name: 'libraryKind',
				type: 'options',
				options: [
					{ name: 'Complete Examples', value: 'examples' },
					{ name: 'Design Templates', value: 'design-templates' },
					{ name: 'Canvas Presets', value: 'canvas-presets' },
					{ name: 'Shapes', value: 'shapes' },
				],
				default: 'examples',
				displayOptions: { show: { resource: ['creativeLibrary'] } },
			},
			{
				displayName: 'Search Query',
				name: 'libraryQuery',
				type: 'string',
				default: '',
				displayOptions: { show: { resource: ['creativeLibrary'], operation: ['search'] } },
			},
			{
				displayName: 'Limit',
				name: 'libraryLimit',
				type: 'number',
				typeOptions: { minValue: 1, maxValue: 60 },
				default: 12,
				displayOptions: { show: { resource: ['creativeLibrary'], operation: ['search'] } },
			},
			{
				displayName: 'Offset',
				name: 'libraryOffset',
				type: 'number',
				typeOptions: { minValue: 0 },
				default: 0,
				displayOptions: { show: { resource: ['creativeLibrary'], operation: ['search'] } },
			},
			{
				displayName: 'Slug',
				name: 'librarySlug',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: { resource: ['creativeLibrary'], operation: ['getMetadata', 'getContent'] },
				},
			},

			// stock media fields
			{
				displayName: 'Media Type',
				name: 'stockType',
				type: 'options',
				options: ['image', 'video', 'gif', 'audio'].map((value) => ({ name: value, value })),
				default: 'image',
				displayOptions: { show: { resource: ['stockMedia'], operation: ['search'] } },
			},
			{
				displayName: 'Provider',
				name: 'stockProvider',
				type: 'options',
				options: ['all', 'pexels', 'pixabay', 'unsplash', 'giphy', 'jamendo'].map((value) => ({
					name: value,
					value,
				})),
				default: 'all',
				displayOptions: { show: { resource: ['stockMedia'], operation: ['search'] } },
			},
			{
				displayName: 'Search Query',
				name: 'stockQuery',
				type: 'string',
				default: '',
				displayOptions: { show: { resource: ['stockMedia'], operation: ['search'] } },
			},
			{
				displayName: 'Page',
				name: 'stockPage',
				type: 'number',
				typeOptions: { minValue: 1, maxValue: 500 },
				default: 1,
				displayOptions: { show: { resource: ['stockMedia'], operation: ['search'] } },
			},
			{
				displayName: 'Results Per Page',
				name: 'stockPerPage',
				type: 'number',
				typeOptions: { minValue: 1, maxValue: 60 },
				default: 12,
				displayOptions: { show: { resource: ['stockMedia'], operation: ['search'] } },
			},

			{
				displayName: 'Schema Target',
				name: 'schemaTarget',
				type: 'options',
				options: [
					{ name: 'Project Payload', value: 'project' },
					{ name: 'Full Render Request', value: 'render-request' },
				],
				default: 'project',
				description:
					'Whether the LLM needs the project payload shape or the complete API request envelope',
				displayOptions: {
					show: { resource: ['authoring'], operation: ['getSchema'] },
				},
			},
			{
				displayName: 'Element Type',
				name: 'elementType',
				type: 'options',
				options: ['IMAGE', 'VIDEO', 'GIF', 'SVG', 'TEXT', 'AUDIO', 'SUBTITLE', 'SCENE'].map(
					(value) => ({ name: value, value }),
				),
				default: 'TEXT',
				displayOptions: {
					show: { resource: ['authoring'], operation: ['getElementDocs'] },
				},
			},
			{
				displayName: 'Example',
				name: 'exampleName',
				type: 'options',
				options: [
					{ name: 'All Examples', value: 'all' },
					{ name: 'Promo Video', value: 'promo-video' },
					{ name: 'Still Image', value: 'still-image' },
					{ name: 'Subtitles', value: 'subtitles' },
					{ name: 'Template Render', value: 'template-render' },
					{ name: 'Webhook Flow', value: 'webhook-flow' },
				],
				default: 'promo-video',
				displayOptions: {
					show: { resource: ['authoring'], operation: ['getExample'] },
				},
			},
			{
				displayName: 'Project JSON',
				name: 'projectJson',
				type: 'json',
				default: '{}',
				required: true,
				description:
					'Project JSON to repair. For AI Agent use, let the model supply the generated project object.',
				displayOptions: {
					show: { resource: ['authoring'], operation: ['repair'] },
				},
			},
			{
				displayName: 'Render Type',
				name: 'renderType',
				type: 'options',
				options: [
					{
						name: 'Image',
						value: 'image',
					},
					{
						name: 'Video',
						value: 'video',
					},
				],
				default: 'video',
				description: 'Whether the project renders a video or a still image',
				displayOptions: {
					show: {
						resource: ['render'],
						operation: ['create', 'createBulk'],
					},
				},
			},
			{
				displayName: 'Render Type',
				name: 'renderType',
				type: 'options',
				options: [
					{
						name: 'Image',
						value: 'image',
					},
					{
						name: 'Video',
						value: 'video',
					},
				],
				default: 'video',
				description: 'Whether the template renders a video or a still image',
				displayOptions: {
					show: {
						resource: ['template'],
						operation: ['render'],
					},
				},
			},
			{
				displayName: 'Source',
				name: 'source',
				type: 'options',
				options: [
					{
						name: 'Project JSON',
						value: 'json',
						description: 'Provide the full project spec inline',
					},
					{
						name: 'Template',
						value: 'template',
						description: 'Reference a saved template by ID, with variables',
					},
				],
				default: 'template',
				displayOptions: {
					show: {
						resource: ['render'],
						operation: ['create', 'createBulk', 'validate'],
					},
				},
			},
			{
				displayName: 'Project JSON',
				name: 'projectJson',
				type: 'json',
				default: '{}',
				required: true,
				description:
					'Full Zvid project spec (scenes, elements, output settings). Use the Validate operation (or the @zvid/mcp get_project_schema tool) to check AI-generated or expression-built JSON before rendering — the backend validation is the source of truth.',
				displayOptions: {
					show: {
						resource: ['render'],
						operation: ['create', 'createBulk', 'validate'],
						source: ['json'],
					},
				},
			},
			{
				displayName: 'Template ID',
				name: 'templateId',
				type: 'string',
				default: '',
				required: true,
				placeholder: 'tpl_XXXXXXXXXXXXXXXXXXXX',
				displayOptions: {
					show: {
						resource: ['render'],
						operation: ['create', 'createBulk', 'validate'],
						source: ['template'],
					},
				},
			},
			{
				displayName: 'Template ID',
				name: 'templateId',
				type: 'string',
				default: '',
				required: true,
				placeholder: 'tpl_XXXXXXXXXXXXXXXXXXXX',
				displayOptions: {
					show: {
						resource: ['template'],
						operation: ['get', 'update', 'delete', 'duplicate', 'preview', 'render'],
					},
				},
			},
			{
				displayName: 'Template Name',
				name: 'templateName',
				type: 'string',
				default: '',
				required: true,
				description: 'Human-readable name for the reusable template',
				displayOptions: {
					show: { resource: ['template'], operation: ['create'] },
				},
			},
			{
				displayName: 'Description',
				name: 'templateDescription',
				type: 'string',
				default: '',
				description: 'Optional description of the template purpose and expected variables',
				displayOptions: {
					show: { resource: ['template'], operation: ['create'] },
				},
			},
			{
				displayName: 'Template Project JSON',
				name: 'templateProjectJson',
				type: 'json',
				default: '{}',
				required: true,
				description:
					'Complete project JSON. Read the schema first; placeholders need safe defaults and video-template scenes need explicit durations.',
				displayOptions: {
					show: { resource: ['template'], operation: ['create'] },
				},
			},
			{
				displayName: 'Template Changes',
				name: 'templateChanges',
				type: 'json',
				default: '{}',
				required: true,
				description:
					'JSON object containing at least one of name, description, or payload (the complete replacement project JSON)',
				displayOptions: {
					show: { resource: ['template'], operation: ['update'] },
				},
			},
			{
				displayName: 'Variables',
				name: 'variables',
				type: 'json',
				default: '{}',
				description: 'Template variable values as a JSON object, keyed by variable name',
				displayOptions: {
					show: {
						resource: ['render'],
						operation: ['create', 'validate'],
						source: ['template'],
					},
				},
			},
			{
				displayName: 'Variables',
				name: 'variables',
				type: 'json',
				default: '{}',
				description: 'Template variable values as a JSON object, keyed by variable name',
				displayOptions: {
					show: {
						resource: ['template'],
						operation: ['preview', 'render'],
					},
				},
			},
			{
				displayName: 'Base Variables',
				name: 'variables',
				type: 'json',
				default: '{}',
				description: 'Variables applied to every item (each item&apos;s variables merge on top)',
				displayOptions: {
					show: {
						resource: ['render'],
						operation: ['createBulk'],
						source: ['template'],
					},
				},
			},
			{
				displayName: 'Items',
				name: 'items',
				type: 'json',
				default: '[]',
				required: true,
				description:
					'JSON array with one entry per render, e.g. [{"variables": {"name": "Alice"}}, {"variables": {"name": "Bob"}}] (max 500)',
				displayOptions: {
					show: {
						resource: ['render'],
						operation: ['createBulk'],
					},
				},
			},

			// ----------------------------------
			//         render: get fields
			// ----------------------------------
			{
				displayName: 'Job ID',
				name: 'jobId',
				type: 'string',
				default: '',
				required: true,
				description: 'Render job ID (UUID) returned when the render was created',
				displayOptions: {
					show: {
						resource: ['render'],
						operation: ['get'],
					},
				},
			},
			{
				displayName: 'Wait for Completion',
				name: 'waitForCompletion',
				type: 'boolean',
				default: false,
				description:
					'Whether to poll the job until it completes (or fails) and return the finished render instead of the queued job',
				displayOptions: {
					show: {
						resource: ['render'],
						operation: ['create', 'get'],
					},
				},
			},
			{
				displayName: 'Wait for Completion',
				name: 'waitForCompletion',
				type: 'boolean',
				default: false,
				description:
					'Whether to poll the job until it completes (or fails) and return the finished render instead of the queued job',
				displayOptions: {
					show: {
						resource: ['template'],
						operation: ['render'],
					},
				},
			},
			{
				displayName: 'Wait Options',
				name: 'waitOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				displayOptions: {
					show: {
						waitForCompletion: [true],
					},
				},
				options: [
					{
						displayName: 'Max Wait Time (Seconds)',
						name: 'maxWaitTime',
						type: 'number',
						typeOptions: {
							minValue: 1,
						},
						default: 600,
						description: 'Fail if the render has not finished after this long',
					},
					{
						displayName: 'Poll Interval (Seconds)',
						name: 'pollInterval',
						type: 'number',
						typeOptions: {
							minValue: 1,
						},
						default: 5,
						description: 'How often to check the job status',
					},
				],
			},

			// ----------------------------------
			//         render: getAll fields
			// ----------------------------------
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				typeOptions: {
					minValue: 1,
				},
				default: 50,
				description: 'Max number of results to return',
				displayOptions: {
					show: {
						resource: ['render'],
						operation: ['getAll'],
					},
				},
			},
			{
				displayName: 'Page',
				name: 'page',
				type: 'number',
				typeOptions: {
					minValue: 1,
				},
				default: 1,
				description: 'Page of results to fetch',
				displayOptions: {
					show: {
						resource: ['render'],
						operation: ['getAll'],
					},
				},
			},
			{
				displayName: 'Type',
				name: 'filterType',
				type: 'options',
				options: [
					{
						name: 'All',
						value: 'all',
					},
					{
						name: 'Image',
						value: 'image',
					},
					{
						name: 'Video',
						value: 'video',
					},
				],
				default: 'all',
				description: 'Only return renders of this type',
				displayOptions: {
					show: {
						resource: ['render'],
						operation: ['getAll'],
					},
				},
			},
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				typeOptions: {
					minValue: 1,
				},
				default: 50,
				description: 'Max number of results to return',
				displayOptions: {
					show: {
						resource: ['template'],
						operation: ['getAll'],
					},
				},
			},

			// ----------------------------------
			//         additional fields
			// ----------------------------------
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: {
					show: {
						resource: ['render'],
						operation: ['create', 'createBulk', 'validate'],
					},
				},
				options: [
					{
						displayName: 'Batch Name',
						name: 'batchName',
						type: 'string',
						default: '',
						description: 'Name for the bulk batch (Create Bulk only)',
					},
					{
						displayName: 'Overrides',
						name: 'overrides',
						type: 'json',
						default: '{}',
						description:
							'Output overrides as JSON: name, width, height, resolution, outputFormat, frameRate, backgroundColor, and for images snapshotTime, quality, transparent',
					},
					{
						displayName: 'Webhook URL',
						name: 'webhookUrl',
						type: 'string',
						default: '',
						description:
							'Per-job webhook notified on render.completed / render.failed (HMAC-signed)',
					},
				],
			},
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: {
					show: {
						resource: ['template'],
						operation: ['render'],
					},
				},
				options: [
					{
						displayName: 'Overrides',
						name: 'overrides',
						type: 'json',
						default: '{}',
						description:
							'Output overrides as JSON: name, width, height, resolution, outputFormat, frameRate, backgroundColor',
					},
					{
						displayName: 'Webhook URL',
						name: 'webhookUrl',
						type: 'string',
						default: '',
						description:
							'Per-job webhook notified on render.completed / render.failed (HMAC-signed)',
					},
				],
			},
		],
	};
}
