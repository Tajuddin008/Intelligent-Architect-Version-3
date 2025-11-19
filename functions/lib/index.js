"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.api = void 0;
const functions = __importStar(require("firebase-functions"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const node_fetch_1 = __importDefault(require("node-fetch"));
const app = (0, express_1.default)();
// Use CORS to allow frontend requests
app.use((0, cors_1.default)({ origin: true }));
app.use(express_1.default.json());
// Route to create a RupantorPay checkout session
app.post('/rupantorpay-create', async (req, res) => {
    const { customerName, customerEmail, amount } = req.body;
    if (!customerName || !customerEmail || !amount) {
        return res.status(400).json({ ok: false, message: 'Missing required fields' });
    }
    const baseUrl = 'https://intelligent-architect-version-3.web.app'; // Your deployed app URL
    try {
        const response = await (0, node_fetch_1.default)('https://payment.rupantorpay.com/api/payments/checkout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-KEY': process.env.RUPANTORPAY_API_KEY,
            },
            body: JSON.stringify({
                fullname: customerName,
                email: customerEmail,
                amount,
                success_url: `${baseUrl}/?payment=success&trx_id={trx_id}`,
                cancel_url: `${baseUrl}/?payment=cancelled`,
                methods: ['mfs', 'card'],
            }),
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data?.message || 'Gateway error');
        }
        if (!data.payment_url) {
            return res.status(400).json({ ok: false, message: 'No payment_url returned', raw: data });
        }
        return res.json({ ok: true, paymentUrl: data.payment_url });
    }
    catch (error) {
        return res.status(500).json({ ok: false, message: error.message });
    }
});
// Route to verify a RupantorPay payment
app.post('/rupantorpay-verify', async (req, res) => {
    const { transactionId } = req.body;
    if (!transactionId) {
        return res.status(400).json({ ok: false, message: 'transactionId required' });
    }
    try {
        const response = await (0, node_fetch_1.default)('https://payment.rupantorpay.com/api/payment/verify-payment', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-KEY': process.env.RUPANTORPAY_API_KEY,
            },
            body: JSON.stringify({ transaction_id: transactionId }),
        });
        const data = await response.json();
        return res.json({
            ok: true,
            status: data?.status || 'UNKNOWN',
            raw: data,
        });
    }
    catch (error) {
        return res.status(500).json({ ok: false, message: error.message });
    }
});
// Expose the Express app as a single Cloud Function
exports.api = functions.https.onRequest(app);
//# sourceMappingURL=index.js.map