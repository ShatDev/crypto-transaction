const express = require('express');
const Web3 = require('web3');
const solanaWeb3 = require('@solana/web3.js');
const Validator = require('validatorjs');
const cors = require('cors');

require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json()); // for parsing application/json

const PORT = process.env.PORT || 3000;

app.get('/api/balance/:address', async (req, res) => {
  const ethNetwork =
    req.query.network === 'eth'
      ? process.env.ETH_NETWORK
      : process.env.BSC_NETWORK;
  const web3 = new Web3(new Web3.providers.HttpProvider(ethNetwork));

  const userBalance = await web3.eth.getBalance(req.params.address);

  return res.json({
    amount: web3.utils.fromWei(userBalance, 'ether'),
  });
});

app.post('/api/create', async (req, res) => {
  let web3;
  if (req.query.network === 'solana') {
    web3 = solanaWeb3;
  }

  const keyPair = web3.Keypair.generate();

  console.log(keyPair.secretKey);

  return res.json({
    address: keyPair.publicKey.toString(),
    privateKey: keyPair.secretKey.toString(),
  });
});

app.post('/api/transfer', async (req, res) => {
  let rules = {
    privateKey: 'required|string',
    amount: 'required',
    receiver: 'required|string',
    network: 'required|string',
  };

  let validation = new Validator(req.body, rules);

  if (validation.fails()) {
    return res.status(401).json({
      type: 'ValidationError',
      errors: validation.errors.all(),
    });
  }

  if (req.body.network === 'solana') {
    const connection = new solanaWeb3.Connection(
      solanaWeb3.clusterApiUrl('devnet'),
      'confirmed'
    );

    const receiver = new solanaWeb3.PublicKey(req.body.receiver);

    const privateKey = new Uint8Array(req.body.privateKey.split(','));
    const from = solanaWeb3.Keypair.fromSecretKey(privateKey);

    // Add transfer instruction to transaction
    const transaction = new solanaWeb3.Transaction().add(
      solanaWeb3.SystemProgram.transfer({
        fromPubkey: from.publicKey,
        toPubkey: receiver,
        lamports: solanaWeb3.LAMPORTS_PER_SOL * req.body.amount,
      })
    );

    try {
      // Sign transaction, broadcast, and confirm
      const signature = await solanaWeb3.sendAndConfirmTransaction(
        connection,
        transaction,
        [from]
      );

      return res.json({ signature });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  const ethNetwork =
    req.body.network === 'eth'
      ? process.env.ETH_NETWORK
      : process.env.BSC_NETWORK;
  const web3 = new Web3(new Web3.providers.HttpProvider(ethNetwork));

  const { address: sender } = web3.eth.accounts.wallet.add(req.body.privateKey);

  try {
    const weiBalance = await web3.eth.getBalance(sender);
    let balance = web3.utils.fromWei(weiBalance, 'ether');

    if (balance < req.body.amount) {
      return res.status(401).json({ error: 'insufficient funds' });
    }
    const nonce = await web3.eth.getTransactionCount(sender);

    const gas = web3.utils.toBN(21000);

    const gasPrice = await web3.eth.getGasPrice();

    const amount = web3.utils.toHex(
      web3.utils.toWei(req.body.amount.toString(), 'ether')
    );

    const txObj = {
      to: req.body.receiver,
      value: amount,
      gas,
      gasPrice,
      nonce,
    };

    const signedTx = await web3.eth.accounts.signTransaction(
      txObj,
      req.body.privateKey
    );

    try {
      web3.eth.sendSignedTransaction(signedTx.rawTransaction, (err, txHash) => {
        return res.json({ hash: txHash });
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => console.log(`Server is running on PORT ${PORT}`));
