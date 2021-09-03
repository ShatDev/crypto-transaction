const express = require('express');
const Web3 = require('web3');
const EthereumTx = require('ethereumjs-tx').Transaction;
const Validator = require('validatorjs');
const Common = require('ethereumjs-common').default;
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

  return new Promise(async (resolve, reject) => {
    var nonce = await web3.eth.getTransactionCount(sender);
    web3.eth.getBalance(sender, async (err, result) => {
      if (err) {
        return reject();
      }
      let balance = web3.utils.fromWei(result, 'ether');
      console.log(balance + ' ETH');
      if (balance < req.body.amount) {
        reject();

        return res.status(401).json({ error: 'insufficient funds' });
      }

      let gasPrice = await web3.eth.getGasPrice();

      let details = {
        to: req.body.receiver,
        value: web3.utils.toHex(
          web3.utils.toWei(req.body.amount.toString(), 'ether')
        ),
        gas: 21000,
        gasPrice: parseFloat(gasPrice),
        nonce: nonce,
      };

      let common;

      if (req.body.network === 'eth') {
        common = { chain: 'rinkeby' };
      } else {
        common = Common.forCustomChain(
          'mainnet',
          {
            name: 'bnb',
            networkId: 97,
            chainId: 97,
          },
          'istanbul'
        );
      }

      const transaction = new EthereumTx(
        details,
        req.body.network === 'eth' ? common : { common }
      );
      let privateKey = req.body.privateKey;
      let privKey = Buffer.from(privateKey, 'hex');
      transaction.sign(privKey);

      const serializedTransaction = transaction.serialize();

      web3.eth.sendSignedTransaction(
        '0x' + serializedTransaction.toString('hex'),
        (err, id) => {
          if (err) {
            console.log(err);
            return reject();
          }

          resolve({ id: id });

          return res.json({ hash: id });
        }
      );
    });
  });
});

app.listen(PORT, () => console.log(`Server is running on PORT ${PORT}`));
