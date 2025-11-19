import * as functions from 'firebase-functions';
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();

// Use CORS to allow frontend requests
app.use(cors({ origin: true }));
app.use(express.json());

// Route to create a RupantorPay checkout session
app.post('/rupantorpay-create', async (req: express.Request, res: express.Response) => {
  const { customerName, customerEmail, amount } = req.body;
  if (!customerName || !customerEmail || !amount) {
    return res.status(400).json({ ok: false, message: 'Missing required fields' });
  }

  const baseUrl = 'https://intelligent-architect-version-3.web.app'; // Your deployed app URL

  try {
    const response = await fetch('https://payment.rupantorpay.com/api/payments/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': process.env.RUPANTORPAY_API_KEY!,
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

    const data: any = await response.json();

    if (!response.ok) {
      throw new Error(data?.message || 'Gateway error');
    }

    if (!data.payment_url) {
      return res.status(400).json({ ok: false, message: 'No payment_url returned', raw: data });
    }

    return res.json({ ok: true, paymentUrl: data.payment_url });
  } catch (error: any) {
    return res.status(500).json({ ok: false, message: error.message });
  }
});

// Route to verify a RupantorPay payment
app.post('/rupantorpay-verify', async (req: express.Request, res: express.Response) => {
  const { transactionId } = req.body;
  if (!transactionId) {
    return res.status(400).json({ ok: false, message: 'transactionId required' });
  }

  try {
    const response = await fetch('https://payment.rupantorpay.com/api/payment/verify-payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': process.env.RUPANTORPAY_API_KEY!,
      },
      body: JSON.stringify({ transaction_id: transactionId }),
    });

    const data: any = await response.json();

    return res.json({
      ok: true,
      status: data?.status || 'UNKNOWN',
      raw: data,
    });
  } catch (error: any) {
    return res.status(500).json({ ok: false, message: error.message });
  }
});

// Expose the Express app as a single Cloud Function
export const api = functions.https.onRequest(app);