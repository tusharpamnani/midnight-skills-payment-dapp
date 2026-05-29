import PaymentClient from './PaymentClient';

export const metadata = {
  title: 'Payment DApp - Midnight Network',
  description: 'Accept and withdraw tNIGHT payments on Midnight Network via 1AM Wallet',
};

export default function PaymentPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-8">
      <PaymentClient />
    </div>
  );
}
