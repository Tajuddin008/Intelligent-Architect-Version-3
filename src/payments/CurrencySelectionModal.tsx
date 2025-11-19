import React from 'react';

export function CurrencySelectionModal({
  isOpen,
  onClose,
  onSelectCurrency,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelectCurrency: (currency: 'USD' | 'BDT') => void;
}) {
  if (!isOpen) return null;

  return (
    <div style={styles.backdrop}>
      <div style={styles.modal}>
        <h2 style={styles.title}>Select Payment Currency</h2>
        <p>Please choose your preferred currency for the transaction.</p>
        <div style={styles.buttonGroup}>
          <button onClick={() => onSelectCurrency('USD')} style={styles.currencyBtn}>
            Pay in USD ($)
          </button>
          <button onClick={() => onSelectCurrency('BDT')} style={styles.currencyBtn}>
            Pay in BDT (৳)
          </button>
        </div>
        <button onClick={onClose} style={styles.closeBtn}>Cancel</button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
  },
  modal: {
    width: 400,
    background: '#1f2937',
    padding: 20,
    borderRadius: 10,
    border: '1px solid #374151',
    color: '#e5e7eb',
    textAlign: 'center',
  },
  title: {
    color: '#facc15',
    fontFamily: "'Permanent Marker', cursive",
    fontSize: 24,
    marginBottom: 10,
  },
  buttonGroup: {
    margin: '20px 0',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  currencyBtn: {
    width: '100%',
    padding: '12px',
    background: '#374151',
    color: '#e5e7eb',
    fontWeight: 700,
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: '16px',
  },
  closeBtn: {
    width: '100%',
    padding: 10,
    marginTop: 8,
    background: 'transparent',
    color: '#9ca3af',
    border: '1px solid #374151',
    borderRadius: 8,
    cursor: 'pointer',
  },
};