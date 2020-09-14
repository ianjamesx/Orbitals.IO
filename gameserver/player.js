
var game = require('./app.js');
var Neutron = require('./neutron.js');

module.exports = class Player {

  constructor(id, socket, server){

    /* game & coordinate data */

		this.xc = 1000;
		this.yc = 1000;
		this.dx = 0;
		this.dy = 0;
    this.alive = false;
    this.maxSpeed = 360;

    this.mouseX = 0;
    this.mouseY = 0;

    this.xMax = 1920;
    this.yMax = 1080;

    this.xRange = 1060;
    this.yRange = 640;

    //this.xVR = 1920;
    //this.yVR = 1080;

    this.xNative = 1920;
    this.yNative = 1080;

    this.resScale = 1;
    this.zoom = 1;
    this.proximityIncrement = 14;
    this.speedIncrement = 2.6;

    /* identification data */

    this.id = id;
    this.server = server;
    this.socket = socket;
    this.name = "";
    this.color = 0;
    this.notify = false;

    /* server info */

    this.arenaSize = game.getArenaSize(server);

    /* stats */

    this.allKills = 0;
    this.allElectrons = 0;
    this.largestOrbit = 0;
    this.topPlace = 25;
    this.startTime = 0;
    this.leaderboardPlace = -1;

    /* all intervals will be in this object */

    this.intervals = {};

    /* electron data */

    //indexes of electrons which are close (within xRange and yRange) of player\
    //ids of neutrons close to player

    this.electronProxim = {};
    this.neutronProxim = {};

    //indexes of electrons which are in players orbit

    this.orbit = {};

    //array of objects containing id and distance of all electrons in orbit
    //sorted by closest to furthest

    this.orbitData = [];

    this.orbitalDistances = game.getDistanceArr(server);

    //radius of which electrons must be within in order to enter a players orbit
    //will increase when player acquires more electrons, will decrease when electrons are released

    this.proxRadius = 125;

    //maximium amount of electrons allowed in orbit, and current amount of electrons in orbit

    this.maxOrbit = 5;
    this.inOrbit = 0;

    //indexes of enemies of which are in range of the player

    this.enemProx = {};

    //flags, gaming is for if player has started playing (once they have, initial intervals are run)
    //allowReq is for if the player is allowed to be readded to game

    this.gaming = false;
    this.allowReq = true;

  }

  //adding player attributes (name and color)

  addAttributes(data){

    //only let them change color or their name if they're dead (main menu or respawn menu)

    if(!this.alive && typeof data.name === 'string' && typeof data.color === 'number'){

      var name = data.name, color = data.color, i;

    	if(name.length > 33){

    		this.name = name.substring(0, 30) + "...";

    	} else {

    		this.name = name;

    	}

      this.specialUserNames();

      //verify color (only options, 0 - 6)

      var valid;

      for(i = 0; i < 7; i++){

        if(color === i){

          valid = true;

          break;

        }

      }

      if(valid){

        this.color = color;

      } else {

        //default to blue (0) if their color is invalid

        this.color = 0;

      }

    //  this.setResolutionScale(data.quality);
    //  this.setVirtualResolution();

    }

  }

  specialUserNames(){

    if(this.name === 'serverinfo'){

      var playerCount = game.getTotalPlayerCount();
      var serverCount = game.getTotalServerCount();

      var sendString = 'servers: ' + serverCount + ' - players: ' + playerCount;

      this.socket.emit('info', sendString);

    }

  }

  setResolution(data){

    if(typeof data.xMax === 'number' && typeof data.yMax === 'number'){

      // max resolution: 1920x1080

      if(data.xMax > this.xNative){

        data.xMax = this.xNative;

      }

      if(data.yMax > this.yNative){

        data.yMax = this.yxNative;

      }

      if(data.xMax < 1){

        data.xMax = 1;

      }

      if(data.yMax < 1){

        data.yMax = 1;

      }

      this.xMax = data.xMax;
      this.yMax = data.yMax;

      //this.setVirtualResolution();

      if(this.alive){

        this.setZoom();

        this.socket.emit('zoom', this.zoom);

     } else {

       //set zoom, but dont default to 1

       this.setZoom(this.zoom);

       this.setRange();

     }

    }

  }

/*

  setResolutionScale(quality){

    switch(quality){

      case 0:

        this.resScale = 1;

      break;

      case 1:

        this.resScale = .66;

      break;

      case 2:

        this.resScale = .44;

      break;

      default:

        this.resScale = 1;

    }

  }

*/

  setRange(){

    /*

      x and y range, used for proximity testing
      half the x and y max, with an extra 1/4 of the max value
      added to have some head room (in case of latency or some delay in interval)

    */

    var xRes = this.xMax, yRes = this.yMax;

    var zoom = (1 / this.zoom);// * (this.resScale);

    var xView = ((xRes/2) * zoom) - xRes/2,
        yView = ((yRes/2) * zoom) - yRes/2;

    this.xRange = (xRes/2) + xView + 250,
    this.yRange = (yRes/2) + yView + 250;

  }

  setVirtualResolution(){

    //if user lowers quality, will lower their screen resolution
    //however, we scale out thier game canvas, so we want to keep the
    //same native resolution as other players

    this.xVR = this.xMax * (1/this.resScale),
    this.yVR = this.yMax * (1/this.resScale);

    if(this.xVR > this.xNative){ this.xVR = this.xNative; }
    if(this.yVR > this.yNative){ this.yVR = this.yNative; }

  }

  handleInput(binData){

    var xm, ym;

    xm = binData[0];
    ym = binData[1];

    if(typeof xm === 'number' && typeof ym === 'number'){

      //since screen resolution is capped to 1920x1080
      //maximum location of mouse could be x or y resolution divided by 2

      var xMouseMax = this.xNative / 2,
          yMouseMax = this.yNative / 2;

      if(xm > xMouseMax){ xm = xMouseMax; }
      if(ym > yMouseMax){ ym = yMouseMax; }
      if(xm < -xMouseMax){ xm = -xMouseMax; }
      if(ym < -yMouseMax){ ym = -yMouseMax; }

      this.mouseX = xm;
      this.mouseY = ym;

    }

  }

  calcPosition(){

    /*  note:

        each time method or variable has term 'delta'
        implies framerate independency

        so instead of calculating pixels per frame
        calculates pixel per second and time since last frame

    */

    var now = Date.now();

    this.delta = now - this.lastUpdate;

    this.lastUpdate = now;

    var delta = this.maxSpeed * (this.delta/1000);

    this.movePlayer(delta);

  }

  movePlayer(deltaSpeed){

    var radians = Math.atan2(this.mouseY, this.mouseX), speed;

    //divide canvas-style grid by fourths
    //the reason canvas is divided into fourths is to divide canvas
    //into two boxes, if mouse is more than half the canvas width or height
    //from player, move at max speed (absX or absY = 1)

    //if mouse is closer to player, slow down

    var mouseDistX = Math.abs(this.mouseX / (this.xMax/4));
    var mouseDistY = Math.abs(this.mouseY / (this.yMax/4));

    if(mouseDistX > 1){ mouseDistX = 1; }
    if(mouseDistY > 1){ mouseDistY = 1; }

    //find best speed (depending on if mouseX or mouseY is further)

    var xSpd = mouseDistX * deltaSpeed;
    var ySpd = mouseDistY * deltaSpeed;
    xSpd > ySpd ? speed = xSpd : speed = ySpd;

    this.dx = Math.cos(radians) * speed;
    this.dy = Math.sin(radians) * speed;

    this.roundDeltas();

    //do not allow player to move in direction if it is out of bounds

    if(!((this.xc + this.dx + 25) > this.arenaSize || (this.xc + this.dx - 25) < 0)){

      this.xc += this.dx;

    }

    if(!((this.yc + this.dy + 25) > this.arenaSize || (this.yc + this.dy - 25) < 0)){

      this.yc += this.dy;

    }

  }

  roundDeltas(){

    //trunc for optimization

    this.dx = Math.trunc(this.dx);
    this.dy = Math.trunc(this.dy);

  }

  add(){

    //set some properies to default here instead of in reset

    this.allowReq = false;

    this.proxRadius = 125;
    this.zoom = 1;// * this.resScale;
    this.setRange();

    //new position

    var newPosition = this.findRespawnPosition(),
        newX = newPosition.xc,
        newY = newPosition.yc;

    this.xc = newX;
    this.yc = newY;

    //reset proximity object before re-initializing electrons

    this.electronProxim = {};
    this.neutronProxim = {};

    //send client coordinates, and init array of electron, neutron, and enemy data

    this.socket.emit('newPos', [

      this.xc,
      this.yc,
      this.electronInit(),
      this.neutronInit(),
      this.enemyInit(),
      Date.now()

    ]);

    //put on slight delay

    setTimeout(() => {

      if(game.playerExists(this.server, this.id)){

        this.startTime = Date.now();
        this.alive = true;
        this.resumeIntervals();

      }

    }, 250);

  }

  findRespawnPosition(){

    var oldX = this.xc,
        oldY = this.yc;

    /*

    getSpawnPoint methods have different standards

    standards will depend on parameter i (iterations of loop)

    every 100 iterations, it will assume high standards are impossible
    and lower standards for new respawn position

    */

    var i, locationObj;

    for(i = 0; i < 200; i++){

      locationObj = this.randomizeSpawnPoint(oldX, oldY, i);

      //break out once we get on object

      if(locationObj){

        break;

      }

    }

    var newX = locationObj.xc,
        newY = locationObj.yc;

    return {

      xc: newX,
      yc: newY,

    };

  }

  randomizeSpawnPoint(oldX, oldY, iterations){

    var standard, spawnRange = this.arenaSize - 1000,
        newX = Math.trunc(Math.random() * spawnRange) + 500,
        newY = Math.trunc(Math.random() * spawnRange) + 500;

    //standard 1 - no enemies, no electrons
    //standard 2 - no electrons
    //fallback - just return something if on final iteration

    if(iterations < 100){

      standard = !(this.checkElectronsNearSpawnPoint(newX, newY)) &&
                 !(this.checkEnemiesNearSpawnPoint(newX, newY));

    } else if(iterations >= 100 && iterations < 198){

      standard = !(this.checkElectronsNearSpawnPoint(newX, newY));

    } else {

      standard = true;

    }

    if(standard){

      return {

        xc: newX,
        yc: newY,

      };

    }

  }

  resetPlayer(){

    this.clearElectrons();
    this.notifyEnemies();

    //reset data to defaults

    this.allowReq = true;
    this.dx = this.dy = this.inOrbit = 0;
    this.maxOrbit = 5;
    this.maxSpeed = 360;
    this.proximityIncrement = 14;
    this.orbit = {};
    this.orbitData = [];

    this.pauseIntervals();
    this.sendPlayerStats();
    this.resetStats();

  }

  resetStats(){

    this.allKills = 0;
    this.allElectrons = 0;
    this.largestOrbit = 0;
    this.topPlace = 25;
    this.startTime = 0;

    this.leaderboardPlace = 25;

  }

  notifyEnemies(){

    var i, playerList = game.getServer(this.server);

    for(i in playerList){

      var player = playerList[i];

      if(typeof player.enemProx[this.id] !== 'undefined'){

        player.removeEnem(this.id);

      }

    }

  }

  sendPlayerStats(){

    var timeAlive = Date.now() - this.startTime;

    var stats = {

      timeAlive: timeAlive,
      atoms: this.allKills,
      maxOrbit: this.largestOrbit,
      place: this.topPlace,

    }

    this.socket.emit('dead', stats);

  }

  setLeaderboardPlace(place){

    this.leaderboardPlace = place;

    if(this.leaderboardPlace < this.topPlace){

      this.topPlace = this.leaderboardPlace;

    }

  }

  compareMaxOrbit(){

    if(this.inOrbit > this.largestOrbit){

      this.largestOrbit = this.inOrbit;

    }

  }

  clearElectrons(){

    //clear electrons

    var i, es = game.getElectronList(this.server), eArr = [];

    for(i in this.orbit){

      //force cast

      var index = i * 1;

      //when freeing an electron with no input energy, release it on an orbit tangent

      es[index].orbitTangent();
      es[index].free();

      eArr.push([

        index,
        es[index].xc,
        es[index].yc,
        es[index].dx,
        es[index].dy

      ]);

    }

    if(eArr.length){

      game.serverAlert(this.server, 'free', eArr);

    }

    game.clearSenderId(this.server, this.id);

  }

  //main player data

  emitPlyrData(){

    var arr = [

      this.xc,
      this.yc,
      Date.now() //include a time stamp for lag interpolation

    ];

    this.socket.send(arr);

  }

  /*

  enemies

  */

  checkEnemiesNearby(){

    //proximity check

    var proximity = this.getProximityObj();
    var i, players = game.getServer(this.server);

    for(i in players){

      if(i != this.id){

        var player = players[i];

        if(player.alive){

          //proximity detection and electron check (we check electrons in enemies orbit as well because when an electron
          //is within a players screen in an enemies orbit, and there is no enemy to use as a anchor point the electron will glitch out)

            if(this.proximityCheck(proximity, player) || this.enemElectron(this.id, i, this.server)){

              //the player has met requirements to be on the client, see if we have it on client yet

              if(typeof this.enemProx[i] === 'undefined'){

                //we dont, put it on clients object and send data to create enemy to client

                this.enemProx[i] = i;

                this.socket.emit('enemConst', [

                  player.name,
                  player.color,
                  player.id,
                  player.xc,
                  player.yc

                ]);

              }

            //remove from array if enemy is not in range, not alive, or not defined

            } else {

              this.removeEnem(i);

            }

          } else {

            this.removeEnem(i);

          }

        }

      }

      //send updates for enemies in enemProx

    this.sendEnemyData();

  }

  sendEnemyData(){

    var i, players = game.getServer(this.server);

    //if theres at least one player in proximity (in enemProx object)

    if(Object.keys(this.enemProx).length && players){

      //push date for latency tracking

      var sendArr = [Date.now()];

      for(i in this.enemProx){

        var player = players[i];

        if(player){

          sendArr.push(player.xc, player.yc, player.id);

        }

      }

      this.socket.emit('enem', sendArr);

    }

  }

  removeEnem(id){

    //remove an enemy from proximity object

    if(typeof this.enemProx[id] !== 'undefined'){

      delete this.enemProx[id];

      this.socket.emit('delPl', id);

    }

  }

  consoleSomething(){

    //just used for debugging

  }

  electronInit(){

    /*

    send initial packet of electron data

    */

    var es = game.getElectronList(this.server), initArr = [], i;
    var e = es.length;

    //proximity check

    var proximity = this.getProximityObj();

    for(i = 0; i < e; i++){

      if(this.proximityCheck(proximity, es[i])){

        var eArr = this.electronDataArray(es[i]);

        //put array into initArr, we will send back 2d array
        //also put electron in proximity object

        initArr.push(eArr);
        this.electronProxim[i] = i;

      }

    }

    return initArr;

  }

  neutronInit(){

    //send initial packet of neutron data

    var ns = game.getNeutrons(this.server), initArr = [], i;

    //players proximity check

    var proximity = this.getProximityObj();

    for(i in ns){

      if(this.proximityCheck(proximity, ns[i])){

        var nArr = [

            ns[i].xc,
            ns[i].yc,
            ns[i].dx,
            ns[i].dy,
            ns[i].id

          ];

        initArr.push(nArr);
        this.neutronProxim[i] = i;

      }

    }

    return initArr;

  }

  enemyInit(){

    var players = game.getServer(this.server), initArr = [], i;

    //players proximity check

    var proximity = this.getProximityObj();

    for(i in players){

      if(this.proximityCheck(proximity, players[i])){

        if(players[i].id !== this.id){

          var pArr = [

              players[i].name,
              players[i].color,
              players[i].id,
              players[i].xc,
              players[i].yc

            ];

          this.enemProx[i] = i;
          initArr.push(pArr);

        }

      }

    }

    return initArr;

  }

  electronRange(){

    /*

    interval to check if an electron has come into range of player
    runs pretty slowly (every 500ms)

    */

    //get electron array

    var es = game.getElectronList(this.server), i;
    var e = es.length;

    //players proximity check

    var proximity = this.getProximityObj();

    for(i = 0; i < e; i++){

      if(this.proximityCheck(proximity, es[i])){

        //its proximal, see if the players proximity object does not contain it

        if(typeof this.electronProxim[i] === 'undefined'){

          //if they don't, then send data to construct it

          this.cacheElectron(i, true);

        }

      } else {

        //if its out of range, and its in the object, delete it

        if(typeof this.electronProxim[i] !== 'undefined'){

          this.removeElectron(i);

        }

      }

    }

  }

  neutronRange(){

    /*

    interval to check if a neutron has come into range of player

    */

    //get electron array

    var ns = game.getNeutrons(this.server), i;

    //players proximity check

    var proximity = this.getProximityObj();

    for(i in ns){

      if(this.proximityCheck(proximity, ns[i])){

        //its proximal, see if the players proximity object does not contain it

        if(typeof this.neutronProxim[i] === 'undefined'){

          //if they don't, then send data to construct it

          this.cacheNeutron(ns[i], true);

        }

      } else {

        //if its out of range, and its in the object, delete it

        if(typeof this.neutronProxim[i] !== 'undefined'){

          this.removeNeutron(i);

        }

      }

    }

  }

  cacheNeutron(neutron, cacheInObj){

    if(cacheInObj){

      this.neutronProxim[neutron.id] = neutron.id;

    }

    var nArr = [

      neutron.xc,
      neutron.yc,
      neutron.dx,
      neutron.dy,
      neutron.id

    ];

    this.socket.emit('newNeutron', nArr);

  }

  removeNeutron(id){

    //deleting from player proximity object, then delete on client side

    delete this.neutronProxim[id];

    this.socket.emit('nDel', [id, -1]);

  }

  sendAllElectronData(){

    //send positions of all electrons in local array to client
    //this also runs slowly (every 1000ms)

    var i, sendArr = [], es = game.getElectronList(this.server);

    for(i in this.electronProxim){

      var electron = es[i];

      sendArr.push(electron.index, electron.xc, electron.yc);

    }

    if(sendArr.length > 0){

      var binaryArray = this.convertArrayToINT16(sendArr);

      this.socket.emit('ele', binaryArray);

    }

  }

  sendAllNeutronData(){

    //send positions of all electrons in local array to client\
    //this also runs slowly (every 1000ms)

    var i, sendArr = [], ns = game.getNeutrons(this.server);

    for(i in this.neutronProxim){

      var neutron = ns[i];

      sendArr.push(neutron.id, neutron.xc, neutron.yc);

    }

    if(sendArr.length > 0){

      var binaryArray = this.convertArrayToINT16(sendArr);

      this.socket.emit('nUpd', binaryArray);

    }

  }

  //send data to construct electron on client
  //and (maybe) cache electron in proxim object

  cacheElectron(index, cacheInObj){

    var electron = game.getElectron(this.server, index);
    var eArr = this.electronDataArray(electron);

    //we dont push the electron into the players proximity array if client asks for constructor
    //electron is already in array, we just need to send it to client again due to network error

    if(cacheInObj){

      this.electronProxim[index] = index;

    }

    this.socket.emit('eleConst', eArr);

  }

  electronDataArray(electron){

    //return an appropriate array for client based on electron passed
    //see if the electron has an owner

    var eArr;

    if(electron.origin === -1 || electron.origin === -2){

      //no owner (free)

      eArr = [

        electron.xc,
        electron.yc,
        electron.dx,
        electron.dy,
        electron.index,
        electron.color

      ];

    } else {

      //owner, we will need more data regarding electrons rotation

      eArr = [

        electron.xc,
        electron.yc,
        electron.dx,
        electron.dy,
        electron.index,
        electron.dirIncrement,
        electron.cw,
        electron.dist,
        electron.dir,
        electron.origin,
        electron.color

      ];

    }

    return eArr;

  }

  removeElectron(index){

    //deleting from player proximity object, then delete on client side

    delete this.electronProxim[index];

    this.socket.emit('eleDel', index);

  }

  electronHitCheck(){

    //will check for collisions with electrons on fast interval (66hz)

    var i, es = game.getElectronList(this.server);

    //go through proximity object

    for(i in this.electronProxim){

      if(es.length){

        //check electrons within proximity radius

        if(this.getDistance(this.xc, this.yc, es[i].xc, es[i].yc) < this.proxRadius){

          //its in our proximity radius, see if its already in orbit object

          if(typeof this.orbit[i] === 'undefined'){

            this.putElectronInOrbit(i);

          }

          //check for collisions with electrons

          if(this.hitTest(this.xc, this.yc, 25, es[i].xc, es[i].yc, 10)){

            if(this.alive){

              this.playerHitElectron(es[i]);

            }

          }

        }

      }

    }

  }

  playerHitElectron(electron){

    //see if electron has an owner (not including this)

    if(this.accurateCollision(electron)){

      if(electron.sendId !== -1 && electron.sendId !== this.id){

        var enemPlayer = game.getPlayer(this.server, electron.sendId);

        if(enemPlayer){

          if(!enemPlayer.bot){

            enemPlayer.allKills++;

          }

        }

      }

      this.alive = false;

      //reset main player

      this.dropNeutron();
      this.playerExplosion();
      this.resetPlayer();

    }

  }

  accurateCollision(electron){

    if(typeof this.electronProxim[electron.index] !== 'undefined'){

      return true;

    }

    return false;

  }

  putElectronInOrbit(i){

    //make sure theres room in orbit, and player is alive

    if(this.maxOrbit > this.inOrbit && this.alive){

      //ensure electron is available (not in other players orbits)

      if(this.availCheck(i)){

        //electron is now captured in orbit

        var electron = game.getElectron(this.server, i);

        electron.orbit(this.id);

        this.orbit[i] = i;

        //increase orbit count and proximity radius

        this.inOrbit++;

        this.maxSpeed -= this.speedIncrement;

        this.allElectrons++;

        this.sortElectronsByDistance(electron, true);

        this.proxRadius = this.orbitalDistances[this.inOrbit] || this.orbitalDistances[99];

        //zoom out a little bit to show more map space

        this.setZoom();

        this.socket.emit('electronObtained', [this.maxSpeed, this.zoom]);

        this.compareMaxOrbit();

      }

    }

  }

  sortElectronsByDistance(electron, push){

    var i;

    //either push or remove electron from orbitData
    //push will be passed as true if we're adding electron

    if(push){

      this.orbitData.push({

        index: electron.index,
        dist: electron.dist,

      });

    } else {

      //push is passed as false, we're removing one, find it by index first

      for(i = 0; i < this.orbitData.length; i++){

        if(this.orbitData[i].index === electron.index){

          this.orbitData.splice(i, 1);

        }

      }

    }

    this.orbitData.sort(function(a, b) {

      return a.dist - b.dist;

    });

    this.setProperDistances();

  }

  setProperDistances(){

    var i, l = this.orbitData.length,
        electrons = game.getElectronList(this.server),
        sendArr = [];

    /*

    orbitData contains electrons data objects with their index and distance from origin player

    basically, what we want to do is set electrons their pre-determined
    distances in orbit, according to orbitalDistances array

    orbitData array is already sorted, so we just assign them
    to value in orbitalDistances linearly

    */

    for(i = 0; i < l; i++){

      var electron = electrons[this.orbitData[i].index];

      var oldDist = electron.dist;

      electron.dist = this.orbitalDistances[i];

      //modify directional increment to suit new distance

      electron.getDirIncrement();

      this.orbitData[i].dist = this.orbitalDistances[i];

      sendArr.push(

        electron.index,
        electron.dist,
        electron.dirIncrement

      );

    }

    //convert sending array to unsigned 16 byte array

    var binaryArray = this.convertArrayToINT16(sendArr);

    this.socket.emit('fixDist', binaryArray);

    game.enemyAlert(this.server, 'fixDist', binaryArray, this.id);

  }

  convertArrayToINT16(array){

    var s = array.length, i;

    var buffer = new ArrayBuffer(s * 2);
    var dataView = new Int16Array(buffer);

    for(i = 0; i < s; i++){

      dataView[i] = Math.trunc(array[i]);

    }

    return dataView;

  }

  sendOrbitData(){

    var i, sendArr = [this.inOrbit], es = game.getElectronList(this.server);

    for(i in this.orbit){

      var electron = es[i];

      sendArr.push(electron.index, electron.xc, electron.yc, electron.dir);

    }

    if(sendArr.length){

      var binaryArray = this.convertArrayToINT16(sendArr);

      this.socket.emit('orbitUpdate', binaryArray);

    }

  }

  fire(){

    //verify they have electrons to begin with

    if(this.inOrbit){

      var closestIndex = this.closestElectronToMouse();
      var closestElectron = game.getElectron(this.server, closestIndex);

      //fire, then take it out of orbit array

      closestElectron.fire(this.dx, this.dy);

      delete this.orbit[closestIndex];
      this.inOrbit--;
      this.maxSpeed += this.speedIncrement;

      //zoom back in a little, and decrease x and y ranges

      this.sortElectronsByDistance(closestElectron, false);

      this.setZoom();

      this.proxRadius = this.orbitalDistances[this.inOrbit];

      this.socket.emit('electronFired', [this.maxSpeed, this.inOrbit, this.zoom]);

    }

  }

  closestElectronToMouse(){

    //finding closest electron to mouse

    var i,
        localIndex = 0,
        es = game.getElectronList(this.server),

    //find mouse position relative to player

        newMX = this.xc + this.mouseX * (1/this.zoom),
        newMY = this.yc + this.mouseY * (1/this.zoom),

    //default to first electron

        closestIndex = this.orbit[Object.keys(this.orbit)[0]],
        defElectron = es[closestIndex],
        bestDist = this.getDistance(newMX, newMY, defElectron.xc, defElectron.yc);

    //compare values from default electron to all other electrons in orbit

    for(i in this.orbit){

      var nextElectron = es[i],
          tempDist = this.getDistance(newMX, newMY, nextElectron.xc, nextElectron.yc);

      if(tempDist < bestDist){

        bestDist = tempDist;
        closestIndex = i;

      }

    }

    return closestIndex;

  }

  setZoom(optionalZoom){

    //if an optional zoom is passed

    if(optionalZoom){

      this.zoom = optionalZoom;

    } else {

      //no zoom passed, calculate their zoom

      if(this.inOrbit){

        var farthestIndex = this.orbitData[this.inOrbit - 1].index,
            electron = game.getElectron(this.server, farthestIndex);

        this.checkOrbitalDistances(electron.dist);

      } else {

        //no electrons, reset to default zoom

        this.zoom = 1;// * this.resScale;

      }

    }

  }

  checkOrbitalDistances(distance){

    //first find if x or y is shorter to find minimum viewing distance

    var currentZoom = this.zoom;

    var xViewingDistance = (this.xMax/2),
        yViewingDistance = (this.yMax/2),
        viewingDistance = xViewingDistance < yViewingDistance ?
                          xViewingDistance : yViewingDistance;

    var newZoom = (viewingDistance / (distance + 200));// * this.resScale;

    //only zoom if the new zooming is noticable
    //if its less than 7.5% zoom, just ignore it

    if(Math.abs(newZoom - currentZoom) > .075){

      this.zoom = newZoom;

    }

    //limit zooming in to 100%, zooming out to 26%

    if(this.zoom > 1){

      this.zoom = 1;

    }

    if(this.zoom < .26){

      this.zoom = .26;

    }

    this.setRange();

  }


  /*

  players intervals

  */

  constantlyRunningIntervals(){

    //intervals that run constantly
    //Hz passed, when player is in-game, intervals run fast
    //when player is at menu, intervals run slowly

    this.initIntervalsRunning = true;

    this.intervals.electronRangeInterval = setInterval(() => this.electronRange(), 1000/4);
    this.intervals.neutronRangeInterval = setInterval(() => this.neutronRange(), 1000/4);
    this.intervals.enemyInterval = setInterval(() => this.checkEnemiesNearby(), 1000/25);

  }

  pauseIntervals(){

    //intervals that pause when player dies

    clearInterval(this.intervals.calcPositionInterval);
    clearInterval(this.intervals.electronHitInterval);
    clearInterval(this.intervals.playerEmitInterval);
    clearInterval(this.intervals.orbitSend);
    clearInterval(this.intervals.electronEmitInterval);
    //clearInterval(this.intervals.neutronEmitInterval);
    clearInterval(this.intervals.consoleInterval);

  }

  resumeIntervals(){

    //set the last update to now before we call calcPosition()

    this.lastUpdate = Date.now();

    //use arrow functions for intervals as we are calling members of the player class

    this.intervals.calcPositionInterval = setInterval(() => this.calcPosition(), 1000/66);
    this.intervals.electronHitInterval = setInterval(() => this.electronHitCheck(), 1000/66);
    this.intervals.playerEmitInterval = setInterval(() => this.emitPlyrData(), 1000/20);
    this.intervals.orbitSend = setInterval(() => this.sendOrbitData(), 1000);
    this.intervals.electronEmitInterval = setInterval(() => this.sendAllElectronData(), 2500);
    //this.intervals.neutronEmitInterval = setInterval(() => this.sendAllNeutronData(), 2500);
    this.intervals.consoleInterval = setInterval(() => this.consoleSomething(), 2000);

  }

  clearIntervals(){

    //player left, clear all their intervals

    var i;

    for(i in this.intervals){

      clearInterval(this.intervals[i]);

    }

  }

  playerExplosion(){

    var explArray = [], i;

    var newX = Math.trunc(this.xc);
    var newY = Math.trunc(this.yc);

    //generate one planned and two random coordinates around player, push into array

    explArray.push({

        xc: newX,
        yc: newY

      });

    //push expl from two different funcs into array

    for(i = 0; i < 2; i++){

      explArray.push({

        xc: Math.trunc(newX - (Math.random() * 350) + 150),
        yc: Math.trunc(newY + (Math.random() * 350) - 150)

      });

    }

    //add exploding players id to end of explArray

    explArray.push(this.id);

    game.selectiveServerAlert(this.server, 'plExpl', explArray, this.xc, this.yc);

  }

  /*

  misc. logic

  */

  getProximityObj(proximity){

    //get object with different proximity values

    var plyrPosX, plyrNegX, plyrNegY, plyrPosY;

    //player will pass proximity if its checking specific prox radius

    if(proximity){

      plyrNegX = this.xc - proximity;
      plyrPosX = this.xc + proximity;
      plyrNegY = this.yc - proximity;
      plyrPosY = this.yc + proximity;

    } else {

      plyrNegX = this.xc - this.xRange;
      plyrPosX = this.xc + this.xRange;
      plyrNegY = this.yc - this.yRange;
      plyrPosY = this.yc + this.yRange;

    }

    return {

      pnx: plyrNegX,
      ppx: plyrPosX,
      pny: plyrNegY,
      ppy: plyrPosY

    };

  }

  proximityCheck(proximityObject, comparisonObject){

    //see if comparisonObject is within range of proximityObject

    if(proximityObject.pnx < comparisonObject.xc &&
       comparisonObject.xc < proximityObject.ppx &&
       proximityObject.pny < comparisonObject.yc &&
       comparisonObject.yc < proximityObject.ppy){

      return true;

    }

    return false;

  }

  hitTest(x1, y1, r1, x2, y2, r2){

    //circular collision detection

    var distance = this.getDistance(x1, y1, x2, y2);

    if (distance < r1 + r2) {

      return true;

    } else {

      return false;

    }

  }

  getDistance(x1, y1, x2, y2){

    var dx = x1 - x2,
        dy = y1 - y2;

    return Math.sqrt((dx * dx) + (dy * dy));

  }

  availCheck(eIndex){

    //check electrons origin, -1 signifies that its available

    if(game.getElectron(this.server, eIndex).origin === -1){

      return true;

    } else {

      return false;

    }

  }

  checkElectronsNearSpawnPoint(xc, yc){

    /*

    ensure spawn location of player isnt too close or colliding with electron

    */

    var i, es = game.getElectronList(this.server), e = es.length, inRange = false;

    var negX = xc - 300, posX = xc + 300;
    var negY = yc - 300, posY = yc + 300;

    for(i = 0; i < e; i++){

      if(es[i].xc  > negX && es[i].xc < posX
        && es[i].yc > negY && es[i].yc < posY){

          //if there is one within in range, it will collide

          inRange = true;

      }

    }

    //return true or false

    return inRange;

  }

  checkEnemiesNearSpawnPoint(xc, yc){

    /*

    ensuring that spawn location of a player is not
    too close to an enemy which is already alive

    */

    var i, players = game.getServer(this.server), tooClose = false;

    var proximity = this.getProximityObj(500);

    for(i in players){

      if(i !== this.id){

        if(players[i].alive){

          if(this.proximityCheck(proximity, players[i])){

              //if there is one within in range, it may be too dangerous

              tooClose = true;

          }

        }

      }

    }

    return tooClose;

  }

  dropNeutron(){

    var i, m = Math.trunc(this.maxOrbit / 5);
    if(m > 5){ m = 5; }

    for(i = 0; i < m; i++){

      var id = Math.random();

      var neutronWorth = Math.floor(Math.random() * 4);

      if(neutronWorth <= 0){ neutronWorth = 1; }

      var neutron = new Neutron(this.xc, this.yc, 0, 0, this.server, id, neutronWorth);

      neutron.randomizeDelta();
      neutron.init();

      //alert players

      this.newNeutronOnServer(neutron);

      //finally, put into object

      var ns = game.getNeutrons(this.server);
      ns[id] = neutron;

    }

  }

  newNeutronOnServer(neutron){

    var i, players = game.getServer(this.server);

    for(i in players){

      players[i].neutronRange();

    }

  }

  enemElectron(p1, p2, serv){

    /*

      We want to see if at least one electron in this players proximity array is
      in the orbit array of the other player we are comparing

      if so, then we need to send data of the comparing player to this player
      so the movement of the electron looks smooth on the client

      this is because movement of an electron in orbit requires information on the
      player it is orbiting, without this, the electron will stutter

    */

    //this player is playerOne, retrieve playerTwo to get their orbit array

    var playerTwo = game.getPlayer(serv, p2), i;
    var p1Prox = this.electronProxim, p2Orb = playerTwo.orbit;
    var included = false;

    for(i in p2Orb){

      //if p1 proximity array has at least one in p2 orbit array

      if(typeof p1Prox[i] !== 'undefined'){

        included = true;

      }

    }

    return included;

  }

}
