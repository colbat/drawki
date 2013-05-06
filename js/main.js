

/* ==========================================================================
   Drawki client side code
   ========================================================================== */

jQuery(function($){

	var iosocket = io.connect("http://drawki.aws.af.cm", {'sync disconnect on unload': true});

	var canvas = $('#drawCanvas');
	var context = canvas[0].getContext('2d');

	var drawing = false;
	var lastX;
	var lastY;
	var lastEmit = $.now();

	/* Configure the canvas */
	var backgroundColor = $('#drawCanvas').css('background-color');

	var drawingSizes = {
		small: 1,
		medium: 4,
		large: 9
	};

	var drawingColors = {
		pencil: "#000000",
		eraser: "#3399cc"
	};


	var drawingOptions;



	/**********************/
	/* Sign in / Sign out */
	/**********************/

	$('#sign-in').on('submit', function(event) {
		event.preventDefault();

		/* Hide sign in and show the drawing board */
		$("#intro-description").hide();
		$("#sign-in-container").hide();
		$("#drawki").fadeIn();

		/* Set up canvas */
		var originalWidth = $('#drawingBoard').width();
		var originalHeight = $('#drawingBoard').height();
		canvas[0].width = originalWidth;
		canvas[0].height = originalHeight;

		/* Set up context */
		context.lineCap = "round";
		
		iosocket.emit('signIn', {
			userName: $('#user-name').val(),
			channelName: $('#channel').val()
		});

		/* Set up color picker */
		$('select[name="colorpicker"]').simplecolorpicker({
	  		picker: true
		}).on('change', function() {
	  		iosocket.emit('changeDrawingColor', $('select[name="colorpicker"]').val());
	  		drawingOptions.color = $('select[name="colorpicker"]').val();
		});
	});


	iosocket.on("userSignedIn", function(username, channel) {
		$("#chat-messages-list").append("<li class='message-item text-success'>" + username + " has signed in.</li>");
	});

	iosocket.on("initOptions", function(defaultDrawingOptions) {
		drawingOptions = defaultDrawingOptions;
	})

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
	* Add points to the path and draw the line
	*/
	var draw = function(origX, origY, destX, destY, drawingOptions) {
		context.strokeStyle = drawingOptions.color;
		context.lineWidth = drawingOptions.size;
		context.moveTo(origX, origY);
		context.lineTo(destX, destY);
		context.stroke();
	};

	canvas.mousedown(function(e) {
		context.beginPath();
		lastX = e.pageX - this.offsetLeft;
		lastY = e.pageY - this.offsetTop;
		iosocket.emit('drawing', lastX, lastY, e.pageX - this.offsetLeft - 1, e.pageY - this.offsetTop);
		iosocket.emit('updateUsersDrawingList');
		draw(lastX, lastY, e.pageX - this.offsetLeft - 1, e.pageY - this.offsetTop, drawingOptions);
		drawing = true;
	});

	canvas.mousemove(function(e) {
		if(drawing) {
			if($.now() - lastEmit > 20) {
				iosocket.emit('drawing', lastX, lastY, e.pageX - this.offsetLeft, e.pageY - this.offsetTop);
				draw(lastX, lastY, e.pageX - this.offsetLeft, e.pageY - this.offsetTop, drawingOptions);
				lastEmit = $.now();
				lastX = e.pageX - this.offsetLeft;
				lastY = e.pageY - this.offsetTop;
			}
		}
	});

	canvas.mouseup(function(e) {
		if(drawing) {
			iosocket.emit('updateUsersDrawingList');
			iosocket.emit('resetPath');
			drawing = false;
		}
	});

	canvas.mouseleave(function(e) {
		if(drawing) {
			iosocket.emit('updateUsersDrawingList');
			iosocket.emit('resetPath');
			drawing = false;
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

	iosocket.on('drawing', function(origX, origY, destX, destY, drawingOptions) {
		draw(origX, origY, destX, destY, drawingOptions);
	});

	iosocket.on('eraseDrawing', function() {
		context.clearRect(0, 0, canvas[0].width, canvas[0].height);
		context.beginPath();
	});

	iosocket.on('resetPath', function() {
		context.beginPath();
	})


	/**
	* Display a new notification when the list of the users, who are
	* currently drawing, is updated.
	*/
	iosocket.on('updateUsersDrawingList', function(usersCurrentlyDrawing) {
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
	});



	/*********************/
	/* Draw Tool buttons */
	/*********************/

	$('#clearButton').click(function() {
		context.clearRect(0, 0, canvas[0].width, canvas[0].height);
		iosocket.emit('eraseDrawing');
	});

	$('#eraserButton').click(function() {
		iosocket.emit('changeDrawingColor', drawingColors.eraser);
		drawingOptions.color = drawingColors.eraser;
		$('#pencilButton').removeClass('disabled');
		$(this).addClass('disabled');
	});

	$('#pencilButton').click(function() {
		iosocket.emit('changeDrawingColor', $('select[name="colorpicker"]').val());
		drawingOptions.color = $('select[name="colorpicker"]').val();
		$('#eraserButton').removeClass('disabled');
		$(this).addClass('disabled');
	});

	$('.dropdown-menu .small').click(function() {
		iosocket.emit('changeDrawingSize', drawingSizes.small);
		drawingOptions.size = drawingSizes.small;
		$('.dropdown-menu li').removeClass('active');
		$(this).addClass('active');
	});

	$('.dropdown-menu .medium').click(function() {
		iosocket.emit('changeDrawingSize', drawingSizes.medium);
		drawingOptions.size = drawingSizes.medium;
		$('.dropdown-menu li').removeClass('active');
		$(this).addClass('active');
	});

	$('.dropdown-menu .large').click(function() {
		iosocket.emit('changeDrawingSize', drawingSizes.large);
		drawingOptions.size = drawingSizes.large;
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