const express = require('express');
const Web3 = require('web3');
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