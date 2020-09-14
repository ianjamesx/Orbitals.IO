
var game = require('./app.js');
var Neutron = require('./neutron.js');

module.exports = class Bot {

  constructor(id, server){

    /* game & coordinate data */

		this.xc = 1000;
		this.yc = 1000;
		this.dx = 0;
		this.dy = 0;
    this.alive = false;
    this.maxSpeed = 360;
    this.mouseX = 0;
    this.mouseY = 0;

    this.xRange = 1060;
    this.yRange = 640;
    this.xNative = 1920;
    this.yNative = 1080;
    this.zoom = 1;
    this.proximityIncrement = 14;
    this.speedIncrement = 3;

    this.id = id;
    this.server = server;
    this.name = 'bot';
    this.color = Math.floor(Math.random() * 7);
    this.notify = false;
    this.bot = true;
    this.willRespawn = true;

    this.arenaSize = game.getArenaSize(server);
    this.orbitalDistances = game.getDistanceArr(server);

    this.electronProxim = {};
    this.orbit = {};
    this.orbitData = [];
    this.proxRadius = 125;
    this.maxOrbit = 10;
    this.inOrbit = 0;

    this.intervals = {};

    //set suedo-methods and properties

    this.socket = {

      emit: function(msgName, msg){},
      send: function(msg){}

    };

    this.neutronRange = function(){};

    this.neutronProxim = {};
    this.enemProx = {};

  }

  randomMouse(){

    var xMax = Math.trunc(Math.random() * (960/2));
    var yMax = Math.trunc(Math.random() * (540/2));

    var xVal = Math.random() * (Math.random() < 0.5 ? -1 : 1);
    var yVal = Math.random() * (Math.random() < 0.5 ? -1 : 1);

    this.mouseX = xMax * xVal;
    this.mouseY = yMax * yVal;

    this.calcDeltas();

  }

  calcPosition(){

    var now = Date.now();

    this.delta = now - this.lastUpdate;

    this.lastUpdate = now;

    this.movePlayer();

  }

  calcDeltas(){

    var radians = Math.atan2(this.mouseY, this.mouseX), speed;

    var mouseDistX = Math.abs(this.mouseX / (1920/4));
    var mouseDistY = Math.abs(this.mouseY / (1080/4));

    if(mouseDistX > 1){ mouseDistX = 1; }
    if(mouseDistY > 1){ mouseDistY = 1; }

    var xSpd = mouseDistX * this.maxSpeed;
    var ySpd = mouseDistY * this.maxSpeed;
    xSpd > ySpd ? speed = xSpd : speed = ySpd;

    this.dx = Math.cos(radians) * speed;
    this.dy = Math.sin(radians) * speed;

    this.dx = Math.trunc(this.dx);
    this.dy = Math.trunc(this.dy);

  }

  movePlayer(deltaSpeed){

    //do not allow player to move in direction if it is out of bounds

    var arbitraryFrame = 1000/66;

    var xDelta = this.dx * (this.delta/1000);
    var yDelta = this.dy * (this.delta/1000);

    xDelta = Math.trunc(xDelta);
    yDelta = Math.trunc(yDelta);

    if(!((this.xc + xDelta + 25) > this.arenaSize || (this.xc + xDelta - 25) < 0)){

      this.xc += xDelta;

    } else {

      this.dx = -this.dx;

    }

    if(!((this.yc + yDelta + 25) > this.arenaSize || (this.yc + yDelta - 25) < 0)){

      this.yc += yDelta;

    } else {

      this.dy = -this.dy;

    }

  }

  add(){

    //new position

    var newPosition = this.findRespawnPosition(),
        newX,
        newY;

    if(newPosition){

      newX = newPosition.xc,
      newY = newPosition.yc;

      this.xc = newX;
      this.yc = newY;

      this.electronProxim = {};

      this.randomMouse();

      setTimeout(() => {

        if(game.playerExists(this.server, this.id)){

          this.alive = true;
          this.resumeIntervals();

        }

      }, 500);

    } else {

      //we couldn't find a valid spot, lets try again in a second

      setTimeout(() => {

        this.add();

      }, 3000);

    }

  }

  findRespawnPosition(){

    var oldX = this.xc,
        oldY = this.yc;

    var i, locationObj;

    for(i = 0; i < 50; i++){

      locationObj = this.randomizeSpawnPoint(oldX, oldY, i);

      //if we get back a -1, return undefined
      //this will postpone the respawning since we couldn't find any spots

      //if we get something, and its not -1, then break loop and continue

      if(locationObj === -1){

        return;

      } else if(locationObj){

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

    var standard,
        spawnRange = this.arenaSize - 1000,
        newX = Math.trunc(Math.random() * spawnRange) + 500,
        newY = Math.trunc(Math.random() * spawnRange) + 500;

    if(iterations < 48){

      standard = !(this.checkEnemiesNearSpawnPoint(newX, newY));

    } else {

      //we've tried too many times, there are possibly no free spaces, return a -1
      //to symbolize a pause in the respawn

      return -1

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

    //reset data to defaults

    this.dx = this.dy = this.inOrbit = 0;
    this.maxOrbit = 5;
    this.maxSpeed = 360;
    this.proximityIncrement = 14;
    this.orbit = {};
    this.orbitData = [];

    this.pauseIntervals();

    setTimeout(() => {

      if(this.willRespawn){

        this.add();

      } else {

        this.removeFromServer();

      }

    }, 2000);

  }

  clearElectrons(){

    var i, es = game.getElectronList(this.server), eArr = [];

    for(i in this.orbit){

      var index = i * 1;

      es[index].orbitTangent();
      es[index].free();

      eArr.push([index, es[index].xc, es[index].yc, es[index].dx, es[index].dy]);

    }

    if(eArr.length){

      game.serverAlert(this.server, 'free', eArr);

    }

  }

  electronRange(){

    var es = game.getElectronList(this.server), i;
    var e = es.length;

    var proximity = this.getProximityObj();

    for(i = 0; i < e; i++){

      if(this.proximityCheck(proximity, es[i])){

        if(typeof this.electronProxim[i] === 'undefined'){

          this.cacheElectron(i, true);

        }

      } else {

        if(typeof this.electronProxim[i] !== 'undefined'){

          this.removeElectron(i);

        }

      }

    }

  }

  cacheElectron(index, cacheInObj){

    var electron = game.getElectron(this.server, index);

    if(cacheInObj){

      this.electronProxim[index] = index;

    }

  }

  removeElectron(index){

    delete this.electronProxim[index];

  }

  electronHitCheck(){

    var i, es = game.getElectronList(this.server);

    for(i in this.electronProxim){

      if(es.length){

        if(this.getDistance(this.xc, this.yc, es[i].xc, es[i].yc) < this.proxRadius){

          if(typeof this.orbit[i] === 'undefined'){

            this.putElectronInOrbit(i);

          }

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

  putElectronInOrbit(i){

    if(this.maxOrbit > this.inOrbit && this.alive){

      if(this.availCheck(i)){

        var electron = game.getElectron(this.server, i);

        electron.orbit(this.id);

        this.orbit[i] = i;

        this.inOrbit++;

        this.maxSpeed -= this.speedIncrement;

        this.sortElectronsByDistance(electron, true);

        this.proxRadius = this.orbitalDistances[this.inOrbit] || this.orbitalDistances[74];

      }

    }

  }

  sortElectronsByDistance(electron, push){

    var i;

    if(push){

      this.orbitData.push({

        index: electron.index,
        dist: electron.dist,

      });

    } else {

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

    var i,
        electrons = game.getElectronList(this.server),
        l = this.orbitData.length,
        sendArr = [];

    for(i = 0; i < l; i++){

      var electron = electrons[this.orbitData[i].index];

      var oldDist = electron.dist;

      electron.dist = this.orbitalDistances[i];

      electron.getDirIncrement();

      this.orbitData[i].dist = this.orbitalDistances[i];

      sendArr.push(

        electron.index,
        electron.dist,
        electron.dirIncrement

      );

    }

    var binaryArray = this.convertArrayToINT16(sendArr);

    game.enemyAlert(this.server, 'fixDist', binaryArray, this.id);

  }

  pauseIntervals(){

    //intervals that pause when player dies

    clearInterval(this.intervals.calcPositionInterval);
    clearInterval(this.intervals.electronHitInterval);
    clearInterval(this.intervals.electronRangeInterval);

  }

  resumeIntervals(){

    this.lastUpdate = Date.now();

    this.intervals.calcPositionInterval = setInterval(() => this.calcPosition(), 1000/66);
    this.intervals.electronHitInterval = setInterval(() => this.electronHitCheck(), 1000/66);
    this.intervals.electronRangeInterval = setInterval(() => this.electronRange(), 1000/2);

  }

  clearIntervals(){

    var i;

    for(i in this.intervals){

      clearInterval(this.intervals[i]);

    }

  }

  removeFromServer(){

    game.removeBot(this.id, this.server);

  }

  playerExplosion(){

    var explArray = [], i;

    var newX = Math.trunc(this.xc);
    var newY = Math.trunc(this.yc);

    explArray.push({

        xc: newX,
        yc: newY

      });

    for(i = 0; i < 2; i++){

      explArray.push({

        xc: Math.trunc(newX - (Math.random() * 350) + 150),
        yc: Math.trunc(newY + (Math.random() * 350) - 150)

      });

    }

    explArray.push(this.id);

    game.selectiveServerAlert(this.server, 'plExpl', explArray, this.xc, this.yc);

  }


  getProximityObj(proximity){

    var plyrPosX, plyrNegX, plyrNegY, plyrPosY;

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

    if(proximityObject.pnx < comparisonObject.xc &&
       comparisonObject.xc < proximityObject.ppx &&
       proximityObject.pny < comparisonObject.yc &&
       comparisonObject.yc < proximityObject.ppy){

      return true;

    }

    return false;

  }

  hitTest(x1, y1, r1, x2, y2, r2){

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

    if(game.getElectron(this.server, eIndex).origin === -1){

      return true;

    } else {

      return false;

    }

  }

  checkElectronsNearSpawnPoint(xc, yc){

    var i, es = game.getElectronList(this.server), e = es.length, inRange = false;

    var negX = xc - 300, posX = xc + 300;
    var negY = yc - 300, posY = yc + 300;

    for(i = 0; i < e; i++){

      if(es[i].xc  > negX && es[i].xc < posX
        && es[i].yc > negY && es[i].yc < posY){

          inRange = true;

      }

    }

    return inRange;

  }

  checkEnemiesNearSpawnPoint(xc, yc){

    var i, players = game.getServer(this.server), tooClose = false;

    var proximity = this.getProximityObj(500);

    for(i in players){

      if(i !== this.id){

        //exclude bots

        if(players[i].alive && !players[i].bot){

          if(this.proximityCheck(proximity, players[i])){

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

      this.newNeutronOnServer(neutron);

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

  convertArrayToINT16(array){

    var s = array.length, i;

    var buffer = new ArrayBuffer(s * 2);
    var dataView = new Int16Array(buffer);

    for(i = 0; i < s; i++){

      dataView[i] = Math.trunc(array[i]);

    }

    return dataView;

  }

}
