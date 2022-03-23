
const redirectForm = (ticket, user_id, upay_site_id, upay_site_url) => {

  return `
    <form method="post" action="${upay_site_url || process.env.UPAY_SITE_URL}" name="touchnet">
      <input type="hidden" name="UPAY_SITE_ID" value="${upay_site_id || process.env.UPAY_SITE_ID}">
      <input type="hidden" name="TICKET" value="${ticket}">
      <input type="hidden" name="TICKET_NAME" value="${user_id}">
    </form>
    Redirecting to payment site.
    <script>
    window.onload = function(){
      document.forms['touchnet'].submit();
    }
    </script>
  `
}

const postback = (data) => {
            var request = require('request');
            console.log('body for postback');
            console.log(data);

              request.post(
    {
    url:'http://localhost:6001/add',
    json: {
      unit_name:req.body.unit_name,
      unit_price:req.body.unit_price
        },
    headers: {
        'Content-Type': 'application/json'
    }
    },
  function(error, response, body){
    // console.log(error);
    // console.log(response);
    console.log(body);
    res.send(body);
  });
            var clientServerOptions = {
                uri: 'https://www.library.tufts.edu/hsteele/alma_touchnet_integration/postback/postback.php',
                json: data,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            }
            request.post((clientServerOptions, function (error, response) {
                console.log(error,response.body);
                return;
            });


}

const returnToReferrer = (returnUrl, message) => {
  let form = '<p>Payment successfully processed.</p>';
  if (message) {
    form += `
    <p>Returning...</p>
    <script>
      window.opener.postMessage(${JSON.stringify(message)}, "*");
      window.close();
    </script>
    `    
  } else if (returnUrl) {
    form += `
      <p>Redirecting...</p>
      <script>
        setInterval(() => { window.location.href = "${returnUrl}"; }, 2000);
      </script>`
    
  }
  return form;
}

const goToCancel = (returnUrl) => {
    let form = '<p>Payment cancelled</p>';
    
    form += `
      <p>Redirecting...</p>
      <script>
        setInterval(() => { window.location.href = "${returnUrl}"; }, 2000);
      </script>`

                    
  return form;
 
}


module.exports = { redirectForm, postback, returnToReferrer, goToCancel };
