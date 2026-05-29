export type PaymentPrivateState = {
  ownerSecretKey: Uint8Array;
};


export const paymentWitnesses = {
  ownerKey: (context: { privateState: PaymentPrivateState }) => context.privateState.ownerSecretKey,
};
