const web3 = require('@solana/web3.js');
(async () => {
  // Connect to cluster
  const connection = new web3.Connection(
    web3.clusterApiUrl('devnet'),
    'confirmed'
  );

  const keyPair = web3.Keypair.generate();

  console.log('Public Key:', keyPair.publicKey.toString());
  console.log('Secret Key:', keyPair.secretKey);
})();
