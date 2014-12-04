

/* ==========================================================================
   Drawki server side code
   ========================================================================== */


var utils = require('./utils');
var channelsFilePath = './channels.json';

var port = process.env.VCAP_APP_PORT || 1337;

var app = require('http').createServer();
var io = require('socket.io')(app);

app.listen(port, function() {
	console.log('Listening on: ' + port);
});


var connectedUsers = {};


io.on('connection', function(client) {


	/**********************/
	/* Sign in / Sign out */
	/**********************/

	client.on('signIn', function(signInfos) {
	    var channelName = stripHTML(signInfos.channelName.toLowerCase());
	    var userName = stripHTML(signInfos.userName);

	    console.log('Sign in attempt : ' + userName + ' in #' + channelName);

	    /* Creates the channel if it doesn't exist */
	    if(!utils.getChannel(channelsFilePath, channelName)) {
	      console.log('#' + channelName + ' does not exist.');
	      utils.addChannel(channelsFilePath, channelName);
	    }
	    
	    /* Put the client in the specified channel and get 
	    the current drawing of the channel */
	    client.join(channelName);
	    console.log(userName + ' joined #' + channelName);
	    client.username = userName;
	    client.channel = channelName;
	    client.signedIn = true;
	    io.in(client.channel).emit('userSignedIn', userName, channelName);
	    client.in(client.channel).broadcast.emit('requestCurrentDrawing');

    	/* Updates connected users for this channel */
    	var users = connectedUsers[channelName] || [];
    	users.push(userName);
    	connectedUsers[channelName] = users;
    	io.in(channelName).emit('updateConnectedUsers', users);
  	});


	/**
  	* Handle clients disconnections.
  	*/
  	client.on('disconnect', function() {
  		if(client.signedIn) {

  			/* Updates connected users for this channel */
    		var users = connectedUsers[client.channel];
    		var userTodelete = users.indexOf(client.username);
    		users.splice(userTodelete, 1);
    		io.in(client.channel).emit('updateConnectedUsers', users);

    		/* Delete channel from array if 
    		the channel is empty */
    		if(users.length === 0)
    			delete connectedUsers[client.channel];

    		io.in(client.channel).emit('clientDisco', client.username);
			client.leave(client.channel);
    		client.signedIn = false;
  		}
  	});


  	/**
  	* Update connected users
  	*/
  	var updateConnectedUsers = function(channel) {
    	var connectedUsers = [];
	    var connectedSockets = io.clients(channel);
	    console.log('Update connected users: ' + connectedSockets.length);

	    /* Update the connected users array depending on the sockets connected in the channel */
	    for(var connectedSocket in connectedSockets) {
	      connectedUsers.push(connectedSockets[connectedSocket].username);
	    }

	    // Send connected users array to the clients
	    io.in(channel).emit('updateConnectedUsers', connectedUsers);
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
		io.in(client.channel).emit('eraseDrawing');
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
  		// Strip HTML tags
  		message = stripHTML(message);

    	io.in(client.channel).emit('sendMessageToClients', client.username, message);
  	});

});

function stripHTML(string) {
	return string.replace(/<(.|\n)*?>/g, '');
}

