const express = require('express');
const jwt     = require('jsonwebtoken');
const TouchnetWS = require('./touchnet');
const responses = require('./responses');
const dom = require('@xmldom/xmldom').DOMParser;
const { requestp, frombase64 } = require('./utils');
const { getFees, payFees } = require('./alma');
const fs = require('fs');
global.returnUrl = "https://www.library.tufts.edu/hsteele/alma_touchnet_integration/index.html";
global.successUrl;
global.cancelUrl;
global.applicationUrl = "https://exl-touchnet-connector.tufts.edu/touchnet";
const http = require('http');
const https = require('https');
const env_var_libraries = process.env.ALMA_LIBRARY_CODE;
const postback_url = process.env.POSTBACK_URL;
let privateKey, certificate, credentials;
if (process.env.CERTIFICATE_KEY_FILE) {
  privateKey  = fs.readFileSync(process.env.CERTIFICATE_KEY_FILE, 'utf8');
  certificate = fs.readFileSync(process.env.CERTIFICATE_CRT_FILE, 'utf8');
  credentials = {key: privateKey, cert: certificate};
}

let touchnet;
const init = async (touchnet_ws_url) => {
  if (!touchnet) {
    console.log('Initializing Touchnet');
    touchnet = await TouchnetWS.init(touchnet_ws_url || process.env.TOUCHNET_WS_URL);
  }
}

const PORT = process.env.PORT || 3002;
const SECURE_PORT = process.env.SECURE_PORT || 3003;
const app = express();
app.use(express.urlencoded({extended: true}));

app.get('/', (request, response) => {
  response.send('Touchnet connector');
})

app.get('/touchnet', async (request, response) => {
  const protocol = request.get('x-forwarded-proto') || request.protocol;
  const host = request.get('x-forwarded-host') || request.get('host');

  
  //returnUrl = (protocol + '://' + host + request.originalUrl.split("?").shift()).replace(/\/$/, "");

  const referrer = request.query.returnUrl || request.header('Referer');

  try {
    const resp = await get(request.query, returnUrl, referrer);
    response.send(resp);
  } catch (e) {
	if (e.message == "Nothing to pay"){
		return response.status(400).send("<p>There are no more fines to pay at this library. Click the <a href='javascript:history.back()'>Back</a> button to pay more fines");
	}
    return response.status(400).send(e.message);
  }
})

const get = async (qs, returnUrl, referrer) => {
  if (!qs || !returnUrl) return 'Touchnet connector';
  let user_id, total_sum, upay_site_id, upay_site_url, post_message = 'false', institution, touchnet_ws_url;
  if (qs.s) { 
    /* From CloudApp */
    ({ user_id, total_sum, upay_site_id, upay_site_url, touchnet_ws_url } = JSON.parse(frombase64(qs.s)));
    post_message = 'true';
  } else if (qs.jwt) { 
    /* From Primo VE */
	library = decodeURIComponent(qs.library);
	successUrl = qs.success_url;
        cancelUrl = qs.cancel_url;
    try {
	   
      ({ userName: user_id, institution } = jwt.decode(qs.jwt));
    } catch (e) {
      console.error("Error in retrieving user information:", e.message)
      throw new Error('Cannot retrieve user details information.');
    }
  } else if (qs.pds_handle) {
    /* From Primo Classic */
    try {
      const ref = new URL(referrer);
      const url = `${ref.protocol}//${ref.host}/primo_library/libweb/webservices/rest/PDSUserInfo?institute=${qs.institution}&pds_handle=${qs.pds_handle}`;
      const borinfo = await requestp({url});
      const node = require('xpath').select('/bor/bor_id/id', new dom().parseFromString(borinfo));
      user_id = node.length > 0 ? node[0].firstChild.data : null;
    } catch (e) {
      console.error("Error in retrieving user information:", e.message)
      throw new Error('Cannot retrieve user details information.');
    }
  }

  ({ total_sum } = await getFees(user_id, library));
  if (!user_id || total_sum <= 0) throw new Error('Nothing to pay');

  await init(touchnet_ws_url);
  try {
    let ticket = await touchnet.generateTicket(user_id, {
      amount: total_sum,
      success: applicationUrl + '/success',
      error: applicationUrl + '/error',
      cancel: applicationUrl + '/cancel',
      referrer,
      post_message,
      institution
    });
    console.log('Successfully created ticket', ticket);
	upay_site_id = JSON.parse(env_var_libraries)[library];
    return responses.redirectForm(ticket, user_id, upay_site_id, upay_site_url);
  } catch (e) {
    console.error("Error in setting up payment:", e.message)
    throw new Error('Cannot prepare payment information.');
  }
}

app.post('/touchnet/success', async (request, response) => {
  try {
    const resp = await success(request.body);
    response.send(resp);
  } catch(e) {
    return response.status(400).send(e.message);
  }
})

const success = async body => {
  await init();
  const amount = body.pmt_amt;
  //let returnUrl = "https://www.library.tufts.edu/hsteele/alma_touchnet_integration/index.html";
  let receipt, user_id, post_message;
  try {
    ({ receipt, user_id, post_message } = await touchnet.authorize(body.session_identifier));
    
      //returnUrl = decodeURIComponent(returnUrl);
  } catch(e) {
    console.error("Error while authorizing payment:", e.message);
    throw new Error('Could not authorize payment.')
  }

  try {
    let returnUrl = "https://www.library.tufts.edu/hsteele/alma_touchnet_integration/index.html";
    if (post_message === 'true') {
      return responses.returnToReferrer(successUrl, { amount: amount, external_transaction_id: receipt, user_id: user_id });
    } else {    
      await payFees(user_id, amount, receipt, library);
      console.log('Payment posted to Alma. Returning to referrer', successUrl);
      body['library'] = library;
      responses.postback(body, postback_url);
      return responses.returnToReferrer(successUrl);
    }
  } catch (e) {
    console.error("Error in posting payment to Alma:", e.message);
    throw new Error('Could not post payment to Alma')
  }
}

app.get('/touchnet/error', (request, response) => {
  response.status(400).send('An error has occurred');
})

app.get('/touchnet/cancel', (request, response) => {
  try {
    response.status(200).send(responses.goToCancel(cancelUrl));
}
   catch(e) {
        response.status(400).send(e.message);
  }

})

const cancel = async body => {

    await init();
     try {
    //let returnUrl = "https://www.library.tufts.edu/hsteele/alma_touchnet_integr$

      return responses.returnToReferrer(cancelUrl);
    } 
   catch (e) {
    console.error("cancel error", e.message);
    throw new Error('cancel error');
  }
}


// app.listen(PORT);
server = http.createServer(app).listen(PORT);
if (credentials) https.createServer(credentials, app).listen(SECURE_PORT);
// We are only using socket.io here to respond to the npmStop signal
// To support IPC (Inter Process Communication) AKA RPC (Remote P.C.)

const io = require('socket.io')(server);
io.on('connection', (socketServer) => {
  socketServer.on('npmStop', () => {
    process.exit(0);
  });
});

module.exports = { get, success };
