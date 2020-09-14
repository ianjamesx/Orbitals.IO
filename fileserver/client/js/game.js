
"use strict";

/*

most globals defined here, all other globals are:

-Game 'closure', Visuals 'closure', GameUI 'closure' (notice quotations, they're not real closures)
-Player class, Enemy class, Electron class, Neutron class

NOTE:

notifications currently not in use due to display errors

*/

var players = {},
		electrons = {},
		neutrons = {},
		graphicsCache = {},
		imageCache = {},
		intervals = {},
		textFields = {},
		containers = {},
		settings = {},
		colorData = {},
		gameStage,
		cacheStage,
		titleStage,
		socket,
		servers = {

			local: {ip: 'http://localhost:8080', location: 'local server'}
			/*eu: {ip: 'http://178.62.251.251:8080', location: 'Amsterdam, Netherlands'},
			in: {ip: 'http://206.189.130.217:8080', location: 'Bangalore, India'},
			ny: {ip: 'http://206.189.200.44:8080', location: 'New York City, US'},
			ca: {ip: 'http://178.128.180.135:8080', location: 'San Francisco, US'}*/

		};

var Game = {

	 	//id of main player
		main: 0,

		//screen resolution
		xMax: 0,
		yMax: 0,

		//native game resolution
		xNative: 1920,
		yNative: 1080,

		//standard resolution
		xStandard: 1920,
		yStandard: 1080,

		//integer to represent graphics quality setting
		//currently not in use in this version
		quality: 0,

		//scaling accounting for resolution
		scaleFactor: 1,

		//mouse location
		mouseX: 0,
		mouseY: 0,

		currentScreen: 0,

		//latency data
		networkOffsetArray: [],
		latency: 0,

		//if user is on game screen
		focus: true,

		//if player is available to join game (at main menu)
		available: false,

		//for player choosing a skin
		userColor: 0,
		imgTotal: 6,

		//font used for canvas text
		font: 'Roboto',

		//size of the game area
		arenaSize: 15000,

		//background color of game canvas
		backgroundColor: '#090909',

		//how many players to show in leaderboard
		leaderboardCount: 7,

		//zoom (will zoom out if they acquire electrons)
		zoom: 1,

		//frames per second
		fps: 66,

		findGameServer: function(){

			//open sockets first

			var i;

			for(i in servers){

				servers[i].socket = io(servers[i].ip);

			}

			//then send latency packets once connections are established

			for(i in servers){

				Game.testSocket(servers[i].socket, i);

			}

		},

		testSocket: function(tempSocket, id){

			var beforeSending = Date.now(), lag;

			tempSocket.emit('hi');

			tempSocket.on('hi', function(){

				var afterSending = Date.now();

				lag = afterSending - beforeSending;

				servers[id].lag = lag;

				//if we already found a socket, then close it
				//if not, then its the first socket to reply, use it as
				//our game server

				if(!socket){

					Game.connectToSocket(id);

				} else {

					Game.closeSocket(id);

				}

			});

		},

		connectToSocket: function(id){

			socket = servers[id].socket;

			console.log('connected to server ' + servers[id].location + ', lag: ' + servers[id].lag + 'ms');

			Game.init();

		},

		closeSocket: function(id){

			servers[id].socket.close();

			console.log('latency to ' + servers[id].location + ' : ' + servers[id].lag + 'ms');

		},

		detectMobile: function(){

		 if( navigator.userAgent.match(/Android/i)
				 || navigator.userAgent.match(/webOS/i)
				 || navigator.userAgent.match(/iPhone/i)
				 || navigator.userAgent.match(/iPad/i)
				 || navigator.userAgent.match(/iPod/i)
				 || navigator.userAgent.match(/BlackBerry/i)
				 || navigator.userAgent.match(/Windows Phone/i)){

		   	alert('Hello! It appears you are on a mobile device, currently there is no mobile version of the game, we will have a dedicated mobile app in the works soon');

		  }

		},

		init: function(){

			Visuals.setupCanvas();

			//GameUI.setCanvasBlur('blur(12px)');

			createjs.Touch.enable(cacheStage);

			Game.xMax = window.innerWidth;
			Game.yMax = window.innerHeight;

			GameUI.defaultSettings();

			//request id from server once everything is setup
			//we expect to recieve 'id' in servComm.js

			Game.setServHandlers();

			Game.detectMobile();

			socket.emit('join');

		},

		setupGameData: function(data){

			//creaete main player object

			var id = data.id;

			players[id] = new Player(id);

			Game.main = id;
			Game.arenaSize = data.arena;

			createjs.Ticker.framerate = 66;
			createjs.Ticker.addEventListener("tick", Game.gameLoop);

			//initiate graphics

			Visuals.setBounds();
			Visuals.graphicsRender();
			Visuals.imgLoader();

			//window event handlers and intervals

			window.addEventListener("resize", Game.handleResize);
			window.addEventListener("focus", Game.handleFocus);
			window.addEventListener("blur", Game.handleBlur);

			//initial viewpoint

			players[id].xView = containers.gameHolder.x = -1000 + (Game.xMax/2);
			players[id].yView = containers.gameHolder.y = -1000 + (Game.yMax/2);

			//start latency tracking

			Game.sendNetworkPing();

			//resize canvas

			Game.handleResize();

			//randomly generate first skin

			Game.userColor = Math.floor(Math.random() * (Game.imgTotal + 1));
	    GameUI.displayImg();

			Game.startInstructions();

			//tell server were loaded

			socket.emit('loaded');

		},

		startInstructions: function(){

			GameUI.resetInstructions();

			var i;

			for(i in intervals){

				clearInterval(intervals[i]);

			}

			intervals.instructions = setInterval(GameUI.changeInstructions, 6000);

		},

		gameLoop: function(event){

			//track fps (if user prefered)

			if(settings.showFps){

				textFields["fps"].text = "fps - " + Math.round(createjs.Ticker.getMeasuredFPS());

			}

			//call all position updaters at same time, then update stage
			//the reason for calling all position updates at the same time is
			//to ensure some elements dont move around on different intervals
			//which, for orbiting electrons in specific, may look strange

			Game.updatePlayerPositions();
			Game.updateParticlePositions();

			gameStage.update(event);

			//titleStage.update();

		},

		updatePlayerPositions: function(){

			var i;

			if(players[Game.main].alive){

				players[Game.main].updatePosition();

			}

			if(players[Game.main].camera){

				players[Game.main].updateCameraPosition(containers.gameHolder);

			}

			for(i in players){

				//enemy player

				if(i != Game.main){

					players[i].updatePosition();

				}

			}

		},

		updateParticlePositions: function(){

			var i;

			for(i in electrons){

				if(electrons[i].origin === -1){

					//non orbit

					electrons[i].mainMove();

				} else {

					//orbit

					electrons[i].deltaOrbit();

				}

			}

			for(i in neutrons){

				neutrons[i].move();

			}

		},

		sendMousePos: function(){

			var buffer = new ArrayBuffer(4);
			var dataView = new Int16Array(buffer);

			dataView[0] = Math.trunc(Game.mouseX);
			dataView[1] = Math.trunc(Game.mouseY);

			socket.send(dataView);

		},

		fire: function(){

			socket.emit('f');

			if(players[Game.main].orbitCount > 0){

				players[Game.main].orbitCount--;

				Visuals.updateOrbit();

			}

		},

		mouseLoc: function(event){

			Game.mouseX = event.stageX - Game.xMax/2;
			Game.mouseY = event.stageY - Game.yMax/2;

		},

		bufferToArray(dataView){

			var i, arr = [];

			for(i in dataView){

				arr.push(dataView[i]);

			}

			return arr;

		},

		scaleArena: function(zoom, time){

			//time is optional
			//if not provided, then calculate here

			if(!time){

				time = Math.abs(Game.zoom - zoom) * 20000;

			}

			createjs.Tween.removeTweens(containers.gameHolder);
			createjs.Tween.removeTweens(Game);

      createjs.Tween.get(containers.gameHolder).to({scale: zoom}, time, createjs.Ease.cubicOut);
      createjs.Tween.get(Game).to({zoom: zoom}, time, createjs.Ease.cubicOut);

		},

		eliminated: function(){

			//disable mouse, and fire input

			cacheStage.removeEventListener("stagemousemove", Game.mouseLoc);
			cacheStage.removeEventListener("stagemouseup", Game.fire);

			Game.mouseX = 0;
			Game.mouseY = 0;

			//raise packet time

			Game.servDelay = 200;

			//reset player

			players[Game.main].reset();
			Visuals.updateOrbit();

			//bring up respawn nav

			setTimeout(function(){

				GameUI.toggleScreen(GameUI.statsMenu, 600);

			}, 1200);

			//stop the camera zooming

			createjs.Tween.removeTweens(containers.gameHolder);
			createjs.Tween.removeTweens(Game);

		},

		//getLatency, used for finding time individual packets took to send
		//used for interpolation, as next packet to send from server will most
		//likely have similar or equal latency

		getLatency: function(serverTime){

			var now = Date.now(), then = serverTime, lag;

			//offsetDir: 0 - client time is ahead of server, 1 - server time is ahead of client

		  Game.offsetDir === 0 ?
				lag = (now - Game.offset) - then:
				lag = (then - Game.offset) - now;

			//lag cannot be negative

		  if(lag < 0){

				lag = 0;

		  }

			return lag;

		},

		//for finding time offset between server and client

		//networkOffsetArray, holds objects containing the time offset between
		//the server and client, and the direction of the offset
		//direction referring to if server is ahead of client, or client ahead of server in terms of time

		sendNetworkPing: function(){

		  Game.commLatency = Date.now();

		  socket.emit('se');

			//expect to recieve 're' from server in servComm.js

		},

		pushLatencyData: function(data){

			var difference, direction;

			//client time is ahead of server time, set direction to 0

			if(Game.clientTime > (data - Game.commLatency)){

				difference = Game.clientTime - (data - Game.commLatency);
				direction = 0;

			} else {

				//server time is ahead of client time

				difference = (data - Game.commLatency) - Game.clientTime;
				direction = 1;

			}

			var tempObj = {

				diff: difference,
				dir: direction

			 };

			Game.networkOffsetArray.push(tempObj);

			if(Game.networkOffsetArray.length < 5){

				Game.sendNetworkPing();

				//we have an array of five times, adequet to find average

			} else {

				Game.findNetworkTimeAvg();

			}

		},

		//findNetworkTimeAvg() is called when networkOffsetArray has five values
		//Game.offset, time in ms of which either client time is ahead of server, or server time is ahead of client
		//Game.offsetDir, 0 means client time is ahead of server, 1 means server time is ahead of client

		findNetworkTimeAvg: function(){

		  var i, d = Game.networkOffsetArray.length, servTotal = 0, clientTotal = 0, dirServ = 0, dirClient = 0;

		  //find totals for both, client and server time totals

		  for(i = 0; i < d; i++){

		    if(Game.networkOffsetArray[i].dir === 0){

		      dirClient++;
		      clientTotal += Game.networkOffsetArray[i].diff;

		    } else {

		      dirServ++;
		      servTotal += Game.networkOffsetArray[i].diff;

		    }

		  }

		  //if client had more times ahead of server

		  if(dirClient > dirServ){

		    Game.offset = clientTotal/dirClient;
		    Game.offsetDir = 0;

		  } else {

		    //if server had more times ahead of client

		    Game.offset = servTotal/dirServ;
		    Game.offsetDir = 1;

		  }

		  //clear array for next test

		  Game.networkOffsetArray = [];

		},

		initElectrons: function(electronDataMatrix){

			//recieve a new 2d array of electrons to put on screen, remove all old ones

			containers.electronHolder.removeAllChildren();
			electrons = {};

			//add new ones

			var i, d = electronDataMatrix.length;

			for(i = 0; i < d; i++){

				//shorter array signifies a free electron
				//longer array signifies an electron in orbit

				 if(electronDataMatrix[i].length === 6){

					 Game.createFreeElectron(electronDataMatrix[i]);

				 } else {

					 Game.createOrbitalElectron(electronDataMatrix[i]);

				}

			}

		},

		createFreeElectron: function(dataArray){

			var xc = dataArray[0],
					yc = dataArray[1],
					dx = dataArray[2],
					dy = dataArray[3],
					id = dataArray[4],
					color = dataArray[5];

			//if there is no electron on stage with that id, create a new one

			if(electrons[id]){

				electrons[id].remove();

			}

			var electron = new Electron(id, xc, yc, dx, dy, color);

			electron.render();
			electron.mainMove();

			electrons[id] = electron;

		},

		createOrbitalElectron: function(dataArray){

			var xc = dataArray[0],
					yc = dataArray[1],
					dx = dataArray[2],
					dy = dataArray[3],
					id = dataArray[4],
					dirIncrement = dataArray[5],
					cw = dataArray[6],
					dist = dataArray[7],
					dir = dataArray[8],
					origin = dataArray[9],
					color = dataArray[10];

			if(electrons[id]){

	  		electrons[id].remove();

	  	}

			var electron = new Electron(id, xc, yc, dx, dy, color);

			electron.render();
		 	electron.init();
			electron.orbit(dirIncrement, cw, dist, dir, origin, color, dx, dy);
			electron.removeStamp = false;

			electrons[id] = electron;

		},

		initNeutrons: function(neutronDataMatrix){

			containers.neutronHolder.removeAllChildren();
			neutrons = {};

			var i, n = neutronDataMatrix.length;

			for(i = 0; i < n; i++){

				Game.createNeutron(neutronDataMatrix[i]);

			}

		},

		createNeutron(dataArray){

			var xc = dataArray[0], yc = dataArray[1],
					dx = dataArray[2], dy = dataArray[3],
					id = dataArray[4];

			if(neutrons[id]){

				neutrons[id].xc = xc;
				neutrons[id].yc = yc;

			} else {

				var neutron = new Neutron(xc, yc, dx, dy, id);

				neutron.render();

				neutrons[id] = neutron;

			}

		},

		initEnemies: function(playerDataMatrix){

			var i, n = playerDataMatrix.length;

			for(i = 0; i < n; i++){

				Game.createEnemy(playerDataMatrix[i]);

			}

		},

		resetEnemies: function(){

			var i;

			for(i in players){

				if(i != Game.main){

					delete players[i];

				}

			}

			containers.playerHolder.removeAllChildren();
			containers.nameHolder.removeAllChildren();

			//Game.compareGraphicsToData(containers.playerHolder, players);
			//Game.compareGraphicsToData(containers.nameHolder, players);

		},

		/*

		following methods with keyword 'mark' will append serverMatch
		property to certain objects

		if object does not have property enabled by end of server update
		then it is assumed we should remove the object

		*/

		/*

		markElectrons: function(){

			var i;

			for(i in electrons){

				electrons[i].serverMatch = false;

			}

		},

		markNeutrons: function(){

			var i;

			for(i in neutrons){

				neutrons[i].serverMatch = false;

			}

		},

		markPlayers: function(){

			var i;

			for(i in players){

				if(i != Game.main){

					players[i].serverMatch = false;

				}

			}

		},

		deleteUnMarkedElectrons: function(){

			var i;

			for(i in electrons){

				if(!electrons[i].serverMatch){

					electrons[i].remove();

				}

			}

		},

		deleteUnMarkedNeutrons: function(){

			var i;

			for(i in neutrons){

				if(!neutrons[i].serverMatch){

					neutrons[i].clear(-1);

				}

			}

		},

		deleteUnMarkedPlayers: function(){

			var i;

			for(i in players){

				if(i != Game.main){

					players[i].remove();

				}

			}

		},
		*/
		createEnemy: function(data){

			var name = data[0], color = data[1], id = data[2], xc = data[3], yc = data[4],
					localEnem = new Enemy(name, color, id, xc, yc);

			if(!players[id]){

				localEnem.render();

			  players[id] = localEnem;

				return localEnem;

			} else {

				return players[id];

			}

		},

		hideNames: function(){

			var i;

			for(i in players){

				if(i != Game.main){

					players[i].nameHidden = true;
					players[i].removeName();

				}

			}

			players[Game.main].txt = "";

			Game.clearNames();

		},

		showNames: function(){

			var i;

			for(i in players){

				if(i != Game.main){

					players[i].nameHidden = false;
					players[i].renderName();

				}

			}

			players[Game.main].txt = players[Game.main].name;

		},

		clearNames: function(){

			containers.nameHolder.removeAllChildren();

		},

		handleBlur: function(){

			Game.focus = false;

		},

		handleFocus: function(){

			//player refocuses, electrons in orbit may be out of place
			//request their new position

			Game.focus = true;

			var i;

			if(players[Game.main].alive){

				//ensure that all electrons are correct color

				for(i in electrons){

					electrons[i].correctColor();
					electrons[i].alpha = 1;

				}

			}

		},

		testOnStageGraphics: function(){

			if(Game.focus){

				Game.compareGraphicsToData(containers.electronHolder);
				//Game.orbitalColorCorrection();

			}

		},

		compareGraphicsToData: function(grapicsContainer){

			var i;

			for(i = 0; i < grapicsContainer.numChildren; i++){

				var child = grapicsContainer.getChildAt(i);

				var xc = child.x, yc = child.y;

				if(xc === 0 && yc === 0){

					child.count++;

					child.x = -5000;

					if(child.count > 10){

						grapicsContainer.removeChild(child);

					}

				}

			}

		},

		orbitalColorCorrection: function(){

			var i;

			for(i in electrons){

				if(electrons[i].origin !== -1){

					var origin = electrons[i].origin;

					if(players[origin]){

						var correctColor = players[origin].color;

						electrons[i].color = correctColor;

						electrons[i].correctColor();

					}

				}

			}

		},

	  joinGame: function(){

			Game.available = false;
			Game.handleSettings();
			GameUI.getUserName();
			Game.currentScreen = -1;

			Game.resetEnemies();

			//set zoom out a little so we have zooming effect on respawn

			containers.gameHolder.scale = .75;
			Game.zoom = .75;

			//pause instructions

			clearInterval(intervals.instructions);

	    socket.emit('start', {

	      name: players[Game.main].name,
	      color: Game.userColor

	    });

			Game.startIntervals();

			//color match leaderboard place to users color

			textFields["mainPlayer"].color = Visuals.getCSSColor(Game.userColor);

			cacheStage.update();

	  },

		handleSettings: function(){

			//call settings methods in GameUI

			GameUI.handleFPSSettings();
			GameUI.handleNameSettings();
			GameUI.handleBoardSettings();
	    //GameUI.handleQualitySettings();

		},

		startIntervals: function(){

			players[Game.main].started = true;

			//start intervals if this is first time respawing

			intervals.electron = setInterval(Game.testOnStageGraphics, (1000/60));
			intervals.latency = setInterval(Game.sendNetworkPing, 5000);
			intervals.send = setInterval(Game.sendMousePos, (1000/20));

		},


		/*

		resizing canvas

		*/

		setResolutionScaling: function(){

			Game.scaleFactor = Game.xNative / Game.xStandard;

			this.handleResize();

		},

		handleResize: function(){

			  //first, reset canvas size

			  Game.setCanvasSize();

			  //then update textfields

			  var ratio = Game.xNative/Game.yNative,

			      windowRatio = Game.xMax/Game.yMax,

			      scale = Game.xMax/Game.xNative;

			 	if(windowRatio > ratio){

				  scale = Game.yMax/Game.yNative;

				}

			  Game.scaleTextFields(scale);

			  //update gameStage, and update cacheStage if player has started game

				gameStage.update();

				if(players[Game.main].started){

				  cacheStage.update();

				}

				//update notification locations
/*
				var n = notifications.length, i;

			  for(i = 0; i < n; i++){

					notifications[i].x = Game.xMax/24;
					notifications[i].y = Game.yMax/1.2 - (((n - i) - 1) * 25);

				}
*/
			  //send res to server

				socket.emit('res', {

					xMax: Game.xMax,
					yMax: Game.yMax

				});

		 },

		 setCanvasSize: function(){

		    //the goal: have canvas max resolution
		    //yet keep the canvas fullscreen at all times

		    var nativeGameWidth = Game.xNative,
		        nativeGameHeight = Game.yNative,
		        deviceWidth = window.innerWidth,
		        deviceHeight = window.innerHeight,
		        renderScale = Math.max(deviceWidth/nativeGameWidth, deviceHeight/nativeGameHeight);

		    Game.xMax = Math.floor(deviceWidth/renderScale);
			  Game.yMax = Math.floor(deviceHeight/renderScale);

			  gameCanvas.width = hudCanvas.width = Game.xMax;
			  gameCanvas.height = hudCanvas.height = Game.yMax;

			  gameCanvas.style.width = hudCanvas.style.width = '100%';
			  gameCanvas.style.height = hudCanvas.style.height = '100%';

		 },

		 scaleTextFields: function(scale){

		    var spacing = Game.yMax/42;
				var font = Game.font;

				var resolutionScale = Game.xNative/1920;

		    //size scaling

			  textFields["orbit"].font = 2.25*scale*resolutionScale + "em " + font;
			  textFields["scoreAmount"].font = 1.8*scale*resolutionScale + "em " + font;
			  textFields["mainPlayer"].font = .85*scale*resolutionScale + "em " + font;
			  textFields["playerOnlineLabel"].font = 1.5*scale*resolutionScale + "em " + font;
			  textFields["playersOnline"].font = 1.5*scale*resolutionScale + "em " + font;
			  textFields["userAlert"].font = 1.5*scale*resolutionScale + "em " + font;
				textFields["fps"].font = 1.2*scale*resolutionScale + "em " + font;
				textFields["latency"].font = 1.2*scale*resolutionScale + "em " + font;

		    //placement

				textFields["orbit"].x = Game.xMax/1.025;
				textFields["orbit"].y = Game.yMax/14;
				textFields["scoreAmount"].x = Game.xMax/1.025;
			 	textFields["scoreAmount"].y = Game.yMax/4;
				textFields["mainPlayer"].x = Game.xMax/24;
				textFields["mainPlayer"].y = Game.yMax/14;
				textFields["userAlert"].x = Game.xMax/2;
				textFields["userAlert"].y = Game.yMax/1.15;
				textFields["fps"].x = Game.xMax/1.025;
				textFields["fps"].y = Game.yMax/1.125;
				textFields["latency"].x = Game.xMax/1.025;
				textFields["latency"].y = Game.yMax/1.2;

				//leaderboard textfields

				var i, leaderBoardArr = textFields["leaderboard"];

				for(i = 0; i < Game.leaderboardCount; i++){

					leaderBoardArr[i].x = Game.xMax/24;
					leaderBoardArr[i].y = Game.yMax/14 + spacing * (i + 1);

					leaderBoardArr[i].font = .85*scale*resolutionScale + "em " + font;

				}

		 }

	};

	var Visuals = {

		addColorData: function(){

			colorData["blue"] = {

				electron: {r: 0, g: 100, b: 210},
				expl: [{r: 55, g: 150, b:255}, {r: 45, g: 75, b:255}, {r:40 , g: 90, b:240}],
				blur: {r: 0, g: 88, b:230}

			};

			colorData["red"] = {

				electron: {r: 180, g: 0, b: 0 },
				expl: [{r: 225, g: 75, b:75}, {r: 230, g: 20, b:20}, {r:255 , g: 0, b:0}],
				blur: {r: 180, g: 0, b:0}

			};

			colorData["purple"] = {

				electron: {r: 118, g: 25, b:197},
				expl: [{r: 140, g: 90, b:220}, {r: 143, g: 42, b:228}, {r:100 , g: 60, b:220}],
				blur: {r: 147, g: 75, b:212}

			};

			colorData["green"] = {

				electron: {r: 65, g: 140, b: 40},
				expl: [{r: 50, g: 160, b:100}, {r: 65, g: 130, b:50}, {r:50 , g: 150, b:100}],
				blur: {r: 50, g: 160, b:100}

			};

			colorData["lightblue"] = {

				electron: {r: 112, g: 185, b: 213},
				expl: [{r: 112, g: 185, b:213}, {r: 150, g: 179, b:219}, {r:150 , g: 179, b:219}],
				blur: {r: 112, g: 185, b:213}

			};

			colorData["orange"] = {

				electron: {r: 255, g: 105, b: 79},
				expl: [{r: 255, g: 150, b:89}, {r: 255, g: 105, b:79}, {r:255 , g: 105, b:79}],
				blur: {r: 255, g: 150, b:89}

			};

			colorData["gold"] = {

				electron: {r: 255, g: 207, b: 34},
				expl: [{r: 255, g: 207, b:34}, {r: 255, g: 154, b:28}, {r:255 , g: 154, b:28}],
				blur: {r: 255, g: 207, b:3}

			};

		},

		explGraphic: function(colorArr, radius){

			var color1 = Visuals.RGBtoString(colorArr[0], 1),
					color2 = Visuals.RGBtoString(colorArr[1], 1),
					color3 = Visuals.RGBtoString(colorArr[2], 0);

		  var expl = new createjs.Graphics().beginRadialGradientFill([color1, color2, color3],
		    [.2, .7, 1], 0, 0, 0, 0, 0, radius).drawCircle(0, 0, radius);

		  return expl;

		},

		electronGraphic: function(colorObj, radius){

			var color1 = Visuals.RGBtoString(colorObj, 1),
					color2 = Visuals.RGBtoString(colorObj, 0);

		  var blur = new createjs.Graphics().beginRadialGradientFill([color1, color2],
		    [0, 1], 0, 0, 0, 0, 0, radius).drawCircle(0, 0, radius);

		  return blur;

		},

		lensflareGraphic: function(colorObj, radius){

			var color1 = Visuals.RGBtoString(colorObj, .45),
					color2 = Visuals.RGBtoString(colorObj, 0);

		  var blur = new createjs.Graphics().beginRadialGradientFill([color1, color2],
		    [0, 1], 0, 0, 0, 0, 0, radius).drawCircle(0, 0, radius);

		  return blur;

		},

		RGBtoString(color, alpha){

			return 'rgba(' + color.r + ',' + color.g + ',' + color.b + ',' + alpha + ')';

		},

		//put graphics in graphicsCache object to easily grab them in-game

		graphicsRender: function(){

			Visuals.addColorData();

			var i;

			for(i in colorData){

				graphicsCache[i + 'Ex'] = Visuals.explGraphic(colorData[i].expl, 100);
				graphicsCache[i + 'Blur'] = Visuals.lensflareGraphic(colorData[i].blur, 350);
				graphicsCache[i + 'BlurS'] = Visuals.lensflareGraphic(colorData[i].blur, 175);
				graphicsCache[i + 'Charge'] = Visuals.lensflareGraphic(colorData[i].blur, 60);
				graphicsCache[i + 'Particle'] = Visuals.electronGraphic(colorData[i].electron, 10);

			}

		  graphicsCache["neutron"] = Visuals.electronGraphic({r: 240, g: 240, b: 255}, 20);

			Visuals.setGrid();

		},

		/*

		load all image assets (only background as of now)

		*/

		imgLoader: function(){

		  //set the LoadQueue and add the listeners

		  Visuals.loader = new createjs.LoadQueue(true, "/client/img/");

		  Visuals.loader.on("fileload", Visuals.handleLoad, this);
		  Visuals.loader.on("complete", Visuals.openScreen, this);

		  //start loading

		  Visuals.loader.loadManifest([

				{

					id: "blue",
				  src: "blue.svg",
					type: createjs.Types.IMAGE

				},

				{

					id: "red",
				  src: "red.svg",
					type: createjs.Types.IMAGE

				},

				{

					id: "purple",
				  src: "purple.svg",
					type: createjs.Types.IMAGE

				},

				{

					id: "green",
				  src: "green.svg",
					type: createjs.Types.IMAGE

				},

				{

					id: "lightblue",
				  src: "lightblue.svg",
					type: createjs.Types.IMAGE

				},

				{

					id: "orange",
				  src: "orange.svg",
					type: createjs.Types.IMAGE

				},

				{

					id: "gold",
				  src: "gold.svg",
					type: createjs.Types.IMAGE

				}

			]);

		},

		handleLoad: function(event){

			imageCache[event.item.id] = event.result;

		},

		setGrid: function(){

			var linesNeeded = Game.arenaSize / 250, i, j;

			for(i = 0; i < linesNeeded; i++){

				var xLine = new createjs.Shape();
				containers.mapHolder.addChild(xLine);
				xLine.graphics.beginFill("rgba(255,255,255,.1)").drawRect(1, 1, 1, Game.arenaSize);
				xLine.x = (i * 250);

				var yLine = new createjs.Shape();
				containers.mapHolder.addChild(yLine);
				yLine.graphics.beginFill("rgba(255,255,255,.1)").drawRect(1, 1, Game.arenaSize, 1);
				yLine.y = (i * 250);

			}

		},

		setupCanvas: function(){

			//container object, containing containers

			containers = {

				//parent containers

				gameHolder: new createjs.Container(), //will move with main player
				hud: new createjs.Container(), 				//will remain stationary

				//children of gameHolder

				nameHolder: new createjs.Container(),
				electronHolder: new createjs.Container(),
				playerHolder: new createjs.Container(),
				neutronHolder: new createjs.Container(),
				fxHolder: new createjs.Container(),
				mapHolder: new createjs.Container()

			};

			//actual canvases
			//set gameCanvas background color for optimization

			$("#gameCanvas").css("backgroundColor", Game.backgroundColor);

			gameStage = new createjs.Stage("gameCanvas");
			cacheStage = new createjs.Stage("hudCanvas");
			//titleStage = new createjs.Stage("titleCanvas");

			gameStage.addChild(containers.gameHolder, containers.hud);

			//containers go in order to ensure layering is correct
			//first ones added will be bottom, last ones will be top

			containers.gameHolder.addChild(

					containers.mapHolder,
				  containers.playerHolder,
				 	containers.electronHolder,
					containers.neutronHolder,
				  containers.nameHolder,
					containers.fxHolder

			);

			Visuals.textInit();

		},

		openScreen: function(){

		 $(".loading").hide();

		 socket.emit('imgLoaded');

		 setTimeout(function(){

			 GameUI.toggleScreen(GameUI.mainMenu, 500);

			// Visuals.titleAnimation();

			//init();

			setTimeout(function(){

				$(".title-class").toggleClass("title-scale");

			}, 200);

		 }, 300);

		 setTimeout(function(){

			 //dont let them join until intro fade is over

			 Game.available = true;

		 }, 1300);

		 Game.currentScreen = 0;

	 },

		lensFlareFx: function(src, xc, yc){

			var blurImg = new createjs.Shape(src);
			blurImg.alpha = 0;
			containers.fxHolder.addChild(blurImg);

			blurImg.x = xc;
			blurImg.y = yc;

			createjs.Tween.get(blurImg)
			  .to({alpha: .75}, 250, createjs.Ease.linear);

			setTimeout(function(){

			  createjs.Tween.get(blurImg)
			    .to({alpha: 0}, 250, createjs.Ease.linear);

		 	}, 750);

			setTimeout(function(){

			  createjs.Tween.removeTweens(blurImg);
				containers.fxHolder.removeChild(blurImg);

			}, 1500);

		},

		explosion: function(expl){

		    createjs.Tween.get(expl)
		      .to({scaleX: 1.5, scaleY: 1.5, alpha: .8}, 200, createjs.Ease.linear)
		      	.to({scaleX: 2, scaleY: 2, alpha: .5}, 500, createjs.Ease.linear)
				      .to({scaleX: 2.25, scaleY: 2.25, alpha: 0}, 600, createjs.Ease.cubicOut);

		    setTimeout(function(){

		      createjs.Tween.removeTweens(expl);

		    }, 1500);

		},

		explosionS: function(expl){

		    createjs.Tween.get(expl)
		      .to({scaleX: .75, scaleY: .75, alpha: .8}, 200, createjs.Ease.linear)
		      	.to({scaleX: 1.25, scaleY: 1.25, alpha: .5}, 500, createjs.Ease.linear)
				      .to({scaleX: 1.75, scaleY: 1.75, alpha: 0}, 600, createjs.Ease.cubicOut);

		    setTimeout(function(){

		      createjs.Tween.removeTweens(expl);

		    }, 1500);

		},

		playerExplosion: function(data, sourcePlayer){

			var i, explArray = new Array(3);

			var tempObj = Visuals.getExplosionGraphics(sourcePlayer.color);

			var expl = tempObj.expl, blur = tempObj.blur;

		  for(i = 0; i < 3; i++){

		    explArray[i] = new createjs.Shape(expl);

		    explArray[i].scaleX = explArray[i].scaleY = 0;
		    explArray[i].alpha = 0;

		    containers.fxHolder.addChild(explArray[i]);

		  }

		  for(i = 0; i < 3; i++){

		    explArray[i].x = data[i].xc;
		    explArray[i].y = data[i].yc;

		    Visuals.explosion(explArray[i]);

		  }

		  var avgX = (data[0].xc + data[1].xc + data[2].xc) / 3;
		  var avgY = (data[0].yc + data[1].yc + data[2].yc) / 3;

		  Visuals.lensFlareFx(blur, avgX, avgY);

		  setTimeout(function(){

		    for(i = 0; i < 3; i++){

		      containers.fxHolder.removeChild(explArray[i]);

		    }

		  }, 1000);

		},

		fadeImg: function(img, alpha, time){

			createjs.Tween.get(img).to({alpha: alpha}, time, createjs.Ease.linear);

			setTimeout(function(){

				//remove tween after a second

				createjs.Tween.removeTweens(img);

			}, time);

		},

		fadeText: function(text, time, alpha){

			createjs.Tween.removeTweens(text);

			createjs.Tween.get(text).to({alpha: alpha}, time, createjs.Ease.cubicOut);

		},

		orbitIncreaseAnimation: function(){

				var time = 3600;

			  //reset text fields

			  textFields["scoreAmount"].y =  Game.yMax/10;
				textFields["scoreAmount"].x =  Game.xMax/1.025;
				textFields["scoreAmount"].alpha = .75;

			  //remove tweens

			  createjs.Tween.removeTweens(textFields["scoreAmount"]);

			  //call tweens

			  createjs.Tween.get(textFields["scoreAmount"]).to({y: Game.yMax/4, x: Game.xMax/1.025, alpha: 0}, time, createjs.Ease.cubicOut);

		},

		textInit: function(){

			Visuals.createTextObj();

			var i, font = "20px " + Game.font;

			//generate textfields/hud

			for(i in textFields){

				//this is default for all textfields, will be reassigned later

				textFields[i] = new createjs.Text("", font, "#FFFFFF");

				containers.hud.addChild(textFields[i]);

			}

			textFields["orbit"].textAlign = textFields["fps"].textAlign = textFields["latency"].textAlign = textFields["scoreAmount"].textAlign = "right";
			textFields["userAlert"].textAlign = "center";

			//assigning text constants (alpha values, text, color, etc)

			textFields["orbit"].text = 0 + " / " + 5;

			//leaderboard text constants

			textFields["scoreAmount"].color = "#1DB000";
			textFields["mainPlayer"].color = "#00D1FF";

			textFields["fps"].alpha = textFields["latency"].alpha = textFields["orbit"].alpha = .35;

			textFields["mainPlayer"].alpha = .75;



			textFields["leaderboard"] = [];
			var leaderBoardArr = textFields["leaderboard"];

			for(i = 0; i < 10; i++){

				leaderBoardArr.push(new createjs.Text("", font, "#FFFFFF"));
				leaderBoardArr[i].alpha = .65;

				containers.hud.addChild(leaderBoardArr[i]);

			}

			//cache

			Visuals.addToCache();

		},

		createTextObj: function(){

			textFields = {

				orbit: 0,
				scoreAmount: 0,
				playerFirst: 0,
			 	playerSecond: 0,
			 	playerThird: 0,
				mainPlayer: 0,
				playerOnlineLabel: 0,
				playersOnline: 0,
				userAlert: 0,
				fps: 0,
				latency: 0,
				title: 0,

			};

		},

		addToCache: function(){

			//all text fields to cache (ones that don't/rarely change)

			var textManifest = [

				textFields["orbit"],
				textFields["lives"],
				textFields["liveTitle"],
				textFields["playerFirst"],
				textFields["playerSecond"],
				textFields["playerThird"],
				textFields["mainPlayer"]

			];

			var txt = textManifest.length, i;

			for(i = 0; i < txt; i++){

				containers.hud.removeChild(textManifest[i]);

				cacheStage.addChild(textManifest[i]);

			}

		},

		titleAnimation: function(){

			textFields["title"].text = 'orb tals.io';
			textFields["title"].font = "6em " + Game.font;
			textFields["title"].x = titleStage.canvas.width/2;
			textFields["title"].y = 20;
			textFields["title"].textAlign = "center";

			textFields["title"].scale = 3;
			textFields["title"].alpha = 0;
			textFields["title"].regY = 10;

			containers.hud.removeChild(textFields["title"]);
			titleStage.addChild(textFields["title"]);

			createjs.Tween.get(textFields["title"])
				.wait(700)
				.to({scale: 1}, 800, createjs.Ease.cubicOut);

			createjs.Tween.get(textFields["title"])
				.wait(1000)
				.to({alpha: 1}, 1600, createjs.Ease.cubicOut);

		},

		updateOrbit: function(){

			if(players[Game.main].orbitMax === 100){

				textFields["orbit"].text = players[Game.main].orbitCount + " / 100 (MAX)";

			} else {

				textFields["orbit"].text = players[Game.main].orbitCount + " / " + players[Game.main].orbitMax;

			}

			//turn text field green if orbit is full

			if(players[Game.main].orbitCount === players[Game.main].orbitMax){

				textFields["orbit"].color = "#1FE291";
				textFields["orbit"].alpha = .75;

			} else {

				textFields["orbit"].color = "#FFFFFF";
				textFields["orbit"].alpha = .35;

			}

			cacheStage.update();

		},

		setBounds: function(){

			//draw red boundary lines

			var i;

			var bounds = new Array(4);

			for(i = 0; i < 4; i++){

				bounds[i] = new createjs.Shape();
				containers.mapHolder.addChild(bounds[i]);

			}

			//can use size of arena for width of bounds as well

			//top & bottom (horizontal)

			bounds[0].graphics.beginFill("rgba(255,255,255,.1)").drawRect(0, 0, 2, Game.arenaSize);
			bounds[1].graphics.beginFill("rgba(255,255,255,.1)").drawRect(0, 0, 2, Game.arenaSize);

			//right & left (vertical)

			bounds[2].graphics.beginFill("rgba(255,255,255,.1)").drawRect(0, 0, Game.arenaSize, 2);
			bounds[3].graphics.beginFill("rgba(255,255,255,.1)").drawRect(0, 0, Game.arenaSize, 2);

			//placement

			bounds[1].x = Game.arenaSize;
			bounds[3].y = Game.arenaSize;

		},
/*
		getNotificationData: function(data){

			var msg;

			switch(data[0]){

			 case 0:

			    //player has left

			    var name = data[1], count = data[2];

			    if(name === ""){ name = "An unnamed player"; }

			    msg = name + " has left the game, " + count + " / 10 players online";

			  break;

			  case 1:

			    //player has joined

			    var name = data[1], count = data[2];

			    if(name === ""){ name = "An unnamed player"; }

			    msg = name + " has joined the game, " + count + " / 10 players online";

			  break;

			  case 2:

			    //player was eliminated by another player

			   var elimName = data[1], hitName = data[2];

			    if(elimName === ""){ elimName = "An unnamed player"; }
			    if(hitName === ""){ hitName = "An unnamed player"; }

			    msg = elimName + " has eliminated " + hitName;

			  break;

			  case 3:

			    //player eliminated by accident (by themselves)

			    var hitName = data[1];

			    if(hitName === ""){ hitName = "An unnamed player"; }

			    msg = hitName + " was eliminated";

			  break;

			}

			Visuals.appendNotification(msg);

		},

		appendNotification: function(msg){

			Visuals.moveNotifications();

			var newNotif = new createjs.Text(msg, "14px Helvetica", "#FFFFFF");
			newNotif.x = Game.xMax/24;
			newNotif.y = Game.yMax/1.2;
			newNotif.alpha = .25;

			//just as a backup, double check settings

			if(settings.showNotifications){

			  containers.hud.addChild(newNotif);

			  //before we add the new one, lets get rid of the oldest one (at index 0)
			  //that is, if there is five already in the array (5 is the arbitrary limit of notifications)

			  if(notifications.length >= 5){

			    containers.hud.removeChild(notifications[0]);
			    notifications.splice(0, 1);

			  }

			  //push new one to end

			  notifications.push(newNotif);

			}

		},

		moveNotifications: function(){

			//bump all notifications up to make room for the new one

			if(notifications.length){

				var n = (notifications.length - 1), i;

				for(i = n; i >= 0; i--){

					var yc = notifications[i].y - 25, fade = notifications[i].alpha * .6;

					createjs.Tween.get(notifications[i]).to({y: yc, alpha: fade}, 250, createjs.Ease.linear);

				}

			}

		},
*/
		colorToString: function(color){

			switch(color){

				case 0: return "blue";

				case 1: return "red";

				case 2: return "purple";

				case 3: return "green";

				case 4: return "lightblue";

				case 5: return "orange";

				case 6: return "gold";

				default: return "blue";

			}

		},

		/*

			source graphics getters

			first, convert color parameter (number) to a string
			then concatanate string with another string to get id of graphics
			in graphicsCache object

		*/

		getPlayerImage: function(color){

			var colorString = Visuals.colorToString(color);

			return imageCache[colorString];

		},

		getElectronGraphics: function(color){

			var colorString = Visuals.colorToString(color),
					idString = colorString + "Particle";

			return graphicsCache[idString];

		},

		getSmallExplosionGraphics: function(color){

			var colorString = Visuals.colorToString(color),
					idExplString = colorString + "Ex",
					idBlurString = colorString + "BlurS";

			return {

				expl: graphicsCache[idExplString],
				blur: graphicsCache[idBlurString]

			};

		},

		getExplosionGraphics: function(color){

			var colorString = Visuals.colorToString(color),
					idExplString = colorString + "Ex",
					idBlurString = colorString + "Blur";

			return {

				expl: graphicsCache[idExplString],
				blur: graphicsCache[idBlurString]

			};

		},

		getCSSColor: function(color){

			var colorObj = Visuals.getRGBA(color);

			var string = 'rgba(' + colorObj.r + ',' + colorObj.g + ',' + colorObj.b + ',1)';

			console.log(string);

			return string;

		},

		getRGBA: function(color){

			var colorString = Visuals.colorToString(color);

			var colorObj = colorData[colorString].electron;

			return {

				r: colorObj.r,
				g: colorObj.g,
				b: colorObj.b

			};

		}

	};
