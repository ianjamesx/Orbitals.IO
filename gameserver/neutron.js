
var game = require('./app.js');

module.exports = class Neutron {

  constructor(xc, yc, dx, dy, server, id, hitValue){

    this.xc = xc;
    this.yc = yc;
    this.dx = dx;
    this.dy = dy;
    this.server = server;
    this.id = id;
    this.hitValue = hitValue
    this.locals = {};
    this.arenaSize = game.getArenaSize(server);

  }

  init(){

    this.lastUpdate = Date.now();

    this.hitTest = setInterval(() => this.collisions(), 1000/66);
    this.deltaFree = setInterval(() => this.mainMove(), 1000/66);

  }

  randomizeSpawn(){

    var spawnRange = this.arenaSize - 1000;
    this.xc = Math.round(Math.random() * spawnRange) + 100;
    this.yc = Math.round(Math.random() * spawnRange) + 100;

  }

  randomizeDelta(){

    var dxTemp = Math.random() * (Math.random() < 0.5 ? -1 : 1);
    var dyTemp = Math.random() * (Math.random() < 0.5 ? -1 : 1);
    this.dx = (Math.round(dxTemp * 100) / 100) * 66;
    this.dy = (Math.round(dyTemp * 100) / 100) * 66;

  }

  mainMove(){

    var now = Date.now();

    this.delta = now - this.lastUpdate;
    this.lastUpdate = now;

    var xDelta = this.dx * (this.delta/1000);
    var yDelta = this.dy * (this.delta/1000);

    //update after we have the delta

    this.deltaMove(xDelta, yDelta);

  }

  deltaMove(xDelta, yDelta){

    //movement when not in pull

    this.xc += xDelta;
    this.yc += yDelta;

    var inBound = true;

    //keep in bounds

    if(this.xc < 0 || this.xc > this.arenaSize){

      this.dx = -this.dx;
      this.boundLoc++;
      inBound = false;

    }

    if(this.yc < 0 || this.yc > this.arenaSize){

      this.dy = -this.dy;
      this.boundLoc++;
      inBound = false;

    }

    //if object is still in bound, it is NOT stuck behind a wall

    if(inBound){

      this.boundLoc = 0;

    }

    //if it has been out of bound more more than 22 frames, assume its stuck
    //refresh it

    if(this.boundLoc > 22){

      this.refresh();

    }

  }

  collisions(){

    //console.log('n-0');

    var players = game.getServer(this.server), i,
        proximity = this.getProximityObj(250, 250);

    for(i in players){

      if(players[i].alive){

        if(this.proximityCheck(proximity, players[i])){

          //if they come close to a neutron, delete it and increase players orbit

          if(this.playerRange(players[i])){

            //100 is max orbit

            if(players[i].maxOrbit < 100){

              if(players[i].maxOrbit + this.hitValue > 100){

                this.hitValue = (players[i].maxOrbit + this.hitValue) - 100;

              }

              players[i].maxOrbit += this.hitValue;

              if(players[i].maxOrbit > 100){

                players[i].maxOrbit = 100;

              }

              players[i].socket.emit('maxOrbit', [

                players[i].maxOrbit,
                this.hitValue

              ]);

              //since its a proximity check and not a hittest, send the id of player as well,
              //animate player absorbing neutron

              game.neutronAlert(this.server, 'nDel', [this.id, players[i].id], this.id);

              this.refresh();

            }

          }

        }

      }

    }

  }

  refresh(){

    var neutrons = game.getNeutrons(this.server);

    //limit server to 50 neutrons

    if(Object.keys(neutrons).length < 50){

      this.randomizeDelta();
      this.boundLoc = 0;
      this.hitValue = 1;

      //clear all intervals

      this.clearAllIntervals();

      var distant = true, limit = 0;

      do {

        distant = this.findNewLocation();

        //give 100 tries before we give up and just spawn anywhere

        limit++;

      } while(!distant && limit < 100);

      //once we have new location, restart intervals

      this.init();

    } else {

      this.clear();

    }

  }

  findNewLocation(){

    //respawn at random point on map

    var spawnRange = this.arenaSize - 1000;

    this.xc = Math.round(Math.random() * spawnRange) + 100;
    this.yc = Math.round(Math.random() * spawnRange) + 100;

    //make sure it wont spawn on any other players

    var proximity = this.getProximityObj(700, 500);

    var i, distant = true, players = game.getServer(this.server);

    for(i in players){

      if(this.proximityCheck(proximity, players[i])){

        distant = false;

      }

    }

    return distant;

  }

  clear(){

    var ns = game.getNeutrons(this.server), i, index;

    delete ns[this.id];

    this.clearAllIntervals();

  }

  clearAllIntervals(){

    clearInterval(this.hitTest);
    clearInterval(this.deltaFree);

  }

  playerRange(player){

    //if within 100 x 100 of a player
    //that player will absorb neutron

    var proximityObj = this.getProximityObj(100, 100);

    if(this.proximityCheck(proximityObj, player)){

      return true;

    } else {

      return false;

    }

  }

  getProximityObj(xProximity, yProximity){

    var plyrNegX = this.xc - xProximity,
        plyrPosX = this.xc + xProximity,
        plyrNegY = this.yc - yProximity,
        plyrPosY = this.yc + yProximity;

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

}
