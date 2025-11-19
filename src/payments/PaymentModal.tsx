import React, { useState } from 'react';
import { createRupantorCheckout } from './rupantorpay-client';

export function PaymentModal({ userEmail, isOpen, onClose }: { userEmail: string; isOpen: boolean; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState(500);
  const [error, setError] = useState('');

  async function startPayment() {
    setLoading(true);
    setError('');
    try {
      const resp = await createRupantorCheckout(name || userEmail.split('@')[0], userEmail, amount);
      if (resp.ok && resp.paymentUrl) {
        window.location.href = resp.paymentUrl;
      } else {
        setError(resp.message || 'Payment initialization failed.');
      }
    } catch (e: any) {
      setError(e.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div style={styles.backdrop}>
      <div style={styles.modal}>
        <h2 style={styles.title}>Purchase Credits</h2>
        <input
          type="text"
          placeholder="Full Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={styles.input}
        />
        <select value={amount} onChange={(e) => setAmount(Number(e.target.value))} style={styles.input}>
          <option value={500}>৳500</option>
          <option value={1000}>৳1000</option>
          <option value={2000}>৳2000</option>
        </select>
        {error && <div style={styles.error}>{error}</div>}
        <button onClick={startPayment} disabled={loading} style={styles.payBtn}>
          {loading ? 'Redirecting...' : 'Pay with RupantorPay'}
        </button>
        <button onClick={onClose} style={styles.closeBtn}>Close</button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
  },
  modal: {
    width: 400, background: '#1f2937', padding: 20, borderRadius: 10, border: '1px solid #374151', color: '#e5e7eb',
  },
  title: { color: '#facc15', fontFamily: "'Permanent Marker', cursive", fontSize: 24, marginBottom: 10 },
  input: { width: '100%', padding: 10, margin: '6px 0', borderRadius: 8, border: '1px solid #374151', background: '#111827', color: '#e5e7eb' },
  payBtn: { width: '100%', padding: 12, marginTop: 8, background: '#16a34a', color: '#111827', fontWeight: 700, border: 'none', borderRadius: 8, cursor: 'pointer' },
  closeBtn: { width: '100%', padding: 10, marginTop: 8, background: 'transparent', color: '#9ca3af', border: '1px solid #374151', borderRadius: 8, cursor: 'pointer' },
  error: { background: '#451a1a', border: '1px solid #ef4444', color: '#fca5a5', borderRadius: 6, padding: 8, marginBottom: 6 },
};
