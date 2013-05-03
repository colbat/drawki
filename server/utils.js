

/* ==========================================================================
   Drawki server tools
   ========================================================================== */

var fs = require('fs');
var utils = {};

module.exports = utils;

var saveChannelsFile = function(channelsFilePath, channels) {
	fs.writeFile(channelsFilePath, JSON.stringify(channels, null, 4), function(err) {
	    if(err) {
	      console.log(err);
	    } else {
	      console.log("Channels list updated.");
	    }
	}); 
};

utils.addChannel = function(channelsFilePath, channelNameToAdd) {
	console.log('Creating #' + channelNameToAdd);
	var channelsList = require(channelsFilePath);
	channelsList.push({name: channelNameToAdd, authPassword: this.generateAuthPassword()});
	saveChannelsFile(channelsFilePath, channelsList);
};

utils.getChannel = function(channelsFilePath, channelName) {
	var channelsList = require(channelsFilePath);
	for(var i = 0; i < channelsList.length; i++) {
		if(channelsList[i].name === channelName) {
			return channelsList[i];
		}
	}
	return false;
};

utils.generateAuthPassword = function() {
	//TODO: auth system
	return "Dig3st0f7H3d347h";
};
