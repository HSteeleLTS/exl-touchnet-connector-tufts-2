const express = require('express');
const jwt     = require('jsonwebtoken');
const ejs = require('ejs');
const TouchnetWS = require('./touchnet');
const responses = require('./responses');

const dom = require('@xmldom/xmldom').DOMParser;
const { requestp, frombase64 } = require('./utils');
const { getFees, payFees } = require('./alma');
const fs = require('fs');
const app_url_base = process.env.APP_BASE_URL;
const applicationUrl = app_url_base + "/touchnet"
const my_account_link = process.env.MY_ACCOUNT_LINK
const returnUrl = app_url_base + "/fines";

global.applicationUrl = app_url_base + "/touchnet";
global.my_account_link = process.env.MY_ACCOUNT_LINK
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

app.get('/fines', async (request, response) => {

/* 	const protocol = request.get('x-forwarded-proto') || request.protocol;
  const host = request.get('x-forwarded-host') || request.get('host');


  //returnUrl = (protocol + '://' + host + request.originalUrl.split("?").shift()).replace(/\/$/, "");

  const referrer = request.query.returnUrl || request.header('Referer'); */



		if (request.query.jwt) {
    /* From Primo VE */

    try {

      ({ userName: user_id, institution } = jwt.decode(request.query.jwt));


libraries_hash = JSON.parse(env_var_libraries);
libraries_string = JSON.stringify(libraries_hash);

libraries = Object.keys(libraries_hash);

//libraries = ['GINN', 'HIRSH', 'MUSIC', 'SMFA', 'TISCH', 'VET'];

libraries_and_fines = {}
for(var i = 0; i < libraries.length; i += 1) {
  libraries_and_fines[libraries[i]] = {"amount": 0, "success_url": "", "return_url": ""};

}
	//libraries_and_fines = {'GINN': 0, 'HIRSH': 0, 'MUSIC': 0, 'SMFA': 0, 'TISCH': 0, 'VET': 0};
	for (var l in libraries_and_fines) {


			({ total_sum } = await getFees(user_id, l));

			libraries_and_fines[l]['amount'] = total_sum;
      libraries_and_fines[l]['success_url'] = libraries_hash[l]['success_url'];
      libraries_and_fines[l]['cancel_url'] = libraries_hash[l]['cancel_url'];

    // here value is the array element being iterated
}




    // for (let library of Object.keys(libraries_and_fines)) {
    //    console.log("Fines owed at " + library + ": " + libraries_and_fines[library]['amount']);
    //
    //
    // }


// //this can be taken out and replace with loop based on libraries_and_fines[<key name>]
// 	g = libraries_and_fines['GINN'];
// 	h = libraries_and_fines['HIRSH'];
// 	m = libraries_and_fines['MUSIC'];
// 	s = libraries_and_fines['SMFA'];
// 	t = libraries_and_fines['TISCH'];
// 	v = libraries_and_fines['VET'];


	app.use( express.static( "branding" ) );

	app.set('view engine', 'html');
	app.engine('html', require('ejs').renderFile);
  /*this can be replaced with loop that assigns keys and values to this dictionary: roughly (not javascript) for key in hash: hash.append("<key>": hash["<key>"]  or in javascript const newArr = [
  {name: 'eve'},
  {name: 'john'},
  {name: 'jane'}
].map(v => ({...v, isActive: true}))" */
  libraries_and_fines['applicationUrl'] = applicationUrl + "?"
  libraries_and_fines['my_account'] = my_account_link
	response.render("./index", libraries_and_fines);
	//response.render("./index", {libraries_and_fines: libraries_and_fines});
	}
	catch (e) {
      console.error("Error in retrieving user information:", e.message)
      throw new Error('Cannot retrieve user details information.');
    }


  }



	//return response.status(200).send("<p>Got to fines landing page,/p>");
    //fs.createReadStream('index.html').pipe(response);




})

/* const land = async(qs) => {

	if (qs.jwt) {
    /* From Primo VE */

/*     try {

      ({ userName: user_id, institution } = jwt.decode(qs.jwt));
    } catch (e) {
      console.error("Error in retrieving user information:", e.message)
      throw new Error('Cannot retrieve user details information.');
    }

	libraries = ['GINN', 'HIRSH', 'MUSIC', 'SMFA', 'TISCH', 'VET'];
	libraries_and_fines = {'GINN': 0, 'HIRSH': 0, 'MUSIC': 0, 'SMFA': 0, 'TISCH': 0, 'VET': 0}
	for (const l in libraries){

		({ total_sum } = await getFees(user_id, l));
		libraries_and_fines[l] = total_sum

	}

	libraries_and_fines


} */



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
  //app_url_base = process.env.APP_URL_BASE;
  //applicationUrl = app_url_base + "/touchnet";
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
	upay_site_id = libraries_hash[library]['site_id'];
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
     console.log("Cancel URL from the return: " + cancelUrl);
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

module.exports = { get, success};
