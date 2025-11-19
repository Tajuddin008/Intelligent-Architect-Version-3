import { useState } from 'react';
import { PaymentModal } from './PaymentModal';

export function BuyCreditsButton({ userEmail }: { userEmail: string }) {
  const [openPay, setOpenPay] = useState(false);

  return (
    <>
      <button className="generate-button" onClick={() => setOpenPay(true)}>
        Buy Credits
      </button>

      <PaymentModal
        userEmail={userEmail}
        isOpen={openPay}
        onClose={() => setOpenPay(false)}
      />
    </>
  );
}

