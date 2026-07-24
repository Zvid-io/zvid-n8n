"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZvidTrigger = void 0;
const crypto_1 = require("crypto");
const GenericFunctions_1 = require("../Zvid/GenericFunctions");
class ZvidTrigger {
    constructor() {
        this.description = {
            displayName: 'Zvid Trigger',
            name: 'zvidTrigger',
            icon: 'file:zvid.svg',
            group: ['trigger'],
            version: 1,
            description: 'Starts the workflow when a Zvid render completes or fails',
            defaults: {
                name: 'Zvid Trigger',
            },
            inputs: [],
            outputs: ['main'],
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
                    description: 'Whether to reject deliveries whose HMAC-SHA256 signature (X-Zvid-Signature) does not match the endpoint secret',
                },
            ],
        };
        this.webhookMethods = {
            default: {
                async checkExists() {
                    var _a;
                    const webhookData = this.getWorkflowStaticData('node');
                    const webhookUrl = this.getNodeWebhookUrl('default');
                    const response = await GenericFunctions_1.zvidApiRequest.call(this, 'GET', '/api/webhooks');
                    const webhooks = (_a = response.webhooks) !== null && _a !== void 0 ? _a : [];
                    for (const webhook of webhooks) {
                        if (webhook.url === webhookUrl) {
                            webhookData.webhookId = webhook.id;
                            return true;
                        }
                    }
                    return false;
                },
                async create() {
                    const webhookUrl = this.getNodeWebhookUrl('default');
                    const webhookData = this.getWorkflowStaticData('node');
                    const events = this.getNodeParameter('events');
                    const response = await GenericFunctions_1.zvidApiRequest.call(this, 'POST', '/api/webhooks', {
                        url: webhookUrl,
                        events,
                        description: 'n8n Zvid Trigger',
                    });
                    const webhook = response.webhook;
                    if (!(webhook === null || webhook === void 0 ? void 0 : webhook.id))
                        return false;
                    webhookData.webhookId = webhook.id;
                    webhookData.webhookSecret = webhook.secret;
                    return true;
                },
                async delete() {
                    const webhookData = this.getWorkflowStaticData('node');
                    if (webhookData.webhookId) {
                        try {
                            await GenericFunctions_1.zvidApiRequest.call(this, 'DELETE', `/api/webhooks/${webhookData.webhookId}`);
                        }
                        catch {
                            return false;
                        }
                        delete webhookData.webhookId;
                        delete webhookData.webhookSecret;
                    }
                    return true;
                },
            },
        };
    }
    async webhook() {
        var _a, _b, _c;
        const req = this.getRequestObject();
        const res = this.getResponseObject();
        const body = this.getBodyData();
        const verify = this.getNodeParameter('verifySignature', true);
        if (verify) {
            const webhookData = this.getWorkflowStaticData('node');
            let secret = webhookData.webhookSecret;
            if (!secret && webhookData.webhookId) {
                const response = await GenericFunctions_1.zvidApiRequest.call(this, 'GET', `/api/webhooks/${webhookData.webhookId}`);
                secret = (_a = response.webhook) === null || _a === void 0 ? void 0 : _a.secret;
                if (secret)
                    webhookData.webhookSecret = secret;
            }
            const signatureHeader = String((_b = req.headers['x-zvid-signature']) !== null && _b !== void 0 ? _b : '');
            const timestamp = String((_c = req.headers['x-zvid-timestamp']) !== null && _c !== void 0 ? _c : '');
            const rawBody = req.rawBody;
            const signedPayload = `${timestamp}.${rawBody ? rawBody.toString('utf8') : JSON.stringify(body)}`;
            let valid = false;
            if (secret && signatureHeader.startsWith('sha256=')) {
                const expected = (0, crypto_1.createHmac)('sha256', secret).update(signedPayload).digest('hex');
                const received = signatureHeader.slice('sha256='.length);
                valid =
                    expected.length === received.length &&
                        (0, crypto_1.timingSafeEqual)(Buffer.from(expected, 'hex'), Buffer.from(received, 'hex'));
            }
            if (!valid) {
                res.status(401).send('Invalid signature');
                return {
                    noWebhookResponse: true,
                };
            }
        }
        const events = this.getNodeParameter('events');
        const event = body.event;
        if (event && !events.includes(event)) {
            return {};
        }
        return {
            workflowData: [this.helpers.returnJsonArray(body)],
        };
    }
}
exports.ZvidTrigger = ZvidTrigger;
//# sourceMappingURL=ZvidTrigger.node.js.map