interface RupantorPayCreateResponse {
    ok: boolean;
    paymentUrl?: string;
    message?: string;
  }
  
  export async function createRupantorCheckout(name: string, email: string, amount: number): Promise<RupantorPayCreateResponse> {
    try {
      const resp = await fetch(`/api/rupantorpay-create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerName: name, customerEmail: email, amount }),
      });
      return await resp.json();
    } catch (e: any) {
      return { ok: false, message: e.message };
    }
  }
  
  interface RupantorPayVerifyResponse {
    ok: boolean;
    message?: string;
  }
  
  export async function verifyRupantorPayment(transactionId: string): Promise<RupantorPayVerifyResponse> {
    try {
      const resp = await fetch(`/api/rupantorpay-verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId }),
      });
      return await resp.json();
    } catch (e: any) {
      return { ok: false, message: e.message };
    }
  }
  