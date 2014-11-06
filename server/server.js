

/* ==========================================================================
   Drawki server side code
   ========================================================================== */


var port = (process.env.VCAP_APP_PORT || 1337);
var http = require('http').createServer();
http.listen(port);
console.log('Server running on ' + port);

/* ######## */

var io = require('socket.io').listen(http);

// WebSockets are not supported (yet) by the server
io.set('transports', ['xhr-polling']);

var utils = require('./utils');
var channelsFilePath = './channels.json';


io.sockets.on('connection', function(client) {


	/**********************/
	/* Sign in / Sign out */
	/**********************/

	client.on('signIn', function(signInfos) {
	    var channelName = signInfos.channelName.toLowerCase();
	    var userName = signInfos.userName;

	    console.log('Sign in attempt : ' + userName + ' in #' + channelName);

	    /* Creates the channel if it doesn't exist */
	    if(!utils.getChannel(channelsFilePath, channelName)) {
	      console.log('#' + channelName + ' does not exist.');
	      utils.addChannel(channelsFilePath, channelName);
	    }
	    
	    /* Put the client in the specified channel and get the current drawing of the channel */
	    client.join(channelName);
	    console.log(userName + ' joined #' + channelName);
	    client.username = userName;
	    client.channel = channelName;
	    client.signedIn = true;
	    io.sockets.in(client.channel).emit('userSignedIn', userName, channelName);
	    client.in(client.channel).broadcast.emit('requestCurrentDrawing');
    	updateConnectedUsers(client.channel);
  	});


	/**
  	* Handle clients disconnections.
  	*/
  	client.on('disconnect', function() {
  		if(client.signedIn) {
			io.sockets.in(client.channel).emit('clientDisco', client.username);
    		client.leave(client.channel);
    		client.signedIn = false;
    		updateConnectedUsers(client.channel);
  		}
  	});


  	/**
  	* Update connected users
  	*/
  	var updateConnectedUsers = function(channel) {
    	var connectedUsers = [];
	    var connectedSockets = io.sockets.clients(channel);
	    console.log('Update connected users: ' + connectedSockets.length);

	    /* Update the connected users array depending on the sockets connected in the channel */
	    for(var connectedSocket in connectedSockets) {
	      connectedUsers.push(connectedSockets[connectedSocket].username);
	    }

	    // Send connected users array to the clients
	    io.sockets.in(channel).emit('updateConnectedUsers', connectedUsers);
  	};



  	/***********/
	/* Drawing */
	/***********/

	client.on('sendCurrentDrawing', function(currentDrawingImageDataURL) {
		client.in(client.channel).broadcast.emit('sendCurrentDrawing', currentDrawingImageDataURL);
	});

	client.on('drawCommand', function(drawCommand) {
		drawCommand.username = client.username;
		client.in(client.channel).broadcast.emit('drawCommand', drawCommand);
	});

	client.on('eraseDrawing', function() {
		io.sockets.in(client.channel).emit('eraseDrawing');
	});

	client.on('userStoppedDrawing', function() {
		client.in(client.channel).broadcast.emit('userStoppedDrawing', client.username);
	});


  	/********/
  	/* Chat */
  	/********/

	/**
  	* Handle received messages. 
  	*/
  	client.on('sendMessage', function(message) {
    	io.sockets.in(client.channel).emit('sendMessageToClients', client.username, message);
  	});

});

