const express = require('express');
const Web3 = require('web3');
const EthereumTx = require('ethereumjs-tx').Transaction;
const axios = require('axios');

require('dotenv').config();

const app = express();
app.use(express.json()); // for parsing application/json

const PORT = process.env.PORT || 3000;

app.get('/api/balance/:address', async (req, res) => {
  const userBalance = await web3.eth.getBalance(req.params.address);

  return res.json({
    amount: web3.utils.fromWei(userBalance, 'ether'),
  });
});

app.post('/api/transfer', async (req, res) => {
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
        console.log('insufficient funds');
        return reject();
      }

      let gasPrices = await getCurrentGasPrices();
      let details = {
        to: req.body.receiver,
        value: web3.utils.toHex(
          web3.utils.toWei(req.body.amount.toString(), 'ether')
        ),
        gas: 21000,
        gasPrice: gasPrices.low * 1000000000,
        nonce: nonce,
        chainId: 4,
      };

      const transaction = new EthereumTx(details, { chain: 'rinkeby' });
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

  async function getCurrentGasPrices() {
    let response = await axios.get(
      'https://ethgasstation.info/json/ethgasAPI.json'
    );
    let prices = {
      low: response.data.safeLow / 10,
      medium: response.data.average / 10,
      high: response.data.fast / 10,
    };
    return prices;
  }
});

app.listen(PORT, () => console.log(`Server is running on PORT ${PORT}`));
