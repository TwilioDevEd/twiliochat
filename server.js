/*
Load Twilio configuration from .env config file - the following environment
variables should be set:

process.env.TWILIO_ACCOUNT_SID
process.env.TWILIO_API_KEY
process.env.TWILIO_API_SECRET
process.env.TWILIO_IPM_SERVICE_SID
process.env.PARSE_WEBHOOK_KEY

*/
require('dotenv').load();
var http = require('http');
var path = require('path');
var AccessToken = require('twilio').AccessToken;
var IpMessagingGrant = AccessToken.IpMessagingGrant;
var express = require('express');
var bodyParser = require('body-parser');

// Create Express webapp
var app = express();
app.use(express.static(path.join(__dirname, 'public')));

// Webhook request sent by Parse to our server-side app, so we can generate a
// token for use with the IP Messaging SDK
app.post('/token', bodyParser.json(), function(request, response) {
    // First, validate webhook request originated from Parse
    var candidateParseHeader = request.get('X-Parse-Webhook-Key');
    if (process.env.PARSE_WEBHOOK_KEY !== candidateParseHeader) {
        return response.status(403).send({
            status: 403,
            message: 'Parse webhook request could not be validated.'
        });
    }

    // Now, generate a token for the logged in Parse user
    var appName = 'TwilioChat';
    var identity = request.body.user.username;
    var deviceId = request.body.params.device;

    // Create a unique ID for the client on their current device
    var endpointId = appName + ':' + identity + ':' + deviceId;

    // Create a "grant" which enables a client to use IPM as a given user,
    // on a given device
    var ipmGrant = new IpMessagingGrant({
        serviceSid: process.env.TWILIO_IPM_SERVICE_SID,
        endpointId: endpointId
    });

    // Create an access token which we will sign and return to the client,
    // containing the grant we just created
    var token = new AccessToken(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_API_KEY,
        process.env.TWILIO_API_SECRET
    );
    token.addGrant(ipmGrant);
    token.identity = identity;

    // Serialize the token to a JWT string and include it in a JSON response
    response.send({
        success: {
            identity: identity,
            token: token.toJwt()
        }
    });
});

// Create http server and run it
var server = http.createServer(app);
var port = process.env.PORT || 3000;
server.listen(port, function() {
    console.log('Express server running on *:' + port);
});