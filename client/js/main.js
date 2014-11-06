

/* ==========================================================================
   Drawki client side code
   ========================================================================== */

jQuery(function($){

	var iosocket = io.connect("http://drawki.aws.af.cm", {'sync disconnect on unload': true});
	//var iosocket = io.connect("http://192.168.1.15:1337", {'sync disconnect on unload': true});

	var canvas = $('#drawCanvas');
	var context = canvas[0].getContext('2d');

	var drawing = false;
	var lastX;
	var lastY;
	var lastEmit = $.now();
	var usersCurrentlyDrawing = [];

	var backgroundColor = $('#drawCanvas').css('background-color');

	var drawingSizes = {
		small: 2,
		medium: 4,
		large: 9
	};

	var localDrawingOptions = {
		color: "#000000",
		size: drawingSizes.medium
	};

	/**********************/
	/* Sign in / Sign out */
	/**********************/

	$('#sign-in').on('submit', function(event) {
		event.preventDefault();

		/* Displays the drawing board */
		$("#intro-description").hide();
		$("#sign-in-container").hide();
		$("#drawki").fadeIn();

		/* Canvas settings */
		var originalWidth = $('#drawingBoard').width();
		var originalHeight = $('#drawingBoard').height();
		canvas[0].width = originalWidth;
		canvas[0].height = originalHeight;

		/* Context settings */
		context.lineCap = "round";
		
		iosocket.emit('signIn', {
			userName: $('#user-name').val(),
			channelName: $('#channel').val()
		});

		/* Color picker settings */
		$('select[name="colorpicker"]').simplecolorpicker({
	  		picker: true
		}).on('change', function() {
	  		localDrawingOptions.color = $('select[name="colorpicker"]').val();
		});
	});


	iosocket.on("userSignedIn", function(username, channel) {
		$("#chat-messages-list").append("<li class='message-item text-success'>" + username + " has signed in.</li>");
	});

	iosocket.on("updateConnectedUsers", function(connectedUsers) {
		$("#number-of-users").text(connectedUsers.length);
	});


	iosocket.on("clientDisco", function(username) {
		$("#chat-messages-list").append("<li class='message-item text-error'>" + username + " has signed out.</li>");
	});



	/***********/
	/* Drawing */
	/***********/

	/**
	* Adds points to the path and draws the line using
	* the specified drawing options
	*/
	var draw = function(origX, origY, destX, destY, drawingOptions) {
		context.strokeStyle = drawingOptions.color;
		context.lineWidth = drawingOptions.size;
		context.beginPath();
		context.moveTo(origX, origY);
		context.lineTo(destX, destY);
		context.stroke();
	};

	var drawCommands = [];
	var processDrawQueue = null;
	var timeInterval = 10;

	var startProcessingDrawQueue = function() {
		if(!processDrawQueue) {
			processDrawQueue = setInterval(processDrawCommand, timeInterval);
		}
	};

	var stopProcessingDrawQueue = function() {
		if(processDrawQueue) {
			clearInterval(processDrawQueue);
			processDrawQueue = null;
		}
	};

	/**
	* Processes each draw command
	*/
	var processDrawCommand = function() {
		if(drawCommands.length === 0) {
			stopProcessingDrawQueue();
			return;
		}

		var drawCommand = drawCommands.pop();
		
		draw(drawCommand.origX,
				drawCommand.origY,
				drawCommand.destX,
				drawCommand.destY,
				drawCommand.drawingOptions);
	};



	/****************/
	/* Mouse events */
	/****************/

	canvas.mousedown(function(e) {
		lastX = e.pageX - this.offsetLeft;
		lastY = e.pageY - this.offsetTop;

		var drawCommand = {
			origX: lastX,
			origY: lastY,
			destX: lastX - 1,
			destY: lastY,
			drawingOptions: localDrawingOptions
		};

		iosocket.emit('drawCommand', drawCommand);

		drawCommands.unshift(drawCommand);
		startProcessingDrawQueue();
		
		drawing = true;
	});

	canvas.mousemove(function(e) {
		if(drawing) {
			if($.now() - lastEmit > 20) {
				var drawCommand = {
					origX: lastX,
					origY: lastY,
					destX: e.pageX - this.offsetLeft,
					destY: e.pageY - this.offsetTop,
					drawingOptions: localDrawingOptions
				};

				iosocket.emit('drawCommand', drawCommand);

				drawCommands.unshift(drawCommand);
				startProcessingDrawQueue();
				
				lastX = e.pageX - this.offsetLeft;
				lastY = e.pageY - this.offsetTop;

				lastEmit = $.now();
			}
		}
	});

	canvas.mouseup(function(e) {
		if(drawing) {
			drawing = false;
			iosocket.emit('userStoppedDrawing');
		}
	});

	canvas.mouseleave(function(e) {
		if(drawing) {
			drawing = false;
			iosocket.emit('userStoppedDrawing');
		}
	});



	/****************/
	/* Touch events */
	/****************/

	$("#drawCanvas").on('touchstart', function(e) {
		e.preventDefault();

		lastX = e.originalEvent.touches[0].pageX - this.offsetLeft;
		lastY = e.originalEvent.touches[0].pageY - this.offsetTop;

		var drawCommand = {
			origX: lastX,
			origY: lastY,
			destX: lastX - 1,
			destY: lastY,
			drawingOptions: localDrawingOptions
		};

		iosocket.emit('drawCommand', drawCommand);

		drawCommands.unshift(drawCommand);
		startProcessingDrawQueue();
		
		drawing = true;
	});

	$("#drawCanvas").on('touchmove', function(e) {
		e.preventDefault();

		if(drawing) {
			if($.now() - lastEmit > 20) {
				var drawCommand = {
					origX: lastX,
					origY: lastY,
					destX: e.originalEvent.touches[0].pageX - this.offsetLeft,
					destY: e.originalEvent.touches[0].pageY - this.offsetTop,
					drawingOptions: localDrawingOptions
				};

				iosocket.emit('drawCommand', drawCommand);
				
				drawCommands.unshift(drawCommand);
				startProcessingDrawQueue();
				
				lastX = e.originalEvent.touches[0].pageX - this.offsetLeft;
				lastY = e.originalEvent.touches[0].pageY - this.offsetTop;

				lastEmit = $.now();
			}
		}
	});

	$("#drawCanvas").on('touchend', function(e) {
		if(drawing) {
			drawing = false;
			iosocket.emit('userStoppedDrawing');
		}
	});




	iosocket.on('requestCurrentDrawing', function() {
        iosocket.emit('sendCurrentDrawing', canvas[0].toDataURL());
	});

	iosocket.on('sendCurrentDrawing', function(currentDrawingImageDataURL) {
		var currentDrawingImage = new Image();
        currentDrawingImage.src = currentDrawingImageDataURL;
		currentDrawingImage.onload = function() {
          context.drawImage(this, 0, 0);
        };
	});

	iosocket.on('drawCommand', function(drawCommand) {
		var username = drawCommand.username;

		if(usersCurrentlyDrawing.indexOf(username) < 0) {
			usersCurrentlyDrawing.push(username);
			updateUsersDrawing();
		}

		drawCommands.unshift(drawCommand);
		startProcessingDrawQueue();
	});

	iosocket.on('eraseDrawing', function() {
		context.clearRect(0, 0, canvas[0].width, canvas[0].height);
		context.beginPath();
	});

	iosocket.on('userStoppedDrawing', function(username) {
		var index = usersCurrentlyDrawing.indexOf(username);
		usersCurrentlyDrawing.splice(index, 1);
		updateUsersDrawing();
	});


	/**
	* Displays a new notification when the list of the users who are
	* currently drawing is updated.
	*/
	function updateUsersDrawing() {
		$('#notifications').text('');
		switch(usersCurrentlyDrawing.length) {
			case 1:
				$('#notifications').text(
					usersCurrentlyDrawing[0] + ' is drawing...'
					);
				break;

			case 2: 
				$('#notifications').text(
					usersCurrentlyDrawing[0] + ' and ' + 
					usersCurrentlyDrawing[1] + ' are drawing...'
					);
				break;

			case 3:
				('#notifications').text(
					usersCurrentlyDrawing[0] + ', ' + 
					usersCurrentlyDrawing[1] + ' and ' + 
					usersCurrentlyDrawing.length - 2 + ' other people are drawing...'
					);
				break;
		}
	}



	/*********************/
	/* Draw Tool buttons */
	/*********************/

	$('#clearButton').click(function() {
		context.clearRect(0, 0, canvas[0].width, canvas[0].height);
		iosocket.emit('eraseDrawing');
	});

	$('#eraserButton').click(function() {
		localDrawingOptions.color = backgroundColor;
		$('#pencilButton').removeClass('disabled');
		$(this).addClass('disabled');
	});

	$('#pencilButton').click(function() {
		localDrawingOptions.color = $('select[name="colorpicker"]').val();
		$('#eraserButton').removeClass('disabled');
		$(this).addClass('disabled');
	});

	$('.dropdown-menu .small').click(function() {
		localDrawingOptions.size = drawingSizes.small;
		$('.dropdown-menu li').removeClass('active');
		$(this).addClass('active');
	});

	$('.dropdown-menu .medium').click(function() {
		localDrawingOptions.size = drawingSizes.medium;
		$('.dropdown-menu li').removeClass('active');
		$(this).addClass('active');
	});

	$('.dropdown-menu .large').click(function() {
		localDrawingOptions.size = drawingSizes.large;
		$('.dropdown-menu li').removeClass('active');
		$(this).addClass('active');
	});



	/********/
	/* Chat */
	/********/

	$('#message-to-send').keypress(function(e) {
		if(e.which === 13) {
			iosocket.emit('sendMessage', $('#message-to-send').val());
			$('#message-to-send').val('');
		}
	});

	iosocket.on("sendMessageToClients", function(username, message) {
		$("#chat-messages-list").append("<li class='message-item'>" + username + ": " + message + "</li>");
		$("#chat-messages").animate({scrollTop: $("#chat-messages").prop('scrollHeight')}, 50);
	});



	/*********/
	/* Tools */
	/*********/

	/*
	function rgb2hex(rgb) {
 		rgb = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
 		return "#" +
  			("0" + parseInt(rgb[1],10).toString(16)).slice(-2) +
  			("0" + parseInt(rgb[2],10).toString(16)).slice(-2) +
  			("0" + parseInt(rgb[3],10).toString(16)).slice(-2);
	}
	*/

});