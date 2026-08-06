import { createHmac, timingSafeEqual } from 'crypto';
import type {
	IDataObject,
	IHookFunctions,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

import { zvidApiRequest } from '../Zvid/GenericFunctions';

// Triggers start workflows and cannot be invoked as AI tools.
// eslint-disable-next-line @n8n/community-nodes/node-usable-as-tool
export class ZvidTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Zvid Trigger',
		name: 'zvidTrigger',
		icon: {
			light: 'file:zvid.light.svg',
			dark: 'file:zvid.svg',
		},
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["events"].join(", ")}}',
		description: 'Starts the workflow when a Zvid render completes or fails',
		defaults: {
			name: 'Zvid Trigger',
		},
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'zvidApi',
				required: true,
			},
		],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
			},
		],
		properties: [
			{
				displayName: 'Events',
				name: 'events',
				type: 'multiOptions',
				options: [
					{
						name: 'Render Completed',
						value: 'render.completed',
						description: 'A render finished successfully and its output URL is ready',
					},
					{
						name: 'Render Failed',
						value: 'render.failed',
						description: 'A render failed (credits are refunded)',
					},
				],
				default: ['render.completed'],
				required: true,
			},
			{
				displayName: 'Verify Signature',
				name: 'verifySignature',
				type: 'boolean',
				default: true,
				description:
					'Whether to reject deliveries whose HMAC-SHA256 signature (X-Zvid-Signature) does not match the endpoint secret',
			},
		],
	};

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const webhookData = this.getWorkflowStaticData('node');
				const webhookUrl = this.getNodeWebhookUrl('default');

				const response = await zvidApiRequest.call(this, 'GET', '/api/webhooks');
				const webhooks = (response.webhooks as IDataObject[] | undefined) ?? [];
				for (const webhook of webhooks) {
					if (webhook.url === webhookUrl) {
						webhookData.webhookId = webhook.id;
						return true;
					}
				}
				return false;
			},

			async create(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default');
				const webhookData = this.getWorkflowStaticData('node');
				const events = this.getNodeParameter('events') as string[];

				const response = await zvidApiRequest.call(this, 'POST', '/api/webhooks', {
					url: webhookUrl,
					events,
					description: 'n8n Zvid Trigger',
				});

				const webhook = response.webhook as IDataObject | undefined;
				if (!webhook?.id) return false;
				webhookData.webhookId = webhook.id;
				// The signing secret is returned in full on creation; keep it for
				// verifying deliveries in webhook().
				webhookData.webhookSecret = webhook.secret;
				return true;
			},

			async delete(this: IHookFunctions): Promise<boolean> {
				const webhookData = this.getWorkflowStaticData('node');
				if (webhookData.webhookId) {
					await zvidApiRequest.call(this, 'DELETE', `/api/webhooks/${webhookData.webhookId}`);
					delete webhookData.webhookId;
					delete webhookData.webhookSecret;
				}
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const req = this.getRequestObject();
		const res = this.getResponseObject();
		const body = this.getBodyData();

		const verify = this.getNodeParameter('verifySignature', true) as boolean;
		if (verify) {
			const webhookData = this.getWorkflowStaticData('node');
			let secret = webhookData.webhookSecret as string | undefined;
			if (!secret && webhookData.webhookId) {
				// Older registrations (or reactivated workflows) may not have the
				// secret in static data — fetch it once from the API.
				const response = await zvidApiRequest.call(
					this,
					'GET',
					`/api/webhooks/${webhookData.webhookId}`,
				);
				secret = (response.webhook as IDataObject | undefined)?.secret as string | undefined;
				if (secret) webhookData.webhookSecret = secret;
			}

			const signatureHeader = String(req.headers['x-zvid-signature'] ?? '');
			const timestamp = String(req.headers['x-zvid-timestamp'] ?? '');
			// Deliveries are signed over `${timestamp}.${rawBody}` with the
			// endpoint secret: X-Zvid-Signature: sha256=<hex>.
			const rawBody = (req as unknown as { rawBody?: Buffer }).rawBody;
			const signedPayload = `${timestamp}.${rawBody ? rawBody.toString('utf8') : JSON.stringify(body)}`;

			let valid = false;
			if (secret && /^sha256=[0-9a-f]{64}$/i.test(signatureHeader)) {
				const expected = createHmac('sha256', secret).update(signedPayload).digest('hex');
				const received = signatureHeader.slice('sha256='.length);
				const expectedBytes = Uint8Array.from(Buffer.from(expected, 'hex'));
				const receivedBytes = Uint8Array.from(Buffer.from(received, 'hex'));
				valid = timingSafeEqual(expectedBytes, receivedBytes);
			}

			if (!valid) {
				res.status(401).send('Invalid signature');
				return {
					noWebhookResponse: true,
				};
			}
		}

		const events = this.getNodeParameter('events') as string[];
		const event = (body as IDataObject).event as string | undefined;
		if (event && !events.includes(event)) {
			// Subscribed events are managed by the API, but test deliveries and
			// stale subscriptions can still send others — acknowledge and drop.
			return {};
		}

		return {
			workflowData: [this.helpers.returnJsonArray(body as IDataObject)],
		};
	}
}
